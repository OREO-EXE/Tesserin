"use strict";
/**
 * Ollama AI Service
 *
 * HTTP client for the Ollama API running locally.
 * All AI operations run in the Electron main process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
exports.chatStream = chatStream;
exports.summarize = summarize;
exports.generateTags = generateTags;
exports.suggestLinks = suggestLinks;
exports.checkConnection = checkConnection;
exports.listModels = listModels;
const DEFAULT_ENDPOINT = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
/**
 * Send a non-streaming chat request to Ollama.
 */
async function chat(messages, model = DEFAULT_MODEL) {
    const response = await fetch(`${DEFAULT_ENDPOINT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return { role: 'assistant', content: data.message?.content || '' };
}
/**
 * Send a streaming chat request to Ollama.
 * Calls onChunk for each token, onDone when complete.
 */
async function chatStream(messages, model = DEFAULT_MODEL, callbacks) {
    const response = await fetch(`${DEFAULT_ENDPOINT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
        }),
    });
    if (!response.ok) {
        callbacks.onError(`Ollama error: ${response.status} ${response.statusText}`);
        return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
        callbacks.onError('No response body');
        return;
    }
    const decoder = new TextDecoder();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) {
                        callbacks.onChunk(json.message.content);
                    }
                    if (json.done) {
                        callbacks.onDone();
                        return;
                    }
                }
                catch {
                    // Skip malformed JSON lines
                }
            }
        }
        callbacks.onDone();
    }
    catch (err) {
        callbacks.onError(String(err));
    }
}
/**
 * Summarize a block of text.
 */
async function summarize(text, model = DEFAULT_MODEL) {
    const result = await chat([
        {
            role: 'system',
            content: 'You are a concise summarizer. Provide a clear, brief summary of the given text in 2-3 sentences. Focus on key points.',
        },
        {
            role: 'user',
            content: `Summarize the following:\n\n${text}`,
        },
    ], model);
    return result.content;
}
/**
 * Generate tags for a piece of content.
 */
async function generateTags(text, model = DEFAULT_MODEL) {
    const result = await chat([
        {
            role: 'system',
            content: 'You are a tagging assistant. Given text, suggest 3-5 concise, relevant tags. Return ONLY a JSON array of strings, nothing else. Example: ["productivity", "note-taking", "zettelkasten"]',
        },
        {
            role: 'user',
            content: text,
        },
    ], model);
    try {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed))
            return parsed.map(String);
    }
    catch {
        // Try to extract tags from plain text
        const tags = result.content
            .replace(/[\[\]"]/g, '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
        return tags.slice(0, 5);
    }
    return [];
}
/**
 * Suggest wiki-links for the current note content.
 */
async function suggestLinks(content, existingTitles, model = DEFAULT_MODEL) {
    const result = await chat([
        {
            role: 'system',
            content: `You are a knowledge graph assistant. Given a note's content and a list of existing note titles, suggest which existing notes should be linked. Return ONLY a JSON array of note titles that are relevant. Example: ["Note Title 1", "Note Title 2"]

Available note titles: ${JSON.stringify(existingTitles)}`,
        },
        {
            role: 'user',
            content,
        },
    ], model);
    try {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed)) {
            return parsed.filter(t => existingTitles.includes(String(t)));
        }
    }
    catch {
        // Fallback
    }
    return [];
}
/**
 * Check if Ollama is running and accessible.
 */
async function checkConnection() {
    try {
        const response = await fetch(`${DEFAULT_ENDPOINT}/api/version`, {
            signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
            const data = await response.json();
            return { connected: true, version: data.version };
        }
        return { connected: false };
    }
    catch {
        return { connected: false };
    }
}
/**
 * List available Ollama models.
 */
async function listModels() {
    try {
        const response = await fetch(`${DEFAULT_ENDPOINT}/api/tags`);
        if (!response.ok)
            return [];
        const data = await response.json();
        return (data.models || []).map((m) => m.name);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=ai-service.js.map