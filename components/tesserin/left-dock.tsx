"use client"

import React from "react"
import { FiFileText, FiCompass, FiCode, FiSun, FiMoon, FiSettings, FiGrid, FiCalendar } from "react-icons/fi"
import { HiOutlineCpuChip } from "react-icons/hi2"
import { SkeuoPanel } from "./skeuo-panel"
import { TesserinLogo } from "./tesserin-logo"
import { useTesserinTheme } from "./theme-provider"

/**
 * LeftDock
 *
 * A vertical navigation dock pinned to the left edge of the viewport.
 * Contains:
 *
 * - **Brand logo** at the top (animated Hyper-Crystal).
 * - **Tab navigation** – Workspace, Canvas, Graph, Code.
 * - **Utility buttons** – Theme toggle (Ceramic / Obsidian) and Settings.
 *
 * An active-indicator "pill" is rendered on the leading edge of the
 * currently selected tab.
 *
 * @param activeTab    - The currently active tab id.
 * @param setActiveTab - Callback to change the active tab.
 *
 * @example
 * ```tsx
 * <LeftDock activeTab={activeTab} setActiveTab={setActiveTab} />
 * ```
 */

/** Tab definitions */
const TABS = [
  { id: "notes", icon: FiFileText, label: "Notes" },
  { id: "canvas", icon: FiCompass, label: "Canvas" },
  { id: "graph", icon: HiOutlineCpuChip, label: "Graph" },
  { id: "code", icon: FiCode, label: "Code" },
  { id: "kanban", icon: FiGrid, label: "Kanban" },
  { id: "daily", icon: FiCalendar, label: "Daily" },
] as const

export type TabId = (typeof TABS)[number]["id"]

interface LeftDockProps {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
}

export function LeftDock({ activeTab, setActiveTab }: LeftDockProps) {
  const { isDark, toggleTheme } = useTesserinTheme()

  return (
    <div className="m-3 mr-0 w-20 flex-shrink-0 z-30 flex flex-col gap-4">
      <SkeuoPanel className="h-full flex flex-col items-center py-6 gap-6">
        {/* Brand logo */}
        <div className="cursor-pointer hover:scale-110 transition-transform duration-300">
          <TesserinLogo size={42} animated />
        </div>

        {/* Divider */}
        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border-dark)", opacity: 0.2 }} />

        {/* Navigation tabs */}
        <nav className="flex-1 flex flex-col gap-4 w-full px-2 items-center" aria-label="Main navigation">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`skeuo-btn w-12 h-12 flex items-center justify-center rounded-xl relative ${activeTab === item.id ? "active" : ""
                }`}
              aria-label={item.label}
              aria-current={activeTab === item.id ? "page" : undefined}
            >
              <item.icon size={20} />
              {/* Active indicator pill */}
              {activeTab === item.id && (
                <div
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full"
                  style={{ backgroundColor: "var(--accent-primary)" }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </nav>

        {/* Utility buttons */}
        <div className="flex flex-col gap-4 mb-2 items-center">
          <button
            onClick={toggleTheme}
            className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-full"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          <button className="skeuo-btn w-10 h-10 flex items-center justify-center rounded-full" aria-label="Settings">
            <FiSettings size={18} />
          </button>
        </div>
      </SkeuoPanel>
    </div>
  )
}
