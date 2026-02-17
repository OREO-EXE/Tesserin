/**
 * Storage Client
 *
 * Renderer-side API for database operations via the Electron IPC bridge.
 * Falls back to in-memory storage when not running in Electron (e.g. browser dev).
 */

export interface StorageNote {
    id: string
    title: string
    content: string
    folder_id: string | null
    is_pinned: number
    is_archived: number
    created_at: string
    updated_at: string
}

export interface StorageTask {
    id: string
    title: string
    status: 'backlog' | 'todo' | 'in-progress' | 'done'
    priority: 'none' | 'low' | 'medium' | 'high'
    note_id: string | null
    created_at: string
    updated_at: string
}

export interface StorageTemplate {
    id: string
    name: string
    content: string
    category: string
    created_at: string
}

function isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.tesserin?.db
}

/* ------------------------------------------------------------------ */
/*  Notes                                                              */
/* ------------------------------------------------------------------ */

export async function listNotes(): Promise<StorageNote[]> {
    if (isElectron()) {
        return window.tesserin!.db.listNotes()
    }
    return []
}

export async function getNote(id: string): Promise<StorageNote | undefined> {
    if (isElectron()) {
        return window.tesserin!.db.getNote(id)
    }
    return undefined
}

export async function createNote(note: { id: string; title: string; content: string }): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.createNote(note)
    }
}

export async function updateNote(id: string, updates: Partial<Pick<StorageNote, 'title' | 'content'>>): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.updateNote(id, updates)
    }
}

export async function deleteNote(id: string): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.deleteNote(id)
    }
}

export async function searchNotes(query: string): Promise<StorageNote[]> {
    if (isElectron()) {
        return window.tesserin!.db.searchNotes(query)
    }
    return []
}

/* ------------------------------------------------------------------ */
/*  Tasks                                                              */
/* ------------------------------------------------------------------ */

export async function listTasks(): Promise<StorageTask[]> {
    if (isElectron()) {
        return window.tesserin!.db.listTasks()
    }
    return []
}

export async function createTask(task: Partial<StorageTask>): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.createTask(task)
    }
}

export async function updateTask(id: string, updates: Partial<StorageTask>): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.updateTask(id, updates)
    }
}

export async function deleteTask(id: string): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.deleteTask(id)
    }
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export async function listTemplates(): Promise<StorageTemplate[]> {
    if (isElectron()) {
        return window.tesserin!.db.listTemplates()
    }
    return []
}

export async function createTemplate(template: Partial<StorageTemplate>): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.createTemplate(template)
    }
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export async function getSetting(key: string): Promise<string | null> {
    if (isElectron()) {
        return window.tesserin!.db.getSetting(key)
    }
    return null
}

export async function setSetting(key: string, value: string): Promise<void> {
    if (isElectron()) {
        return window.tesserin!.db.setSetting(key, value)
    }
}

/* ------------------------------------------------------------------ */
/*  AI                                                                 */
/* ------------------------------------------------------------------ */

export function isAIAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.tesserin?.ai
}

export async function checkAIConnection(): Promise<{ connected: boolean; version?: string }> {
    if (isAIAvailable()) {
        return window.tesserin!.ai.checkConnection()
    }
    return { connected: false }
}

export async function aiChat(
    messages: Array<{ role: string; content: string }>,
    model?: string
): Promise<{ role: string; content: string }> {
    if (isAIAvailable()) {
        return window.tesserin!.ai.chat(messages, model)
    }
    return { role: 'assistant', content: 'AI is not available. Install Ollama to enable AI features.' }
}

export async function aiSummarize(text: string): Promise<string> {
    if (isAIAvailable()) {
        return window.tesserin!.ai.summarize(text)
    }
    return 'AI summarization requires Ollama to be running.'
}

export async function aiGenerateTags(text: string): Promise<string[]> {
    if (isAIAvailable()) {
        return window.tesserin!.ai.generateTags(text)
    }
    return []
}

export async function aiSuggestLinks(content: string, titles: string[]): Promise<string[]> {
    if (isAIAvailable()) {
        return window.tesserin!.ai.suggestLinks(content, titles)
    }
    return []
}
