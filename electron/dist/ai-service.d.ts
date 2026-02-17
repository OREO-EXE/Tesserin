/**
 * Ollama AI Service
 *
 * HTTP client for the Ollama API running locally.
 * All AI operations run in the Electron main process.
 */
interface ChatMessage {
    role: string;
    content: string;
}
interface StreamCallbacks {
    onChunk: (chunk: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
}
/**
 * Send a non-streaming chat request to Ollama.
 */
export declare function chat(messages: ChatMessage[], model?: string): Promise<{
    role: string;
    content: string;
}>;
/**
 * Send a streaming chat request to Ollama.
 * Calls onChunk for each token, onDone when complete.
 */
export declare function chatStream(messages: ChatMessage[], model: string | undefined, callbacks: StreamCallbacks): Promise<void>;
/**
 * Summarize a block of text.
 */
export declare function summarize(text: string, model?: string): Promise<string>;
/**
 * Generate tags for a piece of content.
 */
export declare function generateTags(text: string, model?: string): Promise<string[]>;
/**
 * Suggest wiki-links for the current note content.
 */
export declare function suggestLinks(content: string, existingTitles: string[], model?: string): Promise<string[]>;
/**
 * Check if Ollama is running and accessible.
 */
export declare function checkConnection(): Promise<{
    connected: boolean;
    version?: string;
}>;
/**
 * List available Ollama models.
 */
export declare function listModels(): Promise<string[]>;
export {};
//# sourceMappingURL=ai-service.d.ts.map