/**
 * @file GuidanceTool.ts
 * @description A tool for the BestPracticesAgent that uses advanced AI patterns
 * to generate high-quality guidance.
 */

import { AITool } from './AITool';
import { D1Tool } from './D1Tool';

interface Env {
    // Requires AI and D1 bindings
    [key: string]: any;
}

export class GuidanceTool {
    private aiTool: AITool;
    private d1Tool: D1Tool;

    constructor(env: Env) {
        this.aiTool = new AITool(env);
        this.d1Tool = new D1Tool(env);
    }

    /**
     * @description Implements the "Agent Fan-Out and Judging" pattern.
     * It generates multiple potential solutions to a given topic, then uses a separate
     * "judge" model to evaluate and select the best one before returning it.
     * The final, approved guidance is stored in the D1 database for future reference.
     * @param {string} topic - The topic to get best practice guidance on (e.g., "Cloudflare Worker error handling").
     * @param {number} [candidate_count=3] - The number of candidate solutions to generate.
     * @returns {Promise<string>} A promise that resolves with the single best guidance string.
     */
    async getGuidance(topic: string, candidate_count: number = 3): Promise<string> {
        console.log(`Generating ${candidate_count} guidance candidates for topic: ${topic}`);

        // 1. Fan-Out: Generate multiple candidate solutions in parallel.
        const candidatePromises = [];
        for (let i = 0; i < candidate_count; i++) {
            const promise = this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
                prompt: `You are a world-class software architect. Provide a detailed, expert-level best practice guide on the following topic: ${topic}. Be concise, clear, and actionable.`
            });
            candidatePromises.push(promise);
        }
        const candidateResults = await Promise.all(candidatePromises);
        const candidates = candidateResults.map(res => res.response);

        console.log("Candidates generated. Now seeking judgment.");

        // 2. Judging: Present all candidates to a "judge" model.
        const judgePrompt = `You are a senior engineering manager responsible for code quality. Below are several proposed best practice guides on the topic "${topic}". Evaluate them all and select the single best one. Your response must be ONLY the full text of the best guide, with no extra commentary or preamble.

        Here are the candidates:
        ${candidates.map((c, i) => `\n--- Candidate ${i + 1} ---\n${c}`).join('')}

        Now, provide the full text of the best guide and nothing else.`;

        const judgment = await this.aiTool.run('@cf/meta/llama-2-7b-chat-int8', {
            prompt: judgePrompt
        });

        const bestGuidance = judgment.response.trim();
        console.log("Best guidance selected.");

        // 3. Store the approved guidance in D1 for future retrieval and learning.
        try {
            await this.d1Tool.insert('DB', 'best_practices', {
                id: crypto.randomUUID(),
                topic: topic,
                guidance: bestGuidance,
                source: 'ai_generated_judged'
            });
            console.log("Best guidance has been stored in the D1 database.");
        } catch (e) {
            console.error("Failed to store guidance in D1:", e);
            // Non-fatal, we can still return the guidance.
        }

        return bestGuidance;
    }
}