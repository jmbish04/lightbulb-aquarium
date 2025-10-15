import { DurableObject } from "cloudflare:workers";
import {
  type McpMessage,
  type McpResponse,
  McpServer,
  McpSession,
} from "@cloudflare/mcp-client";

// --- Base McpAgent Class (as provided in the prompt) ---
// Note: This is the same base class as before.

type McpAgentSession = {
  id: string;
  name?: string;
  socket: WebSocket;
  downstream: McpSession;
  upstream: McpSession;
};

export abstract class McpAgent<
  Env = unknown,
  State = unknown,
  Props extends Record<string, unknown> = Record<string, unknown>,
> extends DurableObject {
  abstract server: McpServer | undefined;
  abstract init(): Promise<void>;

  sessions: Map<string, McpAgentSession> = new Map();
  props: Props;

  constructor(state: State, env: Env, props: Props) {
    super(state, env);
    this.props = props;
  }

  static mount<
    Env = unknown,
    State = unknown,
    T extends McpAgent = McpAgent<Env, State>,
  >(
    path: string,
    handler?: (
      req: Request,
      ...args: any[]
    ) => Response | Promise<Response>,
  ) {
    const urlPattern = new URLPattern({ pathname: path });

    return (
      req: Request,
      env: Env & { [key: string]: DurableObjectNamespace },
      ctx: ExecutionContext,
      ...args: any[]
    ) => {
      const url = new URL(req.url);
      const match = urlPattern.exec(url.pathname, url.origin);

      if (!match) {
        return handler?.(req, ...args);
      }

      const durableObjectName = req.headers.get("X-Mcp-Session-Id") || "";
      const durableObjectBinding = (env as any)[
        this.name.toUpperCase()
      ] as DurableObjectNamespace;
      const durableObjectId = durableObjectBinding.idFromName(durableObjectName);
      const durableObjectStub = durableObjectBinding.get(durableObjectId, {
        props: match.pathname.groups,
      });

      return durableObjectStub.fetch(req);
    };
  }

  async fetch(req: Request): Promise<Response> {
    await this.init();

    if (!this.server) {
      return new Response("Upstream MCP server not initialized", {
        status: 500,
      });
    }

    const sessionId = req.headers.get("X-Mcp-Session-Id");
    if (!sessionId) {
      return new Response("Missing X-Mcp-Session-Id header", { status: 400 });
    }

    if (req.method === "OPTIONS") {
      return this.options(req);
    }

    if (req.method === "POST") {
      return this.handlePost(req, sessionId);
    }

    if (req.method === "GET") {
      return this.handleGet(req, sessionId);
    }

    return new Response("Method not allowed", { status: 405 });
  }

  protected async handleGet(req: Request, sessionId: string): Promise<Response> {
    const session = this.sessions.get(sessionId);

    if (session) {
      return new Response(
        `Session with id "${sessionId}" already established.`,
        { status: 409 },
      );
    }

    const { readable, writable } = new TransformStream();

    const downstream = new McpSession({
      name: "mcp-agent-downstream",
      side: "server",
      stream: {
        readable: readable,
        writable: writable,
      },
      process: (message: McpMessage) => {
        this.sessions.get(sessionId)?.upstream.send(message);
        return { ok: true };
      },
    });

    const upstream = new McpSession({
      name: "mcp-agent-upstream",
      side: "client",
      server: this.server,
      process: (message: McpMessage) => {
        this.sessions.get(sessionId)?.downstream.send(message);
        return { ok: true };
      },
    });

    this.sessions.set(sessionId, {
      id: sessionId,
      socket: null as never,
      downstream: downstream,
      upstream: upstream,
    });

    const response = new Response(downstream.stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    this.addCorsHeaders(req, response);
    return response;
  }

  protected async handlePost(req: Request, sessionId: string): Promise<Response> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return new Response(`Session with id "${sessionId}" not found.`, {
        status: 404,
      });
    }

    let mcpResponse: McpResponse;
    try {
      mcpResponse = await session.downstream.process(
        (await req.json()) as McpMessage,
      );
    } catch (e) {
      mcpResponse = {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: e instanceof Error ? e.message : "An unknown error occurred",
        },
      };
    }

    const response = new Response(JSON.stringify(mcpResponse), {
      headers: { "Content-Type": "application/json" },
    });

    this.addCorsHeaders(req, response);
    return response;
  }

  protected addCorsHeaders(req: Request, response: Response): void {
    const origin = req.headers.get("Origin");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Mcp-Session-Id",
      );
    }
  }

  async options(req: Request): Promise<Response> {
    const response = new Response(null, { status: 204 });
    this.addCorsHeaders(req, response);
    return response;
  }
}

// --- Enhanced Implementation ---

// 1. Define TypeScript Interfaces
interface Bindings {
  UNIFIED_MCP_AGENT: DurableObjectNamespace;
  AI: unknown;
}

interface Props {
  service?: string;
}

// 2. Map All Services
const MCP_SERVICES = {
  docs: {
    pkg: "@cloudflare/mcp-client-docs",
    serverClass: "DocsMcpServer",
  },
  bindings: {
    pkg: "@cloudflare/mcp-client-workers-bindings",
    serverClass: "WorkersBindingsMcpServer",
  },
  builds: {
    pkg: "@cloudflare/mcp-client-workers-builds",
    serverClass: "WorkersBuildsMcpServer",
  },
  observability: {
    pkg: "@cloudflare/mcp-client-workers-observability",
    serverClass: "WorkersObservabilityMcpServer",
  },
  radar: {
    pkg: "@cloudflare/mcp-client-radar",
    serverClass: "RadarMcpServer",
  },
  containers: {
    pkg: "@cloudflare/mcp-client-sandbox-container",
    serverClass: "SandboxContainerMcpServer",
  },
  browser: {
    pkg: "@cloudflare/mcp-client-browser-rendering",
    serverClass: "BrowserRenderingMcpServer",
  },
  logs: {
    pkg: "@cloudflare/mcp-client-logpush",
    serverClass: "LogpushMcpServer",
  },
  "ai-gateway": {
    pkg: "@cloudflare/mcp-client-ai-gateway",
    serverClass: "AiGatewayMcpServer",
  },
  autorag: {
    pkg: "@cloudflare/mcp-client-autorag",
    serverClass: "AutoragMcpServer",
  },
  auditlogs: {
    pkg: "@cloudflare/mcp-client-auditlogs",
    serverClass: "AuditlogsMcpServer",
  },
  "dns-analytics": {
    pkg: "@cloudflare/mcp-client-dns-analytics",
    serverClass: "DnsAnalyticsMcpServer",
  },
  dex: {
    pkg: "@cloudflare/mcp-client-dex-analysis",
    serverClass: "DexAnalysisMcpServer",
  },
  casb: {
    pkg: "@cloudflare/mcp-client-cloudflare-one-casb",
    serverClass: "CloudflareOneCasbMcpServer",
  },
  graphql: {
    pkg: "@cloudflare/mcp-client-graphql",
    serverClass: "GraphqlMcpServer",
  },
} as const;

type ServiceName = keyof typeof MCP_SERVICES;

// 3. Implement the UnifiedMcpAgent
export class UnifiedMcpAgent extends McpAgent<Bindings, unknown, Props> {
  server: McpServer | undefined;

  async init(): Promise<void> {
    if (this.server) {
      return;
    }

    const serviceName = this.props.service as ServiceName;
    if (!serviceName || !MCP_SERVICES[serviceName]) {
      throw new Error(`Invalid or unsupported MCP service: ${serviceName}`);
    }

    const service = MCP_SERVICES[serviceName];
    const module = await import(service.pkg);
    const ServerClass = module[service.serverClass];

    if (!ServerClass) {
        throw new Error(`Could not find ${service.serverClass} in package ${service.pkg}`);
    }

    this.server = new ServerClass();
  }
}

// 4. Implement the Worker Entrypoint with Tool Discovery
export default {
  async fetch(req: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Route for tool discovery
    if (url.pathname === "/tools") {
      const allTools: Record<string, unknown> = {};
      for (const [serviceName, service] of Object.entries(MCP_SERVICES)) {
        try {
          const module = await import(service.pkg);
          const ServerClass = module[service.serverClass];
          if (ServerClass) {
            const serverInstance = new ServerClass();
            allTools[serviceName] = {
              description: serverInstance.description,
              tools: serverInstance.tools,
            };
          }
        } catch (error) {
          // Could log this error for debugging, but for now, we'll just skip failed imports
          console.error(`Failed to load tools for service: ${serviceName}`, error);
        }
      }

      const response = new Response(JSON.stringify(allTools, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Allow CORS for the tools endpoint
        },
      });
      return response;
    }

    // Route for MCP agent sessions
    const mcpHandler = UnifiedMcpAgent.mount<Bindings>(
      "/mcp/:service",
      () => new Response("Not a valid MCP agent route.", { status: 404 }),
    );
    return mcpHandler(req, env, ctx);
  },
};