import WebTorrent from 'webtorrent';

// Create a single WebTorrent client for the app
const client = new WebTorrent();

// Map to keep track of active torrent HTTP server URLs per magnet link
const torrentServerMap = new Map<string, string>();

/**
 * Starts a torrent given a magnet link and returns a URL to stream the largest video file.
 * If the torrent is already added, it reuses the existing HTTP server URL.
 */
export const startTorrent = (magnetLink: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`[Torrent] startTorrent called for: ${magnetLink}`);

        // If we already have a server URL for this magnet, reuse it
        const existingUrl = torrentServerMap.get(magnetLink);
        if (existingUrl) {
            console.log(`[Torrent] Reusing existing server URL: ${existingUrl}`);
            return resolve(existingUrl);
        }

        // Helper function to create server from torrent
        const createServerFromTorrent = (torrent: WebTorrent.Torrent) => {
            const server = torrent.createServer();
            server.listen(0, () => {
                const port = (server.address() as any).port;
                const videoFileIndex = torrent.files.reduce((bestIdx, file, idx) => {
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
            server.on('error', (err: any) => {
                console.error('[Torrent] Server error:', err);
                reject(err);
            });
        };

        // Try to find existing torrent by checking all torrents
        const existingTorrent = client.torrents.find(t => {
            // Check if this torrent matches our magnet link
            return t.magnetURI === magnetLink || magnetLink.includes(t.infoHash);
        }) as WebTorrent.Torrent | undefined;

        if (existingTorrent) {
            console.log(`[Torrent] Found existing torrent by scanning, reusing it`);
            createServerFromTorrent(existingTorrent);
            return;
        }

        // Add the torrent for the first time
        console.log(`[Torrent] Adding new torrent to client`);

        const torrentInstance = client.add(magnetLink);

        torrentInstance.once('error', (error: any) => {
            // Handle duplicate torrent error
            if (error.message && error.message.includes('Cannot add duplicate torrent')) {
                console.log(`[Torrent] Caught duplicate error, extracting info hash`);
                // Extract info hash from error message
                const match = error.message.match(/([a-f0-9]{40})/i);
                if (match) {
                    const infoHash = match[1];
                    console.log(`[Torrent] Info hash: ${infoHash}, searching for existing torrent`);
                    const torrent = client.get(infoHash) as unknown as WebTorrent.Torrent | undefined;
                    if (torrent) {
                        console.log(`[Torrent] Found existing torrent by info hash`);
                        createServerFromTorrent(torrent);
                        return;
                    }
                }
            }
            console.error('[Torrent] Error adding torrent:', error);
            reject(error);
        });

        torrentInstance.once('ready', () => {
            console.log(`[Torrent] Torrent added successfully`);
            createServerFromTorrent(torrentInstance);
        });
    });
};

/** Stops a torrent and removes its server URL from the map. */
export const stopTorrent = (magnetLink: string) => {
    const torrent = client.get(magnetLink) as unknown as WebTorrent.Torrent | undefined;
    if (torrent) {
        torrent.destroy();
        torrentServerMap.delete(magnetLink);
        console.log(`[Torrent] Stopped and cleaned up ${magnetLink}`);
    }
};
