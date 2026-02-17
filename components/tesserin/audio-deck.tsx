"use client"

import React, { useState, useEffect, useCallback } from "react"
import { FiMic, FiSquare, FiPlay } from "react-icons/fi"

/**
 * AudioDeck
 *
 * A skeuomorphic voice-memo recorder widget. It features:
 *
 * - A **waveform visualiser** (animated bars that respond to recording state).
 * - A **timer** displaying elapsed recording time in `MM:SS` format.
 * - A **LED indicator** that pulses red while recording.
 * - Record / Stop and Play buttons.
 *
 * > **Note:** This component simulates recording visuals; no actual
 * > `MediaRecorder` API is connected. Integrate your own capture
 * > pipeline by hooking into the `isRecording` state.
 *
 * @example
 * ```tsx
 * <AudioDeck />
 * ```
 */

const WAVEFORM_BARS = 20

export function AudioDeck() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)

  // Increment duration timer while recording
  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => clearInterval(interval)
  }, [isRecording])

  /** Format seconds into `MM:SS` */
  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")
    const s = (secs % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }, [])

  return (
    <div className="flex flex-col gap-2 p-1">
      {/* Section label */}
      <div
        className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        <FiMic size={12} /> Voice Memo
      </div>

      {/* Waveform display */}
      <div
        className="skeuo-inset p-3 flex items-center justify-between relative overflow-hidden h-16"
        role="status"
        aria-label={isRecording ? `Recording: ${formatTime(duration)}` : "Recorder idle"}
      >
        {/* Animated bars */}
        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-30" aria-hidden="true">
          {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-100"
              style={{
                backgroundColor: "var(--text-secondary)",
                height: isRecording ? `${Math.random() * 80 + 20}%` : "20%",
                opacity: isRecording ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Timer */}
        <span className="font-mono text-xl z-10 font-bold" style={{ color: "var(--text-primary)" }}>
          {formatTime(duration)}
        </span>

        {/* LED indicator */}
        <div
          className={`led-indicator ${isRecording ? "animate-pulse" : ""}`}
          style={{
            backgroundColor: isRecording ? "#ef4444" : "var(--text-tertiary)",
            boxShadow: isRecording ? "0 0 8px #ef4444" : "none",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={`skeuo-btn flex-1 h-10 flex items-center justify-center rounded-lg ${isRecording ? "active" : ""}`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? (
            <FiSquare size={16} fill="currentColor" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-red-500 border border-red-700 shadow-inner" />
          )}
        </button>
        <button className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-lg" aria-label="Play recording">
          <FiPlay size={16} />
        </button>
      </div>
    </div>
  )
}
