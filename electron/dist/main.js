"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipc_handlers_1 = require("./ipc-handlers");
const database_1 = require("./database");
// Determine if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        frame: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: '#050505',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    // Load the Vite dev server in development, or the bundled app in production
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Frameless window controls
    electron_1.ipcMain.on('window:minimize', () => mainWindow?.minimize());
    electron_1.ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on('window:close', () => mainWindow?.close());
    electron_1.ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
}
electron_1.app.whenReady().then(() => {
    // Initialize SQLite database (non-fatal — app works without it via in-memory fallback)
    try {
        (0, database_1.initDatabase)();
        console.log('[Tesserin] SQLite database initialized successfully');
    }
    catch (err) {
        console.error('[Tesserin] Failed to initialize SQLite database:', err);
        console.error('[Tesserin] App will continue with in-memory storage fallback');
    }
    // Register all IPC handlers (DB, AI, FS)
    try {
        (0, ipc_handlers_1.registerIpcHandlers)();
        console.log('[Tesserin] IPC handlers registered');
    }
    catch (err) {
        console.error('[Tesserin] Failed to register IPC handlers:', err);
    }
    // Create the main window
    createWindow();
    console.log('[Tesserin] Window created, loading', isDev ? 'http://localhost:5173' : 'dist/index.html');
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
//# sourceMappingURL=main.js.map