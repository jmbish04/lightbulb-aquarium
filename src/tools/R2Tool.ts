/**
 * @file R2Tool.ts
 * @description Provides a comprehensive toolkit for AI agents to interact with Cloudflare R2 buckets.
 * This includes essential object operations like put, get, head, list, and batch delete,
 * with robust error handling for each method.
 */

import { R2Bucket, R2Object, R2ObjectBody, R2ListOptions, R2Objects } from '@cloudflare/workers-types';

interface Env {
    [key: string]: R2Bucket;
}

export class R2Tool {
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    private getBucket(bucket_binding: string): R2Bucket {
        const bucket = this.env[bucket_binding];
        if (!bucket) throw new Error(`R2 bucket binding '${bucket_binding}' not found.`);
        return bucket;
    }

    async put(bucket_binding: string, key: string, data: ReadableStream | ArrayBuffer | string): Promise<R2Object> {
        try {
            return await this.getBucket(bucket_binding).put(key, data);
        } catch (error) {
            throw new Error(`R2 put failed: ${error.message}`);
        }
    }

    async get(bucket_binding: string, key: string): Promise<R2Object | null> {
        try {
            const obj = await this.getBucket(bucket_binding).get(key);
            if (!obj) return null;
            return obj;
        } catch (error) {
            throw new Error(`R2 get failed: ${error.message}`);
        }
    }

    async head(bucket_binding: string, key: string): Promise<R2Object | null> {
        try {
            return await this.getBucket(bucket_binding).head(key);
        } catch (error) {
            throw new Error(`R2 head failed: ${error.message}`);
        }
    }

    async delete(bucket_binding: string, keys: string | string[]): Promise<void> {
        try {
            await this.getBucket(bucket_binding).delete(keys);
        } catch (error) {
            throw new Error(`R2 delete failed: ${error.message}`);
        }
    }

    async list(bucket_binding: string, options?: R2ListOptions): Promise<R2Objects> {
        try {
            return await this.getBucket(bucket_binding).list(options);
        } catch (error) {
            throw new Error(`R2 list failed: ${error.message}`);
        }
    }
}