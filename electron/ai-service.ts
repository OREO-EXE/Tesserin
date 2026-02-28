/**
 * Ollama AI Service
 *
 * HTTP client for the Ollama API running locally.
 * All AI operations run in the Electron main process.
 */

import { getSetting } from './database'

const DEFAULT_ENDPOINT = 'http://localhost:11434'
const DEFAULT_MODEL = 'deepseek-coder:6.7b'

function getEndpoint(): string {
  try {
    const configured = getSetting('ai.endpoint')
    if (configured && configured.trim()) return configured.trim()
  } catch {}
  return DEFAULT_ENDPOINT
}

interface ChatMessage {
    role: string
    content: string
}

interface StreamCallbacks {
    onChunk: (chunk: string) => void
    onDone: () => void
    onError: (error: string) => void
}

/**
 * Send a non-streaming chat request to Ollama.
 */
export async function chat(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL
): Promise<{ role: string; content: string }> {
    const response = await fetch(`${getEndpoint()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
        }),
    })

    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as { message?: { content?: string } }
    return { role: 'assistant', content: data.message?.content || '' }
}

/**
 * Send a streaming chat request to Ollama.
 * Calls onChunk for each token, onDone when complete.
 */
export async function chatStream(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL,
    callbacks: StreamCallbacks
): Promise<void> {
    const response = await fetch(`${getEndpoint()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
        }),
    })

    if (!response.ok) {
        callbacks.onError(`Ollama error: ${response.status} ${response.statusText}`)
        return
    }

    const reader = response.body?.getReader()
    if (!reader) {
        callbacks.onError('No response body')
        return
    }

    const decoder = new TextDecoder()

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value, { stream: true })
            const lines = text.split('\n').filter(Boolean)

            for (const line of lines) {
                try {
                    const json = JSON.parse(line)
                    if (json.message?.content) {
                        callbacks.onChunk(json.message.content)
                    }
                    if (json.done) {
                        callbacks.onDone()
                        return
                    }
                } catch {
                    // Skip malformed JSON lines
                }
            }
        }
        callbacks.onDone()
    } catch (err) {
        callbacks.onError(String(err))
    }
}

/**
 * Summarize a block of text.
 */
export async function summarize(text: string, model: string = DEFAULT_MODEL): Promise<string> {
    const result = await chat(
        [
            {
                role: 'system',
                content: 'You are a concise summarizer. Provide a clear, brief summary of the given text in 2-3 sentences. Focus on key points.',
            },
            {
                role: 'user',
                content: `Summarize the following:\n\n${text}`,
            },
        ],
        model
    )
    return result.content
}

/**
 * Generate tags for a piece of content.
 */
export async function generateTags(text: string, model: string = DEFAULT_MODEL): Promise<string[]> {
    const result = await chat(
        [
            {
                role: 'system',
                content: 'You are a tagging assistant. Given text, suggest 3-5 concise, relevant tags. Return ONLY a JSON array of strings, nothing else. Example: ["productivity", "note-taking", "zettelkasten"]',
            },
            {
                role: 'user',
                content: text,
            },
        ],
        model
    )

    try {
        const parsed = JSON.parse(result.content)
        if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
        // Try to extract tags from plain text
        const tags = result.content
            .replace(/[\[\]"]/g, '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        return tags.slice(0, 5)
    }
    return []
}

/**
 * Suggest wiki-links for the current note content.
 */
export async function suggestLinks(
    content: string,
    existingTitles: string[],
    model: string = DEFAULT_MODEL
): Promise<string[]> {
    const result = await chat(
        [
            {
                role: 'system',
                content: `You are a knowledge graph assistant. Given a note's content and a list of existing note titles, suggest which existing notes should be linked. Return ONLY a JSON array of note titles that are relevant. Example: ["Note Title 1", "Note Title 2"]

Available note titles: ${JSON.stringify(existingTitles)}`,
            },
            {
                role: 'user',
                content,
            },
        ],
        model
    )

    try {
        const parsed = JSON.parse(result.content)
        if (Array.isArray(parsed)) {
            return parsed.filter(t => existingTitles.includes(String(t)))
        }
    } catch {
        // Fallback
    }
    return []
}

/**
 * Check if Ollama is running and accessible.
 */
export async function checkConnection(): Promise<{ connected: boolean; version?: string }> {
    try {
        const response = await fetch(`${DEFAULT_ENDPOINT}/api/version`, {
            signal: AbortSignal.timeout(3000),
        })
        if (response.ok) {
            const data = await response.json() as { version?: string }
            return { connected: true, version: data.version }
        }
        return { connected: false }
    } catch {
        return { connected: false }
    }
}

/**
 * List available Ollama models.
 */
export async function listModels(): Promise<string[]> {
    try {
        const response = await fetch(`${DEFAULT_ENDPOINT}/api/tags`)
        if (!response.ok) return []
        const data = await response.json() as { models?: Array<{ name: string }> }
        return (data.models || []).map((m: { name: string }) => m.name)
    } catch {
        return []
    }
}

// ── OpenRouter ─────────────────────────────────────────────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function getOpenRouterKey(): string {
    try {
        const key = getSetting('ai.openrouterApiKey')
        if (key && key.trim()) return key.trim()
    } catch {}
    return ''
}

function getOpenRouterModel(): string {
    try {
        const model = getSetting('ai.openrouterModel')
        if (model && model.trim()) return model.trim()
    } catch {}
    return 'anthropic/claude-sonnet-4'
}

/**
 * Streaming chat via OpenRouter (OpenAI-compatible SSE).
 */
export async function chatStreamOpenRouter(
    messages: ChatMessage[],
    callbacks: StreamCallbacks
): Promise<void> {
    const apiKey = getOpenRouterKey()
    if (!apiKey) {
        callbacks.onError('OpenRouter API key not configured. Set it in Settings → AI.')
        return
    }

    const model = getOpenRouterModel()

    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://tesserin.app',
            'X-Title': 'Tesserin',
        },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
        }),
    })

    if (!response.ok) {
        const body = await response.text().catch(() => '')
        callbacks.onError(`OpenRouter error ${response.status}: ${body.slice(0, 300)}`)
        return
    }

    const reader = response.body?.getReader()
    if (!reader) {
        callbacks.onError('No response body from OpenRouter')
        return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed || !trimmed.startsWith('data: ')) continue
                const data = trimmed.slice(6)
                if (data === '[DONE]') {
                    callbacks.onDone()
                    return
                }
                try {
                    const json = JSON.parse(data)
                    const delta = json.choices?.[0]?.delta?.content
                    if (delta) callbacks.onChunk(delta)
                } catch {
                    // skip malformed SSE lines
                }
            }
        }
        callbacks.onDone()
    } catch (err) {
        callbacks.onError(String(err))
    }
}

/**
 * List popular OpenRouter models (curated subset).
 */
export async function listOpenRouterModels(apiKey?: string): Promise<string[]> {
    const key = apiKey || getOpenRouterKey()
    if (!key) return []
    try {
        const resp = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` },
            signal: AbortSignal.timeout(8000),
        })
        if (!resp.ok) return []
        const data = await resp.json() as { data?: Array<{ id: string }> }
        return (data.data || []).map(m => m.id).slice(0, 100)
    } catch {
        return []
    }
}
