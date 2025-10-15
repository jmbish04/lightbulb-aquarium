/**
 * @file AITool.ts
 * @description Thin wrapper around the Cloudflare AI binding that ensures
 *              AI prompts initiated by agents are structured, logged, and
 *              parsed consistently. The goal is to make it safe for other
 *              tools to depend on high quality AI output without duplicating
 *              boilerplate request logic.
 */

import { KVNamespace } from '@cloudflare/workers-types';

interface EnvWithAI {
    AI?: {
        run(model: string, payload: Record<string, any>): Promise<any>;
    };
    MCP_LOGS?: KVNamespace;
}

export interface AIToolRunOptions {
    prompt: string;
    system?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    response_format?: Record<string, any>;
}

export interface AIToolRunResult {
    response: string;
    raw: any;
}

/**
 * @description Agent-safe facade over the AI binding. It logs prompts to KV for
 *              traceability and always resolves to a string response, even when
 *              the underlying binding returns a Response object.
 */
export class AITool {
    private env: EnvWithAI;

    constructor(env: EnvWithAI) {
        this.env = env;
    }

    private async writeAuditLog(prompt: string, model: string): Promise<void> {
        try {
            if (!this.env.MCP_LOGS) return;
            const key = `ai-log:${Date.now()}:${crypto.randomUUID()}`;
            await this.env.MCP_LOGS.put(key, JSON.stringify({ model, prompt }));
        } catch (error) {
            console.warn("Failed to persist AI audit log", error);
        }
    }

    /**
     * @description Executes an AI call with a conversational payload. The
     *              request is logged, and the response body is normalised into
     *              a simple object.
     */
    async run(model: string, options: AIToolRunOptions): Promise<AIToolRunResult> {
        if (!this.env.AI || typeof this.env.AI.run !== 'function') {
            throw new Error('AI binding is not configured. Set the AI binding in wrangler.toml.');
        }

        const { prompt, system, temperature, max_tokens, stream, response_format } = options;

        await this.writeAuditLog(prompt, model);

        const payload: Record<string, any> = {
            messages: [
                system ? { role: 'system', content: system } : null,
                { role: 'user', content: prompt }
            ].filter(Boolean),
            temperature,
            max_tokens,
            stream,
            response_format
        };

        const raw = await this.env.AI.run(model, payload);
        let responseText: string;

        if (raw instanceof Response) {
            const contentType = raw.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await raw.json();
                responseText = json.result ?? JSON.stringify(json);
            } else {
                responseText = await raw.text();
            }
        } else if (raw && typeof raw === 'object' && 'response' in raw) {
            responseText = (raw as any).response;
        } else if (typeof raw === 'string') {
            responseText = raw;
        } else {
            responseText = JSON.stringify(raw);
        }

        return { response: responseText, raw };
    }
}
