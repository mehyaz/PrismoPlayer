import { createRequire } from 'node:module';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
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

export const clearCache = () => {
    try {
        console.log('[Cache] Manual cache clear requested.');
        client.torrents.forEach((t: any) => t.destroy());
        activeMagnetLink = null;
        
        if (fs.existsSync(cachePath)) {
             const files = fs.readdirSync(cachePath);
             for (const file of files) {
                 fs.rmSync(path.join(cachePath, file), { recursive: true, force: true });
             }
        }
        console.log('[Cache] Cache cleared successfully.');
        return true;
    } catch (err) {
        console.error('[Cache] Failed to clear cache:', err);
        throw err;
    }
};

const getDirSize = (dirPath: string): number => {
    let size = 0;
    try {
        if (!fs.existsSync(dirPath)) return 0;
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                size += getDirSize(filePath);
            } else {
                size += stats.size;
            }
        }
    } catch (err) {
        console.error(`[Cache] Error calculating size for ${dirPath}:`, err);
    }
    return size;
};

const enforceQuota = () => {
    const settings = getSettings();
    const maxCacheBytes = settings.cacheLimitGB * 1024 * 1024 * 1024;
    
    console.log(`[Cache] Checking quota. Limit: ${settings.cacheLimitGB} GB`);
    let currentSize = getDirSize(cachePath);
    console.log(`[Cache] Current size: ${(currentSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

    if (currentSize <= maxCacheBytes) {
        console.log('[Cache] Quota OK.');
        return;
    }

    console.log('[Cache] Quota exceeded. cleaning up old files...');

    try {
        const items = fs.readdirSync(cachePath).map(file => {
            const filePath = path.join(cachePath, file);
            return {
                path: filePath,
                stats: fs.statSync(filePath)
            };
        });

        items.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());

        for (const item of items) {
            if (currentSize <= maxCacheBytes) break;

            console.log(`[Cache] Deleting old item: ${item.path}`);
            if (item.stats.isDirectory()) {
                const dirSize = getDirSize(item.path);
                fs.rmSync(item.path, { recursive: true, force: true });
                currentSize -= dirSize;
            } else {
                fs.unlinkSync(item.path);
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
    client.destroy((err: Error | null) => {
        if (err) console.error('[Cache] Error destroying client:', err);
        else console.log('[Cache] WebTorrent client destroyed.');
        enforceQuota();
    });
};

export const stopActiveTorrent = () => {
    if (activeMagnetLink) {
        console.log(`[Torrent] Stopping active torrent: ${activeMagnetLink}`);
        stopTorrent(activeMagnetLink);
        activeMagnetLink = null;
    }
};

export const startTorrent = (magnetLink: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`[Torrent] startTorrent called`);

        // 1. Stop any previously active torrent (Zombie prevention)
        // BUT: Do NOT stop if it's the same magnet link we want to play (Resume scenario)
        if (activeMagnetLink && activeMagnetLink !== magnetLink) {
            console.log(`[Torrent] Stopping previous active torrent...`);
            stopTorrent(activeMagnetLink);
        }
        activeMagnetLink = magnetLink;

        const existingUrl = torrentServerMap.get(magnetLink);
        if (existingUrl) {
            console.log(`[Torrent] Reusing existing server URL: ${existingUrl}`);
            return resolve(existingUrl);
        }

        const createServerFromTorrent = (torrent: any) => {
            // Double check if server map was updated in race condition
            if (torrentServerMap.has(magnetLink)) {
                 return resolve(torrentServerMap.get(magnetLink)!);
            }

            // Handle server creation carefully to avoid EADDRINUSE
            try {
                const server = torrent.createServer();
                server.listen(0, () => {
                    const address = server.address();
                    if (!address || typeof address === 'string') {
                        return reject(new Error('Server address is not available.'));
                    }
                    const port = address.port;
                    
                    const videoFileIndex = torrent.files.reduce((bestIdx: number, file: any, idx: number) => {
                        const isVideo = /\.(mp4|mkv|avi|webm)$/i.test(file.name);
                        if (!isVideo) return bestIdx;
                        if (bestIdx === -1) return idx;
                        return torrent.files[idx].length > torrent.files[bestIdx].length ? idx : bestIdx;
                    }, -1);
                    
                    const finalUrl = `http://localhost:${port}/${videoFileIndex !== -1 ? videoFileIndex : 0}`;
                    console.log(`[Torrent] Server created at ${finalUrl}`);
                    torrentServerMap.set(magnetLink, finalUrl);
                    resolve(finalUrl);
                });

                server.on('error', (err: Error) => {
                    console.error('[Torrent] Server error:', err);
                    // If server fails (e.g. port issue), we might reject, but usually retry handled by OS for port 0
                });
            } catch (err) {
                console.error('[Torrent] Error creating server:', err);
                // If we can't create server, we can't stream
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
        torrent.destroy();
        torrentServerMap.delete(magnetLink);
        console.log(`[Torrent] Stopped client activity for ${magnetLink}`);
    }
};