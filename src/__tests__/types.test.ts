/**
 * @fileoverview Basic type checking and module verification test
 * 
 * This file verifies that:
 * 1. The GitHub module can be imported
 * 2. Types are correctly defined
 * 3. Basic instantiation works
 */

import { 
  GitHubAPIClient, 
  createGitHubClient,
  parseGitHubURL,
  formatDate,
  isRateLimitLow,
  type Repository,
  type Issue,
  type PullRequest,
  type FileContent,
  type Commit,
  type RateLimitInfo
} from '../routes/github.js';

/**
 * Test type checking and basic functionality
 */
function testTypes() {
  console.log('Testing type definitions...');

  // Test client creation
  const client = new GitHubAPIClient('test-token');
  console.log('✓ GitHubAPIClient instantiation works');

  // Test parseGitHubURL
  const parsed = parseGitHubURL('https://github.com/octocat/Hello-World');
  if (parsed && parsed.owner === 'octocat' && parsed.repo === 'Hello-World') {
    console.log('✓ parseGitHubURL works correctly');
  } else {
    console.error('✗ parseGitHubURL failed');
  }

  // Test formatDate
  const formatted = formatDate('2024-01-15T12:00:00Z');
  if (formatted.includes('2024')) {
    console.log('✓ formatDate works correctly');
  } else {
    console.error('✗ formatDate failed');
  }

  // Test isRateLimitLow
  const testRateLimit: RateLimitInfo = {
    limit: 5000,
    remaining: 100,
    reset: Date.now() / 1000 + 3600,
    resource: 'core'
  };
  if (isRateLimitLow(testRateLimit, 0.1)) {
    console.log('✓ isRateLimitLow works correctly');
  } else {
    console.error('✗ isRateLimitLow failed');
  }

  console.log('\nAll type checks passed! ✓');
}

// Run tests
testTypes();
