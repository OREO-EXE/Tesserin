/**
 * tools/templates.ts — Templates listing + health check
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { apiGet, txt, errTxt } from '../api.js'
import { API_URL } from '../api.js'

type Template = { id?: string; name?: string }
type TemplatesResp = { templates?: Template[] }

export function registerTemplatesTools(server: McpServer): void {
  // ── list_templates ────────────────────────────────────────────────
  server.tool(
    'list_templates',
    'List all note templates available in the vault.',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/templates')) as TemplatesResp
        const templates = data.templates ?? []
        if (!templates.length) return txt('No templates found.')
        const lines = templates.map(t => `- ${t.name ?? '?'} (id: ${t.id ?? '?'})`)
        return txt(`${templates.length} template(s):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── check_health ──────────────────────────────────────────────────
  server.tool(
    'check_health',
    'Check that the Tesserin API server is reachable and healthy.',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/health')) as {
          status?: string
          version?: string
        }
        return txt(
          `Tesserin API healthy\n\nStatus: ${data.status ?? 'ok'}\nVersion: ${data.version ?? '?'}\nURL: ${API_URL}`,
        )
      } catch (e) {
        return errTxt(`Tesserin API unreachable: ${(e as Error).message}\nURL: ${API_URL}`)
      }
    },
  )
}
