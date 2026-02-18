import React, { useState, useEffect, useCallback } from "react"

// Core
import { TesserinThemeProvider } from "@/components/tesserin/core/theme-provider"
import { SkeuoPanel } from "@/components/tesserin/core/skeuo-panel"
import { LoadingScreen } from "@/components/tesserin/core/loading-screen"
import { TitleBar } from "@/components/tesserin/core/title-bar"
import { PluginProvider, StatusBar } from "@/components/tesserin/core/plugin-provider"

// Panels
import { LeftDock, type TabId } from "@/components/tesserin/panels/left-dock"
import { NoteSidebar } from "@/components/tesserin/panels/note-sidebar"
import { FloatingAIChat } from "@/components/tesserin/panels/floating-ai-chat"
import { SearchPalette } from "@/components/tesserin/panels/search-palette"
import { ExportPanel } from "@/components/tesserin/panels/export-panel"
import { TemplateManager } from "@/components/tesserin/panels/template-manager"
import { BacklinksPanel } from "@/components/tesserin/panels/backlinks-panel"
import { VersionHistoryPanel } from "@/components/tesserin/panels/version-history-panel"
import { ReferenceManager } from "@/components/tesserin/panels/reference-manager"

// Workspace
import { MarkdownEditor } from "@/components/tesserin/workspace/markdown-editor"
import { CreativeCanvas } from "@/components/tesserin/workspace/creative-canvas"
import { D3GraphView } from "@/components/tesserin/workspace/d3-graph-view"
import { CodeView } from "@/components/tesserin/workspace/code-view"
import { KanbanView } from "@/components/tesserin/workspace/kanban-view"
import { DailyNotes } from "@/components/tesserin/workspace/daily-notes"
import { SAMNode } from "@/components/tesserin/workspace/sam-node"
import { TimelineView } from "@/components/tesserin/workspace/timeline-view"
import { SplitPanes, useSplitPanes } from "@/components/tesserin/workspace/split-panes"
import { SettingsPanel } from "@/components/tesserin/panels/settings-panel"

import { NotesProvider, useNotes } from "@/lib/notes-store"
import { getStartupTip, formatShortcut, type TesserinTip } from "@/lib/tips"

/**
 * Tesserin App — Root Component
 *
 * Orchestrates the entire workspace:
 * 1. Custom title bar (frameless window)
 * 2. A 2-second loading splash
 * 3. Three-column layout: Left Dock | Centre Stage | Gadget Sidebar
 * 4. Bottom Timeline toolbar
 * 5. Overlays: Search (Cmd+K), Export (Cmd+E), Templates (Cmd+T)
 */

function AppContent() {
    const [activeTab, setActiveTab] = useState<TabId>("graph")
    const [showNotes, setShowNotes] = useState(true)
    const [showSearch, setShowSearch] = useState(false)
    const [showExport, setShowExport] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [showBacklinks, setShowBacklinks] = useState(false)
    const [showVersionHistory, setShowVersionHistory] = useState(false)
    const [showReferences, setShowReferences] = useState(false)
    const [showQuickCapture, setShowQuickCapture] = useState(false)
    const [notice, setNotice] = useState<{ message: string; visible: boolean }>({ message: "", visible: false })
    const { notes, selectedNoteId, selectNote } = useNotes()
    const { splitState, openSplit, closeSplit } = useSplitPanes()

    const selectedNote = notes.find(n => n.id === selectedNoteId) || null

    // Plugin notice handler
    const handleNotice = useCallback((message: string, duration = 3000) => {
        setNotice({ message, visible: true })
        setTimeout(() => setNotice(prev => ({ ...prev, visible: false })), duration)
    }, [])

    // Startup tip — show one random tip 3s after first render
    useEffect(() => {
        const timer = setTimeout(() => {
            const tip = getStartupTip()
            const shortcutBadge = tip.shortcut ? ` (${formatShortcut(tip.shortcut)})` : ""
            handleNotice(`💡 ${tip.text}${shortcutBadge}`, 6000)
        }, 3000)
        return () => clearTimeout(timer)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Tip action handler — maps tip actions to actual state toggles
    const handleTipAction = useCallback((action: string) => {
        switch (action) {
            case "open-search": setShowSearch(true); break
            case "open-export": setShowExport(true); break
            case "open-templates": setShowTemplates(true); break
            case "open-backlinks": setShowBacklinks(true); break
            case "open-version-history": setShowVersionHistory(true); break
            case "open-quick-capture": setShowQuickCapture(true); break
            case "open-references": setShowReferences(true); break
            case "open-split": openSplit(); break
            case "navigate-daily": setActiveTab("daily"); break
            case "navigate-graph": setActiveTab("graph"); break
            case "navigate-canvas": setActiveTab("canvas"); break
            case "navigate-kanban": setActiveTab("kanban"); break
            case "navigate-sam": setActiveTab("sam"); break
            case "navigate-timeline": setActiveTab("timeline"); break
            case "navigate-settings": setActiveTab("settings"); break
        }
    }, [openSplit])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey
            if (mod && e.key === 'k') {
                e.preventDefault()
                setShowSearch(prev => !prev)
            } else if (mod && e.key === 'e') {
                e.preventDefault()
                setShowExport(prev => !prev)
            } else if (mod && e.key === 't') {
                e.preventDefault()
                setShowTemplates(prev => !prev)
            } else if (mod && e.shiftKey && e.key === 'B') {
                e.preventDefault()
                setShowBacklinks(prev => !prev)
            } else if (mod && e.shiftKey && e.key === 'H') {
                e.preventDefault()
                setShowVersionHistory(prev => !prev)
            } else if (mod && e.shiftKey && e.key === 'D') {
                e.preventDefault()
                setShowQuickCapture(prev => !prev)
            } else if (mod && e.shiftKey && e.key === 'R') {
                e.preventDefault()
                setShowReferences(prev => !prev)
            } else if (mod && e.key === '\\') {
                e.preventDefault()
                if (splitState.isActive) closeSplit()
                else openSplit()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [splitState.isActive, openSplit, closeSplit])

    const handleSelectNote = useCallback(
        (noteId: string) => {
            selectNote(noteId)
            setActiveTab("notes")
            setShowSearch(false)
        },
        [selectNote],
    )

    const handleNavigateTab = useCallback(
        (tabId: string) => {
            setActiveTab(tabId as TabId)
        },
        [],
    )

    return (
        <PluginProvider onNotice={handleNotice} onNavigateTab={handleNavigateTab}>
            <div
                className="w-full h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300"
                style={{ backgroundColor: "var(--bg-app)", color: "var(--text-primary)" }}
            >
                {/* Custom Title Bar */}
                <TitleBar />

                <div className="flex-1 flex overflow-hidden">
                    {/* ── Left Dock ── */}
                    <LeftDock activeTab={activeTab} setActiveTab={setActiveTab} />

                    {/* ── Centre Stage ── */}
                    <main className="flex-1 flex flex-col min-w-0 m-3 relative z-10">
                        <div className="flex-1 flex gap-4 min-h-0">
                            {/* Note sidebar (visible on notes tab) */}
                            {activeTab === "notes" && (
                                <NoteSidebar
                                    visible={showNotes}
                                    onClose={() => setShowNotes(false)}
                                />
                            )}

                            {/* Active workspace panel – all panels stay mounted, only the active one is visible. */}
                            <SkeuoPanel className="flex-1 h-full flex flex-col overflow-hidden">
                                <div className={`w-full h-full ${activeTab === "notes" ? "" : "hidden"}`}>
                                    <SplitPanes
                                        primaryContent={<MarkdownEditor />}
                                        onRequestSplit={() => openSplit()}
                                        secondaryContent={splitState.isActive ? <MarkdownEditor /> : null}
                                        secondaryLabel="Split Editor"
                                        onCloseSecondary={closeSplit}
                                        direction={splitState.direction}
                                    />
                                </div>
                                <div className={`w-full h-full ${activeTab === "canvas" ? "" : "hidden"}`}><CreativeCanvas /></div>
                                <div className={`w-full h-full ${activeTab === "graph" ? "" : "hidden"}`}><D3GraphView /></div>
                                <div className={`w-full h-full ${activeTab === "code" ? "" : "hidden"}`}><CodeView /></div>
                                <div className={`w-full h-full ${activeTab === "kanban" ? "" : "hidden"}`}><KanbanView /></div>
                                <div className={`w-full h-full ${activeTab === "daily" ? "" : "hidden"}`}><DailyNotes /></div>
                                <div className={`w-full h-full ${activeTab === "sam" ? "" : "hidden"}`}><SAMNode /></div>
                                <div className={`w-full h-full ${activeTab === "timeline" ? "" : "hidden"}`}><TimelineView /></div>
                                <div className={`w-full h-full ${activeTab === "settings" ? "" : "hidden"}`}><SettingsPanel /></div>
                            </SkeuoPanel>

                            {/* Right panels: Backlinks / Version History */}
                            {(showBacklinks || showVersionHistory) && activeTab === "notes" && (
                                <SkeuoPanel className="w-72 flex-shrink-0 h-full flex flex-col overflow-hidden">
                                    {showBacklinks && <BacklinksPanel />}
                                    {showVersionHistory && !showBacklinks && <VersionHistoryPanel />}
                                    {showBacklinks && showVersionHistory && (
                                        <div className="border-t" style={{ borderColor: "var(--border-dark)" }}>
                                            <VersionHistoryPanel />
                                        </div>
                                    )}
                                </SkeuoPanel>
                            )}
                        </div>
                    </main>
                </div>

                {/* ── Status Bar (plugin widgets + rotating tips) ── */}
                <StatusBar activeTab={activeTab} onTipAction={handleTipAction} />

                {/* ── Floating AI Chat ── */}
                <FloatingAIChat />

                {/* ── Notice Toast ── */}
                {notice.visible && (
                    <div
                        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
                        style={{
                            backgroundColor: "var(--bg-panel)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-mid)",
                            boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
                        }}
                    >
                        {notice.message}
                    </div>
                )}

                {/* ── Overlays ── */}
                <SearchPalette
                    isOpen={showSearch}
                    onClose={() => setShowSearch(false)}
                    onSelectNote={handleSelectNote}
                    onNavigateTab={handleNavigateTab}
                    onOpenSplit={() => openSplit()}
                />
                <ExportPanel
                    isOpen={showExport}
                    onClose={() => setShowExport(false)}
                    note={selectedNote}
                />
                <TemplateManager
                    isOpen={showTemplates}
                    onClose={() => setShowTemplates(false)}
                    onCreateNote={handleSelectNote}
                />
                <ReferenceManager
                    isOpen={showReferences}
                    onClose={() => setShowReferences(false)}
                />
                {showQuickCapture && (
                    <DailyNotes quickCapture onClose={() => setShowQuickCapture(false)} />
                )}
            </div>
        </PluginProvider>
    )
}

export default function App() {
    const [loading, setLoading] = useState(true)

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
                <AppContent />
            </NotesProvider>
        </TesserinThemeProvider>
    )
}
