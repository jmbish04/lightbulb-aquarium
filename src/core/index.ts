import { DynamicAgent } from './DynamicAgent';
import { GitHubAgent } from '../services/GitHubAgent';
import { DebuggerAgent } from '../services/DebuggerAgent';
import { BestPracticesAgent } from '../services/BestPracticesAgent';
import { D1Tool } from '../tools/D1Tool';
import { D1Database } from '@cloudflare/workers-types';

export { DynamicAgent, GitHubAgent, DebuggerAgent, BestPracticesAgent };

interface Env {
    DYNAMIC_AGENT: DurableObjectNamespace;
    GITHUB_AGENT: DurableObjectNamespace;
    DEBUGGER_AGENT: DurableObjectNamespace;
    BEST_PRACTICES_AGENT: DurableObjectNamespace;
    ASSETS: { fetch(request: Request): Promise<Response> };
    DB: D1Database;
}

type SpecialistBinding = 'GITHUB_AGENT' | 'DEBUGGER_AGENT' | 'BEST_PRACTICES_AGENT';

async function invokeSpecialistAgent(env: Env, bindingName: SpecialistBinding, tool: string, params: any) {
    const namespace = env[bindingName];
    if (!namespace || typeof namespace.get !== 'function') {
        throw new Error(`Specialist agent binding not found: ${bindingName}`);
    }
    const id = namespace.newUniqueId();
    const stub = namespace.get(id);
    const request = new Request('https://specialist/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, params })
    });
    const response = await stub.fetch(request);
    if (!response.ok) {
        throw new Error(`Specialist agent returned ${response.status}: ${await response.text()}`);
    }
    return await response.json();
}

function jsonResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/api/')) {
            try {
                if (request.method === 'POST' && url.pathname === '/api/github/fork-plan') {
                    const body = await request.json();
                    const result = await invokeSpecialistAgent(env, 'GITHUB_AGENT', 'forkAndPlan', body);
                    return jsonResponse(result);
                }

                if (request.method === 'POST' && url.pathname === '/api/github/create-pr') {
                    const body = await request.json();
                    const result = await invokeSpecialistAgent(env, 'GITHUB_AGENT', 'createPrFromTask', body);
                    return jsonResponse(result);
                }

                if (request.method === 'POST' && url.pathname === '/api/github/research') {
                    const body = await request.json();
                    const result = await invokeSpecialistAgent(env, 'GITHUB_AGENT', 'startGithubResearch', body);
                    return jsonResponse(result);
                }

                if (request.method === 'POST' && url.pathname === '/api/admin/init-db') {
const d1 = new D1Tool({ DB: env.DB });
                    await d1.init_schema('DB');
                    return jsonResponse({ success: true });
                }

                if (request.method === 'GET' && url.pathname === '/api/memory/projects') {
                    const d1 = new D1Tool(env as any);
                    const { results } = await d1.query('DB', `
                        SELECT p.*, plans.plan AS plan_json
                        FROM development_projects p
                        LEFT JOIN development_project_plans plans ON plans.project_id = p.id
                        ORDER BY p.created_at DESC
                        LIMIT 20
                    `);
                    return jsonResponse({ projects: results ?? [] });
                }

                if (request.method === 'GET' && url.pathname === '/api/memory/errors') {
                    const d1 = new D1Tool(env as any);
                    const { results } = await d1.query('DB', `
                        SELECT * FROM error_consultations
                        ORDER BY created_at DESC
                        LIMIT 20
                    `);
                    return jsonResponse({ consultations: results ?? [] });
                }

                if (request.method === 'GET' && url.pathname === '/api/memory/research') {
                    const d1 = new D1Tool(env as any);
                    const { results } = await d1.query('DB', `
                        SELECT * FROM research_briefs
                        ORDER BY created_at DESC
                        LIMIT 20
                    `);
                    return jsonResponse({ briefs: results ?? [] });
                }

                return jsonResponse({ error: 'Not Found' }, 404);
            } catch (error) {
                console.error('API request failed', error);
                return jsonResponse({ error: error.message }, 500);
            }
        }

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
