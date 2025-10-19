/**
 * @file GitHubTool.ts
 * @description Provides a direct interface to the GitHub API for the GitHubAgent.
 * This tool handles the low-level API calls, allowing the agent to focus on
 * orchestrating complex workflows.
 */

import { z } from 'zod';

// Shared utilities for this tool
function isNumericString(v: any) { return typeof v === 'string' && /^\d+$/.test(v); }
function toNumberIfNumeric(v: any) { return isNumericString(v) ? Number(v) : v; }
function b64Encode(str: string) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

class GitHubClient {
  constructor(private token: string) {}

  private async req(path: string, init: RequestInit & { retry?: number } = {}) {
    const url = `https://api.github.com${path}`;
    const headers: HeadersInit = {
      ...(init.headers ?? {}),
      'Authorization': `Bearer ${this.token}`, 'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json', 'User-Agent': 'cloudflare-agent-platform',
    };
    const retry = init.retry ?? 2;
    for (let i = 0; i <= retry; i++) {
      const resp = await fetch(url, { ...init, headers });
      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
        await sleep(250 * (i + 1)); continue;
      }
      if (!resp.ok) {
        const text = await resp.text();
        if (resp.status >= 400 && resp.status < 500) throw new Error(`GitHub API Error ${resp.status}: ${text}`);
        continue;
      }
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await resp.json();
      return await resp.text();
    }
    throw new Error('GitHub API request failed after multiple retries.');
  }

  createOrUpdateFile(params: { owner: string; repo: string; path: string; message: string; content: string; branch: string; sha?: string; }) {
    return this.req(`/repos/${params.owner}/${params.repo}/contents/${encodeURIComponent(params.path)}`, { method: 'PUT', body: JSON.stringify({ message: params.message, content: params.content, branch: params.branch, sha: params.sha, }) });
  }

  getFileContents(params: { owner: string; repo: string; path?: string; ref?: string }) {
    const p = params.path ? `/contents/${encodeURIComponent(params.path)}` : `/contents`;
    const q = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : '';
    return this.req(`/repos/${params.owner}/${params.repo}${p}${q}`);
  }

  createPullRequest(params: { owner: string; repo: string; title: string; head: string; base: string; body?: string; }) {
    return this.req(`/repos/${params.owner}/${params.repo}/pulls`, { method: 'POST', body: JSON.stringify(params) });
  }

  createFork(params: { owner: string; repo: string; }) {
      return this.req(`/repos/${params.owner}/${params.repo}/forks`, { method: 'POST' });
  }
}

interface Env { GITHUB_TOKEN?: string; }

export class GitHubTool {
    private env: Env;
    constructor(env: Env) { this.env = env; }

    private getClient(params: { token?: string }): GitHubClient {
        const token = params.token || this.env.GITHUB_TOKEN;
        if (!token) throw new Error('Missing GitHub token. Provide it as a parameter or set GITHUB_TOKEN in the environment.');
        return new GitHubClient(token);
    }

    async create_or_update_file(params: { owner: string; repo: string; path: string; message: string; content: string; branch: string; sha?: string; content_mode?: 'base64' | 'plaintext', token?: string }) {
        const gh = this.getClient(params);
        let content = params.content;
        if (params.content_mode === 'plaintext') content = b64Encode(content);
        return gh.createOrUpdateFile({ ...params, content });
    }

    async get_file_contents(params: { owner: string; repo: string; path: string; ref?: string; decode?: boolean, token?: string }) {
        const gh = this.getClient(params);
        const res = await gh.getFileContents(params);
        if (params.decode && res?.content && res.encoding === 'base64') {
            const bin = atob(res.content);
            res.plaintext = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
        }
        return res;
    }

    async create_pull_request(params: { owner: string; repo: string; title: string; head: string; base: string; body?: string, token?: string }) {
        const gh = this.getClient(params);
        return gh.createPullRequest(params);
    }

    async fork_repository(params: { owner: string; repo: string; token?: string }) {
        const gh = this.getClient(params);
        return gh.createFork(params);
    }
}