/**
 * tesserin-mcp/src/api.ts
 * Shared HTTP client helpers used by all tool modules.
 * Reads TESSERIN_API_URL and TESSERIN_API_TOKEN from the environment.
 */

export const API_URL = (process.env['TESSERIN_API_URL'] ?? 'http://127.0.0.1:9960').replace(/\/$/, '')
export const API_TOKEN = process.env['TESSERIN_API_TOKEN'] ?? ''

const MAX_CONTENT_BYTES = 512 * 1024
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?$/

/** Validate and sanitize an entity ID. Returns null if invalid or empty. */
export function safeId(value: string): string | null {
  const v = value.trim()
  return v && SAFE_ID_RE.test(v) ? v : null
}

/** Validate text payload size. Returns null if over the 512 KB limit. */
export function safeText(value: string): string | null {
  return Buffer.byteLength(value, 'utf8') <= MAX_CONTENT_BYTES ? value : null
}

/** Validate a CSS/HTML hex color string. */
export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color.trim())
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  }
}

async function unwrap(res: Response): Promise<unknown> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let detail = text
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      detail = (parsed['error'] as string) ?? text
    } catch { /* ignore */ }
    throw new Error(`HTTP ${res.status}: ${detail}`)
  }
  return res.json() as Promise<unknown>
}

export async function apiGet(
  path: string,
  params?: Record<string, string | number>,
): Promise<unknown> {
  const urlObj = new URL(`${API_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) urlObj.searchParams.set(k, String(v))
  }
  return unwrap(await fetch(urlObj.toString(), { headers: authHeaders() }))
}

export async function apiPost(path: string, body: object): Promise<unknown> {
  return unwrap(
    await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  )
}

export async function apiPatch(path: string, body: object): Promise<unknown> {
  return unwrap(
    await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  )
}

export async function apiPut(path: string, body: object): Promise<unknown> {
  return unwrap(
    await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  )
}

export async function apiDelete(path: string): Promise<unknown> {
  return unwrap(
    await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),
  )
}

/** Shorthand to build a successful text tool response. */
export function txt(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

/** Shorthand to build an error text tool response. */
export function errTxt(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true }
}
