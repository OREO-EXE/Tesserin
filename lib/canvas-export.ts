/**
 * Canvas Export Utilities
 *
 * Programmatic export helpers for the Excalidraw canvas engine.
 * Used by MainMenu items inside CreativeCanvas to provide:
 *   - PNG  (rasterised via exportToBlob)
 *   - SVG  (vector via exportToSvg)
 *   - JSON (.excalidraw scene via serializeAsJSON)
 *   - Clipboard (PNG copy via exportToClipboard)
 *
 * Works with Electron's native save-file dialog when available,
 * falls back to browser download in Vite dev / web builds.
 */

import { getExcalidrawAPI } from "@/lib/canvas-store"

/* ── helpers ──────────────────────────────────────────── */

function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.tesserin?.dialog
}

function safeName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase() || "canvas"
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadString(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(blob, filename)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Pull current scene data from the shared Excalidraw API ref. */
function getCanvasData() {
  const api = getExcalidrawAPI()
  if (!api) throw new Error("Canvas not available")

  const appState = api.getAppState()
  const elements = api.getSceneElements()
  const files = api.getFiles ? api.getFiles() : {}

  return { elements, appState, files }
}

/* ── public export functions ─────────────────────────── */

/** Export the current canvas as a PNG file. */
export async function exportCanvasPNG(canvasName?: string): Promise<void> {
  const { exportToBlob } = await import("@excalidraw/excalidraw")
  const { elements, appState, files } = getCanvasData()

  const blob = await exportToBlob({
    elements,
    appState: {
      ...appState,
      exportWithDarkMode: appState.theme === "dark",
      exportBackground: true,
      exportScale: 2,
    },
    files,
  })

  const filename = `${safeName(canvasName || "canvas")}.png`

  if (isElectron()) {
    const filePath = await window.tesserin!.dialog!.saveFile({
      title: "Export Canvas as PNG",
      defaultPath: filename,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    })
    if (filePath) {
      const base64 = await blobToBase64(blob)
      await window.tesserin!.fs!.writeBuffer(filePath, base64)
    }
  } else {
    downloadBlob(blob, filename)
  }
}

/** Export the current canvas as an SVG file. */
export async function exportCanvasSVG(canvasName?: string): Promise<void> {
  const { exportToSvg } = await import("@excalidraw/excalidraw")
  const { elements, appState, files } = getCanvasData()

  const svg = await exportToSvg({
    elements,
    appState: {
      ...appState,
      exportWithDarkMode: appState.theme === "dark",
      exportBackground: true,
    },
    files,
  })

  const svgString = new XMLSerializer().serializeToString(svg)
  const filename = `${safeName(canvasName || "canvas")}.svg`

  if (isElectron()) {
    const filePath = await window.tesserin!.dialog!.saveFile({
      title: "Export Canvas as SVG",
      defaultPath: filename,
      filters: [{ name: "SVG Image", extensions: ["svg"] }],
    })
    if (filePath) {
      await window.tesserin!.fs!.writeFile(filePath, svgString)
    }
  } else {
    downloadString(svgString, filename, "image/svg+xml")
  }
}

/** Export the current canvas as a .excalidraw JSON file. */
export async function exportCanvasJSON(canvasName?: string): Promise<void> {
  const { serializeAsJSON } = await import("@excalidraw/excalidraw")
  const { elements, appState, files } = getCanvasData()

  const json = serializeAsJSON(elements, appState, files, "local")
  const filename = `${safeName(canvasName || "canvas")}.excalidraw`

  if (isElectron()) {
    const filePath = await window.tesserin!.dialog!.saveFile({
      title: "Export Canvas as Excalidraw File",
      defaultPath: filename,
      filters: [
        { name: "Excalidraw File", extensions: ["excalidraw"] },
        { name: "JSON File", extensions: ["json"] },
      ],
    })
    if (filePath) {
      await window.tesserin!.fs!.writeFile(filePath, json)
    }
  } else {
    downloadString(json, filename, "application/json")
  }
}

/** Copy the current canvas to the clipboard as a PNG image. */
export async function exportCanvasClipboard(): Promise<void> {
  const { exportToClipboard } = await import("@excalidraw/excalidraw")
  const { elements, appState, files } = getCanvasData()

  await exportToClipboard({
    elements,
    appState: {
      ...appState,
      exportWithDarkMode: appState.theme === "dark",
      exportBackground: true,
    },
    files,
    type: "png",
  })
}
