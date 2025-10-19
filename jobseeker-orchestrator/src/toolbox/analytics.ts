/**
 * Analytics & Metrics Toolbox
 *
 * Implements TASK-010: Custom Metrics and Events
 * Uses Cloudflare Workers Analytics Engine for structured event tracking.
 *
 * Key Metrics:
 * - Agent execution time by provider
 * - Queue processing latency
 * - Judge evaluation time
 * - Error rates
 */

export interface Env {
  ANALYTICS?: AnalyticsEngineDataset;
}

/**
 * Metric event types for the platform
 */
export type MetricEvent =
  | "agent-start"
  | "agent-complete"
  | "agent-error"
  | "queue-start"
  | "queue-complete"
  | "queue-error"
  | "judge-start"
  | "judge-complete"
  | "judge-error"
  | "deliverable-saved"
  | "run-complete"
  | "run-error";

/**
 * Record agent execution metrics
 *
 * @param env - Worker environment
 * @param provider - AI provider (openai, anthropic, google)
 * @param executionTimeMs - Execution time in milliseconds
 * @param runId - Evaluation run ID
 * @param section - Section name
 * @param success - Whether execution succeeded
 *
 * @example
 * ```typescript
 * const start = performance.now();
 * const result = await runAgent(env, 'openai', prompt);
 * const end = performance.now();
 * recordAgentMetric(env, 'openai', end - start, runId, 'Vision', true);
 * ```
 */
export function recordAgentMetric(
  env: Env,
  provider: string,
  executionTimeMs: number,
  runId: string,
  section: string,
  success: boolean
): void {
  if (!env.ANALYTICS) return;

  env.ANALYTICS.writeDataPoint({
    blobs: [
      success ? "agent-complete" : "agent-error",
      provider,
      section
    ],
    doubles: [executionTimeMs],
    indexes: [runId]
  });
}

/**
 * Record queue processing metrics
 *
 * @param env - Worker environment
 * @param processingTimeMs - Processing time in milliseconds
 * @param messageId - Queue message ID
 * @param success - Whether processing succeeded
 */
export function recordQueueMetric(
  env: Env,
  processingTimeMs: number,
  messageId: string,
  success: boolean
): void {
  if (!env.ANALYTICS) return;

  env.ANALYTICS.writeDataPoint({
    blobs: [success ? "queue-complete" : "queue-error"],
    doubles: [processingTimeMs],
    indexes: [messageId]
  });
}

/**
 * Record judge evaluation metrics
 *
 * @param env - Worker environment
 * @param judgeTimeMs - Evaluation time in milliseconds
 * @param runId - Evaluation run ID
 * @param sectionsCount - Number of sections judged
 */
export function recordJudgeMetric(
  env: Env,
  judgeTimeMs: number,
  runId: string,
  sectionsCount: number
): void {
  if (!env.ANALYTICS) return;

  env.ANALYTICS.writeDataPoint({
    blobs: ["judge-complete"],
    doubles: [judgeTimeMs, sectionsCount],
    indexes: [runId]
  });
}

/**
 * Record error event
 *
 * @param env - Worker environment
 * @param errorType - Error type/name
 * @param runId - Evaluation run ID
 */
export function recordError(env: Env, errorType: string, runId: string): void {
  if (!env.ANALYTICS) return;

  env.ANALYTICS.writeDataPoint({
    blobs: ["error", errorType],
    doubles: [1],
    indexes: [runId]
  });
}

/**
 * Generic metric recording
 *
 * @param env - Worker environment
 * @param event - Event type
 * @param dimensions - Categorical dimensions (blobs)
 * @param metrics - Numerical metrics (doubles)
 * @param index - Sampling key
 */
export function recordMetric(
  env: Env,
  event: MetricEvent,
  dimensions: string[],
  metrics: number[],
  index: string
): void {
  if (!env.ANALYTICS) return;

  env.ANALYTICS.writeDataPoint({
    blobs: [event, ...dimensions],
    doubles: metrics,
    indexes: [index]
  });
}

/**
 * Timer utility for measuring execution time
 *
 * @example
 * ```typescript
 * const timer = startTimer();
 * await someAsyncOperation();
 * const elapsed = timer.elapsed();
 * recordMetric(env, 'operation-complete', ['openai'], [elapsed], runId);
 * ```
 */
export function startTimer() {
  const start = performance.now();
  return {
    elapsed: () => performance.now() - start,
    elapsedMs: () => Math.round(performance.now() - start)
  };
}
