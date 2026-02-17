"use client"

import React from "react"
import { FiShare2, FiMoreHorizontal } from "react-icons/fi"
import { SkeuoBadge } from "./skeuo-badge"

/**
 * EditorView
 *
 * A minimal rich-text workspace panel with a skeuomorphic inset textarea.
 * Designed to resemble a dedicated writing surface (like Bear or iA Writer)
 * with a persistent header showing the document title and action buttons.
 *
 * @param content    - The current text content of the editor.
 * @param setContent - Callback invoked when the user types.
 *
 * @example
 * ```tsx
 * const [text, setText] = useState("Hello world")
 * <EditorView content={text} setContent={setText} />
 * ```
 */

interface EditorViewProps {
  /** Current document text */
  content: string
  /** Setter for the document text */
  setContent: (value: string) => void
}

export function EditorView({ content, setContent }: EditorViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="h-14 border-b flex items-center px-6 justify-between shrink-0"
        style={{
          borderColor: "var(--border-dark)",
          background: "var(--bg-panel)",
        }}
      >
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-bold tracking-tight"
            style={{
              color: "var(--text-primary)",
              textShadow: "0 1px 0 var(--bg-app)",
            }}
          >
            Architecture Notes
          </h1>
          <SkeuoBadge>Live</SkeuoBadge>
        </div>

        <div className="flex items-center gap-2">
          <button className="skeuo-btn p-2 rounded-lg" aria-label="Share document">
            <FiShare2 size={16} />
          </button>
          <button className="skeuo-btn p-2 rounded-lg" aria-label="More options">
            <FiMoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Inset writing surface */}
      <div className="flex-1 overflow-hidden relative p-4">
        <div className="w-full h-full skeuo-inset overflow-hidden">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-8 resize-none bg-transparent border-none text-lg leading-relaxed custom-scrollbar font-sans focus:outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="Start typing your thoughts..."
            aria-label="Document editor"
          />
        </div>
      </div>
    </div>
  )
}
