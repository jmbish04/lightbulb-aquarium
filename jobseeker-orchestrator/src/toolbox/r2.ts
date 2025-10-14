/**
 * R2 Storage Toolbox
 *
 * Handles large artifact storage for AI responses, deliverables, and submissions.
 * Implements TASK-007: Large Response Handling strategy.
 *
 * Storage Thresholds:
 * - Small responses (< 20KB): Store in D1
 * - Large responses (>= 20KB): Store in R2, reference in D1
 */

export interface Env {
  DELIVERABLES: R2Bucket;
}

/**
 * Size threshold for R2 storage (20KB)
 * Responses larger than this are stored in R2 instead of D1
 */
export const R2_THRESHOLD = 20_000; // 20KB

/**
 * Maximum content size for R2 storage (100MB)
 * Cloudflare Workers request size limit
 */
export const R2_MAX_SIZE = 100_000_000; // 100MB

/**
 * Store text content in R2 with metadata
 *
 * @param env - Worker environment with R2 bucket binding
 * @param key - R2 object key (path)
 * @param content - Text content to store
 * @param contentType - MIME type (default: text/plain)
 * @param metadata - Optional custom metadata
 * @returns Promise<string> - The R2 key
 *
 * @example
 * ```typescript
 * const key = await r2PutText(env,
 *   "submissions/run-123/vision/openai.md",
 *   markdownContent,
 *   "text/markdown",
 *   { runId: "run-123", provider: "openai" }
 * );
 * ```
 */
export async function r2PutText(
  env: Env,
  key: string,
  content: string,
  contentType: string = "text/plain",
  metadata?: Record<string, string>
): Promise<string> {
  // Validate content size
  if (content.length > R2_MAX_SIZE) {
    throw new Error(`Content size ${content.length} exceeds R2 max size ${R2_MAX_SIZE}`);
  }

  // Store in R2 with metadata
  await env.DELIVERABLES.put(key, content, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable" // 1 year cache
    },
    customMetadata: metadata
  });

  return key;
}

/**
 * Store binary content in R2
 *
 * @param env - Worker environment
 * @param key - R2 object key
 * @param content - Binary content (ArrayBuffer, Blob, ReadableStream)
 * @param contentType - MIME type
 * @param metadata - Optional metadata
 * @returns Promise<string> - The R2 key
 */
export async function r2PutBinary(
  env: Env,
  key: string,
  content: ArrayBuffer | Blob | ReadableStream,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  await env.DELIVERABLES.put(key, content, {
    httpMetadata: { contentType },
    customMetadata: metadata
  });

  return key;
}

/**
 * Retrieve text content from R2
 *
 * @param env - Worker environment
 * @param key - R2 object key
 * @returns Promise<string | null> - Content or null if not found
 */
export async function r2GetText(env: Env, key: string): Promise<string | null> {
  const object = await env.DELIVERABLES.get(key);

  if (!object) {
    return null;
  }

  return await object.text();
}

/**
 * Retrieve binary content from R2
 *
 * @param env - Worker environment
 * @param key - R2 object key
 * @returns Promise<ArrayBuffer | null> - Content or null if not found
 */
export async function r2GetBinary(env: Env, key: string): Promise<ArrayBuffer | null> {
  const object = await env.DELIVERABLES.get(key);

  if (!object) {
    return null;
  }

  return await object.arrayBuffer();
}

/**
 * Stream R2 content directly in Response
 * Efficient for large files
 *
 * @param env - Worker environment
 * @param key - R2 object key
 * @returns Promise<Response> - Response with R2 content or 404
 */
export async function r2StreamResponse(env: Env, key: string): Promise<Response> {
  const object = await env.DELIVERABLES.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Length": object.size.toString(),
      "Cache-Control": object.httpMetadata?.cacheControl || "public, max-age=3600",
      "ETag": object.etag
    }
  });
}

/**
 * Delete object from R2
 *
 * @param env - Worker environment
 * @param key - R2 object key
 */
export async function r2Delete(env: Env, key: string): Promise<void> {
  await env.DELIVERABLES.delete(key);
}

/**
 * Check if object exists in R2
 *
 * @param env - Worker environment
 * @param key - R2 object key
 * @returns Promise<boolean> - True if exists
 */
export async function r2Exists(env: Env, key: string): Promise<boolean> {
  const object = await env.DELIVERABLES.head(key);
  return object !== null;
}

/**
 * List objects with prefix
 *
 * @param env - Worker environment
 * @param prefix - Key prefix to filter
 * @param limit - Maximum number of results
 * @returns Promise<string[]> - Array of keys
 */
export async function r2List(
  env: Env,
  prefix: string,
  limit: number = 1000
): Promise<string[]> {
  const listed = await env.DELIVERABLES.list({ prefix, limit });
  return listed.objects.map(obj => obj.key);
}

/**
 * Generate standardized R2 key for submissions
 *
 * @param runId - Evaluation run ID
 * @param section - Section name
 * @param provider - AI provider
 * @param extension - File extension (default: .md)
 * @returns string - R2 key path
 *
 * @example
 * ```typescript
 * r2KeyForSubmission("run-123", "Vision", "openai")
 * // Returns: "submissions/run-123/vision/openai.md"
 * ```
 */
export function r2KeyForSubmission(
  runId: string,
  section: string,
  provider: string,
  extension: string = "md"
): string {
  const normalizedSection = section.toLowerCase().replace(/\s+/g, "-");
  return `submissions/${runId}/${normalizedSection}/${provider}.${extension}`;
}

/**
 * Generate standardized R2 key for deliverables
 *
 * @param runId - Evaluation run ID
 * @param section - Section name
 * @param extension - File extension (default: html)
 * @returns string - R2 key path
 *
 * @example
 * ```typescript
 * r2KeyForDeliverable("run-123", "Vision")
 * // Returns: "deliverables/run-123/vision.html"
 * ```
 */
export function r2KeyForDeliverable(
  runId: string,
  section: string,
  extension: string = "html"
): string {
  const normalizedSection = section.toLowerCase().replace(/\s+/g, "-");
  return `deliverables/${runId}/${normalizedSection}.${extension}`;
}

/**
 * Clean path for R2 key (remove leading slashes)
 *
 * @param path - Path string
 * @returns string - Cleaned path
 */
export function r2KeyFor(path: string): string {
  return path.replace(/^\/+/, "");
}

/**
 * Determine if content should be stored in R2 vs D1
 *
 * @param content - Content to evaluate
 * @returns boolean - True if should use R2
 */
export function shouldUseR2(content: string): boolean {
  return content.length >= R2_THRESHOLD;
}

/**
 * Store AI response with automatic R2/D1 selection
 * Returns object with storage decision
 *
 * @param env - Worker environment
 * @param runId - Evaluation run ID
 * @param section - Section name
 * @param provider - AI provider
 * @param content - Response content
 * @returns Promise<StorageResult>
 *
 * @example
 * ```typescript
 * const result = await storeAIResponse(env, "run-123", "Vision", "openai", largeContent);
 * if (result.stored_in === "r2") {
 *   // Store r2_key in D1 submissions table
 *   await db.insert({ r2_key: result.r2_key, content: null });
 * } else {
 *   // Store content directly in D1
 *   await db.insert({ r2_key: null, content: result.content });
 * }
 * ```
 */
export interface StorageResult {
  stored_in: "r2" | "d1";
  content?: string;    // Present if stored_in === "d1"
  r2_key?: string;     // Present if stored_in === "r2"
  size: number;
}

export async function storeAIResponse(
  env: Env,
  runId: string,
  section: string,
  provider: string,
  content: string
): Promise<StorageResult> {
  const size = content.length;

  if (shouldUseR2(content)) {
    // Store in R2
    const key = r2KeyForSubmission(runId, section, provider);
    await r2PutText(env, key, content, "text/markdown", {
      runId,
      section,
      provider,
      size: size.toString(),
      timestamp: new Date().toISOString()
    });

    return {
      stored_in: "r2",
      r2_key: key,
      size
    };
  } else {
    // Store in D1
    return {
      stored_in: "d1",
      content,
      size
    };
  }
}

/**
 * Retrieve AI response from either R2 or D1
 *
 * @param env - Worker environment
 * @param content - D1 content (if stored inline)
 * @param r2Key - R2 key (if stored in R2)
 * @returns Promise<string | null> - Content or null if not found
 */
export async function retrieveAIResponse(
  env: Env,
  content: string | null,
  r2Key: string | null
): Promise<string | null> {
  if (content) {
    // Stored in D1
    return content;
  } else if (r2Key) {
    // Stored in R2
    return await r2GetText(env, r2Key);
  }

  return null;
}
