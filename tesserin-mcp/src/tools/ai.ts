/**
 * tools/ai.ts — Tesserin AI tools: chat, summarize, generate tags, suggest links
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, safeId, safeText, txt, errTxt } from '../api.js'

export function registerAiTools(server: McpServer): void {
  // ── ai_chat ───────────────────────────────────────────────────────
  server.tool(
    'ai_chat',
    'Send a message to Tesserin AI and get a response.',
    {
      message: z.string().describe('The message to send to the AI'),
      model: z.string().optional().describe('Optional model override (e.g. "llama3.2", "gpt-4o")'),
    },
    async ({ message, model }) => {
      const msg = message.trim()
      if (!msg) return errTxt('Error: message is required.')
      if (!safeText(msg)) return errTxt('Error: message exceeds 512 KB limit.')
      const messages = [{ role: 'user', content: msg }]
      const body: Record<string, unknown> = { messages }
      if (model?.trim()) body['model'] = model.trim()
      try {
        const data = (await apiPost('/api/ai/chat', body)) as {
          result?: { content?: string }
          response?: string
          message?: string
        }
        const reply =
          (data.result as { content?: string } | undefined)?.content ??
          data.response ??
          data.message ??
          ''
        return txt(`AI Response:\n\n${reply}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── ai_summarize ──────────────────────────────────────────────────
  server.tool(
    'ai_summarize',
    'Ask Tesserin AI to summarize a note by its ID.',
    {
      note_id: z.string().describe('The ID of the note to summarize'),
      model: z.string().optional().describe('Optional model override'),
    },
    async ({ note_id, model }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        // Fetch note content first
        const noteData = (await apiGet(`/api/notes/${sid}`)) as {
          note?: { content?: string; title?: string }
        }
        const note = noteData.note ?? {}
        if (!note.content) return errTxt(`Note not found or has no content: ${sid}`)
        const body: Record<string, unknown> = { text: note.content }
        if (model?.trim()) body['model'] = model.trim()
        const data = (await apiPost('/api/ai/summarize', body)) as { summary?: string }
        return txt(`Summary of "${note.title ?? sid}":\n\n${data.summary ?? ''}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── ai_generate_tags ──────────────────────────────────────────────
  server.tool(
    'ai_generate_tags',
    'Ask Tesserin AI to suggest tags for a note.',
    {
      note_id: z.string().describe('The ID of the note to generate tags for'),
      model: z.string().optional().describe('Optional model override'),
    },
    async ({ note_id, model }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        const noteData = (await apiGet(`/api/notes/${sid}`)) as {
          note?: { content?: string; title?: string }
        }
        const note = noteData.note ?? {}
        if (!note.content) return errTxt(`Note not found or has no content: ${sid}`)
        const body: Record<string, unknown> = { text: `${note.title ?? ''}\n\n${note.content}` }
        if (model?.trim()) body['model'] = model.trim()
        const data = (await apiPost('/api/ai/generate-tags', body)) as { tags?: string[] }
        const tags = data.tags ?? []
        if (!tags.length) return txt('No tag suggestions generated.')
        return txt(`Suggested tags for "${note.title ?? sid}":\n\n${tags.map(t => `- ${t}`).join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── ai_suggest_links ──────────────────────────────────────────────
  server.tool(
    'ai_suggest_links',
    'Ask Tesserin AI to suggest related notes that could be wiki-linked.',
    {
      note_id: z.string().describe('The ID of the note to find link suggestions for'),
      model: z.string().optional().describe('Optional model override'),
    },
    async ({ note_id, model }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        // Get the note content
        const noteData = (await apiGet(`/api/notes/${sid}`)) as {
          note?: { content?: string; title?: string }
        }
        const note = noteData.note ?? {}
        if (!note.content) return errTxt(`Note not found or has no content: ${sid}`)
        // Get all other note titles for context
        const allNotesData = (await apiGet('/api/notes', { limit: 500 })) as {
          notes?: Array<{ id?: string; title?: string }>
        }
        const existingTitles = (allNotesData.notes ?? [])
          .filter(n => n.id !== sid)
          .map(n => n.title ?? '')
          .filter(Boolean)
        const body: Record<string, unknown> = { content: note.content, existingTitles }
        if (model?.trim()) body['model'] = model.trim()
        const data = (await apiPost('/api/ai/suggest-links', body)) as {
          links?: Array<{ title?: string; reason?: string }>
        }
        const links = data.links ?? []
        if (!links.length) return txt('No link suggestions found.')
        const lines = links.map(l => `- [[${l.title ?? '?'}]]${l.reason ? ` — ${l.reason}` : ''}`)
        return txt(`Link suggestions for "${note.title ?? sid}":\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )
}
