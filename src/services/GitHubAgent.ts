/**
 * @file GitHubAgent.ts
 * @description The specialist agent for complex, multi-step GitHub workflows.
 * This agent orchestrates calls to the low-level GitHubTool to perform
 * sophisticated tasks like forking repositories, generating development
 * plans, and creating pull requests.
 */

import { DurableObject } from "cloudflare:workers";
import { GitHubTool } from '../tools/GitHubTool';
import { D1Tool } from '../tools/D1Tool';
import { AITool } from '../tools/AITool';

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

type Env = Record<string, any>;

interface StructuredPlan {
    summary: string;
    milestones: Array<{ title: string; goal: string; tasks: string[]; estimated_hours?: number }>;
    risk_register: Array<{ risk: string; mitigation: string }>;
    success_metrics: string[];
}

interface RepoResearchNote {
    repo: string;
    url: string;
    summary: string;
    notable_apis: string[];
    fit_score: number;
    findings: string[];
}

export class GitHubAgent extends McpAgent {
    private githubTool: GitHubTool;
    private d1Tool: D1Tool;
    private aiTool: AITool;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.githubTool = new GitHubTool(env);
        this.d1Tool = new D1Tool(env);
        this.aiTool = new AITool(env);

        this.tools['forkAndPlan'] = this.forkAndPlan.bind(this);
        this.tools['createPrFromTask'] = this.createPrFromTask.bind(this);
        this.tools['startGithubResearch'] = this.startGithubResearch.bind(this);
    }

    private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
        try {
            const parts = new URL(repoUrl).pathname.split('/').filter(Boolean);
            const [owner, repo] = parts;
            if (!owner || !repo) throw new Error('Unable to determine owner and repo from URL.');
            return { owner, repo };
        } catch (error) {
            throw new Error(`Invalid repository URL provided: ${repoUrl}. ${error.message}`);
        }
    }

    private parseJson<T>(payload: string): T | null {
        try {
            return JSON.parse(payload) as T;
        } catch (error) {
            console.warn('Failed to parse AI response as JSON. Falling back to plain text payload.');
            return null;
        }
    }

    /**
     * @description A complex, multi-step workflow that orchestrates the entire process of starting a new
     * development project. It begins by forking a source repository, waits for GitHub to finish
     * provisioning the fork, and then asks an AI model to craft a structured delivery plan. The
     * resulting plan is persisted in D1 so other agents (and humans) can pick the work up later.
     */
    async forkAndPlan(params: { repoUrl: string, taskDescription: string, newRepoName: string, token?: string }): Promise<object> {
        const { repoUrl, taskDescription, newRepoName, token } = params;
        if (!repoUrl || !taskDescription || !newRepoName) {
            throw new Error('repoUrl, taskDescription, and newRepoName are required parameters.');
        }

        const { owner, repo } = this.parseRepoUrl(repoUrl);

        const sourceRepository = await this.githubTool.get_repository({ owner, repo, token });
        if (!sourceRepository?.default_branch) {
            throw new Error('Unable to load repository metadata. Ensure the GitHub token has repo scope.');
        }

        // 1. Fork the repository
        const forkResult = await this.githubTool.fork_repository({ owner, repo, token });
        const newRepoUrl = forkResult.html_url;
        const forkOwner = forkResult?.owner?.login;
        const forkRepo = forkResult?.name;

        if (!newRepoUrl || !forkOwner || !forkRepo) {
            throw new Error('GitHub did not return details for the created fork.');
        }

        // 2. Wait for GitHub to finish creating the fork (it is eventually consistent)
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
            try {
                await this.githubTool.get_repository({ owner: forkOwner, repo: forkRepo, token });
                break;
            } catch (error) {
                await new Promise(res => setTimeout(res, 2000));
            }
        }

        // 3. Generate a structured development plan using AI
        const planPrompt = `You are the lead engineer responsible for delivering the task "${taskDescription}" after forking ${repoUrl}.
Produce a JSON object with the following structure:
{
  "summary": string,
  "milestones": [
    { "title": string, "goal": string, "tasks": [string], "estimated_hours": number }
  ],
  "risk_register": [ { "risk": string, "mitigation": string } ],
  "success_metrics": [string]
}
Tailor the tasks to the technology stack you can infer from the repository metadata below.
Repository description: ${sourceRepository.description ?? 'n/a'}
Primary language: ${sourceRepository.language ?? 'n/a'}
Stars: ${sourceRepository.stargazers_count}`;

        const planResult = await this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: planPrompt,
            system: 'Respond with valid JSON and avoid markdown fencing.',
            temperature: 0.35,
            response_format: { type: 'json_object' }
        });

        const plan = this.parseJson<StructuredPlan>(planResult.response) ?? {
            summary: planResult.response,
            milestones: [],
            risk_register: [],
            success_metrics: []
        };

        // 4. Persist project metadata and plan in D1
        const projectId = crypto.randomUUID();
        await this.d1Tool.insert('DB', 'development_projects', {
            id: projectId,
            name: newRepoName,
            description: taskDescription,
            github_url: newRepoUrl,
            status: 'planned'
        });

        await this.d1Tool.insert('DB', 'development_project_plans', {
            id: crypto.randomUUID(),
            project_id: projectId,
            plan: JSON.stringify(plan)
        });

        return {
            projectId,
            newRepoUrl,
            plan,
            message: "Repository forked, development plan generated, and project saved."
        };
    }

    /**
     * @description Generates a detailed implementation approach for a stored project task. The AI
     * output is logged to D1 so the delivery team can track recommendations and iterate on them.
     */
    async createPrFromTask(params: { projectId: string, taskDescription: string, token?: string }): Promise<object> {
        const { projectId, taskDescription } = params;
        if (!projectId || !taskDescription) {
            throw new Error('projectId and taskDescription are required.');
        }

        const project = await this.d1Tool.getById('DB', 'development_projects', 'id', projectId);
        if (!project) {
            throw new Error(`Project not found for id ${projectId}`);
        }

        const briefingPrompt = `You are preparing to open a high quality pull request for the project at ${project.github_url}.
Task: ${taskDescription}
Return a JSON object with:
- branch_name: a kebab-case branch suggestion (<= 40 chars)
- implementation_steps: array of concrete git-level actions
- testing_plan: array of commands or manual checks
- pr_body: markdown string summarising the change`;

        const briefingResult = await this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: briefingPrompt,
            system: 'Return valid JSON without code fences.',
            temperature: 0.4,
            response_format: { type: 'json_object' }
        });

        const briefing = this.parseJson<any>(briefingResult.response) ?? {
            branch_name: 'feature-auto-plan',
            implementation_steps: [briefingResult.response],
            testing_plan: [],
            pr_body: briefingResult.response
        };

        await this.d1Tool.insert('DB', 'development_consultations', {
            id: crypto.randomUUID(),
            project_id: projectId,
            question: taskDescription,
            context: JSON.stringify({ github_url: project.github_url }),
            agent_response: JSON.stringify(briefing),
            status: 'planned'
        });

        return {
            project,
            plan: briefing,
            message: 'Generated branch, implementation, and PR guidance. Apply the steps then run create_pull_request tool.'
        };
    }

    /**
     * @description Launches a GitHub research brief. It synthesises candidate repositories,
     * stores structured notes in D1, and returns an aggregated summary for the calling agent.
     */
    async startGithubResearch(params: { topic: string; seedRepos?: string[]; maxRepos?: number; token?: string }): Promise<object> {
        const { topic, seedRepos = [], maxRepos = 5, token } = params;
        if (!topic) {
            throw new Error('topic is required to start GitHub research.');
        }

        const briefId = crypto.randomUUID();

        const summaryResult = await this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: `You are the research director for an AI engineering team. Craft a 3 sentence summary describing why we are researching "${topic}" and the desired outcome.`,
            temperature: 0.5
        });

        await this.d1Tool.insert('DB', 'research_briefs', {
            id: briefId,
            topic,
            summary: summaryResult.response,
            status: 'researching'
        });

        const requested = new Set<string>();
        const repoQueue: Array<{ owner: string; repo: string; html_url: string }> = [];

        for (const url of seedRepos) {
            try {
                const { owner, repo } = this.parseRepoUrl(url);
                const key = `${owner}/${repo}`.toLowerCase();
                if (requested.has(key)) continue;
                requested.add(key);
                repoQueue.push({ owner, repo, html_url: `https://github.com/${owner}/${repo}` });
            } catch (error) {
                console.warn('Skipping invalid seed repo url', url, error);
            }
        }

        const searchResults = await this.githubTool.search_repositories({ query: topic, per_page: maxRepos * 2, token });
        for (const item of searchResults.items ?? []) {
            const key = item.full_name?.toLowerCase();
            if (!key || requested.has(key)) continue;
            const [owner, repo] = item.full_name.split('/');
            requested.add(key);
            repoQueue.push({ owner, repo, html_url: item.html_url });
            if (repoQueue.length >= maxRepos) break;
        }

        const researchNotes: RepoResearchNote[] = [];

        for (const repoInfo of repoQueue.slice(0, maxRepos)) {
            try {
                const metadata = await this.githubTool.get_repository({ owner: repoInfo.owner, repo: repoInfo.repo, token });
                let readme = '';
                try {
                    const readmeResponse = await this.githubTool.get_file_contents({ owner: repoInfo.owner, repo: repoInfo.repo, path: 'README.md', decode: true, token });
                    readme = readmeResponse?.plaintext ?? '';
                } catch (error) {
                    readme = '';
                }

                const repoPrompt = `Repository: ${repoInfo.owner}/${repoInfo.repo}
Description: ${metadata?.description ?? 'n/a'}
Primary language: ${metadata?.language ?? 'n/a'}
Stars: ${metadata?.stargazers_count ?? 0}
README preview (truncated to 2k chars): ${readme.substring(0, 2000)}

Summarise how this repository could help with the research topic "${topic}". Return JSON with fields summary, notable_apis (array of strings), fit_score (0-1 float), and findings (array of strings).`;

                const repoAnalysisResult = await this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
                    prompt: repoPrompt,
                    system: 'Respond with valid JSON.',
                    temperature: 0.2,
                    response_format: { type: 'json_object' }
                });

                const analysis = this.parseJson<RepoResearchNote>(repoAnalysisResult.response);
                if (!analysis) {
                    continue;
                }

                analysis.repo = `${repoInfo.owner}/${repoInfo.repo}`;
                analysis.url = repoInfo.html_url;
                if (!Array.isArray(analysis.notable_apis)) {
                    analysis.notable_apis = analysis.notable_apis ? [String(analysis.notable_apis)] : [];
                }
                if (!Array.isArray(analysis.findings)) {
                    analysis.findings = analysis.findings ? [String(analysis.findings)] : [];
                }
                if (typeof analysis.fit_score !== 'number') {
                    const numericFit = Number((analysis as any).fit_score || 0);
                    analysis.fit_score = isNaN(numericFit) ? 0 : numericFit;
                }

                const repoReviewId = crypto.randomUUID();
                await this.d1Tool.insert('DB', 'research_repos_reviewed', {
                    id: repoReviewId,
                    brief_id: briefId,
                    repo_url: analysis.url,
                    review_notes: analysis.summary
                });

                for (const finding of analysis.findings ?? []) {
                    await this.d1Tool.insert('DB', 'research_findings', {
                        id: crypto.randomUUID(),
                        brief_id: briefId,
                        finding,
                        source_repo_id: repoReviewId,
                        source_file_path: null
                    });
                }

                researchNotes.push(analysis);
            } catch (error) {
                console.error('Research analysis failed for repo', repoInfo, error);
            }
        }

        const synthesisPrompt = `You are preparing the executive summary for a GitHub research brief about "${topic}".
Here are the repository analyses:
${researchNotes.map(note => `- ${note.repo} (fit ${note.fit_score}): ${note.summary}`).join('\n')}

Return JSON with fields overall_summary (string) and top_recommendations (array of { repo: string, rationale: string }).`;

        const synthesisResult = await this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: synthesisPrompt,
            system: 'Return valid JSON.',
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        const synthesis = this.parseJson<any>(synthesisResult.response) ?? {
            overall_summary: synthesisResult.response,
            top_recommendations: []
        };

        await this.d1Tool.update('DB', 'research_briefs', 'id', briefId, {
            status: 'complete'
        });

        return {
            briefId,
            topic,
            overview: synthesis,
            repositories: researchNotes
        };
    }

    // Additional advanced workflows could be expanded here.
    async resolvePrConflict(params: any) { return { status: "pending", message: "Not yet implemented." }; }
    async resolveWorkerBuildIssue(params: any) { return { status: "pending", message: "Not yet implemented." }; }
}
