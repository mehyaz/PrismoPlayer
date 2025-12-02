import { createRequire } from 'node:module';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { TorrentProgress } from '../src/types';
import { torrentEmitter } from './event-emitter';

const require = createRequire(import.meta.url);
const WebTorrent = require('webtorrent');

// --- Configuration ---
const CACHE_DIR_NAME = 'PrismoPlayerCache';
const MAX_CACHE_SIZE_GB = 15;
const MAX_CACHE_BYTES = MAX_CACHE_SIZE_GB * 1024 * 1024 * 1024;
const UPLOAD_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB/s upload limit to prevent network choking

const cachePath = path.join(app.getPath('userData'), CACHE_DIR_NAME);

// Ensure cache directory exists
if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
}

// Initialize WebTorrent with limits
const client = new WebTorrent({
    // maxConns: 55,        // Optional: Limit connections
    uploadLimit: UPLOAD_LIMIT_BYTES,
});

const torrentServerMap = new Map<string, string>();

/**
 * Calculates the total size of a directory recursively.
 */
const getDirSize = (dirPath: string): number => {
    let size = 0;
    try {
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

/**
 * Enforces the cache quota by deleting the oldest files/folders 
 * until the total size is within the limit.
 */
const enforceQuota = () => {
    console.log(`[Cache] Checking quota. Limit: ${MAX_CACHE_SIZE_GB} GB`);
    let currentSize = getDirSize(cachePath);
    console.log(`[Cache] Current size: ${(currentSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

    if (currentSize <= MAX_CACHE_BYTES) {
        console.log('[Cache] Quota OK.');
        return;
    }

    console.log('[Cache] Quota exceeded. cleaning up old files...');

    try {
        // Get all items in cache with their stats
        const items = fs.readdirSync(cachePath).map(file => {
            const filePath = path.join(cachePath, file);
            return {
                path: filePath,
                stats: fs.statSync(filePath)
            };
        });

        // Sort by modification time (oldest first)
        items.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());

        for (const item of items) {
            if (currentSize <= MAX_CACHE_BYTES) break;

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
    
    // Stop all torrents gracefully
    client.destroy((err: Error | null) => {
        if (err) console.error('[Cache] Error destroying client:', err);
        else console.log('[Cache] WebTorrent client destroyed.');
        
        // Instead of wiping everything, we enforce the quota
        // This allows "Resume" functionality for recent movies
        enforceQuota();
    });
};

export const startTorrent = (magnetLink: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`[Torrent] startTorrent called`);

        const existingUrl = torrentServerMap.get(magnetLink);
        if (existingUrl) {
            console.log(`[Torrent] Reusing existing server URL: ${existingUrl}`);
            return resolve(existingUrl);
        }

        // Helper to setup server
        const createServerFromTorrent = (torrent: any) => {
            if (torrentServerMap.has(magnetLink)) {
                 return resolve(torrentServerMap.get(magnetLink)!);
            }

            const server = torrent.createServer();
            server.listen(0, () => {
                const address = server.address();
                if (!address || typeof address === 'string') {
                    return reject(new Error('Server address is not available.'));
                }
                const port = address.port;
                
                // Find largest video file
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
            });
        };

        // Check if already added
        const existingTorrent = client.torrents.find((t: any) => {
            return t.magnetURI === magnetLink || magnetLink.includes(t.infoHash);
        });

        if (existingTorrent) {
            console.log(`[Torrent] Found existing torrent in client`);
            if (existingTorrent.ready) {
                createServerFromTorrent(existingTorrent);
            } else {
                existingTorrent.once('ready', () => createServerFromTorrent(existingTorrent));
            }
            return;
        }

        // Add new torrent
        const torrentInstance = client.add(magnetLink, {
            path: cachePath, // Save to our persistent cache folder
        });

        torrentInstance.on('error', (error: Error) => {
            console.error('[Torrent] Torrent Error:', error);
            // Don't reject immediately on minor errors, but log
        });

        torrentInstance.once('ready', () => {
            console.log(`[Torrent] Metadata ready. Name: ${torrentInstance.name}`);
            createServerFromTorrent(torrentInstance);
            
            // Setup progress emission
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
    });
};

export const stopTorrent = (magnetLink: string) => {
    const torrent = client.get(magnetLink);
    if (torrent) {
        // We don't destroy the torrent file from disk here, 
        // we just stop seeding/downloading in the client
        torrent.destroy();
        torrentServerMap.delete(magnetLink);
        console.log(`[Torrent] Stopped client activity for ${magnetLink}`);
    }
};
