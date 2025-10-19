/**
 * D1 Database Toolbox
 *
 * Provides CRUD helpers and utilities for D1 database operations.
 * Handles evaluation data, submissions, scores, and competition tracking.
 */

export interface Env {
  DB: D1Database;
}

/**
 * Execute SQL statement with parameters
 * Use for INSERT, UPDATE, DELETE operations
 *
 * @param env - Worker environment
 * @param sql - SQL statement
 * @param params - Bind parameters
 * @returns Promise<D1Response> - Query result
 *
 * @example
 * ```typescript
 * await exec(env, "INSERT INTO evals (id, status) VALUES (?, ?)", "run-123", "running");
 * ```
 */
export async function exec(env: Env, sql: string, ...params: unknown[]): Promise<D1Response> {
  return await env.DB.prepare(sql).bind(...params).run();
}

/**
 * Execute SELECT query and return all results
 *
 * @param env - Worker environment
 * @param sql - SQL SELECT statement
 * @param params - Bind parameters
 * @returns Promise<T[]> - Array of rows
 *
 * @example
 * ```typescript
 * const evals = await all<Eval>(env, "SELECT * FROM evals WHERE status = ?", "completed");
 * ```
 */
export async function all<T = unknown>(
  env: Env,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const result = await env.DB.prepare(sql).bind(...params).all<T>();
  return result.results || [];
}

/**
 * Execute SELECT query and return first result
 *
 * @param env - Worker environment
 * @param sql - SQL SELECT statement
 * @param params - Bind parameters
 * @returns Promise<T | null> - First row or null
 *
 * @example
 * ```typescript
 * const eval = await first<Eval>(env, "SELECT * FROM evals WHERE id = ?", "run-123");
 * ```
 */
export async function first<T = unknown>(
  env: Env,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const result = await env.DB.prepare(sql).bind(...params).first<T>();
  return result || null;
}

/**
 * Execute batch of SQL statements atomically
 *
 * @param env - Worker environment
 * @param statements - Array of prepared statements
 * @returns Promise<D1Response[]> - Array of results
 */
export async function batch(
  env: Env,
  statements: D1PreparedStatement[]
): Promise<D1Response[]> {
  return await env.DB.batch(statements);
}

// Type definitions for our schema

export interface Eval {
  id: string;
  project_id: string;
  status: "running" | "completed" | "error";
  judge_model: string | null;
  sections: string; // JSON array
  created_at: number;
  updated_at: number;
  error?: string | null;
}

export interface Submission {
  id: string;
  eval_id: string;
  section: string;
  provider: string;
  content: string | null; // Null if stored in R2
  r2_key: string | null;   // Present if stored in R2
  created_at: number;
}

export interface Score {
  id: string;
  eval_id: string;
  section: string;
  winner_provider: string | null;
  scores_json: string;
  rationale: string | null;
  created_at: number;
}

export interface Deliverable {
  id: string;
  eval_id: string;
  section: string;
  provider: string;
  r2_key: string;
  content: string | null;
  created_at: number;
}

/**
 * Create new evaluation record
 */
export async function createEval(
  env: Env,
  id: string,
  projectId: string,
  judgeModel: string,
  sections: string[]
): Promise<void> {
  await exec(
    env,
    `INSERT INTO evals (id, project_id, status, judge_model, sections, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    projectId,
    "running",
    judgeModel,
    JSON.stringify(sections),
    Date.now(),
    Date.now()
  );
}

/**
 * Update evaluation status
 */
export async function updateEvalStatus(
  env: Env,
  id: string,
  status: "running" | "completed" | "error",
  error?: string
): Promise<void> {
  if (error) {
    await exec(
      env,
      `UPDATE evals SET status = ?, error = ?, updated_at = ? WHERE id = ?`,
      status,
      error,
      Date.now(),
      id
    );
  } else {
    await exec(
      env,
      `UPDATE evals SET status = ?, updated_at = ? WHERE id = ?`,
      status,
      Date.now(),
      id
    );
  }
}

/**
 * Create submission record
 */
export async function createSubmission(
  env: Env,
  evalId: string,
  section: string,
  provider: string,
  content: string | null,
  r2Key: string | null
): Promise<string> {
  const id = crypto.randomUUID();
  await exec(
    env,
    `INSERT INTO submissions (id, eval_id, section, provider, content, r2_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    evalId,
    section,
    provider,
    content,
    r2Key,
    Date.now()
  );
  return id;
}

/**
 * Create score record
 */
export async function createScore(
  env: Env,
  evalId: string,
  section: string,
  winnerProvider: string | null,
  scoresJson: string,
  rationale: string | null
): Promise<string> {
  const id = crypto.randomUUID();
  await exec(
    env,
    `INSERT INTO scores (id, eval_id, section, winner_provider, scores_json, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    evalId,
    section,
    winnerProvider,
    scoresJson,
    rationale,
    Date.now()
  );
  return id;
}

/**
 * Create deliverable record
 */
export async function createDeliverable(
  env: Env,
  evalId: string,
  section: string,
  provider: string,
  r2Key: string,
  content: string | null
): Promise<string> {
  const id = crypto.randomUUID();
  await exec(
    env,
    `INSERT INTO deliverables (id, eval_id, section, provider, r2_key, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    evalId,
    section,
    provider,
    r2Key,
    content,
    Date.now()
  );
  return id;
}

/**
 * Get evaluation by ID
 */
export async function getEval(env: Env, id: string): Promise<Eval | null> {
  return await first<Eval>(env, `SELECT * FROM evals WHERE id = ?`, id);
}

/**
 * List recent evaluations
 */
export async function listEvals(env: Env, limit: number = 50): Promise<Eval[]> {
  return await all<Eval>(
    env,
    `SELECT * FROM evals ORDER BY created_at DESC LIMIT ?`,
    limit
  );
}

/**
 * Get submissions for evaluation
 */
export async function getSubmissions(env: Env, evalId: string): Promise<Submission[]> {
  return await all<Submission>(
    env,
    `SELECT * FROM submissions WHERE eval_id = ? ORDER BY created_at`,
    evalId
  );
}

/**
 * Get scores for evaluation
 */
export async function getScores(env: Env, evalId: string): Promise<Score[]> {
  return await all<Score>(
    env,
    `SELECT * FROM scores WHERE eval_id = ? ORDER BY created_at`,
    evalId
  );
}

/**
 * Get deliverables for evaluation
 */
export async function getDeliverables(env: Env, evalId: string): Promise<Deliverable[]> {
  return await all<Deliverable>(
    env,
    `SELECT * FROM deliverables WHERE eval_id = ? ORDER BY created_at`,
    evalId
  );
}
