/**
 * @file DynamicAgent.ts
 * @description This is the Tier 1, user-facing agent. It manages WebSocket
 * connections from the UI and acts as an MCP Client, delegating tasks to the
 * appropriate Tier 2 specialist McpAgents.
 */

import { DurableObject } from "cloudflare:workers";

// Mock of the Cloudflare Agents SDK
class Agent extends DurableObject {
    protected env: any;
    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        this.env = env;
    }
    onMessage(ws: WebSocket, message: any) { /* to be implemented */ }
    fetch(request: Request) {
        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return new Response('Expected Upgrade: websocket', { status: 426 });
        }
        const [client, server] = Object.values(new WebSocketPair());
        server.accept();
        server.addEventListener('message', (event) => {
            this.onMessage(server, event.data);
        });
        return new Response(null, { status: 101, webSocket: client });
    }
}

// Mock of an MCP Client library
class McpClient {
    private specialistStub: DurableObjectStub;
    constructor(stub: DurableObjectStub) {
        this.specialistStub = stub;
    }
    async invoke(tool: string, params: any) {
        // In a real SDK, this would handle the full MCP handshake and SSE streaming.
        // Here, we simulate it by forwarding a simple fetch request.
        const req = new Request("http://agent/invoke", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool, params })
        });
        const res = await this.specialistStub.fetch(req);
        return await res.json();
    }
}


export class DynamicAgent extends Agent {
    /**
     * @description Handles incoming WebSocket messages from the user. It parses the
     * request, determines which specialist agent to call, invokes the specialist's
     * tool via an MCP client, and streams the result back to the user.
     */
    async onMessage(ws: WebSocket, message: any) {
        try {
            const { agent, tool, params } = JSON.parse(message);
            ws.send(JSON.stringify({ type: 'status', message: `Routing to ${agent} to call ${tool}...` }));

            const specialistBinding = this.env[agent.toUpperCase()];
            if (!specialistBinding) {
                throw new Error(`Specialist agent binding not found: ${agent}`);
            }

            // Get a unique DO for the session/task
            const id = specialistBinding.newUniqueId();
            const specialistStub = specialistBinding.get(id);

            const mcpClient = new McpClient(specialistStub);

            const result = await mcpClient.invoke(tool, params);

            ws.send(JSON.stringify({ type: 'result', tool, result }));

        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    }
}