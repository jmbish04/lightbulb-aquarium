/**
 * @fileoverview Example Usage of GitHub API Module
 * 
 * This file demonstrates various ways to use the GitHub API client
 * in a Cloudflare Worker environment.
 */

import { GitHubAPIClient, createGitHubClient } from './routes/github.js';
import type { Env } from './index.js';

/**
 * Example 1: Basic Repository Information
 * 
 * Fetches basic information about a repository
 */
async function exampleGetRepository(env: Env) {
  const client = createGitHubClient(env);
  
  const repo = await client.getRepository('octocat', 'Hello-World');
  console.log(`Repository: ${repo.full_name}`);
  console.log(`Description: ${repo.description}`);
  console.log(`Stars: ${repo.stargazers_count}`);
  console.log(`Language: ${repo.language}`);
}

/**
 * Example 2: List Open Issues
 * 
 * Retrieves all open issues for a repository
 */
async function exampleListIssues(env: Env) {
  const client = createGitHubClient(env);
  
  const issues = await client.listIssues('octocat', 'Hello-World', {
    state: 'open',
    per_page: 10,
  });
  
  console.log(`Found ${issues.length} open issues:`);
  issues.forEach(issue => {
    console.log(`#${issue.number}: ${issue.title}`);
  });
}

/**
 * Example 3: Search Repositories
 * 
 * Searches for repositories matching criteria
 */
async function exampleSearchRepositories(env: Env) {
  const client = createGitHubClient(env);
  
  const results = await client.searchRepositories('language:typescript stars:>1000', {
    sort: 'stars',
    order: 'desc',
    per_page: 5,
  });
  
  console.log(`Found ${results.total_count} repositories:`);
  results.items.forEach(repo => {
    console.log(`${repo.full_name} - ${repo.stargazers_count} stars`);
  });
}

/**
 * Example 4: Get File Contents
 * 
 * Reads the contents of a file from a repository
 */
async function exampleGetFileContents(env: Env) {
  const client = createGitHubClient(env);
  
  const content = await client.getFileContent('octocat', 'Hello-World', 'README');
  console.log('README.md contents:');
  console.log(content);
}

/**
 * Example 5: List Pull Requests
 * 
 * Gets all open pull requests for a repository
 */
async function exampleListPullRequests(env: Env) {
  const client = createGitHubClient(env);
  
  const prs = await client.listPullRequests('octocat', 'Hello-World', {
    state: 'open',
    sort: 'updated',
    direction: 'desc',
  });
  
  console.log(`Found ${prs.length} open pull requests:`);
  prs.forEach(pr => {
    console.log(`#${pr.number}: ${pr.title} (${pr.head.ref} -> ${pr.base.ref})`);
  });
}

/**
 * Example 6: Execute GraphQL Query
 * 
 * Demonstrates using GraphQL for complex queries
 */
async function exampleGraphQLQuery(env: Env) {
  const client = createGitHubClient(env);
  
  const query = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        name
        description
        stargazerCount
        issues(states: OPEN) {
          totalCount
        }
        pullRequests(states: OPEN) {
          totalCount
        }
      }
    }
  `;
  
  const result = await client.graphql<{ repository: any }>(query, {
    owner: 'octocat',
    name: 'Hello-World',
  });
  
  console.log('GraphQL Result:', JSON.stringify(result.data, null, 2));
}

/**
 * Example 7: Check Rate Limits
 * 
 * Monitors API rate limits
 */
async function exampleCheckRateLimit(env: Env) {
  const client = createGitHubClient(env);
  
  const limits = await client.getRateLimit();
  console.log('Rate Limits:');
  console.log(`Core API: ${limits.core.remaining}/${limits.core.limit}`);
  console.log(`Search API: ${limits.search.remaining}/${limits.search.limit}`);
  console.log(`GraphQL API: ${limits.graphql.remaining}/${limits.graphql.limit}`);
}

/**
 * Example 8: Create an Issue
 * 
 * Creates a new issue in a repository
 */
async function exampleCreateIssue(env: Env) {
  const client = createGitHubClient(env);
  
  const newIssue = await client.createIssue('owner', 'repo', {
    title: 'Example issue created via API',
    body: 'This is an example issue created using the GitHub API client.',
    labels: ['example', 'api'],
  });
  
  console.log(`Created issue #${newIssue.number}: ${newIssue.title}`);
}

/**
 * Example 9: Get Commit History
 * 
 * Retrieves recent commits from a repository
 */
async function exampleGetCommits(env: Env) {
  const client = createGitHubClient(env);
  
  const commits = await client.listCommits('octocat', 'Hello-World', {
    per_page: 5,
  });
  
  console.log('Recent commits:');
  commits.forEach(commit => {
    console.log(`${commit.sha.substring(0, 7)}: ${commit.commit.message}`);
  });
}

/**
 * Example 10: Get User Information via GraphQL
 * 
 * Fetches comprehensive user data
 */
async function exampleGetUser(env: Env) {
  const client = createGitHubClient(env);
  
  const user = await client.getUserGraphQL('octocat');
  console.log(`User: ${user.login}`);
  console.log(`Name: ${user.name}`);
  console.log(`Followers: ${user.followers.totalCount}`);
  console.log(`Repositories: ${user.repositories.totalCount}`);
}

// Export all examples
export {
  exampleGetRepository,
  exampleListIssues,
  exampleSearchRepositories,
  exampleGetFileContents,
  exampleListPullRequests,
  exampleGraphQLQuery,
  exampleCheckRateLimit,
  exampleCreateIssue,
  exampleGetCommits,
  exampleGetUser,
};
