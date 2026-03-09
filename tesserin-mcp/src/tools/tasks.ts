/**
 * tools/tasks.ts — Kanban task management
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete, safeId, txt, errTxt } from '../api.js'

type Task = { id?: string; title?: string; status?: string; priority?: number; dueDate?: string; description?: string }
type TasksResp = { tasks?: Task[] }
type TaskResp = { task?: Task }

export function registerTaskTools(server: McpServer): void {
  // ── list_tasks ────────────────────────────────────────────────────
  server.tool(
    'list_tasks',
    'List kanban tasks, optionally filtered by status or priority.',
    {
      status: z.string().optional().describe('Filter by status: todo | in-progress | done'),
      priority: z.number().optional().describe('Filter by priority: 0=none 1=low 2=medium 3=high'),
    },
    async ({ status, priority }) => {
      try {
        const params: Record<string, string | number> = {}
        if (status?.trim()) params['status'] = status.trim()
        if (priority !== undefined) params['priority'] = priority
        const data = (await apiGet('/api/tasks', params)) as TasksResp
        const tasks = data.tasks ?? []
        if (!tasks.length) return txt('No tasks found.')
        const lines = tasks.map(
          t => `- ${t.title ?? '(untitled)'} (id: ${t.id ?? '?'}, status: ${t.status ?? '?'})`,
        )
        return txt(`${tasks.length} task(s):\n\n${lines.join('\n')}`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── create_task ───────────────────────────────────────────────────
  server.tool(
    'create_task',
    'Create a new kanban task. priority: 0=none 1=low 2=medium 3=high.',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Optional task description'),
      priority: z.number().optional().describe('Priority 0–3 (default: 1 = low)'),
      due_date: z.string().optional().describe('Due date in ISO 8601 format'),
      note_id: z.string().optional().describe('Associated note ID'),
      column_id: z.string().optional().describe('Kanban column ID to place the task in'),
    },
    async ({ title, description, priority = 1, due_date, note_id, column_id }) => {
      const t = title.trim()
      if (!t) return errTxt('Error: title is required.')
      if (![0, 1, 2, 3].includes(priority)) return errTxt('Error: priority must be 0–3.')
      const body: Record<string, unknown> = { title: t, priority }
      if (description?.trim()) body['description'] = description.trim()
      if (due_date?.trim()) body['dueDate'] = due_date.trim()
      if (note_id?.trim()) body['noteId'] = note_id.trim()
      if (column_id?.trim()) body['columnId'] = column_id.trim()
      try {
        const data = (await apiPost('/api/tasks', body)) as TaskResp
        const task = data.task ?? {}
        return txt(`Task created: ${t} (id: ${task.id ?? '?'})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── update_task ───────────────────────────────────────────────────
  server.tool(
    'update_task',
    'Update an existing kanban task. status: todo | in-progress | done.',
    {
      task_id: z.string().describe('The ID of the task to update'),
      title: z.string().optional().describe('New task title'),
      status: z.string().optional().describe('New status: todo | in-progress | done'),
      priority: z.number().optional().describe('New priority 0–3'),
      due_date: z.string().optional().describe('New due date in ISO 8601 format'),
      column_id: z.string().optional().describe('Move to a different kanban column'),
    },
    async ({ task_id, title, status, priority, due_date, column_id }) => {
      const sid = safeId(task_id)
      if (!sid) return errTxt('Error: task_id is required and must be alphanumeric (max 128 chars).')
      const body: Record<string, unknown> = {}
      if (title?.trim()) body['title'] = title.trim()
      if (status?.trim()) body['status'] = status.trim()
      if (priority !== undefined) {
        if (![0, 1, 2, 3].includes(priority)) return errTxt('Error: priority must be 0–3.')
        body['priority'] = priority
      }
      if (due_date?.trim()) body['dueDate'] = due_date.trim()
      if (column_id?.trim()) body['columnId'] = column_id.trim()
      if (!Object.keys(body).length) return errTxt('Error: provide at least one field to update.')
      try {
        await apiPatch(`/api/tasks/${sid}`, body)
        return txt(`Task updated (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )

  // ── delete_task ───────────────────────────────────────────────────
  server.tool(
    'delete_task',
    'Permanently delete a kanban task by its ID. Cannot be undone.',
    { task_id: z.string().describe('The ID of the task to delete') },
    async ({ task_id }) => {
      const sid = safeId(task_id)
      if (!sid) return errTxt('Error: task_id is required and must be alphanumeric (max 128 chars).')
      try {
        await apiDelete(`/api/tasks/${sid}`)
        return txt(`Task deleted (id: ${sid})`)
      } catch (e) {
        return errTxt(`Error: ${(e as Error).message}`)
      }
    },
  )
}
