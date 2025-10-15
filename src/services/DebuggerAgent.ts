/**
 * @file DebuggerAgent.ts
 * @description The specialist agent for debugging and error consultation.
 * It uses the RepoEvalTool for high-level analysis and will be expanded
 * to handle deep code analysis workflows.
 */

// This would be provided by the Cloudflare Agents SDK
import { DurableObject } from "cloudflare:workers";
class McpAgent extends DurableObject {
    // MCP-specific logic would go here
}

import { RepoEvalTool } from '../tools/RepoEvalTool';

export class DebuggerAgent extends McpAgent {
    private repoEvalTool: RepoEvalTool;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.repoEvalTool = new RepoEvalTool(env);
        // Expose tool methods to MCP server
    }
}