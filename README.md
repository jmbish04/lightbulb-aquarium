# lightbulb-aquarium

A Cloudflare Worker with comprehensive GitHub API integration, designed for maximum readability and usability by AI agents and human developers.

## Overview

This project provides a TypeScript-based Cloudflare Worker that interfaces with GitHub's REST and GraphQL APIs. The implementation focuses on:

- **Complete GitHub API Coverage**: Access to repositories, issues, pull requests, commits, file contents, and more
- **AI-Optimized Documentation**: Extensive docstrings at file and function levels
- **Type Safety**: Full TypeScript type definitions for all API responses
- **Developer Experience**: Clean, well-structured code with helpful examples
- **Production Ready**: Error handling, rate limiting, timeout management

## Project Structure

```
lightbulb-aquarium/
├── src/
│   ├── index.ts              # Cloudflare Worker entry point
│   └── routes/
│       └── github.ts         # GitHub API module (core functionality)
├── dist/                     # Compiled JavaScript output
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── wrangler.toml            # Cloudflare Worker configuration
└── README.md                # This file
```

## Features

### GitHub REST API Support

- **Repositories**: Get, list, search repositories
- **Issues**: List, get, create, search issues
- **Pull Requests**: List, get, view files in PRs
- **File Contents**: Read files and directories from repositories
- **Commits**: List and get commit details
- **Search**: Search repositories, issues, and code
- **Rate Limits**: Check current rate limit status

### GitHub GraphQL API Support

- Execute custom GraphQL queries
- Pre-built queries for repositories and users
- Variable support for parameterized queries

### Key Components

#### GitHubAPIClient Class

The main client class provides methods for all GitHub operations:

```typescript
const client = new GitHubAPIClient(token);

// Get repository info
const repo = await client.getRepository('owner', 'repo');

// List open issues
const issues = await client.listIssues('owner', 'repo', { state: 'open' });

// Search repositories
const results = await client.searchRepositories('language:typescript stars:>1000');

// Execute GraphQL query
const data = await client.graphql(`
  query {
    viewer {
      login
    }
  }
`);
```

## Setup

### Prerequisites

- Node.js 16+ and npm
- Cloudflare account (for deployment)
- GitHub Personal Access Token

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jmbish04/lightbulb-aquarium.git
cd lightbulb-aquarium
```

2. Install dependencies:
```bash
npm install
```

3. Set up your GitHub token:
   - Create a GitHub Personal Access Token with appropriate scopes
   - Configure it as a secret in Cloudflare Workers (see Configuration section)

### Configuration

Set the `GITHUB_TOKEN` environment variable in your Cloudflare Worker:

```bash
# Using Wrangler CLI
wrangler secret put GITHUB_TOKEN
```

Or configure it in the Cloudflare dashboard under your Worker's Settings > Variables.

## Development

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Local Development

Run the Worker locally with Wrangler:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## API Endpoints

The Worker exposes the following endpoints:

### Health Check
```
GET /health
```
Returns service status and version information.

### Repository Information
```
GET /repo/:owner/:repo
```
Returns detailed information about a repository.

Example: `/repo/octocat/Hello-World`

### List Issues
```
GET /issues/:owner/:repo?state=open
```
Lists issues for a repository. Query params:
- `state`: `open`, `closed`, or `all` (default: `open`)

Example: `/issues/octocat/Hello-World?state=open`

### List Pull Requests
```
GET /prs/:owner/:repo?state=open
```
Lists pull requests for a repository. Query params:
- `state`: `open`, `closed`, or `all` (default: `open`)

Example: `/prs/octocat/Hello-World?state=closed`

### User Information
```
GET /user/:username
```
Returns user information via GraphQL.

Example: `/user/octocat`

### Rate Limit Status
```
GET /rate-limit
```
Returns current GitHub API rate limit information.

## Usage Examples

### For AI Agents

The module is optimized for AI agent consumption with:

1. **Comprehensive Type Definitions**: All responses are fully typed
2. **Detailed Docstrings**: Every function has usage examples
3. **Error Messages**: Clear, actionable error descriptions
4. **Consistent Patterns**: Predictable method naming and parameter structures

Example AI agent usage:
```typescript
// Import the client
import { GitHubAPIClient } from './routes/github';

// Initialize with token
const client = new GitHubAPIClient(env.GITHUB_TOKEN);

// Get repository data
const repo = await client.getRepository('owner', 'repo');
console.log(`Repository has ${repo.stargazers_count} stars`);

// List and analyze issues
const issues = await client.listIssues('owner', 'repo', { 
  state: 'open',
  labels: 'bug'
});
console.log(`Found ${issues.length} open bugs`);
```

### For Human Developers

```typescript
import { createGitHubClient } from './routes/github';

// Quick client creation from environment
const client = createGitHubClient(env);

// Chain multiple operations
const [repo, issues, prs] = await Promise.all([
  client.getRepository('owner', 'repo'),
  client.listIssues('owner', 'repo', { state: 'open' }),
  client.listPullRequests('owner', 'repo', { state: 'open' })
]);

// Process results
console.log(`${repo.name}: ${issues.length} issues, ${prs.length} PRs`);
```

## Module Documentation

### Core Methods

All methods are documented with:
- Purpose and behavior description
- Parameter types and descriptions
- Return type information
- Usage examples
- Error conditions

See the inline documentation in `src/routes/github.ts` for complete details.

### Type Definitions

Key interfaces include:
- `Repository`: Repository metadata
- `Issue`: Issue details
- `PullRequest`: Pull request information
- `FileContent`: File/directory content
- `Commit`: Commit details
- `RateLimitInfo`: Rate limit status

## Rate Limiting

GitHub API has rate limits:
- **REST API**: 5,000 requests/hour (authenticated)
- **GraphQL API**: 5,000 points/hour
- **Search API**: 30 requests/minute

The client includes helpers to check rate limit status:

```typescript
const limits = await client.getRateLimit();
console.log(`Remaining: ${limits.core.remaining}/${limits.core.limit}`);
```

## Error Handling

All methods throw errors with descriptive messages:

```typescript
try {
  const repo = await client.getRepository('owner', 'repo');
} catch (error) {
  console.error(`Failed to fetch repository: ${error.message}`);
}
```

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing style and patterns
- All public methods have comprehensive docstrings
- Types are properly defined
- Examples are included in documentation

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.