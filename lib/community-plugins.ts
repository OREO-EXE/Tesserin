/**
 * Community Plugins
 *
 * Third-party / community-contributed plugins for Tesserin.
 * Users can browse, install, and uninstall these from the
 * Community Plugins panel (Settings → Plugins or the store tab).
 *
 * Contributing: Add your plugin to the COMMUNITY_PLUGINS array below
 * following the TesserinPlugin interface. Each plugin gets a sandboxed
 * API with rate limiting and permission checking.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  FiClock, FiBookOpen, FiRepeat, FiHash, FiBookmark,
  FiCheckSquare, FiTarget, FiGrid, FiBarChart2, FiMic,
  FiPlay, FiPause, FiSquare, FiSkipForward, FiRotateCcw,
  FiPlus, FiTrash2, FiStar, FiTrendingUp, FiEdit3,
  FiArchive, FiTag, FiCalendar, FiAward, FiActivity,
} from "react-icons/fi"
import type { TesserinPlugin, TesserinPluginAPI } from "./plugin-system"

/* ================================================================== */
/*  1. Pomodoro Timer                                                  */
/* ================================================================== */

export const pomodoroPlugin: TesserinPlugin = {
  manifest: {
    id: "community.pomodoro-timer",
    name: "Pomodoro Timer",
    version: "1.0.0",
    description: "Focus timer with 25/5 intervals and session tracking in the status bar.",
    author: "Community",
    icon: React.createElement(FiClock, { size: 16 }),
    permissions: ["ui:notify", "commands", "panels", "settings:read", "settings:write"],
  },

  activate(api: TesserinPluginAPI) {
    // State managed via closure
    let seconds = 25 * 60
    let isRunning = false
    let isBreak = false
    let sessions = parseInt(api.settings.get("pomodoro:sessions") || "0")
    let interval: ReturnType<typeof setInterval> | null = null
    let listeners: Array<() => void> = []

    const notify = () => listeners.forEach(fn => fn())
    const subscribe = (fn: () => void) => { listeners.push(fn); return () => { listeners = listeners.filter(l => l !== fn) } }

    function tick() {
      if (seconds <= 0) {
        if (interval) clearInterval(interval)
        interval = null
        isRunning = false
        if (!isBreak) {
          sessions++
          api.settings.set("pomodoro:sessions", String(sessions))
          api.ui.showNotice(`🍅 Pomodoro #${sessions} complete! Take a break.`)
          isBreak = true
          seconds = 5 * 60
        } else {
          api.ui.showNotice("Break over! Ready for another pomodoro.")
          isBreak = false
          seconds = 25 * 60
        }
        notify()
        return
      }
      seconds--
      notify()
    }

    function start() {
      if (isRunning) return
      isRunning = true
      interval = setInterval(tick, 1000)
      notify()
    }

    function pause() {
      if (!isRunning) return
      isRunning = false
      if (interval) clearInterval(interval)
      interval = null
      notify()
    }

    function reset() {
      pause()
      isBreak = false
      seconds = 25 * 60
      notify()
    }

    function skip() {
      pause()
      seconds = 0
      tick()
    }

    api.registerStatusBarWidget({
      id: "pomodoro",
      align: "right",
      priority: 5,
      component: function PomodoroWidget() {
        const [, setTick] = React.useState(0)
        React.useEffect(() => subscribe(() => setTick(t => t + 1)), [])

        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        const display = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`

        return React.createElement("div", {
          className: "flex items-center gap-2 text-[11px]",
          style: { color: isBreak ? "#22c55e" : "var(--text-tertiary)" },
        },
          React.createElement("span", null, isBreak ? "☕" : "🍅"),
          React.createElement("span", { className: "font-mono" }, display),
          React.createElement("button", {
            onClick: isRunning ? pause : start,
            className: "hover:brightness-125 transition-all",
            style: { color: "var(--accent-primary)" },
          }, React.createElement(isRunning ? FiPause : FiPlay, { size: 10 })),
          React.createElement("button", {
            onClick: reset,
            className: "hover:brightness-125 transition-all",
            style: { color: "var(--text-tertiary)" },
          }, React.createElement(FiRotateCcw, { size: 10 })),
          React.createElement("span", {
            className: "text-[9px]",
            style: { color: "var(--text-tertiary)", opacity: 0.6 },
          }, `#${sessions}`),
        )
      },
    })

    api.registerCommand({
      id: "pomodoro-start",
      label: "Start Pomodoro",
      category: "Focus",
      execute: start,
    })

    api.registerCommand({
      id: "pomodoro-reset",
      label: "Reset Pomodoro",
      category: "Focus",
      execute: reset,
    })
  },
}

/* ================================================================== */
/*  2. Reading List                                                    */
/* ================================================================== */

export const readingListPlugin: TesserinPlugin = {
  manifest: {
    id: "community.reading-list",
    name: "Reading List",
    version: "1.0.0",
    description: "Bookmark manager with tags and archive — save links and articles for later.",
    author: "Community",
    icon: React.createElement(FiBookOpen, { size: 16 }),
    permissions: ["ui:notify", "commands", "settings:read", "settings:write", "panels"],
  },

  activate(api: TesserinPluginAPI) {
    interface ReadingItem {
      id: string; url: string; title: string; tags: string[];
      addedAt: string; archived: boolean; notes: string
    }

    function getItems(): ReadingItem[] {
      try { return JSON.parse(api.settings.get("readinglist:items") || "[]") } catch { return [] }
    }
    function saveItems(items: ReadingItem[]) {
      api.settings.set("readinglist:items", JSON.stringify(items))
    }

    api.registerCommand({
      id: "add-to-reading-list",
      label: "Add URL to Reading List",
      category: "Reading List",
      execute() {
        const url = prompt("Enter URL to save:")
        if (!url) return
        const title = prompt("Title (optional):") || url
        const tagsStr = prompt("Tags (comma-separated, optional):") || ""
        const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean)
        const items = getItems()
        items.unshift({
          id: `rl-${Date.now()}`, url, title, tags,
          addedAt: new Date().toISOString(), archived: false, notes: ""
        })
        saveItems(items)
        api.ui.showNotice(`Saved "${title}" to reading list`)
      },
    })

    api.registerCommand({
      id: "show-reading-list",
      label: "Show Reading List",
      category: "Reading List",
      execute() {
        const items = getItems().filter(i => !i.archived)
        if (items.length === 0) {
          api.ui.showNotice("Reading list is empty. Use 'Add URL to Reading List' to add items.")
          return
        }
        api.ui.showNotice(`📚 ${items.length} items: ${items.slice(0, 5).map(i => i.title).join(", ")}${items.length > 5 ? "…" : ""}`)
      },
    })

    api.registerStatusBarWidget({
      id: "reading-list-count",
      align: "right",
      priority: 20,
      component: function ReadingListWidget() {
        const count = getItems().filter(i => !i.archived).length
        return React.createElement("span", {
          className: "text-[10px]",
          style: { color: "var(--text-tertiary)" },
          title: "Reading List items",
        }, `📚 ${count}`)
      },
    })
  },
}

/* ================================================================== */
/*  3. Spaced Repetition (SM-2 Flashcards)                             */
/* ================================================================== */

export const spacedRepetitionPlugin: TesserinPlugin = {
  manifest: {
    id: "community.spaced-repetition",
    name: "Spaced Repetition",
    version: "1.0.0",
    description: "SM-2 flashcard system — generate flashcards from your notes and review them.",
    author: "Community",
    icon: React.createElement(FiRepeat, { size: 16 }),
    permissions: ["vault:read", "ui:notify", "commands", "settings:read", "settings:write", "panels"],
  },

  activate(api: TesserinPluginAPI) {
    interface Flashcard {
      id: string; front: string; back: string; noteId: string;
      interval: number; repetition: number; easeFactor: number; nextReview: string
    }

    function getCards(): Flashcard[] {
      try { return JSON.parse(api.settings.get("sr:cards") || "[]") } catch { return [] }
    }
    function saveCards(cards: Flashcard[]) {
      api.settings.set("sr:cards", JSON.stringify(cards))
    }

    // SM-2 algorithm
    function sm2(card: Flashcard, quality: number): Flashcard {
      let { interval, repetition, easeFactor } = card
      if (quality >= 3) {
        if (repetition === 0) interval = 1
        else if (repetition === 1) interval = 6
        else interval = Math.round(interval * easeFactor)
        repetition++
      } else {
        repetition = 0
        interval = 1
      }
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
      const next = new Date()
      next.setDate(next.getDate() + interval)
      return { ...card, interval, repetition, easeFactor, nextReview: next.toISOString() }
    }

    api.registerCommand({
      id: "generate-flashcards",
      label: "Generate Flashcards from Current Note",
      category: "Spaced Repetition",
      execute() {
        const note = api.vault.getSelected()
        if (!note) { api.ui.showNotice("No note selected"); return }

        // Extract Q&A pairs from headers + content, or bold terms
        const lines = note.content.split("\n")
        const cards = getCards()
        let added = 0

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          // Pattern: **Term** — Definition or **Term**: Definition
          const boldMatch = line.match(/^\*\*(.+?)\*\*[\s:—\-]+(.+)/)
          if (boldMatch) {
            cards.push({
              id: `sr-${Date.now()}-${i}`, front: boldMatch[1], back: boldMatch[2],
              noteId: note.id, interval: 0, repetition: 0, easeFactor: 2.5,
              nextReview: new Date().toISOString()
            })
            added++
          }
        }

        saveCards(cards)
        api.ui.showNotice(added > 0 ? `Created ${added} flashcards from "${note.title}"` : "No flashcard patterns found. Use **Term** — Definition format.")
      },
    })

    api.registerCommand({
      id: "review-flashcards",
      label: "Review Due Flashcards",
      category: "Spaced Repetition",
      execute() {
        const cards = getCards()
        const now = new Date()
        const due = cards.filter(c => new Date(c.nextReview) <= now)
        if (due.length === 0) {
          api.ui.showNotice("No flashcards due for review! 🎉")
          return
        }
        const card = due[0]
        const answer = prompt(`FRONT: ${card.front}\n\n(Think of the answer, then rate 0-5)\n0=forgot, 3=hard, 5=easy`)
        if (answer === null) return
        const quality = Math.min(5, Math.max(0, parseInt(answer) || 0))
        const updated = sm2(card, quality)
        const all = getCards().map(c => c.id === updated.id ? updated : c)
        saveCards(all)
        api.ui.showNotice(`BACK: ${card.back}\n\nRated ${quality}/5. Next review in ${updated.interval} day(s). ${due.length - 1} cards remaining.`)
      },
    })

    api.registerStatusBarWidget({
      id: "sr-due-count",
      align: "right",
      priority: 25,
      component: function SRWidget() {
        const cards = getCards()
        const due = cards.filter(c => new Date(c.nextReview) <= new Date()).length
        if (due === 0 && cards.length === 0) return null
        return React.createElement("span", {
          className: "text-[10px]",
          style: { color: due > 0 ? "var(--accent-primary)" : "var(--text-tertiary)" },
          title: "Flashcards due for review",
        }, `🧠 ${due} due`)
      },
    })
  },
}

/* ================================================================== */
/*  4. Zettelkasten ID Generator                                       */
/* ================================================================== */

export const zettelkastenPlugin: TesserinPlugin = {
  manifest: {
    id: "community.zettelkasten-id",
    name: "Zettelkasten ID Generator",
    version: "1.0.0",
    description: "Auto-generate unique Zettelkasten-style timestamp IDs for notes.",
    author: "Community",
    icon: React.createElement(FiHash, { size: 16 }),
    permissions: ["vault:read", "vault:write", "ui:notify", "commands"],
  },

  activate(api: TesserinPluginAPI) {
    function generateZettelId(): string {
      const now = new Date()
      return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join("")
    }

    api.registerCommand({
      id: "create-zettel",
      label: "Create Zettelkasten Note",
      category: "Zettelkasten",
      execute() {
        const id = generateZettelId()
        const title = prompt(`Zettelkasten note title (ID: ${id}):`)
        if (!title) return
        const noteId = api.vault.create(`${id} ${title}`, `---\nzettel-id: ${id}\ncreated: ${new Date().toISOString()}\ntags: []\n---\n\n# ${title}\n\n`)
        api.ui.showNotice(`Created zettel: ${id} ${title}`)
      },
    })

    api.registerCommand({
      id: "insert-zettel-id",
      label: "Copy Zettelkasten ID to Clipboard",
      category: "Zettelkasten",
      execute() {
        const id = generateZettelId()
        navigator.clipboard.writeText(id).then(() => {
          api.ui.showNotice(`Copied Zettel ID: ${id}`)
        })
      },
    })
  },
}

/* ================================================================== */
/*  5. Citation Manager                                                */
/* ================================================================== */

export const citationPlugin: TesserinPlugin = {
  manifest: {
    id: "community.citation-manager",
    name: "Citation Manager",
    version: "1.0.0",
    description: "Import BibTeX/DOI references and auto-format citations in your notes.",
    author: "Community",
    icon: React.createElement(FiBookmark, { size: 16 }),
    permissions: ["ui:notify", "commands", "settings:read", "settings:write", "vault:read", "panels"],
  },

  activate(api: TesserinPluginAPI) {
    interface Citation {
      id: string; key: string; type: string; title: string;
      authors: string[]; year: string; journal?: string; doi?: string; url?: string
    }

    function getCitations(): Citation[] {
      try { return JSON.parse(api.settings.get("citations:library") || "[]") } catch { return [] }
    }
    function saveCitations(cites: Citation[]) {
      api.settings.set("citations:library", JSON.stringify(cites))
    }

    function parseBibtex(bib: string): Partial<Citation> {
      const type = bib.match(/@(\w+)\{/)?.[1] || "misc"
      const key = bib.match(/@\w+\{([^,]+)/)?.[1]?.trim() || ""
      const getField = (name: string) => {
        const m = bib.match(new RegExp(`${name}\\s*=\\s*\\{([^}]*)\\}`))
        return m?.[1]?.trim() || ""
      }
      return {
        type, key, title: getField("title"),
        authors: getField("author").split(" and ").map(a => a.trim()).filter(Boolean),
        year: getField("year"), journal: getField("journal"),
        doi: getField("doi"), url: getField("url"),
      }
    }

    api.registerCommand({
      id: "add-citation-bibtex",
      label: "Add Citation (BibTeX)",
      category: "Citations",
      execute() {
        const bib = prompt("Paste BibTeX entry:")
        if (!bib) return
        const parsed = parseBibtex(bib)
        if (!parsed.title) { api.ui.showNotice("Could not parse BibTeX entry"); return }
        const cites = getCitations()
        cites.push({
          id: `cite-${Date.now()}`, key: parsed.key || `ref${cites.length + 1}`,
          type: parsed.type || "misc", title: parsed.title,
          authors: parsed.authors || [], year: parsed.year || "",
          journal: parsed.journal, doi: parsed.doi, url: parsed.url,
        })
        saveCitations(cites)
        api.ui.showNotice(`Added citation: ${parsed.title}`)
      },
    })

    api.registerCommand({
      id: "list-citations",
      label: "List All Citations",
      category: "Citations",
      execute() {
        const cites = getCitations()
        if (cites.length === 0) { api.ui.showNotice("No citations in library. Use 'Add Citation (BibTeX)' to add."); return }
        const list = cites.map(c => `[@${c.key}] ${c.authors.join(", ")} (${c.year}) — "${c.title}"`).join("\n")
        api.ui.showNotice(`📖 ${cites.length} citations:\n${list.substring(0, 300)}${list.length > 300 ? "…" : ""}`)
      },
    })

    api.registerCommand({
      id: "format-citation",
      label: "Insert Formatted Citation",
      category: "Citations",
      execute() {
        const cites = getCitations()
        if (cites.length === 0) { api.ui.showNotice("No citations available"); return }
        const key = prompt(`Enter citation key:\nAvailable: ${cites.map(c => c.key).join(", ")}`)
        if (!key) return
        const cite = cites.find(c => c.key === key)
        if (!cite) { api.ui.showNotice(`Citation not found: ${key}`); return }
        const formatted = `${cite.authors.join(", ")} (${cite.year}). *${cite.title}*${cite.journal ? `. ${cite.journal}` : ""}${cite.doi ? `. doi:${cite.doi}` : ""}`
        navigator.clipboard.writeText(formatted).then(() => {
          api.ui.showNotice(`Copied formatted citation for [@${key}]`)
        })
      },
    })

    api.registerStatusBarWidget({
      id: "citation-count",
      align: "right",
      priority: 30,
      component: function CitationWidget() {
        const count = getCitations().length
        if (count === 0) return null
        return React.createElement("span", {
          className: "text-[10px]",
          style: { color: "var(--text-tertiary)" },
        }, `📖 ${count} refs`)
      },
    })
  },
}

/* ================================================================== */
/*  6. Habit Tracker                                                   */
/* ================================================================== */

export const habitTrackerPlugin: TesserinPlugin = {
  manifest: {
    id: "community.habit-tracker",
    name: "Habit Tracker",
    version: "1.0.0",
    description: "Daily habit logging with streak tracking and visualization.",
    author: "Community",
    icon: React.createElement(FiCheckSquare, { size: 16 }),
    permissions: ["ui:notify", "commands", "settings:read", "settings:write", "panels"],
  },

  activate(api: TesserinPluginAPI) {
    interface Habit { id: string; name: string; emoji: string; log: string[] }

    function getHabits(): Habit[] {
      try { return JSON.parse(api.settings.get("habits:list") || "[]") } catch { return [] }
    }
    function saveHabits(h: Habit[]) { api.settings.set("habits:list", JSON.stringify(h)) }

    function today() { return new Date().toISOString().split("T")[0] }

    function streakFor(habit: Habit): number {
      const sorted = [...habit.log].sort().reverse()
      if (sorted.length === 0) return 0
      let streak = 0
      const d = new Date()
      for (let i = 0; i < 365; i++) {
        const dateStr = d.toISOString().split("T")[0]
        if (sorted.includes(dateStr)) { streak++; d.setDate(d.getDate() - 1) }
        else if (i === 0) { d.setDate(d.getDate() - 1); continue } // today not yet logged
        else break
      }
      return streak
    }

    api.registerCommand({
      id: "add-habit",
      label: "Add New Habit",
      category: "Habits",
      execute() {
        const name = prompt("Habit name:")
        if (!name) return
        const emoji = prompt("Emoji (optional):") || "✅"
        const habits = getHabits()
        habits.push({ id: `habit-${Date.now()}`, name, emoji, log: [] })
        saveHabits(habits)
        api.ui.showNotice(`Added habit: ${emoji} ${name}`)
      },
    })

    api.registerCommand({
      id: "log-habit",
      label: "Log Habit for Today",
      category: "Habits",
      execute() {
        const habits = getHabits()
        if (habits.length === 0) { api.ui.showNotice("No habits created yet."); return }
        const name = prompt(`Which habit?\n${habits.map((h, i) => `${i + 1}. ${h.emoji} ${h.name}`).join("\n")}`)
        if (!name) return
        const idx = parseInt(name) - 1
        const habit = habits[idx] || habits.find(h => h.name.toLowerCase() === name.toLowerCase())
        if (!habit) { api.ui.showNotice("Habit not found"); return }

        const t = today()
        if (habit.log.includes(t)) { api.ui.showNotice(`Already logged ${habit.emoji} ${habit.name} today!`); return }
        habit.log.push(t)
        saveHabits(habits)
        const streak = streakFor(habit)
        api.ui.showNotice(`${habit.emoji} ${habit.name} logged! 🔥 ${streak}-day streak`)
      },
    })

    api.registerStatusBarWidget({
      id: "habit-streaks",
      align: "right",
      priority: 35,
      component: function HabitWidget() {
        const habits = getHabits()
        if (habits.length === 0) return null
        const t = today()
        const doneToday = habits.filter(h => h.log.includes(t)).length
        return React.createElement("span", {
          className: "text-[10px]",
          style: { color: doneToday === habits.length ? "#22c55e" : "var(--text-tertiary)" },
          title: `${doneToday}/${habits.length} habits done today`,
        }, `✅ ${doneToday}/${habits.length}`)
      },
    })
  },
}

/* ================================================================== */
/*  7. Writing Goals                                                   */
/* ================================================================== */

export const writingGoalsPlugin: TesserinPlugin = {
  manifest: {
    id: "community.writing-goals",
    name: "Writing Goals",
    version: "1.0.0",
    description: "Track daily/weekly/monthly word count targets with progress visualization.",
    author: "Community",
    icon: React.createElement(FiTarget, { size: 16 }),
    permissions: ["vault:read", "ui:notify", "commands", "settings:read", "settings:write", "panels"],
  },

  activate(api: TesserinPluginAPI) {
    function getDailyGoal(): number {
      return parseInt(api.settings.get("writing:dailyGoal") || "500")
    }

    function getTodayCount(): number {
      return parseInt(api.settings.get(`writing:count:${new Date().toISOString().split("T")[0]}`) || "0")
    }

    function recordWords(count: number) {
      const key = `writing:count:${new Date().toISOString().split("T")[0]}`
      api.settings.set(key, String(count))
    }

    // Track words written by periodically checking vault
    let lastTotal = 0

    api.registerCommand({
      id: "set-writing-goal",
      label: "Set Daily Writing Goal",
      category: "Writing Goals",
      execute() {
        const goal = prompt(`Current goal: ${getDailyGoal()} words/day\nEnter new daily goal:`)
        if (!goal) return
        const num = parseInt(goal)
        if (isNaN(num) || num <= 0) { api.ui.showNotice("Invalid number"); return }
        api.settings.set("writing:dailyGoal", String(num))
        api.ui.showNotice(`Daily writing goal set to ${num} words`)
      },
    })

    api.registerCommand({
      id: "check-writing-progress",
      label: "Check Writing Progress",
      category: "Writing Goals",
      execute() {
        const notes = api.vault.list()
        const totalWords = notes.reduce((acc, n) => acc + n.content.split(/\s+/).filter(Boolean).length, 0)
        const todayCount = getTodayCount()
        const goal = getDailyGoal()
        const pct = Math.min(100, Math.round((todayCount / goal) * 100))
        api.ui.showNotice(`📝 Today: ${todayCount}/${goal} words (${pct}%)\nTotal vault: ${totalWords.toLocaleString()} words`)
      },
    })

    api.registerCommand({
      id: "log-writing-session",
      label: "Log Writing Session",
      category: "Writing Goals",
      execute() {
        const words = prompt("How many words did you write this session?")
        if (!words) return
        const num = parseInt(words)
        if (isNaN(num) || num <= 0) { api.ui.showNotice("Invalid number"); return }
        const current = getTodayCount()
        recordWords(current + num)
        const goal = getDailyGoal()
        const total = current + num
        const pct = Math.min(100, Math.round((total / goal) * 100))
        api.ui.showNotice(`Added ${num} words. Today: ${total}/${goal} (${pct}%)${total >= goal ? " 🎉 Goal reached!" : ""}`)
      },
    })

    api.registerStatusBarWidget({
      id: "writing-progress",
      align: "right",
      priority: 15,
      component: function WritingGoalWidget() {
        const todayCount = getTodayCount()
        const goal = getDailyGoal()
        const pct = Math.min(100, Math.round((todayCount / goal) * 100))

        return React.createElement("div", {
          className: "flex items-center gap-2 text-[10px]",
          style: { color: pct >= 100 ? "#22c55e" : "var(--text-tertiary)" },
          title: `Writing goal: ${todayCount}/${goal} words`,
        },
          React.createElement("span", null, "✍️"),
          React.createElement("div", {
            className: "w-12 h-1.5 rounded-full overflow-hidden",
            style: { backgroundColor: "var(--bg-panel-inset)" },
          },
            React.createElement("div", {
              className: "h-full rounded-full transition-all",
              style: {
                width: `${pct}%`,
                backgroundColor: pct >= 100 ? "#22c55e" : "var(--accent-primary)",
              },
            }),
          ),
          React.createElement("span", null, `${pct}%`),
        )
      },
    })
  },
}

/* ================================================================== */
/*  8. Markdown Table Editor                                           */
/* ================================================================== */

export const markdownTablePlugin: TesserinPlugin = {
  manifest: {
    id: "community.markdown-table",
    name: "Markdown Table Editor",
    version: "1.0.0",
    description: "Generate and format markdown tables with a visual builder.",
    author: "Community",
    icon: React.createElement(FiGrid, { size: 16 }),
    permissions: ["ui:notify", "commands", "vault:read"],
  },

  activate(api: TesserinPluginAPI) {
    api.registerCommand({
      id: "insert-table",
      label: "Insert Markdown Table",
      category: "Editor",
      execute() {
        const dims = prompt("Table dimensions (e.g. 3x4 for 3 columns, 4 rows):")
        if (!dims) return
        const match = dims.match(/^(\d+)\s*[xX×]\s*(\d+)$/)
        if (!match) { api.ui.showNotice("Invalid format. Use: 3x4"); return }
        const [, cols, rows] = match.map(Number)
        if (cols < 1 || cols > 20 || rows < 1 || rows > 100) {
          api.ui.showNotice("Table too large. Max 20 columns, 100 rows.")
          return
        }

        const header = "| " + Array(cols).fill("Header").map((h, i) => `${h} ${i + 1}`).join(" | ") + " |"
        const separator = "| " + Array(cols).fill("---").join(" | ") + " |"
        const dataRows = Array(rows).fill("| " + Array(cols).fill("   ").join(" | ") + " |").join("\n")
        const table = `\n${header}\n${separator}\n${dataRows}\n`

        navigator.clipboard.writeText(table).then(() => {
          api.ui.showNotice(`${cols}×${rows} table copied to clipboard. Paste it into your note.`)
        })
      },
    })

    api.registerCommand({
      id: "format-table",
      label: "Format Table from CSV",
      category: "Editor",
      execute() {
        const csv = prompt("Paste CSV data (first row = headers):")
        if (!csv) return
        const lines = csv.trim().split("\n").map(l => l.split(",").map(c => c.trim()))
        if (lines.length < 2) { api.ui.showNotice("Need at least a header + one data row"); return }

        const colWidths = lines[0].map((_, ci) => Math.max(...lines.map(l => (l[ci] || "").length)))
        const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length))

        const header = "| " + lines[0].map((h, i) => pad(h, colWidths[i])).join(" | ") + " |"
        const sep = "| " + colWidths.map(w => "-".repeat(w)).join(" | ") + " |"
        const rows = lines.slice(1).map(r => "| " + r.map((c, i) => pad(c || "", colWidths[i])).join(" | ") + " |")
        const table = `\n${header}\n${sep}\n${rows.join("\n")}\n`

        navigator.clipboard.writeText(table).then(() => {
          api.ui.showNotice("Formatted table copied to clipboard!")
        })
      },
    })
  },
}

/* ================================================================== */
/*  9. Note Statistics                                                 */
/* ================================================================== */

export const noteStatsPlugin: TesserinPlugin = {
  manifest: {
    id: "community.note-statistics",
    name: "Note Statistics",
    version: "1.0.0",
    description: "Analytics dashboard — writing frequency, word distribution, and note growth.",
    author: "Community",
    icon: React.createElement(FiBarChart2, { size: 16 }),
    permissions: ["vault:read", "ui:notify", "commands"],
  },

  activate(api: TesserinPluginAPI) {
    api.registerCommand({
      id: "show-vault-stats",
      label: "Show Vault Statistics",
      category: "Analytics",
      execute() {
        const notes = api.vault.list()
        const totalWords = notes.reduce((acc, n) => acc + n.content.split(/\s+/).filter(Boolean).length, 0)
        const totalChars = notes.reduce((acc, n) => acc + n.content.length, 0)
        const avgWords = notes.length > 0 ? Math.round(totalWords / notes.length) : 0
        const longest = notes.reduce((max, n) => {
          const wc = n.content.split(/\s+/).filter(Boolean).length
          return wc > max.count ? { title: n.title, count: wc } : max
        }, { title: "", count: 0 })

        // Links analysis
        const linkRegex = /\[\[([^\]]+)\]\]/g
        let totalLinks = 0
        for (const n of notes) {
          const matches = n.content.match(linkRegex)
          totalLinks += matches?.length || 0
        }

        // Tag analysis
        const tagRegex = /#[\w-]+/g
        let totalTags = 0
        const tagCounts = new Map<string, number>()
        for (const n of notes) {
          const matches = n.content.match(tagRegex) || []
          totalTags += matches.length
          matches.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1))
        }
        const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

        api.ui.showNotice(
          `📊 Vault Statistics\n` +
          `─────────────────\n` +
          `Notes: ${notes.length}\n` +
          `Words: ${totalWords.toLocaleString()}\n` +
          `Characters: ${totalChars.toLocaleString()}\n` +
          `Avg words/note: ${avgWords}\n` +
          `Wiki-links: ${totalLinks}\n` +
          `Hashtags: ${totalTags}\n` +
          `${longest.title ? `Longest: "${longest.title}" (${longest.count} words)` : ""}\n` +
          `${topTags.length > 0 ? `Top tags: ${topTags.map(([t, c]) => `${t}(${c})`).join(", ")}` : ""}`
        )
      },
    })

    api.registerCommand({
      id: "show-note-details",
      label: "Show Current Note Details",
      category: "Analytics",
      execute() {
        const note = api.vault.getSelected()
        if (!note) { api.ui.showNotice("No note selected"); return }

        const text = note.content
        const words = text.split(/\s+/).filter(Boolean).length
        const chars = text.length
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length
        const links = (text.match(/\[\[([^\]]+)\]\]/g) || []).length
        const headers = (text.match(/^#{1,6}\s/gm) || []).length
        const codeBlocks = (text.match(/```/g) || []).length / 2
        const readTime = Math.max(1, Math.ceil(words / 200))

        api.ui.showNotice(
          `📝 "${note.title}"\n` +
          `Words: ${words} · Chars: ${chars}\n` +
          `Sentences: ${sentences} · Paragraphs: ${paragraphs}\n` +
          `Headers: ${headers} · Links: ${links} · Code blocks: ${Math.floor(codeBlocks)}\n` +
          `Reading time: ~${readTime} min`
        )
      },
    })
  },
}

/* ================================================================== */
/*  10. Voice Notes (Audio Memo)                                       */
/* ================================================================== */

export const voiceNotesPlugin: TesserinPlugin = {
  manifest: {
    id: "community.voice-notes",
    name: "Voice Notes",
    version: "1.0.0",
    description: "Quick audio memos — record voice notes that create timestamped markdown entries.",
    author: "Community",
    icon: React.createElement(FiMic, { size: 16 }),
    permissions: ["vault:read", "vault:write", "ui:notify", "commands", "panels"],
  },

  activate(api: TesserinPluginAPI) {
    let mediaRecorder: MediaRecorder | null = null
    let isRecording = false
    let startTime = 0
    let listeners: Array<() => void> = []
    const notify = () => listeners.forEach(fn => fn())
    const subscribe = (fn: () => void) => { listeners.push(fn); return () => { listeners = listeners.filter(l => l !== fn) } }

    api.registerCommand({
      id: "start-voice-note",
      label: "Start Voice Recording",
      category: "Voice Notes",
      async execute() {
        if (isRecording) { api.ui.showNotice("Already recording!"); return }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          const chunks: Blob[] = []
          mediaRecorder = new MediaRecorder(stream)

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data)
          }

          mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop())
            const duration = Math.round((Date.now() - startTime) / 1000)
            const now = new Date()
            const ts = now.toLocaleString()

            // Create a note with the recording metadata
            const content = [
              `---`,
              `type: voice-note`,
              `recorded: ${now.toISOString()}`,
              `duration: ${duration}s`,
              `---`,
              ``,
              `# 🎙️ Voice Note — ${ts}`,
              ``,
              `**Duration:** ${duration} seconds`,
              ``,
              `> *Audio was recorded. Transcribe above or add notes below.*`,
              ``,
              `## Notes`,
              ``,
              ``,
            ].join("\n")

            api.vault.create(`Voice Note ${ts}`, content)
            api.ui.showNotice(`🎙️ Voice note saved (${duration}s). A new note was created.`)
            isRecording = false
            notify()
          }

          mediaRecorder.start()
          isRecording = true
          startTime = Date.now()
          notify()
          api.ui.showNotice("🎙️ Recording started… Use 'Stop Voice Recording' to finish.")
        } catch (err) {
          api.ui.showNotice("Microphone access denied or not available.")
        }
      },
    })

    api.registerCommand({
      id: "stop-voice-note",
      label: "Stop Voice Recording",
      category: "Voice Notes",
      execute() {
        if (!isRecording || !mediaRecorder) {
          api.ui.showNotice("No recording in progress.")
          return
        }
        mediaRecorder.stop()
      },
    })

    api.registerStatusBarWidget({
      id: "voice-recording",
      align: "left",
      priority: 1,
      component: function VoiceWidget() {
        const [, setTick] = React.useState(0)
        React.useEffect(() => subscribe(() => setTick(t => t + 1)), [])
        React.useEffect(() => {
          if (!isRecording) return
          const i = setInterval(() => setTick(t => t + 1), 1000)
          return () => clearInterval(i)
        }, [isRecording])

        if (!isRecording) return null
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        return React.createElement("div", {
          className: "flex items-center gap-1.5 text-[10px] animate-pulse",
          style: { color: "#ef4444" },
        },
          React.createElement("span", null, "⏺"),
          React.createElement("span", null, `REC ${elapsed}s`),
        )
      },
    })
  },
}

/* ================================================================== */
/*  All community plugins registry                                     */
/* ================================================================== */

export const COMMUNITY_PLUGINS: TesserinPlugin[] = [
  pomodoroPlugin,
  readingListPlugin,
  spacedRepetitionPlugin,
  zettelkastenPlugin,
  citationPlugin,
  habitTrackerPlugin,
  writingGoalsPlugin,
  markdownTablePlugin,
  noteStatsPlugin,
  voiceNotesPlugin,
]
