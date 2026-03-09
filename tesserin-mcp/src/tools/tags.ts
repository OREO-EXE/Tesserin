/**
 * tools/tags.ts — Tag management + note-tag association
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiDelete, safeId, isValidHexColor, txt, errTxt } from '../api.js'

type Tag = { id?: string; name?: string; color?: string }
type TagsResp = { tags?: Tag[] }
type TagResp = { tag?: Tag }

export function registerTagTools(server: McpServer): void {
  // ── list_tags ─────────────────────────────────────────────────────
  server.tool(
    'list_tags',
    'List all tags in the Tesserin vault.',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/tags')) as TagsResp
        const tags = data.tags ?? []
        if (!tags.length) return txt('No tags found.')
        const lines = tags.map(
          t => `- ${t.name ?? '?'} (id: ${t.id ?? '?'}, color: ${t.color ?? '#6366f1'})`,
        )
        return txt(`${tags.length} tag(s):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── create_tag ────────────────────────────────────────────────────
  server.tool(
    'create_tag',
    'Create a new tag. color must be a valid hex color (#RGB or #RRGGBB).',
    {
      name: z.string().describe('Tag name'),
      color: z.string().optional().describe('Hex color code (default: #6366f1)'),
    },
    async ({ name, color = '#6366f1' }) => {
      const n = name.trim()
      if (!n) return errTxt('Error: name is required.')
      const c = color.trim()
      if (!isValidHexColor(c)) return errTxt('Error: color must be a valid hex color (#RGB or #RRGGBB).')
      try {
        const data = (await apiPost('/api/tags', { name: n, color: c })) as TagResp
        const tag = data.tag ?? {}
        return txt(`Tag created: ${n} (id: ${tag.id ?? '?'}, color: ${c})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── delete_tag ────────────────────────────────────────────────────
  server.tool(
    'delete_tag',
    'Permanently delete a tag from the vault by its ID.',
    { tag_id: z.string().describe('The ID of the tag to delete') },
    async ({ tag_id }) => {
      const sid = safeId(tag_id)
      if (!sid) return errTxt('Error: tag_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiDelete(`/api/tags/${sid}`)
        return txt(`Tag deleted (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── add_tag_to_note ───────────────────────────────────────────────
  server.tool(
    'add_tag_to_note',
    'Add an existing tag to a note by their IDs.',
    {
      note_id: z.string().describe('The note ID to tag'),
      tag_id: z.string().describe('The tag ID to add to the note'),
    },
    async ({ note_id, tag_id }) => {
      const nid = safeId(note_id)
      if (!nid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      const tid = safeId(tag_id)
      if (!tid) return errTxt('Error: tag_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiPost(`/api/notes/${nid}/tags/${tid}`, {})
        return txt(`Tag ${tid} added to note ${nid}.`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )
}
