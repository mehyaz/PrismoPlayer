import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getParentsGuide, searchMovie } from './scraper'
import { startTorrent, stopTorrent, cleanupCache } from './torrent-handler'
import { searchTorrent } from './torrent-search'
import { torrentEmitter } from './event-emitter'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    icon: path.join(process.env.VITE_PUBLIC, 'prismo-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow file:// protocol access
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Forward torrent progress to the renderer
  torrentEmitter.on('torrent-progress', (data) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('torrent-progress', data);
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.setTitle('Prismo - Premium Video Player')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    win.setTitle('Prismo')
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupCache();
    app.quit()
    win = null
  }
})

app.on('will-quit', () => {
  cleanupCache();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ipcMain.handle('dialog:openFile', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('search-movie', async (_, query) => {
    return await searchMovie(query);
  });

  ipcMain.handle('get-parents-guide', async (_, imdbId) => {
    return await getParentsGuide(imdbId);
  });

  ipcMain.handle('start-torrent', async (_, magnetLink) => {
    return await startTorrent(magnetLink);
  });

  ipcMain.handle('stop-torrent', async (_, magnetLink) => {
    return stopTorrent(magnetLink);
  });

  ipcMain.handle('search-torrent', async (_, query) => {
    return await searchTorrent(query);
  });

  createWindow();
})
