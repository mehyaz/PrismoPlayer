import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'child_process'
import { getParentsGuide, searchMovie } from './scraper'
import { startTorrent, stopTorrent, cleanupCache, updateTorrentSettings, clearCache, stopActiveTorrent } from './torrent-handler'
import { searchTorrent, getTorrentList } from './torrent-search'
import { torrentEmitter } from './event-emitter'
import { getSettings, saveSettings } from './settings-manager'
import { listSubtitles, downloadSubtitle } from './subtitle-handler'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
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

// Helper to open VLC
const openInVlc = (url: string) => {
    let command = 'vlc';
    const args = [url];

    if (process.platform === 'darwin') {
        command = '/Applications/VLC.app/Contents/MacOS/VLC';
    } else if (process.platform === 'win32') {
        command = 'vlc'; 
    }

    console.log(`[VLC] Opening ${url} with ${command}`);
    try {
        const child = spawn(command, args, { detached: true, stdio: 'ignore' });
        child.on('error', (err) => {
            console.error('[VLC] Failed to start VLC:', err);
        });
        child.unref();
        return true;
    } catch (err) {
        console.error('[VLC] Error spawning process:', err);
        return false;
    }
};

// Quit when all windows are closed
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

  ipcMain.handle('open-in-vlc', async (_, url) => {
    return openInVlc(url);
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

  ipcMain.handle('stop-active-torrent', async () => {
    return stopActiveTorrent();
  });

  ipcMain.handle('search-torrent', async (_, query, quality) => {
    return await searchTorrent(query, quality);
  });

  ipcMain.handle('list-torrents', async (_, query) => {
    return await getTorrentList(query);
  });

  ipcMain.handle('list-subtitles', async (_, imdbId) => {
    return await listSubtitles(imdbId);
  });

  ipcMain.handle('download-subtitle', async (_, item, imdbId) => {
    return await downloadSubtitle(item, imdbId);
  });

  // --- Settings IPC ---
  ipcMain.handle('get-settings', async () => {
    return getSettings();
  });

  ipcMain.handle('save-settings', async (_, newSettings) => {
    const saved = saveSettings(newSettings);
    if (saved) {
      // Apply changes immediately where applicable
      updateTorrentSettings(saved);
    }
    return saved;
  });

  ipcMain.handle('clear-cache', async () => {
    try {
      return clearCache();
    } catch (e) {
      console.error('Failed to clear cache via IPC', e);
      throw e;
    }
  });

  createWindow();
})
