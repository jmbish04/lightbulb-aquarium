/**
 * @file DebuggerAgent.ts
 * @description The specialist agent for debugging and error consultation.
 * It uses the RepoEvalTool for high-level analysis and searches an internal
 * knowledge base before escalating to more complex analysis.
 */

import { DurableObject } from "cloudflare:workers";
import { RepoEvalTool } from '../tools/RepoEvalTool';
import { D1Tool } from '../tools/D1Tool';

// Mock of the Cloudflare Agents SDK's McpAgent
class McpAgent extends DurableObject {
    protected env: any;
    protected tools: Record<string, Function> = {};
    constructor(state: DurableObjectState, env: any) { super(state, env); this.env = env; }
    async fetch(request: Request): Promise<Response> {
        if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
        const { tool, params } = await request.json();
        if (this.tools[tool]) {
            const result = await this.tools[tool](params);
            return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        }
        return new Response("Tool not found", { status: 404 });
    }
}

export class DebuggerAgent extends McpAgent {
    private repoEvalTool: RepoEvalTool;
    private d1Tool: D1Tool;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.repoEvalTool = new RepoEvalTool(env);
        this.d1Tool = new D1Tool(env);

        this.tools['consultOnError'] = this.consultOnError.bind(this);
        this.tools['reportFixStatus'] = this.reportFixStatus.bind(this);
    }

    /**
     * @description The main entrypoint for error consultation. It performs a multi-step
     * analysis, starting with a knowledge base search and escalating if necessary.
     * @param {{ error_message: string, stack_trace?: string, code_snippet?: string, repo_url?: string }} params
     * @returns {Promise<object>} An object containing the analysis and suggested fix.
     */
    async consultOnError(params: { error_message: string, stack_trace?: string, code_snippet?: string, repo_url?: string }): Promise<object> {
        const { error_message, repo_url } = params;
        const consultationId = crypto.randomUUID();

        // 1. Log the initial consultation request in D1
        await this.d1Tool.insert('DB', 'error_consultations', { id: consultationId, error_message, ...params });

        // 2. Search internal knowledge base (D1) for similar, previously solved errors
        const { results } = await this.d1Tool.query('DB',
            `SELECT * FROM error_consultations WHERE error_message LIKE ? AND status = 'fixed' LIMIT 1`,
            [`%${error_message.substring(0, 50)}%`]
        );

        if (results && results.length > 0) {
            const previousFix = results[0];
            await this.d1Tool.query('DB', `UPDATE error_consultations SET status = 'resolved_from_kb', analysis = ?, suggested_fix = ? WHERE id = ?`,
                [previousFix.analysis, previousFix.suggested_fix, consultationId]);
            return { status: "resolved_from_kb", analysis: previousFix.analysis, suggested_fix: previousFix.suggested_fix };
        }

        // 3. If no match, perform high-level repo evaluation if a URL is provided
        let repoAnalysis = {};
        if (repo_url) {
            const [_, owner, repo] = new URL(repo_url).pathname.split('/');
            if (owner && repo) {
                repoAnalysis = await this.repoEvalTool.evaluateRepository(owner, repo);
            }
        }

        // 4. Escalate to deep analysis (placeholder for now)
        const analysis = "No similar errors found in knowledge base. Escalating to deep analysis. Repo evaluation attached.";
        await this.d1Tool.query('DB', `UPDATE error_consultations SET status = 'analyzing', analysis = ? WHERE id = ?`,
                [JSON.stringify({ initial: analysis, repo_eval: repoAnalysis }), consultationId]);

        return { status: "analyzing", message: analysis, repo_evaluation: repoAnalysis };
    }

    /**
     * @description Allows a user or another agent to report the status of a fix.
     * @param {{ consultation_id: string, status: 'fixed' | 'unresolved', fix_details: string }} params
     * @returns {Promise<{success: boolean}>}
     */
    async reportFixStatus(params: { consultation_id: string, status: 'fixed' | 'unresolved', fix_details: string }): Promise<{success: boolean}> {
        const { consultation_id, status, fix_details } = params;
        await this.d1Tool.query('DB', `UPDATE error_consultations SET status = ?, suggested_fix = ? WHERE id = ?`,
            [status, fix_details, consultation_id]);
        return { success: true };
    }
}