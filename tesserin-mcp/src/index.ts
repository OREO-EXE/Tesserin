/**
 * tesserin-mcp — Standalone Node.js MCP server for the Tesserin vault.
 *
 * Usage:
 *   stdio (default):  node dist/index.js
 *   HTTP/SSE:         node dist/index.js --http [--port=3200]
 *
 * Environment variables:
 *   TESSERIN_API_URL      Base URL of the Tesserin REST API   (default: http://127.0.0.1:9960)
 *   TESSERIN_API_TOKEN    Bearer token (tsk_...)              REQUIRED
 *   TESSERIN_MCP_TRANSPORT  Set to "http" to use HTTP transport
 *   TESSERIN_MCP_PORT     HTTP server port                    (default: 3200)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import http from 'node:http'
import { randomUUID } from 'node:crypto'

import { registerNoteTools } from './tools/notes.js'
import { registerTagTools } from './tools/tags.js'
import { registerTaskTools } from './tools/tasks.js'
import { registerFolderTools } from './tools/folders.js'
import { registerGraphTools } from './tools/graph.js'
import { registerCanvasTools } from './tools/canvas.js'
import { registerAiTools } from './tools/ai.js'
import { registerTemplatesTools } from './tools/templates.js'
import { API_URL, API_TOKEN } from './api.js'

/* ─── Token check ───────────────────────────────────────────────────────────── */
if (!API_TOKEN) {
  process.stderr.write(
    '[tesserin-mcp] ERROR: TESSERIN_API_TOKEN is not set.\n' +
    '[tesserin-mcp]        Export it before starting:\n' +
    '[tesserin-mcp]          export TESSERIN_API_TOKEN=tsk_...\n',
  )
  process.exit(1)
}

/* ─── Server factory ────────────────────────────────────────────────────────── */
function buildServer(): McpServer {
  const server = new McpServer({
    name: 'Tesserin',
    version: '1.0.0',
  })
  registerNoteTools(server)
  registerTagTools(server)
  registerTaskTools(server)
  registerFolderTools(server)
  registerGraphTools(server)
  registerCanvasTools(server)
  registerAiTools(server)
  registerTemplatesTools(server)
  return server
}

/* ─── Transport detection ───────────────────────────────────────────────────── */
const useHttp =
  process.argv.includes('--http') ||
  (process.env['TESSERIN_MCP_TRANSPORT'] ?? '').toLowerCase() === 'http'

const portArg = process.argv.find(a => a.startsWith('--port='))
const httpPort = parseInt(
  portArg?.split('=')[1] ?? process.env['TESSERIN_MCP_PORT'] ?? '3200',
  10,
)

/* ─── Start ─────────────────────────────────────────────────────────────────── */
if (useHttp) {
  startHttpServer()
} else {
  startStdioServer()
}

/* ─── stdio transport ───────────────────────────────────────────────────────── */
async function startStdioServer(): Promise<void> {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(`[tesserin-mcp] stdio transport ready (API: ${API_URL})\n`)
}

/* ─── HTTP/SSE transport ────────────────────────────────────────────────────── */
function startHttpServer(): void {
  // Map of sessionId → transport for active MCP sessions
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  const httpServer = http.createServer(async (req, res) => {
    /* CORS — allow any origin so browser-based agents work */
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id')

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    /* Lightweight health endpoint for uptime checks */
    if (req.url === '/health' || req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          status: 'ok',
          transport: 'http',
          sessions: sessions.size,
          apiUrl: API_URL,
        }),
      )
      return
    }

    /* Collect request body */
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', resolve)
      req.on('error', reject)
    })
    const raw = Buffer.concat(chunks).toString()
    let parsedBody: unknown
    try {
      parsedBody = raw ? JSON.parse(raw) : undefined
    } catch { /* malformed JSON — let the transport handle it */ }

    const sessionId = req.headers['mcp-session-id'] as string | undefined

    /* GET / DELETE — resuming or closing an existing session */
    if ((req.method === 'GET' || req.method === 'DELETE') && sessionId) {
      const transport = sessions.get(sessionId)
      if (!transport) {
        res.writeHead(404).end('MCP session not found')
        return
      }
      await transport.handleRequest(req, res, parsedBody)
      return
    }

    /* POST to existing session */
    if (req.method === 'POST' && sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.handleRequest(req, res, parsedBody)
      return
    }

    /* POST without session — initialize a new MCP session */
    if (req.method === 'POST') {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => sessions.set(sid, transport),
      })
      transport.onclose = () => {
        for (const [id, t] of sessions) {
          if (t === transport) { sessions.delete(id); break }
        }
      }
      const server = buildServer()
      await server.connect(transport)
      await transport.handleRequest(req, res, parsedBody)
      return
    }

    res.writeHead(405).end('Method Not Allowed')
  })

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(
        `[tesserin-mcp] Port ${httpPort} is already in use. ` +
        `Set TESSERIN_MCP_PORT or pass --port=<n>\n`,
      )
    } else {
      process.stderr.write(`[tesserin-mcp] HTTP server error: ${err.message}\n`)
    }
    process.exit(1)
  })

  httpServer.listen(httpPort, '0.0.0.0', () => {
    process.stderr.write(
      `[tesserin-mcp] HTTP transport ready\n` +
      `[tesserin-mcp]   MCP endpoint : http://localhost:${httpPort}\n` +
      `[tesserin-mcp]   Health check : http://localhost:${httpPort}/health\n` +
      `[tesserin-mcp]   Tesserin API : ${API_URL}\n`,
    )
  })
}
