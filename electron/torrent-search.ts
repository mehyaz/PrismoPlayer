import axios from 'axios';

export interface TorrentResult {
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
    magnet: string;
    score?: number;
    source: string; // 'YTS', 'APIBay' etc.
}

const TRACKERS = [
    'udp://tracker.coppersurfer.tk:6969/announce',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.opentrackr.org:1337',
    'udp://tracker.leechers-paradise.org:6969',
    'udp://tracker.dler.org:6969/announce',
    'udp://opentracker.i2p.rocks:6969/announce',
    'udp://47.ip-51-68-199.eu:6969/announce',
];

const TRACKER_STRING = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');

const calculateScore = (torrent: any) => {
    let score = parseInt(torrent.seeders);
    const name = torrent.name.toLowerCase();

    if (name.includes('aac')) score += 100;
    if (name.includes('x264') || name.includes('h264')) score += 50;
    if (name.includes('x265') || name.includes('h265') || name.includes('hevc')) score += 75;
    if (name.includes('xvid') || name.includes('divx')) score -= 50;
    if (name.includes('web-dl') || name.includes('webrip')) score += 30;
    
    // Prefer higher quality for listing
    if (name.includes('2160p') || name.includes('4k')) score += 40;
    if (name.includes('1080p')) score += 30;
    if (name.includes('720p')) score += 20;

    return score;
};

// --- Content Filtering Logic ---
const NSFW_KEYWORDS = ['porn', 'xxx', 'erotic', 'adult', 'sex', 'hentai', 'gay', 'lesbian', 'cuckold', 'incest', 'deepfake', 'nude'];
const NSFW_CATEGORIES_APIBAY = ['adult', 'porn', 'xxx']; // APIBay category names might vary

const isNSFW = (torrent: any): boolean => {
    const nameLower = torrent.name.toLowerCase();
    
    // Keyword check in name
    if (NSFW_KEYWORDS.some(keyword => nameLower.includes(keyword))) {
        return true;
    }

    // APIBay Specific Category check
    if (torrent.source === 'APIBay' && torrent.category) {
        const categoryLower = torrent.category.toLowerCase();
        if (NSFW_CATEGORIES_APIBAY.some(cat => categoryLower.includes(cat))) {
            return true;
        }
    }
    
    return false;
};

// --- Providers ---

const searchAPIBay = async (query: string): Promise<TorrentResult[]> => {
    try {
        const response = await axios.get<any[]>(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=200`); // cat=200 is Video
        const results = response.data;

        if (!results || results.length === 0 || results[0].name === 'No results returned') {
            return [];
        }

        return results.map(t => ({
            id: t.id,
            name: t.name,
            info_hash: t.info_hash,
            leechers: t.leechers,
            seeders: t.seeders,
            num_files: t.num_files,
            size: t.size, 
            username: t.username,
            added: t.added,
            status: t.status,
            category: t.category, // Keep original category for filtering
            imdb: t.imdb,
            magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}${TRACKER_STRING}`,
            score: calculateScore(t),
            source: 'APIBay'
        })).filter(t => !isNSFW(t)); // Apply filter
    } catch (error) {
        console.error('[Torrent] APIBay error:', error);
        return [];
    }
};

const searchYTS = async (query: string): Promise<TorrentResult[]> => {
    try {
        // YTS API v2 - Generally clean, but add keyword check just in case
        const response = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&limit=20`);
        const data = response.data;

        if (!data || !data.data || !data.data.movies) {
            return [];
        }

        const movies = data.data.movies;
        const results: TorrentResult[] = [];

        movies.forEach((movie: any) => {
            if (!movie.torrents) return;

            movie.torrents.forEach((torrent: any) => {
                const name = `${movie.title} ${movie.year} ${torrent.quality} ${torrent.type} YTS`;
                results.push({
                    id: `${movie.id}-${torrent.hash}`,
                    name: name,
                    info_hash: torrent.hash,
                    leechers: torrent.peers.toString(),
                    seeders: torrent.seeds.toString(),
                    num_files: '1',
                    size: torrent.size_bytes.toString(),
                    username: 'YTS',
                    added: torrent.date_uploaded,
                    status: 'active',
                    category: 'Movies',
                    imdb: movie.imdb_code,
                    magnet: `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(name)}${TRACKER_STRING}`,
                    score: calculateScore({name, seeders: torrent.seeds}),
                    source: 'YTS'
                });
            });
        });

        return results.filter(t => !isNSFW(t)); // Apply keyword filter
    } catch (error) {
        console.error('[Torrent] YTS error:', error);
        return [];
    }
};

// --- Aggregator ---

export async function getTorrentList(query: string): Promise<TorrentResult[]> {
    console.log(`[Torrent] Aggregating search for: ${query}`);
    
    const [ytsResults, apibayResults] = await Promise.all([
        searchYTS(query),
        searchAPIBay(query)
    ]);

    console.log(`[Torrent] Found: YTS (${ytsResults.length}), APIBay (${apibayResults.length})`);

    const allResults = [...ytsResults, ...apibayResults];

    // Deduplicate by info_hash - filter out any duplicates with lower score if multiple sources provide same torrent
    const uniqueResultsMap = new Map<string, TorrentResult>();
    allResults.forEach(torrent => {
        if (!uniqueResultsMap.has(torrent.info_hash) || (torrent.score || 0) > (uniqueResultsMap.get(torrent.info_hash)?.score || 0)) {
            uniqueResultsMap.set(torrent.info_hash, torrent);
        }
    });
    
    const uniqueResults = Array.from(uniqueResultsMap.values());

    // Sort by score (highest first)
    return uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// Backward compatibility (mainly for quality switch in player, which now calls getTorrentList directly)
export async function searchTorrent(query: string, quality?: string): Promise<string | null> {
    const results = await getTorrentList(query);
    if (results.length === 0) return null;

    if (quality) {
        const qualityMatch = results.find(t => t.name.toLowerCase().includes(quality.toLowerCase()));
        if (qualityMatch) return qualityMatch.magnet;
    }

    return results[0].magnet || null;
}
