import { DynamicAgent } from './DynamicAgent';
import { GitHubAgent } from '../services/GitHubAgent';
import { DebuggerAgent } from '../services/DebuggerAgent';
import { BestPracticesAgent } from '../services/BestPracticesAgent';

export { DynamicAgent, GitHubAgent, DebuggerAgent, BestPracticesAgent };

interface Env {
    DYNAMIC_AGENT: DurableObjectNamespace;
    // Other agent bindings will be used by the DynamicAgent
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Serve static assets from the /public directory
        if (url.pathname.startsWith('/public/')) {
            return env.ASSETS.fetch(request);
        }
        if (url.pathname === '/openapi.json') {
             return env.ASSETS.fetch(new Request(new URL('/public/openapi.json', request.url), request));
        }

        // Route all other requests to the DynamicAgent
        try {
            const id = env.DYNAMIC_AGENT.idFromName("singleton");
            const stub = env.DYNAMIC_AGENT.get(id);
            return await stub.fetch(request);
        } catch (e) {
            console.error("Error fetching from DynamicAgent DO:", e);
            return new Response("Internal Server Error", { status: 500 });
        }
    },
};