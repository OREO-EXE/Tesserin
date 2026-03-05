/**
 * Terminal Store
 *
 * Central state management for terminal sessions.
 * Uses useSyncExternalStore for React integration.
 *
 * Features:
 * - Multiple terminal sessions with tab management
 * - Persistent terminal history (buffer state)
 * - Theme synchronization with application theme
 * - Auto-save terminal state to localStorage
 */

import { useSyncExternalStore, useCallback } from "react"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface TerminalSession {
  id: string
  name: string
  buffer: string // Serialized terminal buffer state
  cols: number
  rows: number
  createdAt: string
  updatedAt: string
  isActive: boolean
}

interface TerminalState {
  sessions: TerminalSession[]
  activeSessionId: string | null
  isLoading: boolean
  theme: "light" | "dark"
}

/* ------------------------------------------------------------------ */
/*  Store                                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "tesserin:terminal:state"
const HISTORY_KEY_PREFIX = "tesserin:terminal:history:"

let state: TerminalState = {
  sessions: [],
  activeSessionId: null,
  isLoading: true,
  theme: "dark",
}

const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function setState(patch: Partial<TerminalState>) {
  state = { ...state, ...patch }
  emit()
}

/* ── Persistence ─────────────────────────────────────────── */

/** Load terminal sessions from localStorage */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const loaded = JSON.parse(raw) as Partial<TerminalState>
      state = {
        ...state,
        sessions: loaded.sessions || [],
        activeSessionId: loaded.activeSessionId || null,
        theme: loaded.theme || "dark",
        isLoading: false,
      }
      emit()
    } else {
      setState({ isLoading: false })
    }
  } catch (err) {
    console.error("[TerminalStore] Failed to load state:", err)
    setState({ isLoading: false })
  }
}

/** Save terminal sessions to localStorage */
function saveState() {
  try {
    const toSave = {
      sessions: state.sessions,
      activeSessionId: state.activeSessionId,
      theme: state.theme,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (err) {
    console.error("[TerminalStore] Failed to save state:", err)
  }
}

/** Save terminal buffer history */
function saveTerminalHistory(sessionId: string, buffer: string) {
  try {
    localStorage.setItem(`${HISTORY_KEY_PREFIX}${sessionId}`, buffer)
  } catch (err) {
    console.error("[TerminalStore] Failed to save terminal history:", err)
  }
}

/** Load terminal buffer history */
function loadTerminalHistory(sessionId: string): string | null {
  try {
    return localStorage.getItem(`${HISTORY_KEY_PREFIX}${sessionId}`)
  } catch (err) {
    console.error("[TerminalStore] Failed to load terminal history:", err)
    return null
  }
}

/* ── Actions ─────────────────────────────────────────── */

/** Initialize the store and load saved sessions */
export function initTerminalStore() {
  loadState()
}

/** Create a new terminal session */
export function createTerminalSession(name?: string): TerminalSession {
  const id = `terminal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const session: TerminalSession = {
    id,
    name: name || `Terminal ${state.sessions.length + 1}`,
    buffer: "",
    cols: 80,
    rows: 24,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: false,
  }

  setState({
    sessions: [...state.sessions, session],
    activeSessionId: session.id,
  })

  // Mark this session as active
  setActiveSession(session.id)
  saveState()

  return session
}

/** Set the active terminal session */
export function setActiveSession(sessionId: string) {
  const sessions = state.sessions.map((s) => ({
    ...s,
    isActive: s.id === sessionId,
  }))

  setState({
    sessions,
    activeSessionId: sessionId,
  })

  saveState()
}

/** Close a terminal session */
export function closeTerminalSession(sessionId: string) {
  const sessions = state.sessions.filter((s) => s.id !== sessionId)
  
  let newActiveId = state.activeSessionId
  
  // If we closed the active session, switch to the first available
  if (sessionId === state.activeSessionId) {
    newActiveId = sessions.length > 0 ? sessions[0].id : null
  }

  setState({
    sessions,
    activeSessionId: newActiveId,
  })

  // Clean up terminal history
  try {
    localStorage.removeItem(`${HISTORY_KEY_PREFIX}${sessionId}`)
  } catch (err) {
    console.error("[TerminalStore] Failed to remove terminal history:", err)
  }

  saveState()
}

/** Update terminal session buffer state */
export function updateTerminalBuffer(sessionId: string, buffer: string) {
  const sessions = state.sessions.map((s) =>
    s.id === sessionId
      ? { ...s, buffer, updatedAt: new Date().toISOString() }
      : s
  )

  setState({ sessions })
  
  // Save buffer to separate storage for better performance
  saveTerminalHistory(sessionId, buffer)
  saveState()
}

/** Update terminal dimensions */
export function updateTerminalDimensions(sessionId: string, cols: number, rows: number) {
  const sessions = state.sessions.map((s) =>
    s.id === sessionId
      ? { ...s, cols, rows, updatedAt: new Date().toISOString() }
      : s
  )

  setState({ sessions })
  saveState()
}

/** Rename a terminal session */
export function renameTerminalSession(sessionId: string, name: string) {
  const sessions = state.sessions.map((s) =>
    s.id === sessionId
      ? { ...s, name, updatedAt: new Date().toISOString() }
      : s
  )

  setState({ sessions })
  saveState()
}

/** Get terminal buffer history */
export function getTerminalHistory(sessionId: string): string | null {
  return loadTerminalHistory(sessionId)
}

/** Set theme (light/dark) for terminal */
export function setTerminalTheme(theme: "light" | "dark") {
  setState({ theme })
  saveState()
}

/** Get all sessions */
export function getSessions(): TerminalSession[] {
  return state.sessions
}

/** Get active session */
export function getActiveSession(): TerminalSession | null {
  return state.sessions.find((s) => s.id === state.activeSessionId) || null
}

/** Get session by ID */
export function getSessionById(sessionId: string): TerminalSession | null {
  return state.sessions.find((s) => s.id === sessionId) || null
}

/* ── React Integration ─────────────────────────────────────────── */

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getSnapshot = () => state

/** React hook to consume terminal store state */
export function useTerminalStore() {
  const terminalState = useSyncExternalStore(subscribe, getSnapshot)

  return {
    sessions: terminalState.sessions,
    activeSessionId: terminalState.activeSessionId,
    isLoading: terminalState.isLoading,
    theme: terminalState.theme,
    createSession: useCallback((name?: string) => createTerminalSession(name), []),
    setActiveSession: useCallback((id: string) => setActiveSession(id), []),
    closeSession: useCallback((id: string) => closeTerminalSession(id), []),
    updateBuffer: useCallback((id: string, buffer: string) => updateTerminalBuffer(id, buffer), []),
    updateDimensions: useCallback((id: string, cols: number, rows: number) => updateTerminalDimensions(id, cols, rows), []),
    renameSession: useCallback((id: string, name: string) => renameTerminalSession(id, name), []),
    getHistory: useCallback((id: string) => getTerminalHistory(id), []),
    setTheme: useCallback((theme: "light" | "dark") => setTerminalTheme(theme), []),
  }
}

// Initialize the store when the module loads
if (typeof window !== "undefined") {
  initTerminalStore()
}
