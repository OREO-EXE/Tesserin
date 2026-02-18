/**
 * Tesserin Tips & Shortcuts System
 *
 * A curated set of tips, shortcuts, and pro-tips that rotate in the
 * status bar and appear as welcome suggestions. Helps new users
 * discover features organically — like a built-in AI guide.
 */

export interface TesserinTip {
  id: string
  /** The actual tip text shown to the user */
  text: string
  /** Keyboard shortcut associated (displayed as badge) */
  shortcut?: string
  /** Category for filtering / grouping */
  category: "shortcut" | "feature" | "pro-tip" | "workflow" | "ai"
  /** Optional action ID that can be triggered when user clicks the tip */
  action?:
    | "open-search"
    | "open-export"
    | "open-templates"
    | "open-backlinks"
    | "open-version-history"
    | "open-quick-capture"
    | "open-references"
    | "open-split"
    | "navigate-daily"
    | "navigate-graph"
    | "navigate-canvas"
    | "navigate-kanban"
    | "navigate-sam"
    | "navigate-timeline"
    | "navigate-settings"
  /** Icon hint for the UI to pick the right icon */
  icon?: "keyboard" | "sparkle" | "lightbulb" | "rocket" | "brain" | "zap"
}

export const TESSERIN_TIPS: TesserinTip[] = [
  // ── Keyboard Shortcuts ──
  {
    id: "tip-search",
    text: "Press Ctrl+K to instantly search your entire vault — notes, commands, everything.",
    shortcut: "Ctrl+K",
    category: "shortcut",
    action: "open-search",
    icon: "keyboard",
  },
  {
    id: "tip-quick-capture",
    text: "Got a quick thought? Press Ctrl+Shift+D to capture it instantly into today's daily note.",
    shortcut: "Ctrl+Shift+D",
    category: "shortcut",
    action: "open-quick-capture",
    icon: "zap",
  },
  {
    id: "tip-export",
    text: "Export your notes as PDF, LaTeX, DOCX, or HTML — press Ctrl+E to open the export panel.",
    shortcut: "Ctrl+E",
    category: "shortcut",
    action: "open-export",
    icon: "keyboard",
  },
  {
    id: "tip-templates",
    text: "Start writing faster with templates — press Ctrl+T to browse and apply them.",
    shortcut: "Ctrl+T",
    category: "shortcut",
    action: "open-templates",
    icon: "keyboard",
  },
  {
    id: "tip-backlinks",
    text: "See every note that links to your current one — press Ctrl+Shift+B for the backlinks panel.",
    shortcut: "Ctrl+Shift+B",
    category: "shortcut",
    action: "open-backlinks",
    icon: "keyboard",
  },
  {
    id: "tip-references",
    text: "Managing research papers? Press Ctrl+Shift+R to open the Reference Manager and import BibTeX.",
    shortcut: "Ctrl+Shift+R",
    category: "shortcut",
    action: "open-references",
    icon: "keyboard",
  },
  {
    id: "tip-split-pane",
    text: "Need to reference two notes side by side? Press Ctrl+\\ to split the editor.",
    shortcut: "Ctrl+\\",
    category: "shortcut",
    action: "open-split",
    icon: "keyboard",
  },
  {
    id: "tip-version-history",
    text: "Made a mistake? Press Ctrl+Shift+H to browse version history and restore any previous state.",
    shortcut: "Ctrl+Shift+H",
    category: "shortcut",
    action: "open-version-history",
    icon: "keyboard",
  },

  // ── Feature Discovery ──
  {
    id: "tip-wiki-links",
    text: "Type [[Note Title]] to create a wiki link — it'll auto-complete and connect your knowledge graph.",
    category: "feature",
    icon: "sparkle",
  },
  {
    id: "tip-block-refs",
    text: "Reference a specific paragraph from another note with ((block-id)) — like Roam Research.",
    category: "feature",
    icon: "sparkle",
  },
  {
    id: "tip-citations",
    text: "Cite papers in your notes with [@author2023] syntax — the Reference Manager formats them for you.",
    category: "feature",
    action: "open-references",
    icon: "sparkle",
  },
  {
    id: "tip-graph-view",
    text: "Your knowledge graph visualises all connections between notes — switch to Graph view to explore.",
    category: "feature",
    action: "navigate-graph",
    icon: "sparkle",
  },
  {
    id: "tip-daily-notes",
    text: "Daily Notes auto-create a journal for each day — pick a template and build a writing streak.",
    category: "feature",
    action: "navigate-daily",
    icon: "sparkle",
  },
  {
    id: "tip-canvas",
    text: "The Canvas is an infinite whiteboard for visual thinking — sketch ideas, diagrams, and workflows.",
    category: "feature",
    action: "navigate-canvas",
    icon: "sparkle",
  },
  {
    id: "tip-kanban",
    text: "Organize tasks visually with the Kanban board — drag and drop cards between columns.",
    category: "feature",
    action: "navigate-kanban",
    icon: "sparkle",
  },
  {
    id: "tip-timeline",
    text: "The Timeline view shows your notes arranged chronologically — great for tracking project progress.",
    category: "feature",
    action: "navigate-timeline",
    icon: "sparkle",
  },
  {
    id: "tip-unlinked-mentions",
    text: "The Backlinks panel detects unlinked mentions — other notes that reference yours without a [[link]].",
    category: "feature",
    action: "open-backlinks",
    icon: "sparkle",
  },
  {
    id: "tip-batch-export",
    text: "Need to export everything? The Export panel supports batch vault export in multiple formats.",
    category: "feature",
    action: "open-export",
    icon: "sparkle",
  },

  // ── Pro Tips ──
  {
    id: "tip-search-filters",
    text: "Use tag:, date:, and in: filters in search — e.g. \"tag:research date:week\" narrows results instantly.",
    category: "pro-tip",
    action: "open-search",
    icon: "lightbulb",
  },
  {
    id: "tip-command-mode",
    text: "Type > in the search palette to enter command mode — run any Tesserin command by name.",
    category: "pro-tip",
    action: "open-search",
    icon: "lightbulb",
  },
  {
    id: "tip-daily-templates",
    text: "Daily Notes support 6 built-in templates — Research Log, Zettelkasten, Meeting Notes, and more.",
    category: "pro-tip",
    action: "navigate-daily",
    icon: "lightbulb",
  },
  {
    id: "tip-bibliography",
    text: "After citing papers with [@key], use the Reference Manager to auto-generate a bibliography section.",
    category: "pro-tip",
    action: "open-references",
    icon: "lightbulb",
  },
  {
    id: "tip-latex-export",
    text: "The LaTeX exporter converts headings, bold/italic, wiki-links, and task lists automatically.",
    category: "pro-tip",
    action: "open-export",
    icon: "lightbulb",
  },
  {
    id: "tip-graph-modes",
    text: "The Graph view supports Force, Radial, and Mind Map layouts — experiment to find your favourite.",
    category: "pro-tip",
    action: "navigate-graph",
    icon: "lightbulb",
  },

  // ── Workflow Tips ──
  {
    id: "tip-zettelkasten",
    text: "Build a Zettelkasten: create atomic notes, connect them with [[links]], and let ideas emerge from the graph.",
    category: "workflow",
    icon: "brain",
  },
  {
    id: "tip-morning-routine",
    text: "Start your day with Ctrl+Shift+D to quick-capture morning thoughts, then expand in Daily Notes.",
    category: "workflow",
    action: "open-quick-capture",
    icon: "brain",
  },
  {
    id: "tip-research-workflow",
    text: "Research workflow: Import papers (Ctrl+Shift+R) → Annotate → Cite in notes → Auto-generate bibliography.",
    category: "workflow",
    action: "open-references",
    icon: "brain",
  },
  {
    id: "tip-review-backlinks",
    text: "Weekly review: open Backlinks (Ctrl+Shift+B) on key notes to discover unexpected connections.",
    category: "workflow",
    action: "open-backlinks",
    icon: "brain",
  },

  // ── AI Tips ──
  {
    id: "tip-sam",
    text: "SAM is your local AI assistant — ask it to brainstorm, summarise, or rewrite your notes. Fully private.",
    category: "ai",
    action: "navigate-sam",
    icon: "rocket",
  },
  {
    id: "tip-sam-offline",
    text: "SAM runs on your machine via Ollama — no cloud, no data leaves your computer. Ever.",
    category: "ai",
    action: "navigate-sam",
    icon: "rocket",
  },
]

/* ── Utilities ── */

/** Get a random tip, optionally excluding recently shown IDs */
export function getRandomTip(exclude?: Set<string>): TesserinTip {
  const pool = exclude
    ? TESSERIN_TIPS.filter((t) => !exclude.has(t.id))
    : TESSERIN_TIPS

  // If all excluded, reset
  const source = pool.length > 0 ? pool : TESSERIN_TIPS
  return source[Math.floor(Math.random() * source.length)]
}

/** Get a contextual tip based on the current tab */
export function getContextualTip(activeTab: string): TesserinTip | null {
  const contextMap: Record<string, string[]> = {
    notes: ["tip-wiki-links", "tip-block-refs", "tip-backlinks", "tip-split-pane", "tip-search-filters", "tip-citations"],
    graph: ["tip-graph-modes", "tip-graph-view", "tip-zettelkasten"],
    canvas: ["tip-canvas"],
    daily: ["tip-daily-templates", "tip-daily-notes", "tip-morning-routine"],
    kanban: ["tip-kanban"],
    timeline: ["tip-timeline"],
    sam: ["tip-sam", "tip-sam-offline"],
    settings: [],
  }

  const tipIds = contextMap[activeTab]
  if (!tipIds || tipIds.length === 0) return null

  const id = tipIds[Math.floor(Math.random() * tipIds.length)]
  return TESSERIN_TIPS.find((t) => t.id === id) ?? null
}

/** Get the startup tip — shown once after loading */
export function getStartupTip(): TesserinTip {
  // Prefer shortcuts & workflow tips for first impressions
  const starterTips = TESSERIN_TIPS.filter(
    (t) => t.category === "shortcut" || t.category === "workflow",
  )
  return starterTips[Math.floor(Math.random() * starterTips.length)]
}

/** Pretty-format a shortcut for display (platform-aware) */
export function formatShortcut(shortcut: string): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  if (isMac) {
    return shortcut
      .replace("Ctrl+Shift+", "⌘⇧")
      .replace("Ctrl+", "⌘")
      .replace("Shift+", "⇧")
  }
  return shortcut
}
