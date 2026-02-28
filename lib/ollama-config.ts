/**
 * Centralized Ollama configuration.
 *
 * All AI-related components read the endpoint from here instead of
 * scattering hardcoded URLs across the codebase.
 */

export const OLLAMA_DEFAULT_ENDPOINT = "http://localhost:11434"
export const OLLAMA_DEFAULT_MODEL = "deepseek-coder:6.7b"

const SETTINGS_KEY = "tesserin:settings"

/**
 * Read the Ollama endpoint from persisted settings, falling back to the default.
 */
export function getOllamaEndpoint(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const settings = JSON.parse(raw)
      const endpoint = settings["ai.ollamaEndpoint"]
      if (typeof endpoint === "string" && endpoint.trim()) {
        return endpoint.trim()
      }
    }
  } catch {
    // Settings corrupted — use default
  }
  return OLLAMA_DEFAULT_ENDPOINT
}

/**
 * Read the default AI model from persisted settings.
 */
export function getOllamaModel(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const settings = JSON.parse(raw)
      const model = settings["ai.defaultModel"]
      if (typeof model === "string" && model.trim()) {
        return model.trim()
      }
    }
  } catch {
    // Settings corrupted — use default
  }
  return OLLAMA_DEFAULT_MODEL
}
