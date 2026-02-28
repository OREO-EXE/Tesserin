"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  FiSearch, FiFileText, FiPlus, FiCommand, FiHash, FiCalendar,
  FiLayout, FiX, FiCompass, FiGrid, FiSettings,
  FiCpu, FiLink2, FiClock, FiColumns, FiZap, FiStar,
} from "react-icons/fi"
import { HiOutlineSparkles } from "react-icons/hi2"
import { useNotes } from "@/lib/notes-store"
import { FuzzySearchEngine, type FuzzyResult, type SearchableItem } from "@/lib/fuzzy-search"
import { usePlugins } from "@/lib/plugin-system"

/**
 * SearchPalette v3
 *
 * A polished command palette with:
 * - Fuzzy note search with ranked scoring & highlighted matches
 * - Plugin commands integration
 * - Tab navigation shortcuts
 * - Quick note creation
 * - Categorised result sections
 * - Keyboard navigation (↑/↓, Enter, Tab, Esc)
 * - Smooth enter/exit animations, staggered items, micro-interactions
 */

interface SearchPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectNote: (noteId: string) => void
  onNavigateTab?: (tabId: string) => void
  onOpenSplit?: () => void
}

interface SearchResult {
  id: string
  type: "note" | "command" | "create" | "tab" | "plugin" | "action"
  title: string
  subtitle?: string
  icon: React.ReactNode
  category: string
  score: number
  action: () => void
  highlights?: Array<{ start: number; length: number }>
}

/* ── Tab navigation items ── */
const TAB_ITEMS = [
  { id: "notes", icon: <FiFileText size={14} />, label: "Notes", subtitle: "Open note editor" },
  { id: "canvas", icon: <FiCompass size={14} />, label: "Canvas", subtitle: "Open whiteboard" },
  { id: "graph", icon: <FiCpu size={14} />, label: "Graph", subtitle: "Knowledge graph view" },
  { id: "sam", icon: <HiOutlineSparkles size={14} />, label: "SAM", subtitle: "AI assistant" },
  { id: "settings", icon: <FiSettings size={14} />, label: "Settings", subtitle: "App preferences" },
]

/* ── Built-in commands ── */
const BUILTIN_COMMANDS = [
  { id: "cmd-new-note", label: "New Note", subtitle: "Create a blank note", icon: <FiPlus size={14} />, category: "Actions" },
  { id: "cmd-split", label: "Open Split View", subtitle: "Side-by-side editing", icon: <FiColumns size={14} />, category: "Actions" },
  { id: "cmd-backlinks", label: "Show Backlinks", subtitle: "View incoming links", icon: <FiLink2 size={14} />, category: "Actions" },
]

/* ── Highlighted text renderer ── */
function HighlightedText({ text, highlights }: { text: string; highlights?: Array<{ start: number; length: number }> }) {
  if (!highlights || highlights.length === 0) {
    return <>{text}</>
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const sorted = [...highlights].sort((a, b) => a.start - b.start)

  for (const hl of sorted) {
    if (hl.start > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex, hl.start)}</span>)
    }
    parts.push(
      <span
        key={`h-${hl.start}`}
        style={{
          color: "var(--accent-primary)",
          fontWeight: 600,
          textShadow: "0 0 8px rgba(250, 204, 21, 0.3)",
        }}
      >
        {text.substring(hl.start, hl.start + hl.length)}
      </span>
    )
    lastIndex = hl.start + hl.length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex)}</span>)
  }

  return <>{parts}</>
}

/* ── Category order for display ── */
const CATEGORY_ORDER = ["Notes", "Actions", "Tabs", "Plugins"]

/* ── Palette keyframe styles (injected once) ── */
const PALETTE_STYLES = `
@keyframes palette-backdrop-in {
  from { opacity: 0; backdrop-filter: blur(0px); }
  to   { opacity: 1; backdrop-filter: blur(12px); }
}
@keyframes palette-backdrop-out {
  from { opacity: 1; backdrop-filter: blur(12px); }
  to   { opacity: 0; backdrop-filter: blur(0px); }
}
@keyframes palette-panel-in {
  from { opacity: 0; transform: translateY(-16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes palette-panel-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-10px) scale(0.98); }
}
@keyframes palette-item-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes palette-empty-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes palette-glow-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); }
  50%      { box-shadow: 0 0 20px 2px rgba(250, 204, 21, 0.08); }
}
@keyframes palette-input-caret {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
`

let stylesInjected = false
function injectPaletteStyles() {
  if (stylesInjected) return
  stylesInjected = true
  const style = document.createElement("style")
  style.textContent = PALETTE_STYLES
  document.head.appendChild(style)
}

export function SearchPalette({ isOpen, onClose, onSelectNote, onNavigateTab, onOpenSplit }: SearchPaletteProps) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const { notes, addNote } = useNotes()
  const { commands: pluginCommands } = usePlugins()

  // Inject keyframe styles once
  useEffect(() => { injectPaletteStyles() }, [])

  // Enter / exit animation lifecycle
  useEffect(() => {
    if (isOpen) {
      setClosing(false)
      setQuery("")
      setActiveIndex(0)
      // Trigger enter on next frame so the DOM is mounted first
      requestAnimationFrame(() => {
        setVisible(true)
        setTimeout(() => inputRef.current?.focus(), 80)
      })
    } else if (visible) {
      // Already open → play exit
      setClosing(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setClosing(false)
      }, 180)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => onClose(), 180)
  }, [onClose])

  // Build fuzzy search engine, kept in sync with notes
  const fuzzyEngine = useMemo(() => {
    const items: SearchableItem[] = notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
    }))
    return new FuzzySearchEngine(items)
  }, [notes])

  // Build results
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    const allResults: SearchResult[] = []

    // Detect command mode (starting with ">")
    const isCommandMode = q.startsWith(">")
    const commandQuery = isCommandMode ? q.slice(1).trim() : q

    if (!q) {
      // Show recent notes + all commands when empty
      const recent = notes.slice(0, 5).map((n): SearchResult => ({
        id: n.id,
        type: "note",
        title: n.title,
        subtitle: `Updated ${new Date(n.updatedAt).toLocaleDateString()}`,
        icon: <FiFileText size={14} />,
        category: "Notes",
        score: 100,
        action: () => onSelectNote(n.id),
      }))
      allResults.push(...recent)

      BUILTIN_COMMANDS.forEach((cmd) => {
        allResults.push({
          id: cmd.id,
          type: "command",
          title: cmd.label,
          subtitle: cmd.subtitle,
          icon: cmd.icon,
          category: "Actions",
          score: 50,
          action: () => {
            if (cmd.id === "cmd-new-note") {
              const id = addNote()
              onSelectNote(id)
            } else if (cmd.id === "cmd-split") {
              onOpenSplit?.()
            }
          },
        })
      })

      TAB_ITEMS.forEach((tab) => {
        allResults.push({
          id: `tab-${tab.id}`,
          type: "tab",
          title: `Go to ${tab.label}`,
          subtitle: tab.subtitle,
          icon: tab.icon,
          category: "Tabs",
          score: 30,
          action: () => onNavigateTab?.(tab.id),
        })
      })

      return allResults
    }

    if (isCommandMode) {
      // Command-only mode
      BUILTIN_COMMANDS
        .filter((cmd) => !commandQuery || cmd.label.toLowerCase().includes(commandQuery))
        .forEach((cmd) => {
          allResults.push({
            id: cmd.id,
            type: "command",
            title: cmd.label,
            subtitle: cmd.subtitle,
            icon: cmd.icon,
            category: "Actions",
            score: 80,
            action: () => {
              if (cmd.id === "cmd-new-note") {
                const id = addNote()
                onSelectNote(id)
              } else if (cmd.id === "cmd-split") {
                onOpenSplit?.()
              }
            },
          })
        })

      pluginCommands
        .filter((cmd) => !commandQuery || cmd.label.toLowerCase().includes(commandQuery))
        .forEach((cmd) => {
          allResults.push({
            id: `plugin-${cmd.id}`,
            type: "plugin",
            title: cmd.label,
            subtitle: cmd.category || "Plugin",
            icon: cmd.icon || <FiZap size={14} />,
            category: "Plugins",
            score: 70,
            action: () => cmd.execute(),
          })
        })

      TAB_ITEMS
        .filter((tab) => !commandQuery || tab.label.toLowerCase().includes(commandQuery))
        .forEach((tab) => {
          allResults.push({
            id: `tab-${tab.id}`,
            type: "tab",
            title: `Go to ${tab.label}`,
            subtitle: tab.subtitle,
            icon: tab.icon,
            category: "Tabs",
            score: 60,
            action: () => onNavigateTab?.(tab.id),
          })
        })

      return allResults
    }

    // ── Full search mode (notes + commands + tabs) ──

    // Fuzzy note search
    const fuzzy: FuzzyResult[] = fuzzyEngine.search(query, 12)
    fuzzy.forEach((fr) => {
      allResults.push({
        id: fr.item.id,
        type: "note",
        title: fr.item.title,
        subtitle: fr.snippet || fr.item.content.substring(0, 80).replace(/[#\n]/g, " ").trim(),
        icon: <FiFileText size={14} />,
        category: "Notes",
        score: fr.score,
        highlights: fr.titleMatches,
        action: () => onSelectNote(fr.item.id),
      })
    })

    // "Create note" option if no exact match
    const hasExactMatch = notes.some((n) => n.title.toLowerCase() === q)
    if (!hasExactMatch && query.trim()) {
      allResults.push({
        id: "create-new",
        type: "create",
        title: `Create "${query.trim()}"`,
        subtitle: "New note",
        icon: <FiPlus size={14} />,
        category: "Actions",
        score: 10,
        action: () => {
          const id = addNote(query.trim())
          onSelectNote(id)
        },
      })
    }

    // Matching commands
    BUILTIN_COMMANDS
      .filter((cmd) => cmd.label.toLowerCase().includes(q))
      .forEach((cmd) => {
        allResults.push({
          id: cmd.id,
          type: "command",
          title: cmd.label,
          subtitle: cmd.subtitle,
          icon: cmd.icon,
          category: "Actions",
          score: 40,
          action: () => {
            if (cmd.id === "cmd-new-note") {
              const id = addNote()
              onSelectNote(id)
            } else if (cmd.id === "cmd-split") {
              onOpenSplit?.()
            }
          },
        })
      })

    // Plugin commands
    pluginCommands
      .filter((cmd) => cmd.label.toLowerCase().includes(q))
      .forEach((cmd) => {
        allResults.push({
          id: `plugin-${cmd.id}`,
          type: "plugin",
          title: cmd.label,
          subtitle: cmd.category || "Plugin",
          icon: cmd.icon || <FiZap size={14} />,
          category: "Plugins",
          score: 35,
          action: () => cmd.execute(),
        })
      })

    // Matching tabs
    TAB_ITEMS
      .filter((tab) => tab.label.toLowerCase().includes(q))
      .forEach((tab) => {
        allResults.push({
          id: `tab-${tab.id}`,
          type: "tab",
          title: `Go to ${tab.label}`,
          subtitle: tab.subtitle,
          icon: tab.icon,
          category: "Tabs",
          score: 20,
          action: () => onNavigateTab?.(tab.id),
        })
      })

    return allResults
  }, [query, notes, pluginCommands, fuzzyEngine, addNote, onSelectNote, onNavigateTab, onOpenSplit])

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: { category: string; items: SearchResult[] }[] = []
    const categoryMap = new Map<string, SearchResult[]>()

    for (const result of results) {
      const items = categoryMap.get(result.category) || []
      items.push(result)
      categoryMap.set(result.category, items)
    }

    for (const cat of CATEGORY_ORDER) {
      const items = categoryMap.get(cat)
      if (items && items.length > 0) {
        groups.push({ category: cat, items: items.sort((a, b) => b.score - a.score) })
      }
    }

    for (const [cat, items] of categoryMap) {
      if (!CATEGORY_ORDER.includes(cat) && items.length > 0) {
        groups.push({ category: cat, items: items.sort((a, b) => b.score - a.score) })
      }
    }

    return groups
  }, [results])

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    return groupedResults.flatMap((g) => g.items)
  }, [groupedResults])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && flatResults[activeIndex]) {
        e.preventDefault()
        flatResults[activeIndex].action()
        handleClose()
      } else if (e.key === "Escape") {
        handleClose()
      } else if (e.key === "Tab") {
        e.preventDefault()
        if (!query.startsWith(">")) {
          setQuery("> ")
        } else {
          setQuery("")
        }
      }
    },
    [flatResults, activeIndex, handleClose, query],
  )

  // Scroll active item into view (smooth)
  useEffect(() => {
    if (resultsRef.current) {
      const activeEl = resultsRef.current.querySelector(`[data-index="${activeIndex}"]`)
      activeEl?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [activeIndex])

  // Don't render if never opened
  if (!isOpen && !visible) return null

  const isCommandMode = query.startsWith(">")
  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={handleClose}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        animation: closing
          ? "palette-backdrop-out 180ms ease-in forwards"
          : "palette-backdrop-in 250ms ease-out forwards",
      }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow:
            "0 25px 60px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)",
          animation: closing
            ? "palette-panel-out 180ms ease-in forwards"
            : "palette-panel-in 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* ── Search input ── */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(255, 255, 255, 0.01)",
          }}
        >
          <FiSearch
            size={18}
            style={{
              color: isCommandMode ? "var(--accent-primary)" : "var(--text-tertiary)",
              transition: "color 200ms ease, transform 200ms ease",
              transform: isCommandMode ? "rotate(-5deg)" : "rotate(0deg)",
              filter: isCommandMode ? "drop-shadow(0 0 6px rgba(250, 204, 21, 0.4))" : "none",
            }}
          />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-base focus:outline-none"
            style={{
              color: "var(--text-primary)",
              caretColor: "var(--accent-primary)",
            }}
            placeholder={isCommandMode ? "Type a command..." : "Search notes, commands, tabs..."}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search"
            
          />
          <div className="flex items-center gap-1.5">
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus() }}
                className="p-1 rounded transition-all duration-150"
                style={{ opacity: 0.6 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1.1)" }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.transform = "scale(1)" }}
              >
                <FiX size={14} style={{ color: "var(--text-secondary)" }} />
              </button>
            )}
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer select-none"
              style={{
                backgroundColor: isCommandMode ? "rgba(250, 204, 21, 0.1)" : "var(--bg-panel-inset)",
                color: isCommandMode ? "var(--accent-primary)" : "var(--text-tertiary)",
                border: `1px solid ${isCommandMode ? "rgba(250, 204, 21, 0.2)" : "rgba(255, 255, 255, 0.06)"}`,
                transition: "all 200ms ease",
              }}
              onClick={() => setQuery(isCommandMode ? "" : "> ")}
              title="Toggle command mode (Tab)"
            >
              {isCommandMode ? "Search" : "> Cmd"}
            </kbd>
          </div>
        </div>

        {/* ── Results ── */}
        <div
          ref={resultsRef}
          className="overflow-y-auto custom-scrollbar py-1"
          style={{
            maxHeight: "420px",
            scrollBehavior: "smooth",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 8px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8px, black calc(100% - 8px), transparent 100%)",
          }}
        >
          {flatResults.length === 0 && query.trim() ? (
            <div
              className="px-4 py-10 text-center text-sm"
              style={{
                color: "var(--text-tertiary)",
                animation: "palette-empty-in 250ms ease-out",
              }}
            >
              <FiSearch size={28} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
              <div>No results for &ldquo;{query}&rdquo;</div>
              <div className="text-xs mt-1" style={{ opacity: 0.5 }}>Try a different search term</div>
            </div>
          ) : (
            groupedResults.map((group, groupIdx) => (
              <div key={group.category}>
                {/* Category header */}
                <div
                  className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2"
                  style={{
                    color: "var(--text-tertiary)",
                    opacity: 0.7,
                    animation: `palette-item-in 200ms ${groupIdx * 30}ms ease-out both`,
                  }}
                >
                  <span>{group.category}</span>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
                  <span style={{ opacity: 0.5, fontSize: 9, fontWeight: 400, letterSpacing: 0 }}>
                    {group.items.length}
                  </span>
                </div>

                {group.items.map((result, itemIdx) => {
                  flatIndex++
                  const idx = flatIndex
                  const isActive = idx === activeIndex
                  const staggerDelay = groupIdx * 30 + itemIdx * 25

                  return (
                    <button
                      key={result.id}
                      data-index={idx}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left group relative"
                      style={{
                        transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                        backgroundColor: isActive ? "rgba(255, 255, 255, 0.06)" : "transparent",
                        color: isActive ? "#ffffff" : "var(--text-primary)",
                        paddingLeft: isActive ? "20px" : "16px",
                        animation: `palette-item-in 200ms ${staggerDelay}ms ease-out both`,
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        result.action()
                        handleClose()
                      }}
                    >
                      {/* Active indicator bar */}
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "20%",
                          bottom: "20%",
                          width: 3,
                          borderRadius: 2,
                          background: isActive ? "var(--accent-primary)" : "transparent",
                          transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: isActive ? "0 0 8px rgba(250, 204, 21, 0.4)" : "none",
                        }}
                      />

                      {/* Icon badge */}
                      <span
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          transition: "all 150ms ease",
                          transform: isActive ? "scale(1.08)" : "scale(1)",
                          backgroundColor:
                            result.type === "create"
                              ? "var(--accent-primary)"
                              : result.type === "plugin"
                                ? "rgba(139, 92, 246, 0.15)"
                                : isActive ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
                          color:
                            result.type === "create"
                              ? "var(--text-on-accent)"
                              : result.type === "plugin"
                                ? "#a78bfa"
                                : isActive ? "#ffffff" : "var(--text-secondary)",
                          boxShadow:
                            result.type === "create" && isActive
                              ? "0 0 12px rgba(250, 204, 21, 0.3)"
                              : "none",
                        }}
                      >
                        {result.icon}
                      </span>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-medium truncate"
                          style={{ transition: "color 150ms ease" }}
                        >
                          <HighlightedText text={result.title} highlights={result.highlights} />
                        </div>
                        {result.subtitle && (
                          <div
                            className="text-xs truncate"
                            style={{
                              color: isActive ? "var(--text-secondary)" : "var(--text-tertiary)",
                              transition: "color 150ms ease",
                            }}
                          >
                            {result.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Trailing icon */}
                      <span
                        style={{
                          transition: "all 150ms ease",
                          opacity: isActive ? 0.6 : 0.3,
                          transform: isActive ? "scale(1.1)" : "scale(1)",
                        }}
                      >
                        {result.type === "note" && (
                          <FiHash size={12} style={{ color: isActive ? "var(--text-secondary)" : "var(--text-tertiary)" }} />
                        )}
                        {result.type === "command" && (
                          <FiCommand size={12} style={{ color: isActive ? "var(--text-secondary)" : "var(--text-tertiary)" }} />
                        )}
                        {result.type === "tab" && (
                          <FiLayout size={12} style={{ color: isActive ? "var(--text-secondary)" : "var(--text-tertiary)" }} />
                        )}
                        {result.type === "plugin" && (
                          <FiZap size={12} style={{ color: "#a78bfa" }} />
                        )}
                        {result.type === "create" && (
                          <FiPlus size={12} style={{ color: "var(--accent-primary)" }} />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="px-5 py-2.5 flex items-center gap-4 text-[10px]"
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            color: "var(--text-tertiary)",
            background: "rgba(0, 0, 0, 0.1)",
          }}
        >
          {[
            { key: "↑↓", label: "Navigate" },
            { key: "↵", label: "Open" },
            { key: "Tab", label: "Commands" },
            { key: "esc", label: "Close" },
          ].map((hint) => (
            <span key={hint.key} className="flex items-center gap-1">
              <kbd
                className="px-1 py-px rounded text-[9px]"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  fontFamily: "inherit",
                }}
              >
                {hint.key}
              </kbd>
              <span style={{ opacity: 0.7 }}>{hint.label}</span>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1" style={{ opacity: 0.5 }}>
            <FiStar size={9} />
            <span>{flatResults.length} result{flatResults.length !== 1 ? "s" : ""}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
