"use client"

import React from "react"
import { TesserinLogo } from "./tesserin-logo"

/**
 * LoadingScreen
 *
 * A full-viewport splash screen displayed during the initial app boot.
 * Shows the animated Tesserin Hyper-Crystal logo with a progress bar
 * that fills over the loading duration.
 *
 * @example
 * ```tsx
 * if (isLoading) return <LoadingScreen />
 * ```
 */

export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: "#eef2f6" }}
      role="status"
      aria-label="Loading Tesserin"
    >
      <TesserinLogo size={120} animated />

      {/* Progress bar */}
      <div className="mt-8 skeuo-inset w-64 h-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: "var(--accent-primary, #FACC15)",
            animation: "progress 2s ease-in-out forwards",
            width: "0%",
          }}
        />
      </div>

      <span className="sr-only">Loading application</span>
    </div>
  )
}
