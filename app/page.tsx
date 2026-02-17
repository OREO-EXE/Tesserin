"use client"

import React, { useState, useEffect } from "react"

import { TesserinThemeProvider } from "@/components/tesserin/theme-provider"
import { SkeuoPanel } from "@/components/tesserin/skeuo-panel"
import { LeftDock, type TabId } from "@/components/tesserin/left-dock"
import { GadgetSidebar } from "@/components/tesserin/gadget-sidebar"
import { BottomTimeline } from "@/components/tesserin/bottom-timeline"
import { LoadingScreen } from "@/components/tesserin/loading-screen"
import { MarkdownEditor } from "@/components/tesserin/markdown-editor"
import { CreativeCanvas } from "@/components/tesserin/creative-canvas"
import { D3GraphView } from "@/components/tesserin/d3-graph-view"
import { CodeView } from "@/components/tesserin/code-view"
import { NoteSidebar } from "@/components/tesserin/note-sidebar"
import { NotesProvider } from "@/lib/notes-store"

/**
 * TesserinApp (Root Page)
 *
 * The top-level page for the Tesserin workspace. It orchestrates:
 *
 * 1. A 2-second loading splash (`LoadingScreen`).
 * 2. A `NotesProvider` wrapping the entire app for Zettelkasten state.
 * 3. A three-column layout:
 *    - **Left Dock** -- navigation & utility icons.
 *    - **Centre Stage** -- the active workspace view.
 *    - **Right Gadget Sidebar** -- audio deck, system monitor, AI assistant.
 * 4. A floating **Bottom Timeline** toolbar.
 * 5. A **Note Sidebar** on the Notes tab for browsing the vault.
 *
 * The graph and editor are bidirectionally linked: clicking a node in
 * the D3 graph selects that note in the markdown editor, and wiki-links
 * in the editor update the graph in real time.
 *
 * State managed here:
 * - `loading`       -- controls splash screen visibility.
 * - `activeTab`     -- which centre-stage view is rendered.
 * - `showCopilot`   -- toggles gadget sidebar.
 * - `showNotes`     -- toggles note sidebar on the notes tab.
 */
export default function TesserinApp() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("graph")
  const [showCopilot, setShowCopilot] = useState(true)
  const [showNotes, setShowNotes] = useState(true)

  // Simulated boot sequence
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <TesserinThemeProvider>
        <LoadingScreen />
      </TesserinThemeProvider>
    )
  }

  return (
    <TesserinThemeProvider>
      <NotesProvider>
        <div
          className="w-full h-screen flex overflow-hidden font-sans transition-colors duration-300"
          style={{ backgroundColor: "var(--bg-app)", color: "var(--text-primary)" }}
        >
          {/* ---- Left Dock ---- */}
          <LeftDock activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* ---- Centre Stage ---- */}
          <main className="flex-1 flex flex-col min-w-0 m-3 relative z-10">
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Note sidebar (visible on notes tab) */}
              {activeTab === "notes" && (
                <NoteSidebar
                  visible={showNotes}
                  onClose={() => setShowNotes(false)}
                />
              )}

              {/* Active workspace panel */}
              <SkeuoPanel className="flex-1 h-full flex flex-col overflow-hidden">
                {activeTab === "notes" && <MarkdownEditor />}
                {activeTab === "canvas" && <CreativeCanvas />}
                {activeTab === "graph" && <D3GraphView />}
                {activeTab === "code" && <CodeView />}
              </SkeuoPanel>

              {/* Right Gadget Sidebar */}
              <GadgetSidebar visible={showCopilot} onClose={() => setShowCopilot(false)} />
            </div>
          </main>

          {/* ---- Bottom Timeline ---- */}
          <BottomTimeline />
        </div>
      </NotesProvider>
    </TesserinThemeProvider>
  )
}
