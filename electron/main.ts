import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { initDatabase } from './database'
import { startMcpServerStdio } from './mcp-server'

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// If launched with --mcp flag, run as MCP server on stdio and exit
if (process.argv.includes('--mcp')) {
  startMcpServerStdio().catch((err) => {
    console.error('[Tesserin] Failed to start MCP server:', err)
    process.exit(1)
  })
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Load the Vite dev server in development, or the bundled app in production
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Frameless window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
}

app.whenReady().then(() => {
  // Initialize SQLite database (non-fatal — app works without it via in-memory fallback)
  try {
    initDatabase()
    console.log('[Tesserin] SQLite database initialized successfully')
  } catch (err) {
    console.error('[Tesserin] Failed to initialize SQLite database:', err)
    console.error('[Tesserin] App will continue with in-memory storage fallback')
  }

  // Register all IPC handlers (DB, AI, FS)
  try {
    registerIpcHandlers()
    console.log('[Tesserin] IPC handlers registered')
  } catch (err) {
    console.error('[Tesserin] Failed to register IPC handlers:', err)
  }

  // Create the main window
  createWindow()
  console.log('[Tesserin] Window created, loading', isDev ? 'http://localhost:5173' : 'dist/index.html')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
