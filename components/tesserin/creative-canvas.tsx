import React, { useState, useEffect } from "react"
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw"
import "@excalidraw/excalidraw/index.css"
import { useTesserinTheme } from "./theme-provider"
import { TesserinLogo } from "./tesserin-logo"

/**
 * CreativeCanvas
 * 
 * enhanced with the official Excalidraw engine.
 * Provides infinite canvas, hand-drawn feel, and extensive diagramming features.
 * 
 * - Synced with Tesserin Theme (Obsidian Black / Ceramic White)
 * - Branding: Tesseradraw
 * - Feature: Mermaid to Excalidraw conversion
 */
export function CreativeCanvas() {
  const { isDark } = useTesserinTheme()
  const [compLoaded, setCompLoaded] = useState(false)
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)

  useEffect(() => {
    setCompLoaded(true)
  }, [])

  // Fix: Programmatically force background color and default styles on theme change
  useEffect(() => {
    if (!excalidrawAPI) return

    const bgColor = isDark ? "#050505" : "#ffffff"
    const strokeColor = isDark ? "#eab308" : "#000000"
    const elementBgColor = isDark ? "transparent" : "transparent"

    excalidrawAPI.updateScene({
      appState: {
        viewBackgroundColor: bgColor,
        theme: isDark ? "dark" : "light",
        currentItemStrokeColor: strokeColor,
        currentItemBackgroundColor: elementBgColor
      }
    })
  }, [isDark, excalidrawAPI])

  if (!compLoaded) {
    return <div className="w-full h-full flex items-center justify-center text-sm opacity-50">Loading Tesseradraw...</div>
  }

  return (
    <div className="w-full h-full creative-canvas-wrapper relative" style={{ isolation: "isolate" }}>
      {/* 
                We override some Excalidraw CSS variables to match Tesserin's specific Obsidian Black 
                palette when in dark mode.
             */}
      <style>{`
                .creative-canvas-wrapper .excalidraw {
                    --color-primary: var(--accent-primary) !important;
                    --color-primary-dark: var(--accent-pressed) !important;
                    font-family: inherit !important;
                }
                
                /* Skeuomorphic Toolbar */
                .creative-canvas-wrapper .excalidraw .App-toolbar-content {
                    background: var(--bg-panel) !important;
                    border: 1px solid var(--border-light) !important;
                    box-shadow: 
                        inset 0 1px 0 rgba(255, 255, 255, 0.05),
                        0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
                    border-radius: 12px !important;
                }

                /* Tool Buttons */
                .creative-canvas-wrapper .excalidraw .ToolIcon__icon {
                    border-radius: 8px !important;
                }
                
                .creative-canvas-wrapper .excalidraw .ToolIcon_type_radio:hover .ToolIcon__icon {
                    background: rgba(var(--accent-primary-rgb), 0.1) !important;
                }

                /* Force overrides for active tools (Radio & Button types) */
                .creative-canvas-wrapper .excalidraw .ToolIcon_type_radio:checked + .ToolIcon__icon,
                .creative-canvas-wrapper .excalidraw .ToolIcon__icon.active,
                .creative-canvas-wrapper .excalidraw .ToolIcon.active .ToolIcon__icon,
                .creative-canvas-wrapper .excalidraw .ToolIcon[aria-selected="true"] .ToolIcon__icon {
                    background: var(--accent-primary) !important;
                    color: #000 !important;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2) !important;
                }
                
                /* Properties Panel Active States */
                .creative-canvas-wrapper .excalidraw .AppState-property label.active,
                .creative-canvas-wrapper .excalidraw .AppState-property button.active,
                .creative-canvas-wrapper .excalidraw .color-picker__button.active,
                .creative-canvas-wrapper .excalidraw .buttonList label.active {
                    background-color: var(--accent-primary) !important;
                    color: #000 !important;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1) !important;
                    border-color: var(--accent-pressed) !important;
                }

                /* Dark Mode Specifics */
                ${isDark ? `
                    .creative-canvas-wrapper .excalidraw.theme--dark {
                        --color-surface-primary: #1e293b; 
                        --color-surface-secondary: #000000;
                        --canvas-background: #050505;
                    }
                    .creative-canvas-wrapper .App-menu_top {
                        background-color: #111 !important;
                        border-bottom: 1px solid #333 !important;
                    }
                    .creative-canvas-wrapper .App-bottom-bar {
                        display: none !important; /* Hide help/encryption text for cleaner look */
                    }
                ` : ``}
            `}</style>

      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        theme={isDark ? "dark" : "light"}
        aiEnabled={true}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: true,
            export: { saveFileToDisk: true },
            loadScene: true,
            saveToActiveFile: false,
            toggleTheme: false,
          }
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Center>
            <div className="flex flex-col items-center justify-center pointer-events-none select-none">
              <TesserinLogo size={64} animated />
              <h1 className="text-3xl font-bold mt-4 tracking-tight" style={{ color: "var(--text-primary)" }}>
                Tesseradraw
              </h1>
              <p className="text-sm opacity-60 mt-2">
                AI-Enhanced Creative Canvas
              </p>
            </div>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>
    </div>
  )
}
