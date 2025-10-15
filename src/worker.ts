// Cloudflare Worker that HOSTS an MCP server exposing GitHub tools directly.
// It provides:
// - /schema: full MCP tool schema (mirrors GitHub MCP server)
// - /invoke: execute any GitHub MCP tool with validated params
// - /health: simple liveness check
// - Base64-safe file writes for create_or_update_file with optional plaintext mode auto-encoding
// - RBAC, rate limiting, logging (KV + optional R2), and agent-friendly defaults

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

// ============ ENV & Bindings ============
type Env = {
  GITHUB_TOKEN?: string;
  ALLOWED_ORIGINS?: string; // comma-separated list
  MCP_LOGS: KVNamespace;
  MCP_ARTIFACTS?: R2Bucket;
};

// ============ Shared Utils ============
function json(c: any, data: any, status = 200, headers: Record<string, string> = {}) {
  return c.json(data, status, headers);
}

function redactToken(str?: string) { return str ? '[redacted]' : undefined; }
function isNumericString(v: any) { return typeof v === 'string' && /^\d+$/.test(v); }
function toNumberIfNumeric(v: any) { return isNumericString(v) ? Number(v) : v; }

function b64Encode(str: string) {
  // Workers runtime: use btoa for ASCII; for utf-8, encode to bytes first
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// ============ Logging ============
class LogStore {
  constructor(private kv: KVNamespace, private r2?: R2Bucket) {}

  async logInvocation(entry: any, response: any) {
    const id = entry.id ?? crypto.randomUUID();
    const payload = typeof response === 'string'
      ? new TextEncoder().encode(response)
      : new TextEncoder().encode(JSON.stringify(response));

    let bodyRef: string | undefined;
    if (this.r2 && payload.byteLength > 100_000) {
      bodyRef = `artifact/${id}.json`;
      await this.r2.put(bodyRef, payload, { httpMetadata: { contentType: 'application/json' } });
    }

    const sanitized = {
      ...entry,
      ts: new Date().toISOString(),
      requestToken: redactToken(entry.requestToken),
      size: payload.byteLength,
      bodyRef,
    };

    await this.kv.put(`log:${id}`, JSON.stringify(sanitized), { expirationTtl: 60 * 60 * 24 });
    return id;
  }

  async get(id: string) {
    const raw = await this.kv.get(`log:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
}

// ============ Config & RBAC ============
const ConfigSchema = z.object({
  github: z.object({
    rateLimitPerHour: z.number().min(1).default(900),
    allowedOrgs: z.array(z.string()).optional(),
    allowedRepos: z.array(z.string()).optional(), // "owner/repo"
    denyTools: z.array(z.string()).optional(),
  }).default({ rateLimitPerHour: 900 }),
});

type Config = z.infer<typeof ConfigSchema>;

class ConfigStore {
  static async load(kv: KVNamespace): Promise<Config> {
    const raw = await kv.get('config:github:v1');
    if (!raw) return ConfigSchema.parse({});
    const parsed = ConfigSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return ConfigSchema.parse({});
    return parsed.data;
  }
  static async save(kv: KVNamespace, cfg: Config) {
    await kv.put('config:github:v1', JSON.stringify(cfg));
  }
}

function checkRBAC(cfg: Config, tool: string, params: any) {
  const deny = cfg.github.denyTools ?? [];
  if (deny.includes(tool)) throw new Error(`Tool ${tool} is denied by policy`);
  const owner = params?.owner;
  const repo = params?.repo;
  if (cfg.github.allowedOrgs && owner && !cfg.github.allowedOrgs.includes(owner)) {
    throw new Error(`Owner ${owner} not allowed`);
  }
  if (cfg.github.allowedRepos && owner && repo && !cfg.github.allowedRepos.includes(`${owner}/${repo}`)) {
    throw new Error(`Repo ${owner}/${repo} not allowed`);
  }
}

// ============ Rate Limiting ============
class RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();
  constructor(private perHour: number) {}
  take(key: string) {
    const now = Date.now();
    const refillPerMs = this.perHour / (60 * 60 * 1000);
    const bucket = this.buckets.get(key) ?? { tokens: this.perHour, last: now };
    const elapsed = now - bucket.last;
    bucket.tokens = Math.min(this.perHour, bucket.tokens + elapsed * refillPerMs);
    bucket.last = now;
    if (bucket.tokens < 1) throw new Error('Rate limit exceeded; try later');
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
  }
}

// ============ MCP Schema (GitHub Tools) ============
// Define the MCP tool catalog we host. This mirrors the GitHub MCP server signature excerpts.
// IMPORTANT: Tools that write files require base64 content per GitHub API.
// We allow an optional "content_mode": "plaintext" to auto-encode for agents that supply raw text.

const ToolDef = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.any()).optional(),
});

const SchemaResponse = z.object({
  tools: z.array(ToolDef),
});

const TOOLS: Array<z.infer<typeof ToolDef>> = [
  // Repositories: create_or_update_file (base64 required)
  {
    name: 'create_or_update_file',
    description: 'Create or update a file in a repository (content must be base64). Optional content_mode="plaintext" to auto-encode.',
    parameters: {
      branch: { type: 'string', required: true },
      content: { type: 'string', required: true }, // base64 content
      content_mode: { type: 'string', required: false, enum: ['base64', 'plaintext'] },
      message: { type: 'string', required: true },
      owner: { type: 'string', required: true },
      path: { type: 'string', required: true },
      repo: { type: 'string', required: true },
      sha: { type: 'string', required: false }, // required when updating
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from a repository branch.',
    parameters: {
      branch: { type: 'string', required: true },
      message: { type: 'string', required: true },
      owner: { type: 'string', required: true },
      path: { type: 'string', required: true },
      repo: { type: 'string', required: true },
    },
  },
  {
    name: 'get_file_contents',
    description: 'Get file or directory contents. Returns JSON with file content base64 (files) or entries (directories).',
    parameters: {
      owner: { type: 'string', required: true },
      path: { type: 'string', required: false },
      ref: { type: 'string', required: false },
      repo: { type: 'string', required: true },
      sha: { type: 'string', required: false },
      decode: { type: 'boolean', required: false }, // optional: return decoded plaintext for files
    },
  },
  // Pull requests (subset, expand as needed)
  {
    name: 'create_pull_request',
    description: 'Open new pull request.',
    parameters: {
      base: { type: 'string', required: true },
      body: { type: 'string', required: false },
      draft: { type: 'boolean', required: false },
      head: { type: 'string', required: true },
      maintainer_can_modify: { type: 'boolean', required: false },
      owner: { type: 'string', required: true },
      repo: { type: 'string', required: true },
      title: { type: 'string', required: true },
    },
  },
  {
    name: 'merge_pull_request',
    description: 'Merge pull request.',
    parameters: {
      commit_message: { type: 'string', required: false },
      commit_title: { type: 'string', required: false },
      merge_method: { type: 'string', required: false },
      owner: { type: 'string', required: true },
      pullNumber: { type: 'number', required: true },
      repo: { type: 'string', required: true },
    },
  },
  {
    name: 'update_pull_request',
    description: 'Edit pull request metadata.',
    parameters: {
      base: { type: 'string', required: false },
      body: { type: 'string', required: false },
      draft: { type: 'boolean', required: false },
      maintainer_can_modify: { type: 'boolean', required: false },
      owner: { type: 'string', required: true },
      pullNumber: { type: 'number', required: true },
      repo: { type: 'string', required: true },
      reviewers: { type: 'array', required: false }, // string[]
      state: { type: 'string', required: false },
      title: { type: 'string', required: false },
    },
  },
  // Actions (workflows)
  {
    name: 'list_workflows',
    description: 'List workflows.',
    parameters: {
      owner: { type: 'string', required: true },
      page: { type: 'number', required: false },
      perPage: { type: 'number', required: false },
      repo: { type: 'string', required: true },
    },
  },
  {
    name: 'list_workflow_runs',
    description: 'List workflow runs.',
    parameters: {
      actor: { type: 'string', required: false },
      branch: { type: 'string', required: false },
      event: { type: 'string', required: false },
      owner: { type: 'string', required: true },
      page: { type: 'number', required: false },
      perPage: { type: 'number', required: false },
      repo: { type: 'string', required: true },
      status: { type: 'string', required: false },
      workflow_id: { type: 'string', required: true },
    },
  },
  // Issues
  {
    name: 'create_issue',
    description: 'Open new issue.',
    parameters: {
      assignees: { type: 'array', required: false }, // string[]
      body: { type: 'string', required: false },
      labels: { type: 'array', required: false }, // string[]
      milestone: { type: 'number', required: false },
      owner: { type: 'string', required: true },
      repo: { type: 'string', required: true },
      title: { type: 'string', required: true },
      type: { type: 'string', required: false },
    },
  },
  // Add more tools here as needed following the schema in your page (Jobs, Logs, Security, Projects, etc.)
];

// Zod for /invoke body
const InvokeSchema = z.object({
  tool: z.string(),
  params: z.record(z.any()).default({}),
}).transform((v) => ({
  tool: v.tool ?? 'n/a',
  params: v.params ?? 'n/a',
}));

// ============ GitHub API Client ============
// Minimal REST client wrappers. Expand per tool coverage.
// Note: create_or_update_file requires base64 content for GitHub Contents API.

class GitHubClient {
  constructor(private token: string) {}

  private async req(path: string, init: RequestInit & { retry?: number } = {}) {
    const url = `https://api.github.com${path}`;
    const headers: HeadersInit = {
      ...(init.headers ?? {}),
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'mcp-worker',
    };
    const retry = init.retry ?? 2;
    let lastErr: any;
    for (let i = 0; i <= retry; i++) {
      const resp = await fetch(url, { ...init, headers });
      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
        await sleep(250 * (i + 1));
        continue;
      }
      if (!resp.ok) {
        const text = await resp.text();
        lastErr = new Error(`GitHub API ${resp.status}: ${text}`);
        // some 4xx errors should not retry
        if (resp.status >= 400 && resp.status < 500) throw lastErr;
        continue;
      }
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await resp.json();
      return await resp.text();
    }
    throw lastErr ?? new Error('GitHub API failed');
  }

  // Repos: create/update file (Contents API)
  async createOrUpdateFile(params: {
    owner: string; repo: string; path: string;
    message: string; content: string; branch: string; sha?: string;
  }) {
    return this.req(`/repos/${params.owner}/${params.repo}/contents/${encodeURIComponent(params.path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: params.message,
        content: params.content, // base64 per API
        branch: params.branch,
        sha: params.sha,
      }),
    });
  }

  async deleteFile(params: { owner: string; repo: string; path: string; message: string; branch: string; sha: string }) {
    return this.req(`/repos/${params.owner}/${params.repo}/contents/${encodeURIComponent(params.path)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: params.message,
        branch: params.branch,
        sha: params.sha,
      }),
    });
  }

  async getFileContents(params: { owner: string; repo: string; path?: string; ref?: string }) {
    const p = params.path ? `/contents/${encodeURIComponent(params.path)}` : `/contents`;
    const q = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : '';
    return this.req(`/repos/${params.owner}/${params.repo}${p}${q}`, { method: 'GET' });
  }

  // Pull requests (subset)
  async createPullRequest(params: { owner: string; repo: string; title: string; head: string; base: string; body?: string; draft?: boolean; maintainer_can_modify?: boolean }) {
    return this.req(`/repos/${params.owner}/${params.repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async mergePullRequest(params: { owner: string; repo: string; pullNumber: number; commit_title?: string; commit_message?: string; merge_method?: string }) {
    return this.req(`/repos/${params.owner}/${params.repo}/pulls/${params.pullNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({
        commit_title: params.commit_title,
        commit_message: params.commit_message,
        merge_method: params.merge_method,
      }),
    });
  }

  async updatePullRequest(params: { owner: string; repo: string; pullNumber: number; title?: string; body?: string; state?: string; base?: string; maintainer_can_modify?: boolean; draft?: boolean }) {
    return this.req(`/repos/${params.owner}/${params.repo}/pulls/${params.pullNumber}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  }

  // Actions: list workflows/runs
  async listWorkflows(params: { owner: string; repo: string; page?: number; perPage?: number }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    return this.req(`/repos/${params.owner}/${params.repo}/actions/workflows?${q.toString()}`, { method: 'GET' });
  }

  async listWorkflowRuns(params: { owner: string; repo: string; workflow_id: string; page?: number; perPage?: number; actor?: string; branch?: string; event?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.perPage) q.set('per_page', String(params.perPage));
    if (params.actor) q.set('actor', params.actor);
    if (params.branch) q.set('branch', params.branch);
    if (params.event) q.set('event', params.event);
    if (params.status) q.set('status', params.status);
    return this.req(`/repos/${params.owner}/${params.repo}/actions/workflows/${encodeURIComponent(params.workflow_id)}/runs?${q.toString()}`, { method: 'GET' });
  }

  // Issues
  async createIssue(params: { owner: string; repo: string; title: string; body?: string; assignees?: string[]; labels?: string[]; milestone?: number }) {
    return this.req(`/repos/${params.owner}/${params.repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

// ============ Tool Execution Layer ============
async function executeTool(env: Env, tool: string, params: any, meta: { callerId?: string; reqId: string }) {
  const config = await ConfigStore.load(env.MCP_LOGS);
  checkRBAC(config, tool, params);

  // Token selection
  const token = params?.token || env.GITHUB_TOKEN;
  if (!token) throw new Error('Missing GitHub token (provide via X-GitHub-Token or env GITHUB_TOKEN)');
  const gh = new GitHubClient(token);

  // Rate limit key: token + owner/repo
  const owner = params?.owner ?? 'n/a';
  const repo = params?.repo ?? 'n/a';
  const limiter = new RateLimiter(config.github.rateLimitPerHour);
  limiter.take(`${token}:${owner}/${repo}`);

  // Normalize numeric strings to numbers
  const normalized = Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, toNumberIfNumeric(v)]));

  switch (tool) {
    case 'create_or_update_file': {
      // Enforce base64; allow content_mode="plaintext" to auto-encode (prevents agent confusion).
      const mode = normalized.content_mode ?? 'base64';
      if (mode === 'plaintext') {
        if (typeof normalized.content !== 'string') throw new Error('content must be string when content_mode="plaintext"');
        normalized.content = b64Encode(normalized.content);
      }
      if (typeof normalized.content !== 'string') throw new Error('content must be base64 string');
      if (!/^[A-Za-z0-9+/=]+$/.test(normalized.content)) {
        throw new Error('content must be base64; set content_mode="plaintext" to auto-encode');
      }
      if (!normalized.sha) {
        // Optional: best-effort fetch current file to get sha when updating
        try {
          const current = await gh.getFileContents({ owner, repo, path: normalized.path, ref: normalized.branch });
          if (current && current.sha) normalized.sha = current.sha;
        } catch { /* ignore; create will succeed if new file */ }
      }
      return gh.createOrUpdateFile({
        owner,
        repo,
        path: normalized.path,
        message: normalized.message,
        content: normalized.content,
        branch: normalized.branch,
        sha: normalized.sha,
      });
    }
    case 'delete_file': {
      // Require sha; try to discover it
      if (!normalized.sha) {
        const current = await gh.getFileContents({ owner, repo, path: normalized.path, ref: normalized.branch });
        if (!current?.sha) throw new Error('sha required to delete file; could not discover current sha');
        normalized.sha = current.sha;
      }
      return gh.deleteFile({
        owner,
        repo,
        path: normalized.path,
        message: normalized.message,
        branch: normalized.branch,
        sha: normalized.sha,
      });
    }
    case 'get_file_contents': {
      const res = await gh.getFileContents({ owner, repo, path: normalized.path, ref: normalized.ref });
      if (normalized.decode && res && res.content && res.encoding === 'base64') {
        // decode to plaintext
        const bin = atob(res.content);
        const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
        res.plaintext = new TextDecoder().decode(bytes);
      }
      return res;
    }
    case 'create_pull_request': {
      return gh.createPullRequest({
        owner,
        repo,
        title: normalized.title,
        head: normalized.head,
        base: normalized.base,
        body: normalized.body,
        draft: normalized.draft,
        maintainer_can_modify: normalized.maintainer_can_modify,
      });
    }
    case 'merge_pull_request': {
      return gh.mergePullRequest({
        owner,
        repo,
        pullNumber: normalized.pullNumber,
        commit_title: normalized.commit_title,
        commit_message: normalized.commit_message,
        merge_method: normalized.merge_method,
      });
    }
    case 'update_pull_request': {
      return gh.updatePullRequest({
        owner,
        repo,
        pullNumber: normalized.pullNumber,
        title: normalized.title,
        body: normalized.body,
        state: normalized.state,
        base: normalized.base,
        maintainer_can_modify: normalized.maintainer_can_modify,
        draft: normalized.draft,
      });
    }
    case 'list_workflows': {
      return gh.listWorkflows({ owner, repo, page: normalized.page, perPage: normalized.perPage });
    }
    case 'list_workflow_runs': {
      return gh.listWorkflowRuns({
        owner, repo, workflow_id: normalized.workflow_id,
        page: normalized.page, perPage: normalized.perPage,
        actor: normalized.actor, branch: normalized.branch, event: normalized.event, status: normalized.status,
      });
    }
    case 'create_issue': {
      return gh.createIssue({
        owner, repo, title: normalized.title,
        body: normalized.body, assignees: normalized.assignees, labels: normalized.labels, milestone: normalized.milestone,
      });
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// ============ Server (MCP endpoints) ============
const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: (origin, c) => {
    const allowed = c.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    if (allowed.length === 0) return origin;
    return allowed.includes(origin) ? origin : '';
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-GitHub-Token', 'X-Caller-Id'],
}));

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.get('/schema', async (c) => {
  const resp = { tools: TOOLS };
  return json(c, resp);
});

app.post('/invoke', async (c) => {
  if ((c.req.header('content-type') || '').toLowerCase() !== 'application/json') {
    return json(c, { error: 'invalid_content_type', message: 'Use application/json' }, 415);
  }
  const body = await c.req.json();
  const parsed = InvokeSchema.safeParse(body);
  if (!parsed.success) {
    return json(c, { error: 'invalid_request', details: parsed.error.flatten() }, 400);
  }
  const { tool, params } = parsed.data;
  const callerId = c.req.header('X-Caller-Id') ?? 'n/a';
  const perReqToken = c.req.header('X-GitHub-Token');
  const reqId = crypto.randomUUID();

  // token pass-through: allow agents to supply token header; else use env
  if (perReqToken) params.token = perReqToken;

  const logStore = new LogStore(c.env.MCP_LOGS, c.env.MCP_ARTIFACTS);
  const start = Date.now();
  try {
    const result = await executeTool(c.env, tool, params, { callerId, reqId });
    const durationMs = Date.now() - start;
    await logStore.logInvocation({
      id: reqId,
      callerId,
      provider: 'github',
      tool,
      paramsSummary: {
        owner: params?.owner ?? 'n/a',
        repo: params?.repo ?? 'n/a',
        path: params?.path ?? 'n/a',
      },
      durationMs,
      outcome: 'success',
      requestToken: perReqToken,
    }, result);
    return json(c, result, 200, { 'X-Request-Id': reqId });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    await logStore.logInvocation({
      id: reqId,
      callerId,
      provider: 'github',
      tool,
      paramsSummary: {
        owner: params?.owner ?? 'n/a',
        repo: params?.repo ?? 'n/a',
        path: params?.path ?? 'n/a',
      },
      durationMs,
      outcome: 'error',
      error: err?.message ?? 'unknown',
      requestToken: perReqToken,
    }, { message: err?.message ?? 'unknown' });
    return json(c, { error: 'invoke_failed', message: err?.message ?? 'unknown' }, 500, { 'X-Request-Id': reqId });
  }
});

// Protected config update (optional; guard with CF Access or shared secret upstream)
app.put('/config/github', async (c) => {
  const body = await c.req.json();
  const parsed = ConfigSchema.safeParse(body);
  if (!parsed.success) {
    return json(c, { error: 'invalid_config', details: parsed.error.flatten() }, 400);
  }
  await ConfigStore.save(c.env.MCP_LOGS, parsed.data);
  return json(c, { ok: true });
});

app.get('/logs/:id', async (c) => {
  const id = c.req.param('id');
  const logStore = new LogStore(c.env.MCP_LOGS, c.env.MCP_ARTIFACTS);
  const entry = await logStore.get(id);
  if (!entry) return json(c, { error: 'not_found' }, 404);
  return json(c, entry);
});

export default app;