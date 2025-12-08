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

const TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.openbittorrent.com:80/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
    'udp://glotorrents.pw:6969/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://p4p.arenabg.com:1337/announce',
    'udp://tracker.internetwarriors.net:1337/announce',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.openwebtorrent.com',
    'udp://9.rarbg.to:2710/announce',
    'udp://9.rarbg.me:2710/announce',
    'http://tracker.opentrackr.org:1337/announce'
];

const CACHE_DIR_NAME = 'PrismoPlayerCache';
const cachePath = path.join(app.getPath('userData'), CACHE_DIR_NAME);

if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
}

const initialSettings = getSettings();
const client = new WebTorrent({
    uploadLimit: initialSettings.uploadLimitKB * 1024,
    dht: true,
    pex: true,
    lsd: true
});

interface TorrentServer {
    listen: (port: number, callback: () => void) => void;
    address: () => { port: number };
    close: () => void;
    on: (event: string, handler: (err: Error) => void) => void;
}

interface TorrentFile {
    name: string;
    length: number;
    select: () => void;
}

interface WebTorrentInstance {
    files: TorrentFile[];
    createServer: () => TorrentServer;
    destroyed: boolean;
    ready: boolean;
    once: (event: string, handler: () => void) => void;
    on: (event: string, handler: (err?: Error) => void) => void;
    destroy: () => void;
    downloadSpeed: number;
    progress: number;
    numPeers: number;
    downloaded: number;
    length: number;
}

const torrentServerMap = new Map<string, TorrentServer>(); // Store server instance
let activeMagnetLink: string | null = null;

export const updateTorrentSettings = (newSettings: AppSettings) => {
    if (client) {
        client.uploadLimit = newSettings.uploadLimitKB * 1024;
    }
};

export const clearCache = async () => {
    interface MiniTorrent {
        destroy: () => void;
    }
    (client.torrents as MiniTorrent[]).forEach((t) => t.destroy());
    activeMagnetLink = null;
    torrentServerMap.clear();

    try {
        await fsPromises.rm(cachePath, { recursive: true, force: true });
        await fsPromises.mkdir(cachePath, { recursive: true });
    } catch (err) {
        console.error('[Cache] Failed to remove/recreate cache dir:', err);
    }
    return true;
};

export const stopActiveTorrent = () => {
    if (activeMagnetLink) {
        console.log(`[Torrent] Stopping active torrent: ${activeMagnetLink}`);
        const torrent = client.get(activeMagnetLink);
        if (torrent) {
            // Close server if exists
            const server = torrentServerMap.get(activeMagnetLink);
            if (server) {
                try {
                    server.close();
                } catch (e) {
                    console.error('[Torrent] Failed to close server:', e);
                }
                torrentServerMap.delete(activeMagnetLink);
            }
            torrent.destroy();
        }
        activeMagnetLink = null;
    }
};

export const startTorrent = (magnetLink: string, fileIndex?: number): Promise<string | { status: 'select-files'; files: { name: string; index: number }[] }> => {
    return new Promise((resolve, reject) => {
        console.log(`[Torrent] startTorrent called with fileIndex:`, fileIndex);

        if (activeMagnetLink && activeMagnetLink !== magnetLink) {
            stopActiveTorrent();
        }
        activeMagnetLink = magnetLink;

        const existingTorrent = client.get(magnetLink);

        // Helper to start server
        const startServer = (torrent: WebTorrentInstance) => {
            // Find video files
            const videoFiles = torrent.files.filter((file) =>
                /\.(mp4|mkv|avi|webm|m4v)$/i.test(file.name)
            );
            videoFiles.sort((a, b) => b.length - a.length);

            if (videoFiles.length === 0) {
                return reject(new Error('No video files found in torrent.'));
            }

            // If specific file index is provided, use it
            if (fileIndex !== undefined) {
                const selectedFile = torrent.files[fileIndex];
                if (!selectedFile) {
                    return reject(new Error(`File index ${fileIndex} not found`));
                }
                console.log(`[Torrent] Using specified file index ${fileIndex}: ${selectedFile.name}`);
                selectedFile.select();

                try {
                    const server = torrent.createServer();
                    server.listen(0, () => {
                        const port = server.address().port;
                        const url = `http://localhost:${port}/${fileIndex}`;
                        console.log(`[Torrent] Server ready at: ${url}`);
                        torrentServerMap.set(magnetLink, server);
                        resolve(url);
                    });

                    server.on('error', (err: Error) => {
                        console.error('[Torrent] Server error:', err);
                        reject(err);
                    });
                } catch (err) {
                    console.error('[Torrent] Failed to create server:', err);
                    reject(err);
                }
                return;
            }

            // If multiple video files, ask user to select
            if (videoFiles.length > 1) {
                console.log(`[Torrent] Multiple video files found (${videoFiles.length}), requesting user selection`);
                const fileList = videoFiles.map((file) => ({
                    name: file.name,
                    index: torrent.files.indexOf(file)
                }));
                resolve({ status: 'select-files' as const, files: fileList });
                return;
            }

            // Single video file, auto-select
            const file = videoFiles[0];
            console.log(`[Torrent] Auto-selected single file: ${file.name}`);

            // Select file for streaming (prioritize pieces)
            file.select();

            try {
                const server = torrent.createServer();
                server.listen(0, () => {
                    const port = server.address().port;
                    const url = `http://localhost:${port}/${torrent.files.indexOf(file)}`;
                    console.log(`[Torrent] Server ready at: ${url}`);

                    // Store server to close later
                    torrentServerMap.set(magnetLink, server);

                    resolve(url);
                });

                server.on('error', (err: Error) => {
                    console.error('[Torrent] Server error:', err);
                    reject(err);
                });

            } catch (err) {
                console.error('[Torrent] Failed to create server:', err);
                reject(err);
            }
        };

        if (existingTorrent) {
            if (existingTorrent.ready) {
                startServer(existingTorrent);
            } else {
                existingTorrent.once('ready', () => startServer(existingTorrent));
            }

            // Also ensure we are emitting progress
            setupProgress(existingTorrent);
            return;
        }

        // Add new torrent
        const torrent = client.add(magnetLink, {
            path: cachePath,
            announce: TRACKERS
        });

        torrent.on('error', (err: Error) => {
            console.error('[Torrent] Torrent error:', err);
            reject(err);
        });

        torrent.on('metadata', () => {
            console.log('[Torrent] Metadata downloaded.');
            console.log(`[Torrent] Total files: ${torrent.files.length}`);
            torrent.files.forEach((f: TorrentFile, i: number) => {
                console.log(`[Torrent]   File ${i}: ${f.name} (${(f.length / 1024 / 1024).toFixed(2)} MB)`);
            });
        });

        torrent.once('ready', () => {
            console.log('[Torrent] Torrent ready. Starting server...');
            startServer(torrent);
            setupProgress(torrent);
        });
    });
};

function setupProgress(torrent: WebTorrentInstance) {
    let lastUpdate = 0;
    const interval = setInterval(() => {
        if (torrent.destroyed) {
            clearInterval(interval);
            return;
        }
        const now = Date.now();
        if (now - lastUpdate > 1000) {
            const progress: TorrentProgress = {
                downloadSpeed: torrent.downloadSpeed,
                progress: torrent.progress,
                numPeers: torrent.numPeers,
                downloaded: torrent.downloaded,
                length: torrent.length
            };
            torrentEmitter.emit('torrent-progress', progress);
            lastUpdate = now;
        }
    }, 1000);
}

// Legacy export - Keep for backwards compatibility
export const stopTorrent = (/* _magnet: string */) => stopActiveTorrent();