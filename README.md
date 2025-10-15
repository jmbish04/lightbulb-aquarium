# Lightbulb Aquarium Platform

A Cloudflare Workers based reference implementation that showcases a two-tier agent architecture. A DynamicAgent Durable Object exposes a WebSocket interface for real-time conversations while specialist Durable Objects (GitHub, Debugger, Best Practices) execute high-level workflows.

## Features

- **DynamicAgent WebSocket gateway** that proxies tasks to specialist agents using an MCP-style invocation protocol.
- **GitHub automation workflows** for forking repositories, generating implementation plans, and running structured research briefs.
- **Persistent memory layer** backed by Cloudflare D1 for project plans, debugging consultations, and research briefs.
- **Tailwind + Flowbite frontend** with dedicated views for project kickoffs, research briefs, memory visualisation, and raw chat access.

## Getting started

1. Install and authenticate Wrangler (Cloudflare's CLI):
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. Configure bindings inside `wrangler.toml` (Durable Objects, D1, KV, R2, AI binding, GitHub token secret).
3. Initialise the D1 schema:
   ```bash
   npx wrangler d1 execute <database-name> --file=schema.sql
   ```
   Or trigger the worker endpoint after deployment:
   ```bash
   curl -X POST https://<your-worker>/api/admin/init-db
   ```
4. Publish the worker:
   ```bash
   npx wrangler deploy
   ```
5. Open `https://<your-worker>/` to access the operations console.

## Development notes

- The specialist agents live in `src/services`. Each tool exposes AI-centric docstrings describing its behaviour.
- Database helpers reside in `src/tools/D1Tool.ts`; apply schema updates both in this file and in `schema.sql`.
- Frontend assets are in `public/` and are automatically served via the Workers `ASSETS` binding defined in `wrangler.toml`.

## Testing locally

Use the Wrangler dev server to iterate on UI and Durable Object logic:

```bash
npx wrangler dev
```

The dev server exposes the WebSocket endpoint at `ws://127.0.0.1:8787/`.
