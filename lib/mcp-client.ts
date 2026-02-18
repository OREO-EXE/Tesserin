/**
 * Tesserin MCP Client (Renderer Side)
 *
 * Provides a React-friendly API for managing MCP server connections.
 * All actual MCP operations happen in the Electron main process via IPC.
 * In web-only mode (no Electron), MCP features are disabled.
 */

import { useSyncExternalStore, useCallback } from "react"

/* ================================================================== */
/*  Types (mirrored from electron/mcp-client.ts for renderer)          */
/* ================================================================== */

export type McpTransportType = "stdio" | "sse"

export interface McpServerConfig {
  id: string
  name: string
  transport: McpTransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

export interface McpToolInfo {
  serverId: string
  serverName: string
  name: string
  description: string
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
/*  MCP Store (renderer-side state)                                    */
/* ================================================================== */

interface McpState {
  servers: McpServerConfig[]
  statuses: McpConnectionStatus[]
  tools: McpToolInfo[]
  isAvailable: boolean
}

const STORAGE_KEY = "tesserin:mcp:servers"

class McpStore {
  private state: McpState = {
    servers: [],
    statuses: [],
    tools: [],
    isAvailable: false,
  }

  private listeners: Set<() => void> = new Set()
  private _snapshot = this.state

  constructor() {
    this.loadServers()
    this.checkAvailability()
  }

  private notify() {
    this._snapshot = { ...this.state }
    this.listeners.forEach((fn) => fn())
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot(): McpState {
    return this._snapshot
  }

  /* ── Availability ── */

  private checkAvailability() {
    this.state.isAvailable =
      typeof window !== "undefined" && !!window.tesserin?.mcp
  }

  /* ── Server config persistence ── */

  private loadServers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      this.state.servers = raw ? JSON.parse(raw) : []
    } catch {
      this.state.servers = []
    }
  }

  private saveServers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.servers))
    } catch {}
  }

  /* ── Server management ── */

  addServer(config: McpServerConfig) {
    // Remove any existing server with same ID
    this.state.servers = this.state.servers.filter((s) => s.id !== config.id)
    this.state.servers.push(config)
    this.saveServers()
    this.notify()
  }

  removeServer(serverId: string) {
    this.state.servers = this.state.servers.filter((s) => s.id !== serverId)
    this.saveServers()

    // Also update statuses and tools
    this.state.statuses = this.state.statuses.filter((s) => s.serverId !== serverId)
    this.state.tools = this.state.tools.filter((t) => t.serverId !== serverId)
    this.notify()
  }

  updateServer(serverId: string, updates: Partial<McpServerConfig>) {
    const server = this.state.servers.find((s) => s.id === serverId)
    if (server) {
      Object.assign(server, updates)
      this.saveServers()
      this.notify()
    }
  }

  getServers(): McpServerConfig[] {
    return this.state.servers
  }

  /* ── Connection operations (delegate to main process) ── */

  async connect(serverId: string): Promise<void> {
    if (!this.state.isAvailable) {
      console.warn("[MCP] MCP not available (not running in Electron)")
      return
    }

    const config = this.state.servers.find((s) => s.id === serverId)
    if (!config) throw new Error(`Server not found: ${serverId}`)

    // Update status to connecting
    this.updateLocalStatus(serverId, config.name, "connecting", 0)

    try {
      const result = await window.tesserin!.mcp!.connect(config)
      this.state.statuses = this.state.statuses.filter((s) => s.serverId !== serverId)
      this.state.statuses.push(result.status)

      // Merge tools
      this.state.tools = this.state.tools.filter((t) => t.serverId !== serverId)
      this.state.tools.push(...(result.tools || []))
      this.notify()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.updateLocalStatus(serverId, config.name, "error", 0, errorMsg)
    }
  }

  async disconnect(serverId: string): Promise<void> {
    if (!this.state.isAvailable) return

    try {
      await window.tesserin!.mcp!.disconnect(serverId)
    } catch {}

    this.state.statuses = this.state.statuses.filter((s) => s.serverId !== serverId)
    this.state.tools = this.state.tools.filter((t) => t.serverId !== serverId)
    this.notify()
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.state.isAvailable) {
      throw new Error("MCP not available")
    }
    return window.tesserin!.mcp!.callTool(serverId, toolName, args)
  }

  async refreshTools(): Promise<void> {
    if (!this.state.isAvailable) return

    try {
      const result = await window.tesserin!.mcp!.getStatuses()
      this.state.statuses = result.statuses
      this.state.tools = result.tools
      this.notify()
    } catch {}
  }

  /* ── Connect all enabled servers ── */

  async connectEnabled(): Promise<void> {
    const enabled = this.state.servers.filter((s) => s.enabled)
    for (const server of enabled) {
      await this.connect(server.id).catch(() => {})
    }
  }

  /* ── Internal helpers ── */

  private updateLocalStatus(
    serverId: string,
    serverName: string,
    status: McpConnectionStatus["status"],
    toolCount: number,
    error?: string
  ) {
    this.state.statuses = this.state.statuses.filter((s) => s.serverId !== serverId)
    this.state.statuses.push({ serverId, serverName, status, toolCount, error })
    this.notify()
  }
}

/* ── Singleton ── */
export const mcpStore = new McpStore()

/* ================================================================== */
/*  React Hook                                                         */
/* ================================================================== */

const subscribe = (cb: () => void) => mcpStore.subscribe(cb)
const getSnapshot = () => mcpStore.getSnapshot()

export function useMcp() {
  const state = useSyncExternalStore(subscribe, getSnapshot)

  const addServer = useCallback((config: McpServerConfig) => {
    mcpStore.addServer(config)
  }, [])

  const removeServer = useCallback((serverId: string) => {
    mcpStore.removeServer(serverId)
  }, [])

  const connect = useCallback((serverId: string) => {
    return mcpStore.connect(serverId)
  }, [])

  const disconnect = useCallback((serverId: string) => {
    return mcpStore.disconnect(serverId)
  }, [])

  const callTool = useCallback(
    (serverId: string, toolName: string, args: Record<string, unknown>) => {
      return mcpStore.callTool(serverId, toolName, args)
    },
    []
  )

  return {
    ...state,
    addServer,
    removeServer,
    connect,
    disconnect,
    callTool,
  }
}
