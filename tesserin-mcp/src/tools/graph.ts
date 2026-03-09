/**
 * tools/graph.ts — Knowledge graph, vault context, export, vault summary
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, safeId, safeText, txt, errTxt } from '../api.js'

export function registerGraphTools(server: McpServer): void {
  // ── get_knowledge_graph ───────────────────────────────────────────
  server.tool(
    'get_knowledge_graph',
    'Retrieve the full knowledge graph (nodes and edges) for the vault. Includes wiki-link and tag-shared connections.',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/knowledge/graph')) as {
          graph?: { nodes?: unknown[]; edges?: unknown[] }
          nodes?: unknown[]
          edges?: unknown[]
        }
        const graph = data.graph ?? data
        const nodes = (graph.nodes ?? []) as Array<{ id?: string; label?: string; type?: string }>
        const edges = (graph.edges ?? []) as unknown[]
        const lines = nodes
          .slice(0, 50)
          .map(n => `- ${n.label ?? n.id ?? '?'} (id: ${n.id ?? '?'}, type: ${n.type ?? '?'})`)
        return txt(
          `Knowledge Graph\n\nNodes: ${nodes.length}\nEdges: ${edges.length}\n\n` + lines.join('\n'),
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── search_vault_context ──────────────────────────────────────────
  server.tool(
    'search_vault_context',
    'Search the vault and return context-rich RAG chunks suitable for AI use.',
    {
      query: z.string().describe('Semantic search query'),
      max_chunks: z.number().optional().describe('Max context chunks to return (default 10, max 50)'),
    },
    async ({ query, max_chunks }) => {
      const q = query.trim()
      if (!q) return errTxt('Error: query is required.')
      if (!safeText(q)) return errTxt('Error: query is too long (max 512 KB).')
      const mc = Math.min(max_chunks ?? 10, 50)
      try {
        const data = (await apiPost('/api/knowledge/search', { query: q, maxChunks: mc })) as {
          chunks?: Array<{ noteTitle?: string; text?: string }>
        }
        const chunks = data.chunks ?? []
        if (!chunks.length) return txt(`No vault context found for: ${JSON.stringify(q)}`)
        let out = `${chunks.length} context chunk(s) for ${JSON.stringify(q)}:\n\n`
        chunks.forEach((c, i) => {
          out += `--- Chunk ${i + 1} (${c.noteTitle ?? '?'}) ---\n${c.text ?? ''}\n\n`
        })
        return txt(out.trim())
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_vault_context ─────────────────────────────────────────────
  server.tool(
    'get_vault_context',
    'Get rich context from the vault about a topic, formatted for AI reasoning.',
    {
      topic: z.string().optional().describe('Topic to retrieve context for'),
      max_notes: z.number().optional().describe('Maximum notes to include (default 50)'),
    },
    async ({ topic, max_notes }) => {
      const tp = topic?.trim()
      const n = Math.min(max_notes ?? 50, 200)
      try {
        const params: Record<string, string | number> = { maxNotes: n }
        if (tp) params['topic'] = tp
        const data = (await apiGet('/api/knowledge/context', params)) as { context?: string }
        const context = data.context ?? ''
        if (!context) return txt(tp ? `No context found for topic: "${tp}"` : 'Vault context is empty.')
        return txt(tp ? `Vault context for "${tp}":\n\n${context}` : context)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── export_vault ──────────────────────────────────────────────────
  server.tool(
    'export_vault',
    'Export all vault data as JSON (notes, tags, folders, tasks, knowledge graph).',
    {
      format: z.string().optional().describe('Export format: json | markdown (default: json)'),
    },
    async ({ format = 'json' }) => {
      const fmt = format.trim().toLowerCase()
      if (!['json', 'markdown', 'md'].includes(fmt)) {
        return errTxt("Error: format must be 'json' or 'markdown'.")
      }
      try {
        const data = await apiGet('/api/knowledge/export')
        return txt(`Vault export (${fmt}):\n\n${JSON.stringify(data, null, 2)}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_note_with_connections ─────────────────────────────────────
  server.tool(
    'get_note_with_connections',
    'Get a note along with all its backlinks, outgoing wiki-links, and tag connections.',
    { note_id: z.string().describe('The ID of the note') },
    async ({ note_id }) => {
      const sid = safeId(note_id)
      if (!sid) return errTxt('Error: note_id is required and must be alphanumeric (max 128 chars).')
      try {
        const data = (await apiGet(`/api/knowledge/note/${sid}/connections`)) as {
          note?: { title?: string; id?: string }
          outgoingLinks?: Array<{ title?: string; id?: string }>
          incomingLinks?: Array<{ title?: string; id?: string }>
          tags?: string[]
        }
        const note = data.note ?? {}
        const outgoing = data.outgoingLinks ?? []
        const incoming = data.incomingLinks ?? []
        const tags = data.tags ?? []
        const outLines = outgoing.map(l => `  -> ${l.title ?? '?'} (id: ${l.id ?? '?'})`)
        const inLines = incoming.map(l => `  <- ${l.title ?? '?'} (id: ${l.id ?? '?'})`)
        return txt(
          `${note.title ?? '(untitled)'} (id: ${sid})\n\n` +
          `Tags: ${tags.join(', ') || 'none'}\n\n` +
          `Outgoing (${outgoing.length}):\n${outLines.join('\n') || '  none'}\n\n` +
          `Incoming (${incoming.length}):\n${inLines.join('\n') || '  none'}`,
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_vault_summary ─────────────────────────────────────────────
  server.tool(
    'get_vault_summary',
    'Get a high-level summary of vault stats (notes, tags, tasks, folders, links).',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/vault/summary')) as {
          noteCount?: number
          tagCount?: number
          taskCount?: number
          folderCount?: number
          linkCount?: number
        }
        return txt(
          `Vault Summary\n\n` +
          `Notes:   ${data.noteCount ?? '?'}\n` +
          `Tags:    ${data.tagCount ?? '?'}\n` +
          `Tasks:   ${data.taskCount ?? '?'}\n` +
          `Folders: ${data.folderCount ?? '?'}\n` +
          `Links:   ${data.linkCount ?? '?'}`,
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )
}
