/**
 * @fileoverview Cloudflare Worker Entry Point
 * 
 * This is the main entry point for the Cloudflare Worker.
 * It demonstrates how to use the GitHub API module to handle requests.
 * 
 * @module index
 */

import { GitHubAPIClient, createGitHubClient } from './routes/github.js';

/**
 * Environment interface for Cloudflare Worker
 * Define your environment variables here
 */
export interface Env {
  /** GitHub Personal Access Token */
  GITHUB_TOKEN: string;
}

/**
 * Main fetch handler for Cloudflare Worker
 * 
 * This handler demonstrates basic routing and usage of the GitHub API client.
 * Routes:
 * - /repo/:owner/:repo - Get repository information
 * - /issues/:owner/:repo - List repository issues
 * - /prs/:owner/:repo - List repository pull requests
 * - /user/:username - Get user information
 * 
 * @param {Request} request - The incoming HTTP request
 * @param {Env} env - Environment variables (including GITHUB_TOKEN)
 * @param {ExecutionContext} ctx - Execution context for async operations
 * @returns {Promise<Response>} HTTP response
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Create GitHub API client
      const client = createGitHubClient(env);

      // Parse URL and route
      const url = new URL(request.url);
      const path = url.pathname;
      const pathSegments = path.split('/').filter(segment => segment);

      // Health check endpoint
      if (path === '/' || path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'lightbulb-aquarium',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Route: /repo/:owner/:repo
      if (pathSegments[0] === 'repo' && pathSegments.length === 3) {
        const [, owner, repo] = pathSegments;
        const repository = await client.getRepository(owner, repo);
        return new Response(JSON.stringify(repository, null, 2), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Route: /issues/:owner/:repo
      if (pathSegments[0] === 'issues' && pathSegments.length === 3) {
        const [, owner, repo] = pathSegments;
        const state = url.searchParams.get('state') as 'open' | 'closed' | 'all' || 'open';
        const issues = await client.listIssues(owner, repo, { state });
        return new Response(JSON.stringify(issues, null, 2), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Route: /prs/:owner/:repo
      if (pathSegments[0] === 'prs' && pathSegments.length === 3) {
        const [, owner, repo] = pathSegments;
        const state = url.searchParams.get('state') as 'open' | 'closed' | 'all' || 'open';
        const prs = await client.listPullRequests(owner, repo, { state });
        return new Response(JSON.stringify(prs, null, 2), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Route: /user/:username
      if (pathSegments[0] === 'user' && pathSegments.length === 2) {
        const [, username] = pathSegments;
        const user = await client.getUserGraphQL(username);
        return new Response(JSON.stringify(user, null, 2), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Route: /rate-limit
      if (pathSegments[0] === 'rate-limit') {
        const rateLimit = await client.getRateLimit();
        return new Response(JSON.stringify(rateLimit, null, 2), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Route not found
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        availableRoutes: [
          '/health',
          '/repo/:owner/:repo',
          '/issues/:owner/:repo',
          '/prs/:owner/:repo',
          '/user/:username',
          '/rate-limit',
        ],
      }, null, 2), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      // Error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: errorMessage,
      }, null, 2), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },
};
