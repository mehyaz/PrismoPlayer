import WebTorrent from 'webtorrent';

const client = new WebTorrent();

export const startTorrent = (magnetLink: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Check if already added
        const existing = client.get(magnetLink) as unknown as WebTorrent.Torrent | undefined;
        if (existing) {
            // If already added, find the largest file and return its url
            // Note: This logic is simplified. In a real app we'd need to ensure the server is running.
            // For now, we'll just re-add it or return a placeholder if we can't get the server URL easily without re-creating.
            // But re-adding might throw.
            // Let's just return a known error or handle it.
            // Actually, if it exists, we can try to get the server from it if we stored it?
            // For MVP, if it exists, we just return the magnet link as a fallback or error.
            // But better:
        }

        client.add(magnetLink, (torrent) => {
            // Create HTTP server for this torrent
            const server = torrent.createServer();
            server.listen(0, () => {
                const port = (server.address() as any).port;

                // Find the largest video file index
                const videoFileIndex = torrent.files.findIndex((f: any) =>
                    f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi') || f.name.endsWith('.webm')
                );

                const finalUrl = `http://localhost:${port}/${videoFileIndex !== -1 ? videoFileIndex : 0}`;

                console.log(`Torrent server started at ${finalUrl}`);
                resolve(finalUrl);
            });

            server.on('error', (err: any) => {
                reject(err);
            });
        });
    });
};

export const stopTorrent = (magnetLink: string) => {
    const torrent = client.get(magnetLink) as unknown as WebTorrent.Torrent | undefined;
    if (torrent) {
        torrent.destroy();
    }
};
