import React, { useRef, useEffect, useCallback, useState } from "react"
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
} from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import { TesserinLogo } from "../core/tesserin-logo"
import * as storage from "@/lib/storage-client"
import { useTesserinTheme } from "@/components/tesserin/core/theme-provider"
import { useNotes, type Note } from "@/lib/notes-store"
import { FiFileText, FiSearch, FiX, FiPlus } from "react-icons/fi"

/**
 * CreativeCanvas — Tesseradraw
 *
 * Wraps the Excalidraw engine in permanent dark mode.
 * Automatically saves/loads canvas data to/from SQLite.
 */

const DARK_BG = "#121212"
const LIGHT_BG = "#fdfbf7"

/** Default canvas ID — a single persistent canvas (multi-canvas can be added later) */
const DEFAULT_CANVAS_ID = "default-canvas"
/** Storage key for library items across all sessions */
const LIBRARY_STORAGE_KEY = "tesserin:canvas:library"

/** Fields from appState worth persisting (skip transient UI fields) */
const PERSIST_APP_STATE_KEYS = [
  "theme",
  "viewBackgroundColor",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFillStyle",
  "currentItemStrokeWidth",
  "currentItemRoughness",
  "currentItemOpacity",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemTextAlign",
  "currentItemRoundness",
  "currentItemArrowType",
] as const

/* ── helpers ──────────────────────────────────────────── */

/** Generate a random hex ID for Excalidraw elements */
function excalidrawId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  for (let i = 0; i < 21; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

/** Create Excalidraw elements representing a note card */
function createNoteCardElements(note: Note, x: number, y: number, isDark: boolean) {
  const cardWidth = 260
  const cardHeight = 120
  const preview = note.content
    .replace(/^#.*\n?/gm, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim()
    .slice(0, 100)

  const groupId = excalidrawId()

  // Card background rectangle
  const rect = {
    id: excalidrawId(),
    type: "rectangle" as const,
    x,
    y,
    width: cardWidth,
    height: cardHeight,
    strokeColor: isDark ? "#FACC15" : "#CA8A04",
    backgroundColor: isDark ? "#1a1a1a" : "#fdfbf7",
    fillStyle: "solid" as const,
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    angle: 0,
    strokeStyle: "solid" as const,
    roundness: { type: 3, value: 12 },
    seed: Math.floor(Math.random() * 1000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    groupIds: [groupId],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    frameId: null,
  }

  // Note title text
  const titleText = {
    id: excalidrawId(),
    type: "text" as const,
    x: x + 16,
    y: y + 14,
    width: cardWidth - 32,
    height: 24,
    text: note.title,
    fontSize: 18,
    fontFamily: 1,
    textAlign: "left" as const,
    verticalAlign: "top" as const,
    strokeColor: isDark ? "#FACC15" : "#CA8A04",
    backgroundColor: "transparent",
    fillStyle: "solid" as const,
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    angle: 0,
    strokeStyle: "solid" as const,
    roundness: null,
    seed: Math.floor(Math.random() * 1000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    groupIds: [groupId],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    frameId: null,
    containerId: null,
    originalText: note.title,
    autoResize: false,
    lineHeight: 1.25,
  }

  // Preview text
  const previewText = {
    id: excalidrawId(),
    type: "text" as const,
    x: x + 16,
    y: y + 46,
    width: cardWidth - 32,
    height: 56,
    text: preview || "(empty note)",
    fontSize: 12,
    fontFamily: 1,
    textAlign: "left" as const,
    verticalAlign: "top" as const,
    strokeColor: isDark ? "#888888" : "#7a756b",
    backgroundColor: "transparent",
    fillStyle: "solid" as const,
    strokeWidth: 1,
    roughness: 0,
    opacity: 80,
    angle: 0,
    strokeStyle: "solid" as const,
    roundness: null,
    seed: Math.floor(Math.random() * 1000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    groupIds: [groupId],
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    frameId: null,
    containerId: null,
    originalText: preview || "(empty note)",
    autoResize: false,
    lineHeight: 1.25,
  }

  return [rect, titleText, previewText]
}

/* ── Note Picker Panel ───────────────────────────────── */

function NotePickerPanel({
  notes,
  onInsert,
  onClose,
}: {
  notes: Note[]
  onInsert: (note: Note) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const filtered = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.tags.some((t) => t.name.toLowerCase().includes(search.toLowerCase())),
      )
    : notes

  return (
    <div
      className="absolute top-3 right-3 z-50 w-64 rounded-2xl overflow-hidden shadow-xl border"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-dark)",
      }}
    >
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--border-dark)" }}>
        <FiFileText size={14} style={{ color: "var(--accent-primary)" }} />
        <span className="text-xs font-bold flex-1" style={{ color: "var(--text-primary)" }}>Insert Note</span>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
          <FiX size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>
      <div className="px-2 py-1.5">
        <div className="skeuo-inset flex items-center gap-1.5 px-2 py-1 rounded-lg">
          <FiSearch size={12} style={{ color: "var(--text-tertiary)" }} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs focus:outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="Search notes..."
          />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto custom-scrollbar px-1.5 pb-1.5">
        {filtered.length === 0 && (
          <p className="text-[10px] text-center py-4" style={{ color: "var(--text-tertiary)" }}>
            No notes found
          </p>
        )}
        {filtered.map((note) => (
          <button
            key={note.id}
            onClick={() => onInsert(note)}
            className="w-full text-left px-2.5 py-2 rounded-xl mb-0.5 flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-primary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-panel-inset)" }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
          >
            <FiFileText size={12} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{note.title}</p>
              {note.tags.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {note.tags.slice(0, 3).map((t) => (
                    <span key={t.id} className="text-[8px] px-1 rounded-full" style={{ backgroundColor: t.color + "22", color: t.color }}>
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <FiPlus size={12} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── component ───────────────────────────────────────────── */

export function CreativeCanvas() {
  const { isDark } = useTesserinTheme()
  const { notes } = useNotes()
  const apiRef = useRef<any>(null)
  const canvasIdRef = useRef<string>(DEFAULT_CANVAS_ID)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [initialData, setInitialData] = useState<any | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const readyToSave = useRef(false)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const insertCountRef = useRef(0)

  /** Insert a note as a card onto the canvas */
  const handleInsertNote = useCallback(
    (note: Note) => {
      const api = apiRef.current
      if (!api) return

      // Position each card with a slight offset to avoid stacking
      const offset = insertCountRef.current * 30
      insertCountRef.current++

      // Get current viewport center for placement
      const appState = api.getAppState()
      const centerX = (appState.scrollX ? -appState.scrollX : 0) + 200 + offset
      const centerY = (appState.scrollY ? -appState.scrollY : 0) + 150 + offset

      const newElements = createNoteCardElements(note, centerX, centerY, isDark)
      const existingElements = api.getSceneElements()
      api.updateScene({
        elements: [...existingElements, ...newElements],
      })
      setShowNotePicker(false)
    },
    [isDark],
  )

  // ── Load canvas from SQLite (or localStorage fallback) on mount ─
  useEffect(() => {
    let cancelled = false

    async function loadCanvas() {
      let canvasData: { elements: any[]; appState: Record<string, any>; files?: any; libraryItems?: any[] } | null = null
      let libraryItems: any[] = []

      try {
        // Load library items independently
        try {
          const libRaw = localStorage.getItem(LIBRARY_STORAGE_KEY)
          if (libRaw) libraryItems = JSON.parse(libRaw)
        } catch { }
        // Try storage API first (SQLite via IPC or localStorage fallback)
        let canvas = await storage.getCanvas(DEFAULT_CANVAS_ID)

        // Also check raw localStorage as a secondary source
        if (!canvas) {
          try {
            const lsRaw = localStorage.getItem(`tesserin:canvas:${DEFAULT_CANVAS_ID}`)
            if (lsRaw) canvas = JSON.parse(lsRaw)
          } catch { }
        }

        if (!canvas) {
          // Create a new default canvas
          canvas = await storage.createCanvas({
            id: DEFAULT_CANVAS_ID,
            name: "Default Canvas",
          })
        }

        if (canvas?.id) {
          canvasIdRef.current = canvas.id
        }

        if (canvas) {
          const elements = canvas.elements ? JSON.parse(canvas.elements) : []
          const appState = canvas.app_state ? JSON.parse(canvas.app_state) : {}
          const files = canvas.files ? JSON.parse(canvas.files) : undefined

          if (elements.length > 0) {
            canvasData = {
              elements,
              appState: {
                ...appState,
                theme: isDark ? "dark" : "light",
              },
              files: files && Object.keys(files).length > 0 ? files : undefined,
              libraryItems: libraryItems.length > 0 ? libraryItems : undefined,
            }
          }
        }
      } catch (err) {
        console.warn("[Tesserin] Failed to load canvas from DB:", err)
      }

      if (!cancelled) {
        if (canvasData) {
          setInitialData(canvasData)
        } else {
          setInitialData({
            elements: [],
            appState: { theme: isDark ? "dark" : "light" },
            libraryItems: libraryItems.length > 0 ? libraryItems : undefined,
          })
        }
        setIsLoaded(true)
        // Allow saving after initial scene-load onChange calls settle
        setTimeout(() => {
          readyToSave.current = true
        }, 800)
      }
    }
    loadCanvas()

    return () => {
      cancelled = true
    }
  }, [])

  // ── Immediate save helper (non-debounced) ──────────────────────
  const saveNow = useCallback(() => {
    const api = apiRef.current
    if (!api || !readyToSave.current) return

    try {
      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const persistAppState: Record<string, any> = {}
      for (const key of PERSIST_APP_STATE_KEYS) {
        if (key in appState) persistAppState[key] = appState[key]
      }

      // Synchronous localStorage write for immediate persistence
      const canvasId = canvasIdRef.current
      const elementsJson = JSON.stringify(elements)
      const appStateJson = JSON.stringify(persistAppState)

      // Always write to localStorage as immediate backup
      try {
        const lsKey = `tesserin:canvas:${canvasId}`
        const existing = localStorage.getItem(lsKey)
        const canvas = existing ? JSON.parse(existing) : {
          id: canvasId,
          name: "Default Canvas",
          files: "{}",
          created_at: new Date().toISOString(),
        }
        canvas.elements = elementsJson
        canvas.app_state = appStateJson
        canvas.updated_at = new Date().toISOString()
        localStorage.setItem(lsKey, JSON.stringify(canvas))
      } catch { }

      // Also fire async IPC save (may or may not complete before unload)
      storage.updateCanvas(canvasId, {
        elements: elementsJson,
        appState: appStateJson,
      }).catch(() => { })
    } catch { }
  }, [])

  // ── Debounced save ────────────────────────────────────────────
  const doSave = useCallback(
    (elements: readonly any[], appState: Record<string, any>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      saveTimerRef.current = setTimeout(() => {
        try {
          // Pick only persistable appState keys
          const persistAppState: Record<string, any> = {}
          for (const key of PERSIST_APP_STATE_KEYS) {
            if (key in appState) persistAppState[key] = appState[key]
          }

          const elementsJson = JSON.stringify(elements)
          const appStateJson = JSON.stringify(persistAppState)
          const canvasId = canvasIdRef.current

          // Write to localStorage synchronously as backup
          try {
            const lsKey = `tesserin:canvas:${canvasId}`
            const existing = localStorage.getItem(lsKey)
            const canvas = existing ? JSON.parse(existing) : {
              id: canvasId,
              name: "Default Canvas",
              files: "{}",
              created_at: new Date().toISOString(),
            }
            canvas.elements = elementsJson
            canvas.app_state = appStateJson
            canvas.updated_at = new Date().toISOString()
            localStorage.setItem(lsKey, JSON.stringify(canvas))
          } catch { }

          // Also save via IPC/storage API
          storage
            .updateCanvas(canvasId, {
              elements: elementsJson,
              appState: appStateJson,
            })
            .catch((err) =>
              console.warn("[Tesserin] Canvas save failed:", err),
            )
        } catch {
          // Silently ignore serialization errors
        }
      }, 500)
    },
    [],
  )

  // ── Save on beforeunload (page refresh / close) ───────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveNow()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [saveNow])

  // ── Save on visibility change (tab going background) ──────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveNow()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [saveNow])

  // Cleanup save timer on unmount — always flush current state to DB
  useEffect(() => {
    return () => {
      // Cancel any pending debounced save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      // Always save current state on unmount
      saveNow()
    }
  }, [saveNow])

  const onAPI = useCallback((api: any) => {
    apiRef.current = api
  }, [])

  // Excalidraw onChange receives (elements, appState, files)
  const onChange = useCallback(
    (elements: readonly any[], appState: Record<string, any>) => {
      if (!readyToSave.current) return
      doSave(elements, appState)
    },
    [doSave],
  )

  // Triggered when a user adds/removes to their personal Excalidraw library
  const onLibraryChange = useCallback(
    (items: any) => {
      try {
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items))
      } catch (err) {
        console.warn("[Tesserin] Failed to save canvas library:", err)
      }
    },
    [],
  )

  // Synchronize dynamic theme changes with Excalidraw's API
  useEffect(() => {
    if (apiRef.current) {
      apiRef.current.updateScene({ appState: { theme: isDark ? "dark" : "light" } })
    }
  }, [isDark])

  /* ── Tesserin-branded CSS overrides for Excalidraw UI chrome ── */
  const brandCSS = `
    /* ── Override Excalidraw's CSS variables to match Tesserin Obsidian Black ── */
    .excalidraw.theme--dark {
      /* Surface / Island colours → deep black */
      --island-bg-color: #0d0d0d !important;
      --color-surface-lowest: #050505 !important;
      --color-surface-low: #0a0a0a !important;
      --color-surface-mid: #111111 !important;
      --color-surface-high: #1a1a1a !important;
      --default-bg-color: ${DARK_BG} !important;
      --input-bg-color: #0a0a0a !important;
      --popup-bg-color: #0d0d0d !important;
      --sidebar-bg-color: #0a0a0a !important;
      --overlay-bg-color: rgba(0, 0, 0, 0.75) !important;

      /* Primary accent → Tesserin Gold */
      --color-primary: #FACC15 !important;
      --color-primary-darker: #EAB308 !important;
      --color-primary-darkest: #CA8A04 !important;
      --color-primary-hover: #EAB308 !important;
      --color-primary-light: rgba(250, 204, 21, 0.15) !important;
      --color-primary-light-darker: rgba(250, 204, 21, 0.25) !important;
      --color-surface-primary-container: rgba(250, 204, 21, 0.12) !important;

      /* Text */
      --text-primary-color: #ededed !important;
      --color-on-surface: #ededed !important;

      /* Borders & shadows → deeper */
      --dialog-border-color: rgba(255, 255, 255, 0.06) !important;
      --sidebar-border-color: rgba(255, 255, 255, 0.06) !important;
      --shadow-island: 0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) !important;

      /* Buttons */
      --button-bg: #111111 !important;
      --button-hover-bg: #1a1a1a !important;
      --button-active-bg: #FACC15 !important;
      --button-color: #ededed !important;
      --button-hover-color: #ffffff !important;
      --button-border: rgba(255,255,255,0.06) !important;
      --button-hover-border: rgba(255,255,255,0.1) !important;
      --button-active-border: #FACC15 !important;

      /* Color picker / input */
      --input-border-color: rgba(255,255,255,0.08) !important;
      --input-hover-bg-color: #1a1a1a !important;
      --input-label-color: #888888 !important;

      /* Brand logo colour */
      --color-logo-icon: #FACC15 !important;
    }

    /* ── Toolbar container: rounded, Tesserin glass  ── */
    .excalidraw.theme--dark .App-toolbar-content {
      background: linear-gradient(145deg, #111111, #080808) !important;
      border: 1px solid rgba(255,255,255,0.06) !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03) !important;
    }

    /* ── Tool icons: rounded with Tesserin style ── */
    .excalidraw.theme--dark .ToolIcon__icon {
      border-radius: 10px !important;
    }
    .excalidraw.theme--dark .ToolIcon__icon:hover {
      background: rgba(250, 204, 21, 0.08) !important;
    }
    .excalidraw.theme--dark .ToolIcon__icon[aria-checked="true"],
    .excalidraw.theme--dark .ToolIcon__icon[aria-selected="true"] {
      background: #FACC15 !important;
      color: #000000 !important;
      box-shadow: 0 0 12px rgba(250,204,21,0.3), inset 0 1px 2px rgba(0,0,0,0.2) !important;
    }
    .excalidraw.theme--dark .ToolIcon__icon[aria-checked="true"] svg,
    .excalidraw.theme--dark .ToolIcon__icon[aria-selected="true"] svg {
      color: #000000 !important;
    }

    /* ── Side properties panel ── */
    .excalidraw.theme--dark .properties-content {
      background: #0d0d0d !important;
    }

    /* ── Color picker buttons: active state gold ── */
    .excalidraw.theme--dark .color-picker__button.active,
    .excalidraw.theme--dark .color-picker__button:focus {
      box-shadow: 0 0 0 2px #FACC15 !important;
    }

    /* ── Dropdown menus ── */
    .excalidraw.theme--dark .dropdown-menu-container {
      background: #0d0d0d !important;
      border: 1px solid rgba(255,255,255,0.06) !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
    }

    /* ── Library sidebar ── */
    .excalidraw.theme--dark .layer-ui__library {
      background: #0a0a0a !important;
    }

    /* ── Bottom bar (zoom, undo/redo) ── */
    .excalidraw.theme--dark .layer-ui__wrapper__footer {
      background: transparent !important;
    }

    /* ── Welcome screen hint text ── */
    .excalidraw.theme--dark .welcome-screen-decor-hint {
      color: #888888 !important;
    }

    /* ── Scrollbar ── */
    .excalidraw.theme--dark ::-webkit-scrollbar-thumb {
      background-color: #333 !important;
      border-radius: 10px !important;
    }
    .excalidraw.theme--dark ::-webkit-scrollbar-track {
      background: transparent !important;
    }
    
    /* ── Canvas Background Force ── */
    .excalidraw.theme--dark {
      --color-bg-canvas: ${DARK_BG} !important;
      --color-surface-default: ${DARK_BG} !important;
      --color-background: ${DARK_BG} !important;
    }

    /* ── OVERRIDE FOR LIGHT (WARM IVORY) PALETTE ── */
    /* Target via our local wrapper since Excalidraw simply removes .theme--dark rather than adding .theme--light */
    .tesserin-canvas-light .excalidraw {
      --island-bg-color: #fdfbf7 !important;
      --color-surface-lowest: #f1ebd9 !important;
      --color-surface-low: #f6eedb !important;
      --color-surface-mid: #f9f6f0 !important;
      --color-surface-high: #ffffff !important;
      --default-bg-color: ${LIGHT_BG} !important;
      --input-bg-color: #f9f6f0 !important;
      --popup-bg-color: #fdfbf7 !important;
      --sidebar-bg-color: #f9f6f0 !important;
      --overlay-bg-color: rgba(255, 255, 255, 0.75) !important;

      --color-primary: #FACC15 !important;
      --color-primary-darker: #EAB308 !important;
      --color-primary-darkest: #CA8A04 !important;
      --color-primary-hover: #EAB308 !important;
      --color-primary-light: rgba(250, 204, 21, 0.15) !important;
      --color-primary-light-darker: rgba(250, 204, 21, 0.25) !important;
      --color-surface-primary-container: rgba(250, 204, 21, 0.12) !important;

      --text-primary-color: #2d2a26 !important;
      --color-on-surface: #2d2a26 !important;

      --dialog-border-color: rgba(0, 0, 0, 0.06) !important;
      --sidebar-border-color: rgba(0, 0, 0, 0.06) !important;
      --shadow-island: 0 4px 24px rgba(227,223,211,0.6), 0 0 0 1px rgba(0,0,0,0.04) !important;

      --button-bg: #fdfbf7 !important;
      --button-hover-bg: #ffffff !important;
      --button-active-bg: #FACC15 !important;
      --button-color: #7a756b !important;
      --button-hover-color: #2d2a26 !important;
      --button-border: rgba(0,0,0,0.06) !important;
      --button-hover-border: rgba(0,0,0,0.1) !important;
      --button-active-border: #FACC15 !important;

      --input-border-color: rgba(0,0,0,0.08) !important;
      --input-hover-bg-color: #ffffff !important;
      --input-label-color: #a8a399 !important;

      --color-logo-icon: #FACC15 !important;
    }

    .tesserin-canvas-light .excalidraw .App-toolbar-content {
      background: linear-gradient(145deg, #ffffff, #f9f6f0) !important;
      border: 1px solid rgba(0,0,0,0.06) !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 24px rgba(227,223,211,0.5), inset 0 1px 0 rgba(255,255,255,0.8) !important;
    }

    .tesserin-canvas-light .excalidraw .ToolIcon__icon {
      border-radius: 10px !important;
    }
    .tesserin-canvas-light .excalidraw .ToolIcon__icon:hover {
      background: rgba(250, 204, 21, 0.08) !important;
    }
    .tesserin-canvas-light .excalidraw .ToolIcon__icon[aria-checked="true"],
    .tesserin-canvas-light .excalidraw .ToolIcon__icon[aria-selected="true"] {
      background: #FACC15 !important;
      color: #000000 !important;
      box-shadow: 0 0 12px rgba(250,204,21,0.3), inset 0 1px 2px rgba(0,0,0,0.2) !important;
    }
    .tesserin-canvas-light .excalidraw .ToolIcon__icon[aria-checked="true"] svg,
    .tesserin-canvas-light .excalidraw .ToolIcon__icon[aria-selected="true"] svg {
      color: #000000 !important;
    }

    .tesserin-canvas-light .excalidraw .properties-content {
      background: #fdfbf7 !important;
    }

    .tesserin-canvas-light .excalidraw .color-picker__button.active,
    .tesserin-canvas-light .excalidraw .color-picker__button:focus {
      box-shadow: 0 0 0 2px #FACC15 !important;
    }

    .tesserin-canvas-light .excalidraw .dropdown-menu-container {
      background: #fdfbf7 !important;
      border: 1px solid rgba(0,0,0,0.06) !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(227,223,211,0.6) !important;
    }

    .tesserin-canvas-light .excalidraw .layer-ui__library {
      background: #f9f6f0 !important;
    }

    .tesserin-canvas-light .excalidraw .layer-ui__wrapper__footer {
      background: transparent !important;
    }

    .tesserin-canvas-light .excalidraw .welcome-screen-decor-hint {
      color: #a8a399 !important;
    }

    .tesserin-canvas-light .excalidraw ::-webkit-scrollbar-thumb {
      background-color: #d9d5cb !important;
      border-radius: 10px !important;
    }
    .tesserin-canvas-light .excalidraw ::-webkit-scrollbar-track {
      background: transparent !important;
    }
    
    .tesserin-canvas-light .excalidraw {
      --color-bg-canvas: ${LIGHT_BG} !important;
      --color-surface-default: ${LIGHT_BG} !important;
      --color-background: ${LIGHT_BG} !important;
    }
  `

  /* ── render ───────────────────────────────────────────── */
  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: isDark ? DARK_BG : LIGHT_BG }}>
        <TesserinLogo size={48} animated />
      </div>
    )
  }

  return (
    <div className={`w-full h-full relative ${!isDark ? 'tesserin-canvas-light' : ''}`}>
      <style>{brandCSS}</style>
      {/* Insert Note button */}
      <button
        onClick={() => setShowNotePicker(!showNotePicker)}
        className="absolute top-3 right-3 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg transition-all hover:scale-105"
        style={{
          backgroundColor: "var(--accent-primary)",
          color: "#000",
          display: showNotePicker ? "none" : "flex",
        }}
        aria-label="Insert note onto canvas"
      >
        <FiFileText size={13} />
        Insert Note
      </button>
      {/* Note picker panel */}
      {showNotePicker && (
        <NotePickerPanel
          notes={notes}
          onInsert={handleInsertNote}
          onClose={() => setShowNotePicker(false)}
        />
      )}
      <Excalidraw
        excalidrawAPI={onAPI}
        initialData={initialData || undefined}
        onChange={onChange}
        onLibraryChange={onLibraryChange}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: true,
            export: { saveFileToDisk: true },
            loadScene: true,
            saveToActiveFile: false,
            toggleTheme: true,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Center>
            <div className="flex flex-col items-center justify-center pointer-events-none select-none">
              <TesserinLogo size={64} animated />
              <h1
                className="text-3xl font-bold mt-4 tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Tesseradraw
              </h1>
              <p className="text-sm opacity-60 mt-2">AI-Enhanced Creative Canvas</p>
            </div>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>
    </div>
  )
}
