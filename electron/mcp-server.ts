/**
 * Tesserin MCP Server
 *
 * Exposes the Tesserin vault (notes, tags, tasks, search) as MCP tools
 * so that external AI agents can read and manipulate your workspace.
 *
 * Runs in the Electron main process. Communicates over stdio or SSE
 * transport depending on how it's started.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import * as db from "./database"

/* ================================================================== */
/*  Server instance                                                    */
/* ================================================================== */

let mcpServer: McpServer | null = null

/**
 * Create and configure the Tesserin MCP server.
 * Registers all vault tools and resources.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "Tesserin",
    version: "1.0.0",
  })

  /* ── Tools ─────────────────────────────────────────────────────── */

  // List all notes
  server.tool(
    "list_notes",
    "List all notes in the Tesserin vault. Returns id, title, and timestamps.",
    {},
    async () => {
      const notes = db.listNotes()
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              notes.map((n: any) => ({
                id: n.id,
                title: n.title,
                created_at: n.created_at,
                updated_at: n.updated_at,
              })),
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get a specific note
  server.tool(
    "get_note",
    "Get the full content of a note by its ID.",
    { noteId: z.string().describe("The ID of the note to retrieve") },
    async ({ noteId }) => {
      const note = db.getNote(noteId)
      if (!note) {
        return {
          content: [{ type: "text" as const, text: `Note not found: ${noteId}` }],
          isError: true,
        }
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }],
      }
    }
  )

  // Search notes
  server.tool(
    "search_notes",
    "Search notes by title or content. Returns matching notes with snippets.",
    { query: z.string().describe("Search query to match against note titles and content") },
    async ({ query }) => {
      const results = db.searchNotes(query)
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              results.map((n: any) => ({
                id: n.id,
                title: n.title,
                snippet: n.content?.substring(0, 200) + (n.content?.length > 200 ? "…" : ""),
              })),
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Create a note
  server.tool(
    "create_note",
    "Create a new note in the Tesserin vault.",
    {
      title: z.string().describe("Title of the new note"),
      content: z.string().optional().describe("Markdown content of the note"),
      folderId: z.string().optional().describe("Folder ID to place the note in"),
    },
    async ({ title, content, folderId }) => {
      const note = db.createNote({ title, content: content || "", folderId }) as { id: string; title: string }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ id: note.id, title: note.title, message: "Note created successfully" }, null, 2),
          },
        ],
      }
    }
  )

  // Update a note
  server.tool(
    "update_note",
    "Update an existing note's title or content.",
    {
      noteId: z.string().describe("The ID of the note to update"),
      title: z.string().optional().describe("New title for the note"),
      content: z.string().optional().describe("New markdown content for the note"),
    },
    async ({ noteId, title, content }) => {
      const existing = db.getNote(noteId)
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: `Note not found: ${noteId}` }],
          isError: true,
        }
      }
      const updates: Record<string, string> = {}
      if (title !== undefined) updates.title = title
      if (content !== undefined) updates.content = content
      db.updateNote(noteId, updates)
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ noteId, message: "Note updated successfully" }),
          },
        ],
      }
    }
  )

  // Delete a note
  server.tool(
    "delete_note",
    "Delete a note from the vault by its ID.",
    { noteId: z.string().describe("The ID of the note to delete") },
    async ({ noteId }) => {
      const existing = db.getNote(noteId)
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: `Note not found: ${noteId}` }],
          isError: true,
        }
      }
      db.deleteNote(noteId)
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ noteId, message: "Note deleted successfully" }),
          },
        ],
      }
    }
  )

  // Get note by title (for wiki-links)
  server.tool(
    "get_note_by_title",
    "Find a note by its exact title. Useful for resolving [[wiki-links]].",
    { title: z.string().describe("Exact title of the note to find") },
    async ({ title }) => {
      const note = db.getNoteByTitle(title)
      if (!note) {
        return {
          content: [{ type: "text" as const, text: `No note found with title: "${title}"` }],
          isError: true,
        }
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }],
      }
    }
  )

  // List tags
  server.tool(
    "list_tags",
    "List all tags in the vault.",
    {},
    async () => {
      const tags = db.listTags()
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tags, null, 2) }],
      }
    }
  )

  // List tasks
  server.tool(
    "list_tasks",
    "List all tasks (kanban items) in the vault.",
    {},
    async () => {
      const tasks = db.listTasks()
      return {
        content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
      }
    }
  )

  // Create a task
  server.tool(
    "create_task",
    "Create a new task/kanban item.",
    {
      title: z.string().describe("Task title"),
      noteId: z.string().optional().describe("Associated note ID"),
      columnId: z.string().optional().describe("Kanban column ID"),
      priority: z.number().optional().describe("Priority: 0=none, 1=low, 2=medium, 3=high"),
      dueDate: z.string().optional().describe("Due date in ISO format"),
    },
    async ({ title, noteId, columnId, priority, dueDate }) => {
      const task = db.createTask({ title, noteId, columnId, priority, dueDate }) as { id: string; title: string }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ id: task.id, title: task.title, message: "Task created" }, null, 2),
          },
        ],
      }
    }
  )

  // List folders
  server.tool(
    "list_folders",
    "List all folders in the vault hierarchy.",
    {},
    async () => {
      const folders = db.listFolders()
      return {
        content: [{ type: "text" as const, text: JSON.stringify(folders, null, 2) }],
      }
    }
  )

  /* ── Resources ─────────────────────────────────────────────────── */

  // Expose the full vault as a resource
  server.resource(
    "vault_summary",
    "tesserin://vault/summary",
    async (uri) => {
      const notes = db.listNotes()
      const tags = db.listTags()
      const tasks = db.listTasks()
      const folders = db.listFolders()

      const summary = {
        noteCount: notes.length,
        tagCount: tags.length,
        taskCount: tasks.length,
        folderCount: folders.length,
        recentNotes: notes.slice(0, 10).map((n: any) => ({
          id: n.id,
          title: n.title,
          updated_at: n.updated_at,
        })),
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      }
    }
  )

  return server
}

/* ================================================================== */
/*  Lifecycle                                                          */
/* ================================================================== */

/**
 * Start the MCP server on stdio transport.
 * Called when Tesserin is launched with `--mcp` flag.
 */
export async function startMcpServerStdio(): Promise<void> {
  mcpServer = createMcpServer()
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
  console.log("[MCP] Tesserin MCP server started on stdio")
}

/**
 * Get the current MCP server instance (for in-process connections).
 */
export function getMcpServer(): McpServer | null {
  return mcpServer
}

/**
 * Create a fresh MCP server for in-memory transport usage (e.g. SAM bridge).
 */
export function createInProcessServer(): McpServer {
  return createMcpServer()
}
