"use client"

import React from "react"
import { FiRotateCcw, FiRotateCw } from "react-icons/fi"
import { SkeuoPanel } from "./skeuo-panel"

/**
 * BottomTimeline
 *
 * A floating pill-shaped toolbar fixed to the bottom-centre of the
 * viewport. Contains:
 *
 * - **Undo / Redo** buttons.
 * - A decorative version timeline with dots and inset tracks.
 * - A static version label ("VERSION 4.0").
 *
 * @example
 * ```tsx
 * <BottomTimeline />
 * ```
 */

export function BottomTimeline() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <SkeuoPanel className="px-6 py-3 flex items-center gap-6 rounded-full">
        {/* Undo / Redo */}
        <div className="flex items-center gap-4">
          <button
            className="skeuo-btn w-8 h-8 rounded-full flex items-center justify-center"
            aria-label="Undo"
          >
            <FiRotateCcw size={14} />
          </button>
          <button
            className="skeuo-btn w-8 h-8 rounded-full flex items-center justify-center"
            aria-label="Redo"
          >
            <FiRotateCw size={14} />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6" style={{ backgroundColor: "var(--border-dark)", opacity: 0.3 }} aria-hidden="true" />

        {/* Version timeline dots */}
        <div className="flex items-center gap-1" aria-hidden="true">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--text-tertiary)" }} />
          <div className="w-12 h-1 skeuo-inset rounded-full" />
          <div
            className="w-3 h-3 rounded-full border-2 shadow-sm"
            style={{
              backgroundColor: "var(--accent-primary)",
              borderColor: "var(--border-light)",
            }}
          />
          <div className="w-12 h-1 skeuo-inset rounded-full" />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--text-tertiary)" }} />
        </div>

        {/* Divider */}
        <div className="w-px h-6" style={{ backgroundColor: "var(--border-dark)", opacity: 0.3 }} aria-hidden="true" />

        {/* Version label */}
        <span className="text-xs font-bold" style={{ color: "var(--text-tertiary)" }}>
          VERSION 4.0
        </span>
      </SkeuoPanel>
    </div>
  )
}
