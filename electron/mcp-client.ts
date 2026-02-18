/**
 * Tesserin MCP Client Manager (Electron Main Process)
 *
 * Manages connections to external MCP servers. Each connection provides
 * tools that get bridged into SAM and the plugin system.
 *
 * Supports stdio and SSE transports for connecting to remote/local servers.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export type McpTransportType = "stdio" | "sse"

export interface McpServerConfig {
  /** Unique ID for this server connection */
  id: string
  /** Display name */
  name: string
  /** Transport type */
  transport: McpTransportType
  /** For stdio: the command to run */
  command?: string
  /** For stdio: arguments to pass */
  args?: string[]
  /** For stdio: environment variables */
  env?: Record<string, string>
  /** For SSE: the server URL */
  url?: string
  /** Whether this server is enabled */
  enabled: boolean
}

export interface McpToolInfo {
  /** Server ID this tool belongs to */
  serverId: string
  /** Server display name */
  serverName: string
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** JSON schema for parameters */
  inputSchema: Record<string, unknown>
}

export interface McpConnectionStatus {
  serverId: string
  serverName: string
  status: "connected" | "disconnected" | "connecting" | "error"
  error?: string
  toolCount: number
}

/* ================================================================== */
/*  Client Manager                                                     */
/* ================================================================== */

interface ManagedConnection {
  config: McpServerConfig
  client: Client
  transport: StdioClientTransport | SSEClientTransport
  tools: McpToolInfo[]
  status: McpConnectionStatus["status"]
  error?: string
}

class McpClientManager {
  private connections: Map<string, ManagedConnection> = new Map()
  private statusListeners: Set<(statuses: McpConnectionStatus[]) => void> = new Set()

  /**
   * Connect to an MCP server.
   */
  async connect(config: McpServerConfig): Promise<void> {
    // Disconnect existing connection with same ID
    if (this.connections.has(config.id)) {
      await this.disconnect(config.id)
    }

    const client = new Client({
      name: "Tesserin",
      version: "1.0.0",
    })

    let transport: StdioClientTransport | SSEClientTransport

    try {
      this.updateStatus(config.id, config.name, "connecting", 0)

      if (config.transport === "stdio") {
        if (!config.command) throw new Error("stdio transport requires a command")
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: { ...process.env, ...(config.env || {}) } as Record<string, string>,
        })
      } else if (config.transport === "sse") {
        if (!config.url) throw new Error("SSE transport requires a URL")
        transport = new SSEClientTransport(new URL(config.url))
      } else {
        throw new Error(`Unknown transport: ${config.transport}`)
      }

      await client.connect(transport)

      // Discover tools
      const toolsResult = await client.listTools()
      const tools: McpToolInfo[] = (toolsResult.tools || []).map((t) => ({
        serverId: config.id,
        serverName: config.name,
        name: t.name,
        description: t.description || "",
        inputSchema: (t.inputSchema as Record<string, unknown>) || {},
      }))

      const conn: ManagedConnection = {
        config,
        client,
        transport,
        tools,
        status: "connected",
      }
      this.connections.set(config.id, conn)
      this.updateStatus(config.id, config.name, "connected", tools.length)

      console.log(`[MCP Client] Connected to "${config.name}" — ${tools.length} tools available`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[MCP Client] Failed to connect to "${config.name}":`, errorMsg)
      this.updateStatus(config.id, config.name, "error", 0, errorMsg)
    }
  }

  /**
   * Disconnect from an MCP server.
   */
  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return

    try {
      await conn.client.close()
    } catch (err) {
      console.error(`[MCP Client] Error disconnecting "${conn.config.name}":`, err)
    }

    this.connections.delete(serverId)
    this.updateStatus(serverId, conn.config.name, "disconnected", 0)
  }

  /**
   * Disconnect all servers.
   */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys())
    for (const id of ids) {
      await this.disconnect(id)
    }
  }

  /**
   * Call a tool on a connected MCP server.
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`Not connected to server: ${serverId}`)

    const result = await conn.client.callTool({
      name: toolName,
      arguments: args,
    })

    // Extract text from result content
    const content = result.content as Array<{ type: string; text?: string }>
    return content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
  }

  /**
   * Get all tools from all connected servers.
   */
  getAllTools(): McpToolInfo[] {
    const tools: McpToolInfo[] = []
    for (const conn of this.connections.values()) {
      tools.push(...conn.tools)
    }
    return tools
  }

  /**
   * Get tools from a specific server.
   */
  getServerTools(serverId: string): McpToolInfo[] {
    return this.connections.get(serverId)?.tools || []
  }

  /**
   * Get connection statuses for all known servers.
   */
  getStatuses(): McpConnectionStatus[] {
    return Array.from(this.connections.values()).map((conn) => ({
      serverId: conn.config.id,
      serverName: conn.config.name,
      status: conn.status,
      error: conn.error,
      toolCount: conn.tools.length,
    }))
  }

  /**
   * Subscribe to status changes.
   */
  onStatusChange(listener: (statuses: McpConnectionStatus[]) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private updateStatus(
    serverId: string,
    serverName: string,
    status: McpConnectionStatus["status"],
    toolCount: number,
    error?: string
  ) {
    // Update the connection record if it exists
    const conn = this.connections.get(serverId)
    if (conn) {
      conn.status = status
      conn.error = error
    }

    this.statusListeners.forEach((listener) => {
      listener(this.getStatuses())
    })
  }

  /**
   * Get a specific connection.
   */
  getConnection(serverId: string): ManagedConnection | undefined {
    return this.connections.get(serverId)
  }

  /**
   * Check if a server is connected.
   */
  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.status === "connected"
  }
}

/* ── Singleton ── */
export const mcpClientManager = new McpClientManager()
