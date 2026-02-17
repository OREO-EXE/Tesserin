"use client"

import React from "react"
import { FiActivity, FiCpu, FiHardDrive } from "react-icons/fi"
import { SkeuoPanel } from "./skeuo-panel"

/**
 * SystemMonitor
 *
 * A compact dashboard widget that displays simulated system metrics
 * (CPU usage and RAM) using skeuomorphic gauge cards. Each card uses
 * an SVG ring or progress bar for the reading.
 *
 * > **Note:** Values are static / decorative. To make this dynamic,
 * > replace the hard-coded numbers with real-time data from
 * > `navigator.deviceMemory`, performance observers, or a WebSocket feed.
 *
 * @example
 * ```tsx
 * <SystemMonitor />
 * ```
 */

export function SystemMonitor() {
  return (
    <div className="mt-4">
      {/* Section label */}
      <div
        className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        <FiActivity size={12} /> System Status
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* CPU gauge */}
        <SkeuoPanel className="p-3 flex flex-col items-center gap-2">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <FiCpu size={24} style={{ color: "var(--text-tertiary)" }} />
            <svg className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--bg-panel-inset)" strokeWidth="4" />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="4"
                strokeDasharray="125"
                strokeDashoffset="40"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            CPU 68%
          </span>
        </SkeuoPanel>

        {/* RAM gauge */}
        <SkeuoPanel className="p-3 flex flex-col items-center gap-2">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <FiHardDrive size={24} style={{ color: "var(--text-tertiary)" }} />
            <div className="absolute bottom-0 left-0 w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-panel-inset)" }}>
              <div className="h-full w-[40%] bg-green-500" />
            </div>
          </div>
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
            RAM 4GB
          </span>
        </SkeuoPanel>
      </div>
    </div>
  )
}
