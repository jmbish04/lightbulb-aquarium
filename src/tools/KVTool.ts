/**
 * @file KVTool.ts
 * @description A tool for agents to interact with Cloudflare KV namespaces.
 * This tool includes a `list` method for key discovery and a simple in-memory
 * timestamp check to mitigate hitting the 1 write/sec per-key rate limit, although
 * a more robust distributed solution would be needed for high-concurrency scenarios.
 */

import { KVNamespace, KVNamespaceListResult } from '@cloudflare/workers-types';

interface Env {
    [key: string]: KVNamespace;
}

export class KVTool {
    private env: Env;
    private writeTimestamps: Map<string, number> = new Map();

    constructor(env: Env) {
        this.env = env;
    }

    private getNs(namespace_binding: string): KVNamespace {
        const ns = this.env[namespace_binding];
        if (!ns) throw new Error(`KV Namespace binding '${namespace_binding}' not found.`);
        return ns;
    }

    private canWrite(key: string): boolean {
        const lastWrite = this.writeTimestamps.get(key);
        const now = Date.now();
        if (lastWrite && (now - lastWrite) < 1000) {
            console.warn(`KV write for key '${key}' attempted too quickly. Throttling.`);
            return false;
        }
        this.writeTimestamps.set(key, now);
        // Clean up old timestamps occasionally
        if (this.writeTimestamps.size > 1000) {
            for (const [k, ts] of this.writeTimestamps.entries()) {
                if (now - ts > 60000) this.writeTimestamps.delete(k);
            }
        }
        return true;
    }

    async get(namespace_binding: string, key: string, type: "text" | "json" | "arrayBuffer" | "stream" = "text"): Promise<any> {
        try {
            return await this.getNs(namespace_binding).get(key, type);
        } catch (error) {
            throw new Error(`KV get failed: ${error.message}`);
        }
    }

    async put(namespace_binding: string, key: string, value: any, options?: {expirationTtl?: number}): Promise<void> {
        if (!this.canWrite(`${namespace_binding}:${key}`)) {
            throw new Error(`KV write rate limit hit for key '${key}'. Please wait a second.`);
        }
        try {
            await this.getNs(namespace_binding).put(key, value, options);
        } catch (error) {
            throw new Error(`KV put failed: ${error.message}`);
        }
    }

    async list(namespace_binding: string, options?: {prefix?: string, limit?: number, cursor?: string}): Promise<KVNamespaceListResult<unknown>> {
        try {
            return await this.getNs(namespace_binding).list(options);
        } catch (error) {
            throw new Error(`KV list failed: ${error.message}`);
        }
    }

    async delete(namespace_binding: string, key: string): Promise<void> {
        if (!this.canWrite(`${namespace_binding}:${key}`)) {
            throw new Error(`KV delete rate limit hit for key '${key}'. Please wait a second.`);
        }
        try {
            await this.getNs(namespace_binding).delete(key);
        } catch (error) {
            throw new Error(`KV delete failed: ${error.message}`);
        }
    }
}