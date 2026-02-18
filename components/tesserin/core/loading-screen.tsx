"use client"

import React, { useState, useEffect } from "react"
import { TesserinLogo } from "./tesserin-logo"

/**
 * LoadingScreen
 *
 * A cinematic splash screen with the Tesserin crystal logo,
 * a rotating tagline, particle-like ambient dots, and a sleek
 * progress bar — all on the signature Obsidian Black canvas.
 */

const TAGLINES = [
  "Think deeper. Write freely.",
  "Your second brain, offline.",
  "Research. Connect. Discover.",
  "Where ideas become knowledge.",
  "Craft your thoughts in gold.",
  "Local-first. Endlessly powerful.",
]

export function LoadingScreen() {
  const [tagline] = useState(
    () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
  )
  const [phase, setPhase] = useState(0) // 0→ logo fading in, 1→ text, 2→ bar

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#050505" }}
      role="status"
      aria-label="Loading Tesserin"
    >
      {/* Ambient glow behind logo */}
      <div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          background: "radial-gradient(circle, rgba(250,204,21,0.06) 0%, transparent 70%)",
          animation: "loading-pulse 3s ease-in-out infinite",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -60%)",
          pointerEvents: "none",
        }}
      />

      {/* Floating ambient particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            backgroundColor: "rgba(250, 204, 21, 0.15)",
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            animation: `loading-float ${4 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Logo with scale-in */}
      <div
        style={{
          opacity: phase >= 0 ? 1 : 0,
          transform: phase >= 0 ? "scale(1)" : "scale(0.7)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <TesserinLogo size={100} animated />
      </div>

      {/* Brand name */}
      <div
        style={{
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <p
          className="mt-5 text-base font-bold tracking-[0.35em] uppercase"
          style={{ color: "#FACC15" }}
        >
          Tesserin
        </p>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
        }}
      >
        <p
          className="mt-2 text-sm font-light tracking-wide"
          style={{ color: "rgba(255, 255, 255, 0.35)" }}
        >
          {tagline}
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="mt-8 w-56 h-[3px] rounded-full overflow-hidden"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          opacity: phase >= 2 ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #FACC15, #F59E0B)",
            animation: "loading-progress 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards",
            width: "0%",
            boxShadow: "0 0 12px rgba(250, 204, 21, 0.4)",
          }}
        />
      </div>

      {/* Version badge */}
      <p
        className="mt-4 text-[10px] tracking-wider"
        style={{
          color: "rgba(255, 255, 255, 0.12)",
          opacity: phase >= 2 ? 1 : 0,
          transition: "opacity 0.5s ease 0.3s",
        }}
      >
        v1.0.0
      </p>

      <span className="sr-only">Loading application</span>
    </div>
  )
}
