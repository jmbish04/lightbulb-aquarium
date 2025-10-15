/**
 * KV Storage Toolbox
 *
 * Handles ephemeral state, progress logs, and cursors using Workers KV.
 * KV is ideal for high-churn, eventually-consistent data.
 */

export interface Env {
  STATE: KVNamespace;
}

/**
 * Store value in KV
 *
 * @param env - Worker environment
 * @param key - KV key
 * @param value - Value to store
 * @param expirationTtl - Optional TTL in seconds
 */
export async function kvPut(
  env: Env,
  key: string,
  value: string,
  expirationTtl?: number
): Promise<void> {
  await env.STATE.put(key, value, expirationTtl ? { expirationTtl } : undefined);
}

/**
 * Get value from KV
 *
 * @param env - Worker environment
 * @param key - KV key
 * @returns Promise<string | null>
 */
export async function kvGet(env: Env, key: string): Promise<string | null> {
  return await env.STATE.get(key);
}

/**
 * Delete key from KV
 *
 * @param env - Worker environment
 * @param key - KV key
 */
export async function kvDelete(env: Env, key: string): Promise<void> {
  await env.STATE.delete(key);
}

/**
 * Append line to log (naive implementation)
 * For production, consider using Durable Objects for consistent logs
 *
 * @param env - Worker environment
 * @param key - Log key
 * @param line - Line to append
 */
export async function kvAppend(env: Env, key: string, line: string): Promise<void> {
  const existing = (await env.STATE.get(key)) || "";
  await env.STATE.put(key, existing + line + "\n");
}
