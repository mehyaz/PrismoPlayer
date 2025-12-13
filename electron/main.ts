import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { dialog } from 'electron'
import { spawn } from 'child_process'
import { getParentsGuide, searchMovie, getSeriesDetails } from './scraper'
import { startTorrent, stopTorrent, clearCache, updateTorrentSettings, stopActiveTorrent } from './torrent-handler'
import { searchTorrent, getTorrentList } from './torrent-search'
import { torrentEmitter } from './event-emitter'
import { getSettings, saveSettings } from './settings-manager'
import { listSubtitles, downloadSubtitle } from './subtitle-handler'
import { scanFolder } from './library-scanner'
import * as fs from 'fs';
import {
  getProfiles,
  saveProfiles,
  getActiveProfile,
  setActiveProfile,
  setParentalPin,
  verifyParentalPin,
  isPinSet
} from './family-profiles'
import {
  getCustomBlockedWords,
  addBlockedWord,
  removeBlockedWord
} from './safety-manager'
import { getSafetyManager } from './safety-manager'
import { getTMDBCertification } from './tmdb-helper';

// The built directory structure
// In CJS build, __dirname is automatically available and points to dist-electron/
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
      preload: path.join(__dirname, 'preload.cjs'),
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
    clearCache();
    app.quit()
    win = null
  }
})

app.on('will-quit', () => {
  clearCache();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ipcMain.handle('dialog:openFile', async () => {
    // dialog imported at top
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

  ipcMain.handle('get-series-details', async (_, imdbId) => {
    return await getSeriesDetails(imdbId);
  });

  ipcMain.handle('start-torrent', async (_, magnetLink, fileIndex) => {
    return await startTorrent(magnetLink, fileIndex);
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

  ipcMain.handle('list-torrents', async (_, query, imdbId, type) => {
    return await getTorrentList(query, imdbId, type);
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

  // --- Library IPC ---
  ipcMain.handle('library:open-folder', async () => {
    // dialog imported at top
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths;
    }
    return [];
  });

  ipcMain.handle('library:scan-folder', async (_, folderPath) => {
    return await scanFolder(folderPath);
  });

  // --- Family Safety IPC ---
  ipcMain.handle('family:get-profiles', async () => {
    return getProfiles();
  });

  ipcMain.handle('family:get-active-profile', async () => {
    return getActiveProfile();
  });

  ipcMain.handle('family:set-active-profile', async (_, profileId: string) => {
    return setActiveProfile(profileId);
  });

  ipcMain.handle('family:save-profiles', async (_, data: unknown) => {
    return saveProfiles(data as Partial<import('./family-profiles').ProfilesData>);
  });

  ipcMain.handle('family:set-pin', async (_, pin: string) => {
    return setParentalPin(pin);
  });

  ipcMain.handle('family:verify-pin', async (_, pin: string) => {
    return verifyParentalPin(pin);
  });

  ipcMain.handle('family:is-pin-set', async () => {
    return isPinSet();
  });

  // --- Smart Mute IPC ---  
  ipcMain.handle('safety:get-custom-words', async () => {
    return getCustomBlockedWords();
  });

  ipcMain.handle('safety:add-custom-word', async (_, word: string) => {
    return addBlockedWord(word);
  });

  ipcMain.handle('safety:remove-custom-word', async (_, word: string) => {
    return removeBlockedWord(word);
  });

  // Read file content (for subtitle analysis)
  ipcMain.handle('read-file', async (_, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error('[IPC] Failed to read file:', error);
      throw error;
    }
  });

  // Analyze subtitle content for profanity
  ipcMain.handle('safety:analyze-content', async (_, content: string) => {
    try {
      const safetyManager = getSafetyManager();
      const ranges = safetyManager.analyzeSubtitles(content);
      return ranges;
    } catch (error) {
      console.error('[IPC] Safety analysis failed:', error);
      return [];
    }
  });

  // Get TMDB certification for movie
  ipcMain.handle('tmdb:get-certification', async (_, tmdbId: string) => {
    try {
      return await getTMDBCertification(tmdbId);
    } catch (error) {
      console.error('[IPC] TMDB certification fetch failed:', error);
      return null;
    }
  });

  createWindow();
})
