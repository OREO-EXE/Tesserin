/**
 * Type declarations for the Tesserin Electron API
 * exposed via contextBridge in preload.ts
 */

interface TesserinDB {
    // Notes
    listNotes(): Promise<any[]>
    getNote(id: string): Promise<any>
    createNote(note: { id: string; title: string; content: string }): Promise<void>
    updateNote(id: string, updates: Record<string, any>): Promise<void>
    deleteNote(id: string): Promise<void>
    searchNotes(query: string): Promise<any[]>

    // Tags
    listTags(): Promise<any[]>
    createTag(tag: { id: string; name: string; color?: string }): Promise<void>

    // Folders
    listFolders(): Promise<any[]>
    createFolder(folder: { id: string; name: string; parent_id?: string }): Promise<void>

    // Tasks
    listTasks(): Promise<any[]>
    createTask(task: Record<string, any>): Promise<void>
    updateTask(id: string, updates: Record<string, any>): Promise<void>
    deleteTask(id: string): Promise<void>

    // Templates
    listTemplates(): Promise<any[]>
    createTemplate(template: Record<string, any>): Promise<void>

    // Settings
    getSetting(key: string): Promise<string | null>
    setSetting(key: string, value: string): Promise<void>
}

interface TesserinAI {
    chat(
        messages: Array<{ role: string; content: string }>,
        model?: string
    ): Promise<{ role: string; content: string }>

    chatStream(
        messages: Array<{ role: string; content: string }>,
        model?: string
    ): {
        onChunk: (callback: (chunk: string) => void) => void
        onDone: (callback: () => void) => void
        onError: (callback: (error: string) => void) => void
    }

    summarize(text: string, model?: string): Promise<string>
    generateTags(text: string, model?: string): Promise<string[]>
    suggestLinks(content: string, titles: string[], model?: string): Promise<string[]>
    checkConnection(): Promise<{ connected: boolean; version?: string }>
    listModels(): Promise<string[]>
}

interface TesserinWindow {
    minimize(): void
    maximize(): void
    close(): void
}

interface TesserinAPI {
    db: TesserinDB
    ai: TesserinAI
    window: TesserinWindow
}

declare global {
    interface Window {
        tesserin?: TesserinAPI
    }
}

export { }
