import { DynamicAgent } from './DynamicAgent';
import { D1Tool } from '../tools/D1Tool';
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

// API routes for specialist agents
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

                if (request.method === 'GET' && url.pathname === '/api/memory/best-practices') {
                    const d1 = new D1Tool(env as any);
                    const { results } = await d1.query('DB', `
                        SELECT * FROM best_practices
                        ORDER BY created_at DESC
                        LIMIT 50
                    `);
                    return jsonResponse({ bestPractices: results ?? [] });
                }

                if (request.method === 'POST' && url.pathname === '/api/memory/best-practices') {
                    const body = await request.json();
                    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
                    const guidance = typeof body.guidance === 'string' ? body.guidance.trim() : '';
                    const source = typeof body.source === 'string' ? body.source.trim() : undefined;

                    if (!topic || !guidance) {
                        return jsonResponse({ error: 'Topic and guidance are required.' }, 400);
                    }

                    const d1 = new D1Tool(env as any);
                    const bestPractice = {
                        id: crypto.randomUUID(),
                        topic,
                        guidance,
                        source: source || null
                    };
                    await d1.insert('DB', 'best_practices', bestPractice);
                    const { results } = await d1.query('DB', `
                        SELECT * FROM best_practices WHERE id = ? LIMIT 1
                    `, [bestPractice.id]);
                    return jsonResponse({ bestPractice: results && results.length > 0 ? results[0] : bestPractice });
                }

                if (request.method === 'PUT' && url.pathname.startsWith('/api/memory/best-practices/')) {
                    const id = url.pathname.split('/').pop() || '';
                    if (!id) {
                        return jsonResponse({ error: 'Best practice ID is required.' }, 400);
                    }

                    const body = await request.json();
                    const updates: Record<string, any> = {};

                    if (typeof body.topic === 'string') {
                        const topic = body.topic.trim();
                        if (topic) {
                            updates.topic = topic;
                        }
                    }
                    if (typeof body.guidance === 'string') {
                        const guidance = body.guidance.trim();
                        if (guidance) {
                            updates.guidance = guidance;
                        }
                    }
                    if (typeof body.source === 'string') {
                        const source = body.source.trim();
                        updates.source = source || null;
                    }

                    if (Object.keys(updates).length === 0) {
                        return jsonResponse({ error: 'No fields provided for update.' }, 400);
                    }

                    const d1 = new D1Tool(env as any);
                    await d1.update('DB', 'best_practices', 'id', id, updates);
                    const { results } = await d1.query('DB', `
                        SELECT * FROM best_practices WHERE id = ? LIMIT 1
                    `, [id]);
                    if (!results || results.length === 0) {
                        return jsonResponse({ error: 'Best practice not found.' }, 404);
                    }
                    return jsonResponse({ bestPractice: results[0] });
                }

                if (request.method === 'DELETE' && url.pathname.startsWith('/api/memory/best-practices/')) {
                    const id = url.pathname.split('/').pop() || '';
                    if (!id) {
                        return jsonResponse({ error: 'Best practice ID is required.' }, 400);
                    }

                    const d1 = new D1Tool(env as any);
                    await d1.query('DB', `DELETE FROM best_practices WHERE id = ?`, [id]);
                    return jsonResponse({ success: true });
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

function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function invokeSpecialistAgent(env: any, agentBinding: string, method: string, payload: any): Promise<any> {
    // Simple dynamic dispatch to Durable Object or service by binding name if available
    // Placeholder: route through DynamicAgent for now
    const id = env.DYNAMIC_AGENT.idFromName('singleton');
    const stub = env.DYNAMIC_AGENT.get(id);
    const res = await stub.fetch(new Request('https://internal.local/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentBinding, method, payload }),
    }));
    if (!res.ok) throw new Error(`Agent call failed: ${res.status}`);
    return res.json();
}
