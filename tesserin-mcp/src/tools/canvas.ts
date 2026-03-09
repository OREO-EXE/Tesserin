/**
 * tools/canvas.ts — Canvas/board CRUD and diagram generation
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete, safeId, safeText, txt, errTxt } from '../api.js'

type Canvas = {
  id?: string
  name?: string
  elements?: string
  appState?: string
  created_at?: string
  updated_at?: string
}
type CanvasResp = { canvas?: Canvas }
type CanvasesResp = { canvases?: Canvas[] }

export function registerCanvasTools(server: McpServer): void {
  // ── create_diagram ────────────────────────────────────────────────
  server.tool(
    'create_diagram',
    'Generate a Mermaid diagram on the Tesserin canvas using AI. Supports flowchart, sequence, and mindmap.',
    {
      description: z
        .string()
        .optional()
        .describe('Natural-language description of the diagram, e.g. "OAuth2 authorization code flow"'),
      diagram_type: z
        .string()
        .optional()
        .describe("Diagram type: flowchart | sequence | mindmap | auto (default: auto)"),
      canvas_name: z.string().optional().describe('Optional canvas tab name'),
      mermaid_code: z
        .string()
        .optional()
        .describe('Raw Mermaid code to render directly (bypasses AI generation)'),
    },
    async ({ description, diagram_type = 'auto', canvas_name, mermaid_code }) => {
      if (!description?.trim() && !mermaid_code?.trim()) {
        return errTxt("Error: either 'description' or 'mermaid_code' is required.")
      }
      const allowed = ['auto', 'flowchart', 'sequence', 'mindmap']
      const dtype = allowed.includes(diagram_type.toLowerCase()) ? diagram_type.toLowerCase() : 'auto'
      const payload: Record<string, unknown> = { type: dtype }
      if (description?.trim()) {
        if (!safeText(description)) return errTxt('Error: description exceeds 512 KB limit.')
        payload['prompt'] = description.trim()
      }
      if (mermaid_code?.trim()) {
        if (!safeText(mermaid_code)) return errTxt('Error: mermaid_code exceeds 512 KB limit.')
        payload['mermaid_code'] = mermaid_code.trim()
      }
      if (canvas_name?.trim()) payload['canvas_name'] = canvas_name.trim().slice(0, 120)
      try {
        const data = (await apiPost('/api/canvas/diagram', payload)) as {
          canvas_id?: string
          canvas_name?: string
          element_count?: number
          diagram_type?: string
          mermaid_code?: string
        }
        return txt(
          `✅ Diagram created successfully!\n\n` +
          `Canvas ID   : ${data.canvas_id ?? '?'}\n` +
          `Canvas Name : ${data.canvas_name ?? '?'}\n` +
          `Type        : ${data.diagram_type ?? dtype}\n` +
          `Elements    : ${data.element_count ?? 0}\n\n` +
          `Open the Canvas tab in Tesserin to view it.\n\n` +
          `--- Mermaid Code ---\n${data.mermaid_code ?? ''}`,
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── list_canvases ─────────────────────────────────────────────────
  server.tool(
    'list_canvases',
    'List all canvases/boards in the Tesserin workspace.',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/canvas/list')) as CanvasesResp
        const canvases = data.canvases ?? []
        if (!canvases.length) return txt('No canvases found. Use create_diagram to generate one.')
        const lines = canvases.map(c => {
          const updated = (c.updated_at ?? '').slice(0, 10)
          return `- ${c.name ?? '?'} (id: ${c.id ?? '?'}, updated: ${updated})`
        })
        return txt(`${canvases.length} canvas(es):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── get_canvas ────────────────────────────────────────────────────
  server.tool(
    'get_canvas',
    'Get the full data of a canvas by its ID, including all Excalidraw elements and app state.',
    { canvas_id: z.string().describe('The ID of the canvas to retrieve') },
    async ({ canvas_id }) => {
      const sid = safeId(canvas_id)
      if (!sid) return errTxt('Error: canvas_id is required and must be alphanumeric (max 128 chars).')
      try {
        const data = (await apiGet(`/api/canvas/${sid}`)) as CanvasResp
        const canvas = data.canvas ?? (data as Canvas)
        if (!canvas.id) return errTxt(`Canvas not found: ${sid}`)
        return txt(JSON.stringify(canvas, null, 2))
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── create_canvas ─────────────────────────────────────────────────
  server.tool(
    'create_canvas',
    'Create a new blank canvas/board in the Tesserin workspace.',
    {
      name: z.string().describe('Name of the new canvas'),
      elements: z.string().optional().describe('JSON string of Excalidraw elements to pre-populate'),
    },
    async ({ name, elements }) => {
      const n = name.trim()
      if (!n) return errTxt('Error: name is required.')
      try {
        const data = (await apiPost('/api/canvas', {
          name: n,
          elements: elements ?? '[]',
        })) as CanvasResp
        const canvas = data.canvas ?? (data as Canvas)
        return txt(`Canvas created: ${n} (id: ${canvas.id ?? '?'})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── update_canvas_name ────────────────────────────────────────────
  server.tool(
    'update_canvas_name',
    'Rename a canvas/board.',
    {
      canvas_id: z.string().describe('The ID of the canvas to rename'),
      name: z.string().describe('The new name for the canvas'),
    },
    async ({ canvas_id, name }) => {
      const sid = safeId(canvas_id)
      if (!sid) return errTxt('Error: canvas_id is required and must be alphanumeric (max 128 chars).')
      const n = name.trim()
      if (!n) return errTxt('Error: name is required.')
      try {
        await apiPatch(`/api/canvas/${sid}`, { name: n })
        return txt(`Canvas renamed to "${n}" (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── delete_canvas ─────────────────────────────────────────────────
  server.tool(
    'delete_canvas',
    'Delete a canvas/board from the workspace by its ID.',
    { canvas_id: z.string().describe('The ID of the canvas to delete') },
    async ({ canvas_id }) => {
      const sid = safeId(canvas_id)
      if (!sid) return errTxt('Error: canvas_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiDelete(`/api/canvas/${sid}`)
        return txt(`Canvas deleted (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── add_canvas_elements ───────────────────────────────────────────
  server.tool(
    'add_canvas_elements',
    'Append Excalidraw elements to an existing canvas. Elements are merged with the existing scene.',
    {
      canvas_id: z.string().describe('The ID of the canvas to modify'),
      elements: z.string().describe('JSON string of Excalidraw elements to add'),
    },
    async ({ canvas_id, elements }) => {
      const sid = safeId(canvas_id)
      if (!sid) return errTxt('Error: canvas_id is required and must be alphanumeric (max 128 chars).')
      // Validate JSON before sending
      try {
        JSON.parse(elements)
      } catch {
        return errTxt('Error: elements must be a valid JSON array of Excalidraw elements.')
      }
      try {
        const data = (await apiPost(`/api/canvas/${sid}/elements`, {
          elements,
        })) as { elementsAdded?: number; totalElements?: number }
        return txt(
          `Elements added to canvas ${sid}.\n` +
          `Added: ${data.elementsAdded ?? '?'} | Total: ${data.totalElements ?? '?'}`,
        )
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )
}
