/**
 * tools/notes.ts — Note CRUD, search, pin, archive, append, recent, by-title
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete, safeId, safeText, txt, errTxt } from '../api.js'

type Note = { id?: string; title?: string; content?: string; folderId?: string; isPinned?: boolean; isArchived?: boolean; tags?: string[]; updatedAt?: string; updated_at?: string }
type NoteResp = { note?: Note }
type NotesResp = { notes?: Note[] }
type SearchResp = { results?: Note[]; notes?: Note[] }

export function registerNoteTools(server: McpServer): void {
  // ── list_notes ────────────────────────────────────────────────────
  server.tool(
    'list_notes',
    'List notes in the Tesserin vault, optionally filtered by folder or tag.',
    {
      folder_id: z.string().optional().describe('Filter by folder ID'),
      tag: z.string().optional().describe('Filter by tag name'),
      limit: z.number().optional().describe('Maximum notes to return (default 20, max 200)'),
    },
    async ({ folder_id, tag, limit }) => {
      try {
        const params: Record<string, string | number> = {
          limit: Math.min(limit ?? 20, 200),
        }
        if (folder_id?.trim()) {
          const fid = safeId(folder_id)
          if (!fid) return errTxt('Error: folder_id contains invalid characters.')
          params['folderId'] = fid
        }
        if (tag?.trim()) params['tag'] = tag.trim().slice(0, 200)

        const data = (await apiGet('/api/notes', params)) as NotesResp
        const notes = data.notes ?? []
        if (!notes.length) return txt('No notes found.')
        const lines = notes.map(n => `- ${n.title ?? '(untitled)'} (id: ${n.id ?? '?'})`)
        return txt(`${notes.length} note(s):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_note ──────────────────────────────────────────────────────
  server.tool(
    'get_note',
    'Retrieve the full content and metadata of a single note by its ID.',
    { note_id: z.string().describe('The ID of the note to retrieve') },
    async ({ note_id }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        const data = (await apiGet(`/api/notes/${sid}`)) as NoteResp
        const note = data.note ?? {}
        const tags = (note.tags ?? []).join(', ')
        return txt(
          `Title: ${note.title ?? '(untitled)'}\nID: ${sid}\n` +
          `Tags: ${tags || 'none'}\n\n---\n\n${note.content ?? ''}`,
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── search_notes ──────────────────────────────────────────────────
  server.tool(
    'search_notes',
    'Full-text search across all notes in the vault.',
    {
      query: z.string().describe('Search query to match against note titles and content'),
      limit: z.number().optional().describe('Maximum results to return (default 10, max 100)'),
    },
    async ({ query, limit }) => {
      const q = query.trim()
      if (!q) return errTxt('Error: query is required.')
      if (!safeText(q)) return errTxt('Error: query is too long (max 512 KB).')
      try {
        const data = (await apiGet(
          `/api/notes/search/${encodeURIComponent(q)}`,
        )) as SearchResp
        const notes = data.results ?? data.notes ?? []
        const max = Math.min(limit ?? 10, 100)
        const sliced = notes.slice(0, max)
        if (!sliced.length) return txt(`No notes found for: ${JSON.stringify(q)}`)
        const lines = sliced.map(n => `- ${n.title ?? '(untitled)'} (id: ${n.id ?? '?'})`)
        return txt(`${sliced.length} result(s) for ${JSON.stringify(q)}:\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── create_note ───────────────────────────────────────────────────
  server.tool(
    'create_note',
    'Create a new note in the Tesserin vault.',
    {
      title: z.string().describe('Title of the new note'),
      content: z.string().optional().describe('Markdown content of the note'),
      folder_id: z.string().optional().describe('Folder ID to place the note in'),
      tags: z.string().optional().describe('Comma-separated list of tag names to attach'),
    },
    async ({ title, content, folder_id, tags }) => {
      const t = title.trim()
      if (!t) return errTxt('Error: title is required.')
      if (content && !safeText(content)) return errTxt('Error: content exceeds 512 KB limit.')
      const body: Record<string, unknown> = { title: t, content: content ?? '' }
      if (tags?.trim()) body['tags'] = tags.split(',').map(s => s.trim()).filter(Boolean)
      if (folder_id?.trim()) {
        const fid = safeId(folder_id)
        if (!fid) return errTxt('Error: folder_id contains invalid characters.')
        body['folderId'] = fid
      }
      try {
        const data = (await apiPost('/api/notes', body)) as NoteResp
        const note = data.note ?? {}
        return txt(`Note created! Title: ${t} | ID: ${note.id ?? '?'}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── update_note ───────────────────────────────────────────────────
  server.tool(
    'update_note',
    'Update the title, content, or tags of an existing note.',
    {
      note_id: z.string().describe('The ID of the note to update'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New markdown content'),
      tags: z.string().optional().describe('Comma-separated tag names (replaces existing tags)'),
    },
    async ({ note_id, title, content, tags }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      const body: Record<string, unknown> = {}
      if (title?.trim()) body['title'] = title.trim()
      if (content !== undefined) {
        if (!safeText(content)) return errTxt('Error: content exceeds 512 KB limit.')
        body['content'] = content
      }
      if (tags?.trim()) body['tags'] = tags.split(',').map(s => s.trim()).filter(Boolean)
      if (!Object.keys(body).length) return errTxt('Error: provide at least one field to update.')
      try {
        await apiPatch(`/api/notes/${sid}`, body)
        return txt(`Note updated (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── delete_note ───────────────────────────────────────────────────
  server.tool(
    'delete_note',
    'Permanently delete a note from the vault by its ID. Cannot be undone.',
    { note_id: z.string().describe('The ID of the note to delete') },
    async ({ note_id }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiDelete(`/api/notes/${sid}`)
        return txt(`Note deleted (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── append_to_note ────────────────────────────────────────────────
  server.tool(
    'append_to_note',
    'Append text to the end of an existing note without overwriting it.',
    {
      note_id: z.string().describe('The ID of the note to append to'),
      content: z.string().describe('Text to append (Markdown supported)'),
    },
    async ({ note_id, content }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      if (!content.trim()) return errTxt('Error: content is required.')
      if (!safeText(content)) return errTxt('Error: content exceeds 512 KB limit.')
      try {
        const data = (await apiGet(`/api/notes/${sid}`)) as NoteResp
        const current = data.note?.content ?? ''
        const updated = current + '\n\n' + content
        if (!safeText(updated)) return errTxt('Error: combined content would exceed 512 KB limit.')
        await apiPatch(`/api/notes/${sid}`, { content: updated })
        return txt(`Content appended to note (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── pin_note ──────────────────────────────────────────────────────
  server.tool(
    'pin_note',
    'Pin or unpin a note.',
    {
      note_id: z.string().describe('The ID of the note'),
      pinned: z.boolean().optional().describe('true to pin, false to unpin (default: true)'),
    },
    async ({ note_id, pinned = true }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiPatch(`/api/notes/${sid}`, { isPinned: pinned })
        return txt(`${pinned ? 'Pinned' : 'Unpinned'} note (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── archive_note ──────────────────────────────────────────────────
  server.tool(
    'archive_note',
    'Archive or unarchive a note.',
    {
      note_id: z.string().describe('The ID of the note'),
      archived: z.boolean().optional().describe('true to archive, false to unarchive (default: true)'),
    },
    async ({ note_id, archived = true }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiPatch(`/api/notes/${sid}`, { isArchived: archived })
        return txt(`${archived ? 'Archived' : 'Unarchived'} note (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_recent_notes ──────────────────────────────────────────────
  server.tool(
    'get_recent_notes',
    'Get the most recently modified notes.',
    { limit: z.number().optional().describe('Number of notes to return (default 10, max 50)') },
    async ({ limit }) => {
      const n = Math.min(limit ?? 10, 50)
      try {
        const data = (await apiGet('/api/notes', {
          limit: n,
          sort: 'updatedAt',
          order: 'desc',
        })) as NotesResp
        const notes = data.notes ?? []
        if (!notes.length) return txt('No recent notes found.')
        const lines = notes.map(nn => `- ${nn.title ?? '(untitled)'} (id: ${nn.id ?? '?'})`)
        return txt(`${notes.length} recent note(s):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_note_by_title ─────────────────────────────────────────────
  server.tool(
    'get_note_by_title',
    'Find a note by its exact title. Useful for resolving [[wiki-links]].',
    { title: z.string().describe('Exact title of the note to find') },
    async ({ title }) => {
      const t = title.trim()
      if (!t) return errTxt('Error: title is required.')
      try {
        const data = (await apiGet('/api/notes', { limit: 500 })) as NotesResp
        const notes = data.notes ?? []
        const match = notes.find(n => (n.title ?? '').toLowerCase() === t.toLowerCase())
        if (!match) return errTxt(`No note found with title: "${t}"`)
        // Fetch full content
        const full = (await apiGet(`/api/notes/${match.id}`)) as NoteResp
        const note = full.note ?? match
        return txt(
          `Title: ${note.title ?? t}\nID: ${note.id ?? '?'}\n\n---\n\n${note.content ?? ''}`,
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── batch_create_notes ────────────────────────────────────────────
  server.tool(
    'batch_create_notes',
    'Create multiple notes at once. Useful for importing or bulk-generating content.',
    {
      notes: z
        .array(
          z.object({
            title: z.string().describe('Note title'),
            content: z.string().optional().describe('Markdown content'),
            folder_id: z.string().optional().describe('Folder ID'),
            tags: z.string().optional().describe('Comma-separated tags'),
          }),
        )
        .describe('Array of notes to create'),
    },
    async ({ notes }) => {
      const created: Array<{ id: string; title: string }> = []
      const errors: string[] = []
      for (const noteData of notes) {
        const t = noteData.title.trim()
        if (!t) { errors.push('Skipped: empty title'); continue }
        const body: Record<string, unknown> = { title: t, content: noteData.content ?? '' }
        if (noteData.tags?.trim()) {
          body['tags'] = noteData.tags.split(',').map(s => s.trim()).filter(Boolean)
        }
        if (noteData.folder_id?.trim()) {
          const fid = safeId(noteData.folder_id)
          if (fid) body['folderId'] = fid
        }
        try {
          const data = (await apiPost('/api/notes', body)) as NoteResp
          const note = data.note ?? {}
          created.push({ id: note.id ?? '?', title: t })
        } catch (e) {
          errors.push(`"${t}": ${(e as Error).message}`)
        }
      }
      const lines = [
        `Created ${created.length} of ${notes.length} note(s).`,
        ...created.map(n => `  ✓ ${n.title} (id: ${n.id})`),
        ...errors.map(e => `  ✗ ${e}`),
      ]
      return txt(lines.join('\n'))
    },
  )
}
