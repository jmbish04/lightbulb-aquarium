/**
 * @file VectorizeTool.ts
 * @description A tool for agents to interact with Cloudflare Vectorize indexes.
 * This tool provides essential methods for vector search, including `query` and `insert`,
 * and critically, `upsert`, which is vital for keeping vector data fresh without
 * creating duplicates. Proper error handling is included to manage API failures.
 */

import { VectorizeIndex, VectorizeMutationResult, VectorizeMatches } from '@cloudflare/workers-types';

interface Env {
    [key: string]: VectorizeIndex;
}

export class VectorizeTool {
    private env: Env;

    /**
     * @description Initializes the VectorizeTool with the worker's environment.
     * @param {Env} env - The Cloudflare worker environment containing Vectorize bindings.
     */
    constructor(env: Env) {
        this.env = env;
    }

    /**
     * @description Retrieves a Vectorize index binding from the environment.
     * @param {string} index_binding - The name of the Vectorize binding in wrangler.toml.
     * @returns {VectorizeIndex} The Vectorize index instance.
     * @private
     */
    private getIndex(index_binding: string): VectorizeIndex {
        const index = this.env[index_binding];
        if (!index) {
            throw new Error(`Vectorize index binding '${index_binding}' not found.`);
        }
        return index;
    }

    /**
     * @description Inserts vectors into the specified index. Use this for new, unique vectors.
     * For data that may already exist, `upsert` is preferred.
     * @param {string} index_binding - The name of the Vectorize binding.
     * @param {Array<{id: string, values: number[], metadata?: object}>} vectors - An array of vector objects to insert.
     * @returns {Promise<VectorizeMutationResult>} A promise that resolves with the result of the insert operation.
     */
    async insert(index_binding: string, vectors: Array<{id: string, values: number[], metadata?: object}>): Promise<VectorizeMutationResult> {
        try {
            const index = this.getIndex(index_binding);
            return await index.insert(vectors);
        } catch (error) {
            console.error(`VectorizeTool insert failed for binding '${index_binding}':`, error);
            throw new Error(`Vectorize insert failed: ${error.message}`);
        }
    }

    /**
     * @description Inserts vectors if their IDs are new, or updates them if the IDs already exist.
     * This is the recommended method for maintaining data to prevent duplicates and ensure freshness.
     * @param {string} index_binding - The name of the Vectorize binding.
     * @param {Array<{id: string, values: number[], metadata?: object}>} vectors - An array of vector objects to upsert.
     * @returns {Promise<VectorizeMutationResult>} A promise that resolves with the result of the upsert operation.
     */
    async upsert(index_binding: string, vectors: Array<{id: string, values: number[], metadata?: object}>): Promise<VectorizeMutationResult> {
        try {
            const index = this.getIndex(index_binding);
            return await index.upsert(vectors);
        } catch (error) {
            console.error(`VectorizeTool upsert failed for binding '${index_binding}':`, error);
            throw new Error(`Vectorize upsert failed: ${error.message}`);
        }
    }

    /**
     * @description Queries the index to find the most similar vectors to the given vector.
     * @param {string} index_binding - The name of the Vectorize binding.
     * @param {number[]} vector - The query vector.
     * @param {object} [options] - Optional query parameters.
     * @param {number} [options.topK=5] - The number of top results to return.
     * @param {boolean} [options.returnMetadata=true] - Whether to return vector metadata.
     * @returns {Promise<VectorizeMatches>} A promise that resolves with the matched vectors.
     */
    async query(index_binding: string, vector: number[], options: { topK?: number; returnMetadata?: boolean } = { topK: 5, returnMetadata: true }): Promise<VectorizeMatches> {
        try {
            const index = this.getIndex(index_binding);
            return await index.query(vector, options);
        } catch (error) {
            console.error(`VectorizeTool query failed for binding '${index_binding}':`, error);
            throw new Error(`Vectorize query failed: ${error.message}`);
        }
    }
}