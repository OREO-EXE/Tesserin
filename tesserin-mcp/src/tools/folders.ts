/**
 * tools/folders.ts — Folder hierarchy management
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiDelete, safeId, txt, errTxt } from '../api.js'

type Folder = { id?: string; name?: string; parentId?: string }
type FoldersResp = { folders?: Folder[] }
type FolderResp = { folder?: Folder }

export function registerFolderTools(server: McpServer): void {
  // ── list_folders ──────────────────────────────────────────────────
  server.tool(
    'list_folders',
    'List all folders in the Tesserin vault.',
    {},
    async () => {
      try {
        const data = (await apiGet('/api/folders')) as FoldersResp
        const folders = data.folders ?? []
        if (!folders.length) return txt('No folders found.')
        const lines = folders.map(f => `- ${f.name ?? '?'} (id: ${f.id ?? '?'})`)
        return txt(`${folders.length} folder(s):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── create_folder ─────────────────────────────────────────────────
  server.tool(
    'create_folder',
    'Create a new folder, optionally nested inside another folder.',
    {
      name: z.string().describe('Folder name'),
      parent_id: z.string().optional().describe('Parent folder ID for nesting'),
    },
    async ({ name, parent_id }) => {
      const n = name.trim()
      if (!n) return errTxt('Error: name is required.')
      const body: Record<string, unknown> = { name: n }
      if (parent_id?.trim()) {
        const pid = safeId(parent_id)
        if (!pid) return errTxt('Error: parent_id contains invalid characters.')
        body['parentId'] = pid
      }
      try {
        const data = (await apiPost('/api/folders', body)) as FolderResp
        const folder = data.folder ?? {}
        return txt(`Folder created: ${n} (id: ${folder.id ?? '?'})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── delete_folder ─────────────────────────────────────────────────
  server.tool(
    'delete_folder',
    'Delete a folder by its ID. Notes inside may be moved to the root.',
    { folder_id: z.string().describe('The ID of the folder to delete') },
    async ({ folder_id }) => {
      const sid = safeId(folder_id)
      if (!sid) return errTxt('Error: folder_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiDelete(`/api/folders/${sid}`)
        return txt(`Folder deleted (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )
}
