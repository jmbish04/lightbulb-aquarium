/**
 * @file BestPracticesAgent.ts
 * @description The specialist agent responsible for providing expert guidance on software
 * development best practices. It uses the "Agent Fan-Out and Judging" pattern via the
 * GuidanceTool to ensure high-quality responses.
 */

import { DurableObject } from "cloudflare:workers";
import { GuidanceTool } from '../tools/GuidanceTool';

// Mock of the Cloudflare Agents SDK's McpAgent
class McpAgent extends DurableObject {
    protected env: any;
    protected tools: Record<string, Function> = {};

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        this.env = env;
    }

    // This simulates the MCP server's invoke logic.
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

export class BestPracticesAgent extends McpAgent {
    private guidanceTool: GuidanceTool;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.guidanceTool = new GuidanceTool(env);
        // Expose the high-level tool to the MCP server
        this.tools['getGuidance'] = this.getGuidance.bind(this);
    }

    /**
     * @description High-level service method that orchestrates the fan-out/judging
     * pattern to get the best possible guidance for a topic.
     * @param {{ topic: string, candidate_count?: number }} params - The parameters for the guidance request.
     * @returns {Promise<string>} The vetted, best-practice guidance.
     */
    async getGuidance(params: { topic: string, candidate_count?: number }): Promise<string> {
        if (!params.topic) {
            throw new Error("The 'topic' parameter is required.");
        }
        return this.guidanceTool.getGuidance(params.topic, params.candidate_count);
    }
}