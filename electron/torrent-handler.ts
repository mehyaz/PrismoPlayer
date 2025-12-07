import { createRequire } from 'node:module';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { TorrentProgress } from '../src/types';
import { torrentEmitter } from './event-emitter';
import { getSettings, AppSettings } from './settings-manager';

const require = createRequire(import.meta.url);
const WebTorrent = require('webtorrent');

// Configuration (Defaults, overridden by settings)
const CACHE_DIR_NAME = 'PrismoPlayerCache';
const cachePath = path.join(app.getPath('userData'), CACHE_DIR_NAME);

// Ensure cache directory exists
if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
}

// Initialize WebTorrent with initial settings
const initialSettings = getSettings();
const client = new WebTorrent({
    uploadLimit: initialSettings.uploadLimitKB * 1024,
});

const torrentServerMap = new Map<string, string>();

// Track the currently active (streaming) torrent
let activeMagnetLink: string | null = null;

// Allow updating settings on the fly
export const updateTorrentSettings = (newSettings: AppSettings) => {
    if (client) {
        client.uploadLimit = newSettings.uploadLimitKB * 1024;
        console.log(`[Torrent] Updated upload limit to ${newSettings.uploadLimitKB} KB/s`);
    }
};

export const clearCache = async () => {
    try {
        console.log('[Cache] Manual cache clear requested.');
        client.torrents.forEach((t: any) => t.destroy());
        activeMagnetLink = null;

        try {
            await fsPromises.rm(cachePath, { recursive: true, force: true });
            await fsPromises.mkdir(cachePath, { recursive: true });
        } catch (err) {
            console.error('[Cache] Failed to remove/recreate cache dir:', err);
        }

        console.log('[Cache] Cache cleared successfully.');
        return true;
    } catch (err) {
        console.error('[Cache] Failed to clear cache:', err);
        throw err;
    }
};

const getDirSize = async (dirPath: string): Promise<number> => {
    let size = 0;
    try {
        const stats = await fsPromises.stat(dirPath).catch(() => null);
        if (!stats) return 0;

        if (stats.isDirectory()) {
            const files = await fsPromises.readdir(dirPath);
            const sizes = await Promise.all(files.map(file => getDirSize(path.join(dirPath, file))));
            size = sizes.reduce((acc, s) => acc + s, 0);
        } else {
            size = stats.size;
        }
    } catch (err) {
        console.error(`[Cache] Error calculating size for ${dirPath}:`, err);
    }
    return size;
};

const enforceQuota = async () => {
    const settings = getSettings();
    const maxCacheBytes = settings.cacheLimitGB * 1024 * 1024 * 1024;

    console.log(`[Cache] Checking quota. Limit: ${settings.cacheLimitGB} GB`);
    let currentSize = await getDirSize(cachePath);
    console.log(`[Cache] Current size: ${(currentSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

    if (currentSize <= maxCacheBytes) {
        console.log('[Cache] Quota OK.');
        return;
    }

    console.log('[Cache] Quota exceeded. cleaning up old files...');

    try {
        const files = await fsPromises.readdir(cachePath);
        const items = await Promise.all(files.map(async (file) => {
            const filePath = path.join(cachePath, file);
            const stats = await fsPromises.stat(filePath);
            return {
                path: filePath,
                stats
            };
        }));

        items.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());

        for (const item of items) {
            if (currentSize <= maxCacheBytes) break;

            console.log(`[Cache] Deleting old item: ${item.path}`);
            if (item.stats.isDirectory()) {
                const dirSize = await getDirSize(item.path);
                await fsPromises.rm(item.path, { recursive: true, force: true });
                currentSize -= dirSize;
            } else {
                await fsPromises.unlink(item.path);
                currentSize -= item.stats.size;
            }
        }
        console.log(`[Cache] Cleanup complete. New size: ${(currentSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    } catch (err) {
        console.error('[Cache] Error during quota cleanup:', err);
    }
};

export const cleanupCache = () => {
    console.log('[Cache] Application closing. Destroying client and enforcing quota...');
    // We can't use async/await easily in app.on('will-quit') as it doesn't wait for promises by default
    // unless we preventDefault, but simpler here is to just try to clean up what we can or rely on next startup.
    // However, client.destroy is synchronous or callback-based. 
    // We will do best effort synchronous cleanup if needed, or trigger async for next run.

    // For quota enforcement, it's safer to run it on startup or periodic intervals rather than on quit,
    // as quit can be abrupt. But if we must, we try to keep it simple.
    // Given the async refactor, we'll delegate quota enforcement to a detached process or just skip on quit 
    // and rely on the start-of-stream check or startup check (not implemented yet, but safe enough).

    client.destroy((err: Error | null) => {
        if (err) console.error('[Cache] Error destroying client:', err);
        else console.log('[Cache] WebTorrent client destroyed.');
        // We'll skip enforceQuota on quit to prevent race conditions with app exit
        // verifyQuota should ideally run on app start or periodically.
        enforceQuota().catch(e => console.error(e));
    });
};

export const stopActiveTorrent = () => {
    if (activeMagnetLink) {
        console.log(`[Torrent] Stopping active torrent: ${activeMagnetLink}`);
        stopTorrent(activeMagnetLink);
        activeMagnetLink = null;
    }
};

export const startTorrent = (magnetLink: string, fileIndex?: number): Promise<string | { status: 'select-files', files: { name: string, index: number, size: number }[] }> => {
    return new Promise((resolve, reject) => {
        console.log(`[Torrent] startTorrent called. Index: ${fileIndex}`);

        // 1. Stop any previously active torrent (Zombie prevention)
        // BUT: Do NOT stop if it's the same magnet link we want to play (Resume scenario)
        // AND we are not just switching files in the same torrent
        if (activeMagnetLink && activeMagnetLink !== magnetLink) {
            console.log(`[Torrent] Stopping previous active torrent...`);
            stopTorrent(activeMagnetLink);
        }
        activeMagnetLink = magnetLink;

        // If reusing existing server with a specific file index potentially?
        // Current implementation reusing URL map might be tricky if we want to switch files.
        // For simplicity, if fileIndex is provided, we might want to recreate server or update it?
        // WebTorrent server usually serves all files, just the URL path changes.
        // So checking torrentServerMap might be enough if we just append the index to the base URL...
        // BUT the previous implementation stored the full URL including index.
        // Let's modify map storage to store BASE url or check if we can reuse.

        // Actually, easiest way is to re-evaluate the URL if fileIndex is passed.
        const existingUrl = torrentServerMap.get(magnetLink);
        if (existingUrl && fileIndex !== undefined) {
            // If we have an existing URL, we need to check if it matches the requested fileIndex.
            // The stored URL looks like: http://.../INDEX
            // If it doesn't match, we might just need to construct the new URL since server serves all.
            // But we don't store the PORT separately. 
            // Let's just create a new server instance for simplicity or parse the port.
            // Better: Store the SERVER instance or PORT in the map?
            // For now, let's proceed with standard logic: if we need to select file, we likely don't have a stable URL yet
            // OR we can just return the new URL if we can extract port.

            // To simplify: We will allow recreating server if fileIndex is changing, 
            // OR we just parse the port from existingURL if valid.
            const match = existingUrl.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
            if (match) {
                const newUrl = `http://127.0.0.1:${match[1]}/${fileIndex}`;
                console.log(`[Torrent] Switching file on existing server: ${newUrl}`);
                torrentServerMap.set(magnetLink, newUrl);
                return resolve(newUrl);
            }
        } else if (existingUrl && fileIndex === undefined) {
            // Reusing existing "default" or last played
            console.log(`[Torrent] Reusing existing server URL: ${existingUrl}`);
            return resolve(existingUrl);
        }

        const createServerFromTorrent = (torrent: any) => {
            // Check for video files
            const videoFiles = torrent.files.map((file: any, idx: number) => ({
                name: file.name,
                index: idx,
                size: file.length,
                isVideo: /\.(mp4|mkv|avi|webm|m4v)$/i.test(file.name)
            })).filter((f: any) => f.isVideo);

            // Sort by size desc
            videoFiles.sort((a: any, b: any) => b.size - a.size);

            if (videoFiles.length > 1 && fileIndex === undefined) {
                console.log(`[Torrent] Multiple video files found (${videoFiles.length}). Requesting selection.`);
                return resolve({
                    status: 'select-files',
                    files: videoFiles
                });
            }

            // Determine which file to play
            let targetIndex = -1;
            if (fileIndex !== undefined) {
                targetIndex = fileIndex;
            } else if (videoFiles.length > 0) {
                targetIndex = videoFiles[0].index; // Default to largest
            } else {
                // No video files? Just try largest file of any kind?
                targetIndex = torrent.files.reduce((bestIdx: number, file: any, idx: number) => {
                    return torrent.files[idx].length > torrent.files[bestIdx].length ? idx : bestIdx;
                }, 0);
            }

            // Handle server creation carefully to avoid EADDRINUSE
            try {
                // If server already exists for this torrent (we just didn't have the URL mapped correctly or whatever),
                // torrent.createServer might return new one or error?
                // WebTorrent torrent object doesn't expose existing server AFAIK easily.
                // But we can just create one.

                const server = torrent.createServer();
                // Bind strictly to localhost for security
                server.listen(0, '127.0.0.1', () => {
                    const address = server.address();
                    if (!address || typeof address === 'string') {
                        return reject(new Error('Server address is not available.'));
                    }
                    const port = address.port;

                    const finalUrl = `http://127.0.0.1:${port}/${targetIndex}`;
                    console.log(`[Torrent] Server created at ${finalUrl}`);
                    torrentServerMap.set(magnetLink, finalUrl);
                    resolve(finalUrl);
                });

                server.on('error', (err: Error) => {
                    console.error('[Torrent] Server error:', err);
                    reject(err);
                });
            } catch (err) {
                console.error('[Torrent] Error creating server:', err);
                reject(err);
            }
        };

        // 2. Check if torrent already exists in client
        const existingTorrent = client.get(magnetLink); // Much more reliable than .find()
        if (existingTorrent) {
            console.log(`[Torrent] Found existing torrent in client (client.get)`);
            if (existingTorrent.ready) {
                createServerFromTorrent(existingTorrent);
            } else {
                existingTorrent.once('ready', () => createServerFromTorrent(existingTorrent));
            }
            return;
        }

        // 3. Add new torrent safely
        try {
            const torrentInstance = client.add(magnetLink, {
                path: cachePath,
            });

            torrentInstance.on('error', (error: Error) => {
                // Handle duplicate torrent error gracefully if it occurs despite checks
                if (error.message && error.message.includes('duplicate torrent')) {
                    console.log('[Torrent] Caught duplicate error, recovering...');
                    const existing = client.get(magnetLink);
                    if (existing) {
                        createServerFromTorrent(existing);
                        return;
                    }
                }
                console.error('[Torrent] Torrent Error:', error);
                reject(error);
            });

            torrentInstance.once('ready', () => {
                console.log(`[Torrent] Metadata ready. Name: ${torrentInstance.name}`);
                createServerFromTorrent(torrentInstance);

                let lastUpdate = 0;
                const updateInterval = setInterval(() => {
                    if (torrentInstance.destroyed) {
                        clearInterval(updateInterval);
                        return;
                    }
                    const now = Date.now();
                    if (now - lastUpdate > 1000) {
                        const progress: TorrentProgress = {
                            downloadSpeed: torrentInstance.downloadSpeed,
                            progress: torrentInstance.progress,
                            numPeers: torrentInstance.numPeers,
                            downloaded: torrentInstance.downloaded,
                            length: torrentInstance.length
                        };
                        torrentEmitter.emit('torrent-progress', progress);
                        lastUpdate = now;
                    }
                }, 1000);
            });
        } catch (err: any) {
            // Catch synchronous errors from client.add
            if (err.message && err.message.includes('duplicate torrent')) {
                console.log('[Torrent] Caught synchronous duplicate error, recovering...');
                const existing = client.get(magnetLink);
                if (existing) {
                    if (existing.ready) createServerFromTorrent(existing);
                    else existing.once('ready', () => createServerFromTorrent(existing));
                    return;
                }
            }
            console.error('[Torrent] Failed to add torrent:', err);
            reject(err);
        }
    });
};

export const stopTorrent = (magnetLink: string) => {
    const torrent = client.get(magnetLink);
    if (torrent) {
        try {
            torrent.destroy();
        } catch (e) { console.error('Error destroying torrent', e); }
        torrentServerMap.delete(magnetLink);
        console.log(`[Torrent] Stopped client activity for ${magnetLink}`);
    }
};
