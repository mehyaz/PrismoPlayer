import axios from 'axios';

interface TorrentResult {
    id: string;
    name: string;
    info_hash: string;
    leechers: string;
    seeders: string;
    num_files: string;
    size: string;
    username: string;
    added: string;
    status: string;
    category: string;
    imdb: string;
}

export async function searchTorrent(query: string, quality?: string): Promise<string | null> {
    try {
        console.log(`Searching torrents for: ${query} (Quality Preference: ${quality || 'None'})`);
        const response = await axios.get<TorrentResult[]>(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=200`);

        const results = response.data;

        if (!results || results.length === 0 || results[0].name === 'No results returned') {
            console.log('No torrents found.');
            return null;
        }

        // Filter and score torrents based on codec preference and requested quality
        const scoredResults = results.map(torrent => {
            let score = parseInt(torrent.seeders); // Base score: seeders
            const name = torrent.name.toLowerCase();

            // Prefer AAC audio (Chromium supports AAC, not AC3/DTS)
            if (name.includes('aac')) score += 100;

            // Prefer modern video codecs
            if (name.includes('x264') || name.includes('h264')) score += 50;
            if (name.includes('x265') || name.includes('h265') || name.includes('hevc')) score += 75;

            // Avoid old codecs that might have compatibility issues
            if (name.includes('xvid') || name.includes('divx')) score -= 50;

            // Prefer web-optimized formats
            if (name.includes('web-dl') || name.includes('webrip')) score += 30;

            // --- Quality Logic ---
            if (quality) {
                // If user specifically asked for a quality, prioritize it heavily
                if (name.includes(quality.toLowerCase())) {
                    score += 10000; 
                }
            } else {
                // Default logic: Prefer 1080p slightly over 720p if seeds are similar
                if (name.includes('1080p')) score += 20;
                if (name.includes('720p')) score += 10;
            }

            return { ...torrent, score };
        });

        // Sort by score (highest first)
        scoredResults.sort((a, b) => b.score - a.score);

        const bestMatch = scoredResults[0];
        console.log(`Found torrent: ${bestMatch.name} (Seeders: ${bestMatch.seeders}, Score: ${bestMatch.score})`);

        // Construct magnet link
        const trackers = [
            'udp://tracker.coppersurfer.tk:6969/announce',
            'udp://tracker.openbittorrent.com:80',
            'udp://tracker.opentrackr.org:1337',
            'udp://tracker.leechers-paradise.org:6969',
            'udp://tracker.dler.org:6969/announce',
            'udp://opentracker.i2p.rocks:6969/announce',
            'udp://47.ip-51-68-199.eu:6969/announce',
        ];

        const trackerString = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
        const magnetLink = `magnet:?xt=urn:btih:${bestMatch.info_hash}&dn=${encodeURIComponent(bestMatch.name)}${trackerString}`;

        return magnetLink;
    } catch (error) {
        console.error('Error searching torrents:', error);
        return null;
    }
}