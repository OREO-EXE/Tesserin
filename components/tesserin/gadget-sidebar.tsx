"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { FiX, FiSend, FiWifi, FiWifiOff, FiLoader, FiPlus, FiCopy, FiCheck } from "react-icons/fi"
import { HiOutlineSparkles, HiOutlineCpuChip } from "react-icons/hi2"
import { SkeuoPanel } from "./skeuo-panel"
import { AudioDeck } from "./audio-deck"
import { SystemMonitor } from "./system-monitor"
import { useNotes } from "@/lib/notes-store"

/**
 * GadgetSidebar
 *
 * Collapsible right-hand utility panel with:
 * 1. AudioDeck — Voice memo recorder
 * 2. SystemMonitor — CPU / RAM gauges
 * 3. AI Assistant — Live Ollama chat with streaming + insert-to-note
 *
 * When collapsed, renders as a small floating button.
 */

const OLLAMA_ENDPOINT = "http://localhost:11434"

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export function GadgetSidebar() {
  const [expanded, setExpanded] = useState(true)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "👋 Hi! I'm your Tesserin AI assistant. Ask me anything — I can help summarize notes, suggest connections, brainstorm ideas, or just chat.",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [selectedModel, setSelectedModel] = useState("llama3.2")
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { selectedNoteId, notes, updateNote } = useNotes()
  const selectedNote = notes.find(n => n.id === selectedNoteId) || null

  // Check Ollama connection on mount
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = useCallback(async () => {
    // Try Electron IPC first
    if (typeof window !== "undefined" && window.tesserin?.ai) {
      try {
        const result = await window.tesserin.ai.checkConnection()
        setIsConnected(result.connected)
        if (result.connected) {
          const models = await window.tesserin.ai.listModels()
          setAvailableModels(models)
          if (models.length > 0 && !models.includes(selectedModel)) {
            setSelectedModel(models[0])
          }
        }
        return
      } catch {
        // Fall through to direct HTTP
      }
    }

    // Direct HTTP to Ollama
    try {
      const res = await fetch(`${OLLAMA_ENDPOINT}/api/version`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        setIsConnected(true)
        // Fetch models
        const tagRes = await fetch(`${OLLAMA_ENDPOINT}/api/tags`)
        if (tagRes.ok) {
          const data = (await tagRes.json()) as { models?: Array<{ name: string }> }
          const models = (data.models || []).map((m: { name: string }) => m.name)
          setAvailableModels(models)
          if (models.length > 0 && !models.includes(selectedModel)) {
            setSelectedModel(models[0])
          }
        }
      } else {
        setIsConnected(false)
      }
    } catch {
      setIsConnected(false)
    }
  }, [selectedModel])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Insert AI response text into the currently selected note
  const insertToNote = useCallback(
    (text: string) => {
      if (!selectedNoteId || !selectedNote) return
      const separator = selectedNote.content.endsWith("\n") ? "\n" : "\n\n"
      const newContent = selectedNote.content + separator + "---\n\n" + text + "\n"
      updateNote(selectedNoteId, { content: newContent })
    },
    [selectedNoteId, selectedNote, updateNote],
  )

  const copyToClipboard = useCallback(async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }, [])

  // Stream chat directly via Ollama HTTP (works in browser without Electron)
  const streamOllamaHttp = useCallback(
    async (allMessages: ChatMessage[]) => {
      const assistantMsg: ChatMessage = { role: "assistant", content: "" }
      setMessages(prev => [...prev, assistantMsg])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            messages: allMessages.map(m => ({ role: m.role, content: m.content })),
            stream: true,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(`Ollama ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split("\n").filter(Boolean)

          for (const line of lines) {
            try {
              const json = JSON.parse(line)
              if (json.message?.content) {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: last.content + json.message.content }
                  }
                  return updated
                })
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last.role === "assistant" && last.content === "") {
            updated[updated.length - 1] = {
              role: "assistant",
              content: `⚠️ Ollama error: ${err instanceof Error ? err.message : String(err)}. Make sure Ollama is running.`,
            }
          }
          return updated
        })
      } finally {
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [selectedModel],
  )

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setChatInput("")
    setIsLoading(true)

    const allMessages = [...messages, userMsg]

    // Try Electron IPC first
    if (typeof window !== "undefined" && window.tesserin?.ai && isConnected) {
      try {
        const assistantMsg: ChatMessage = { role: "assistant", content: "" }
        setMessages(prev => [...prev, assistantMsg])

        const stream = window.tesserin.ai.chatStream(
          allMessages.map(m => ({ role: m.role, content: m.content })),
          selectedModel,
        )
        stream.onChunk((chunk: string) => {
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + chunk }
            }
            return updated
          })
        })
        stream.onDone(() => setIsLoading(false))
        stream.onError((error: string) => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: `⚠️ Error: ${error}` }
            return updated
          })
          setIsLoading(false)
        })
        return
      } catch {
        // Fall through to HTTP
      }
    }

    // Direct HTTP streaming to Ollama (browser mode)
    if (isConnected) {
      await streamOllamaHttp(allMessages)
      return
    }

    // Demo mode fallback
    setTimeout(() => {
      const demos = [
        "I'd be happy to help! In Tesserin, you can use [[wiki-links]] to connect related notes and build a knowledge graph.",
        "That's a great question! Try organizing your ideas using the Kanban board for project tracking.",
        "Here's a tip: Press **Cmd+K** to open the search palette and quickly navigate between your notes.",
        "I recommend breaking that down into atomic notes — one idea per note, then link them together using [[wiki-links]].",
        "You can use the Daily Notes feature to build a journaling habit. It auto-creates an entry for each day!",
      ]
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: demos[Math.floor(Math.random() * demos.length)] },
      ])
      setIsLoading(false)
    }, 800 + Math.random() * 1200)
  }, [chatInput, messages, isLoading, isConnected, selectedModel, streamOllamaHttp])

  /* ── Collapsed state: floating button ── */
  if (!expanded) {
    return (
      <div className="flex items-start pt-2">
        <button
          onClick={() => setExpanded(true)}
          className="skeuo-btn w-12 h-12 flex items-center justify-center rounded-xl relative group"
          aria-label="Open Tesserin Gadgets"
          style={{ boxShadow: "0 4px 16px rgba(250, 204, 21, 0.15)" }}
        >
          <HiOutlineSparkles size={20} className="text-yellow-500" />
          {/* Pulse indicator */}
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent-primary)", boxShadow: "0 0 8px rgba(250, 204, 21, 0.6)" }}
          />
          {/* Tooltip */}
          <div
            className="absolute right-full mr-3 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)", boxShadow: "var(--panel-shadow)" }}
          >
            Tesserin Gadgets
          </div>
        </button>
      </div>
    )
  }

  /* ── Expanded state: full panel ── */
  return (
    <SkeuoPanel className="w-80 h-full flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div
        className="p-4 border-b flex justify-between items-center"
        style={{ borderColor: "var(--border-dark)" }}
      >
        <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
          <HiOutlineSparkles size={16} className="text-yellow-500 fill-yellow-500" />
          TESSERIN GADGETS
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="skeuo-btn p-1 rounded-md"
          aria-label="Collapse gadget sidebar"
        >
          <FiX size={14} />
        </button>
      </div>

      {/* Scrollable widget area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="p-4 space-y-6">
          <AudioDeck />
          <SystemMonitor />
        </div>

        {/* AI Assistant */}
        <div className="flex-1 flex flex-col px-4 pb-2">
          {/* AI Header */}
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              <HiOutlineCpuChip size={12} />
              AI Assistant
            </div>
            <div className="flex items-center gap-2">
              {/* Connection status */}
              {isConnected === true && (
                <div className="flex items-center gap-1 text-[10px]" style={{ color: "#22c55e" }}>
                  <FiWifi size={10} /> Connected
                </div>
              )}
              {isConnected === false && (
                <button
                  onClick={checkConnection}
                  className="flex items-center gap-1 text-[10px] hover:opacity-80"
                  style={{ color: "#ef4444" }}
                >
                  <FiWifiOff size={10} /> Reconnect
                </button>
              )}
              {isConnected === null && (
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Demo Mode</span>
              )}
            </div>
          </div>

          {/* Model selector */}
          {availableModels.length > 0 && (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full skeuo-inset px-2 py-1 text-[10px] rounded-lg mb-2 focus:outline-none"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-panel-inset)" }}
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}

          {/* Chat Messages */}
          <div className="flex-1 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar space-y-3 mb-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] relative group">
                  <div
                    className="px-3 py-2 rounded-xl text-xs leading-relaxed"
                    style={{
                      backgroundColor: msg.role === "user"
                        ? "var(--accent-primary)"
                        : "var(--bg-panel-inset)",
                      color: msg.role === "user"
                        ? "var(--text-on-accent)"
                        : "var(--text-primary)",
                      boxShadow: msg.role === "user"
                        ? "0 2px 8px rgba(250, 204, 21, 0.3)"
                        : "var(--input-inner-shadow)",
                    }}
                  >
                    {msg.content}
                    {msg.role === "assistant" && i === messages.length - 1 && isLoading && (
                      <span className="inline-block ml-1 animate-pulse">▊</span>
                    )}
                  </div>

                  {/* Action buttons on assistant messages (not the loading one) */}
                  {msg.role === "assistant" && msg.content && !(i === messages.length - 1 && isLoading) && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Insert to note */}
                      <button
                        onClick={() => insertToNote(msg.content)}
                        disabled={!selectedNoteId}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium hover:opacity-80 disabled:opacity-30"
                        style={{ color: "var(--accent-primary)" }}
                        title={selectedNoteId ? `Insert into "${selectedNote?.title}"` : "Select a note first"}
                      >
                        <FiPlus size={9} /> Insert to note
                      </button>
                      {/* Copy */}
                      <button
                        onClick={() => copyToClipboard(msg.content, i)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium hover:opacity-80"
                        style={{ color: "var(--text-tertiary)" }}
                        title="Copy to clipboard"
                      >
                        {copiedIdx === i ? <FiCheck size={9} /> : <FiCopy size={9} />}
                        {copiedIdx === i ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Command input */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border-dark)" }}>
        {/* Active note indicator */}
        {selectedNote && (
          <div
            className="text-[9px] mb-1.5 px-1 truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            📝 Active note: <span className="font-semibold">{selectedNote.title}</span>
          </div>
        )}
        <div className="relative">
          <input
            ref={inputRef}
            className="w-full skeuo-inset py-3 pl-4 pr-10 text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder={isLoading ? "Thinking..." : "Ask AI anything..."}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={isLoading}
            aria-label="AI chat input"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !chatInput.trim()}
            className="absolute right-2 top-2 skeuo-btn p-1.5 rounded-lg active disabled:opacity-30"
            aria-label="Send message"
          >
            {isLoading ? (
              <FiLoader size={14} className="animate-spin" />
            ) : (
              <FiSend size={14} />
            )}
          </button>
        </div>
      </div>
    </SkeuoPanel>
  )
}
