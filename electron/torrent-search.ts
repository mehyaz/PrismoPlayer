import axios from 'axios';
import * as cheerio from 'cheerio';

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
    source: string; // 'YTS', 'APIBay', 'EZTV', 'TorrentsCSV'
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

const calculateScore = (torrent: any, source?: string) => {
    const seeders = parseInt(torrent.seeders || '0');
    const leechers = parseInt(torrent.leechers || '0');

    // Base score: Priority is purely on Seeders (and some Leechers for activity)
    let score = seeders + (leechers * 0.1);

    const name = torrent.name.toLowerCase();
    const src = source || torrent.source || '';

    // Source Bonuses (Tie-breakers mostly)
    if (src === 'YTS') score += 50;
    if (src === 'EZTV') score += 40;
    if (src === 'TorrentsCSV') score += 20; // Fast and reliable
    if (src === 'APIBay') score += 10;

    // Quality Bonuses (Small boost for better resolution)
    if (name.includes('2160p') || name.includes('4k')) score += 20;
    if (name.includes('1080p')) score += 15;
    if (name.includes('720p')) score += 10;

    // Codec Bonuses
    if (name.includes('x265') || name.includes('h265') || name.includes('hevc')) score += 10;

    // Negative weights for trash quality
    if (name.includes('cam') || name.includes('telesync') || name.includes('ts')) score -= 500;
    if (name.includes('sample')) score -= 200;

    return score;
};

// --- Content Filtering ---
const NSFW_KEYWORDS = ['porn', 'xxx', 'erotic', 'adult', 'sex', 'hentai', 'gay', 'lesbian', 'cuckold', 'incest', 'deepfake', 'nude'];
const NSFW_CATEGORIES_APIBAY = ['adult', 'porn', 'xxx'];

const isNSFW = (torrent: any): boolean => {
    const nameLower = torrent.name.toLowerCase();
    if (NSFW_KEYWORDS.some(keyword => nameLower.includes(keyword))) return true;
    if (torrent.source === 'APIBay' && torrent.category) {
        const categoryLower = torrent.category.toLowerCase();
        if (NSFW_CATEGORIES_APIBAY.some(cat => categoryLower.includes(cat))) return true;
    }
    return false;
};

// --- Providers ---

const searchAPIBay = async (query: string): Promise<TorrentResult[]> => {
    try {
        const response = await axios.get<any[]>(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`); // cat=0 All
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
            num_files: '1',
            size: t.size,
            username: 'APIBay',
            added: t.added,
            status: t.status,
            category: t.category,
            imdb: t.imdb,
            magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}${TRACKER_STRING}`,
            score: calculateScore(t, 'APIBay'),
            source: 'APIBay'
        })).filter(t => !isNSFW(t));
    } catch (error) {
        console.error('[Torrent] APIBay error:', error);
        return [];
    }
};

const searchYTS = async (query: string): Promise<TorrentResult[]> => {
    try {
        // YTS search often fails if "Title Year" is passed. Strip year for better results.
        const cleanQuery = query.replace(/\s+\d{4}$/, '');
        const response = await axios.get(`https://en.yts-official.org/api/v2/list_movies.json?query_term=${encodeURIComponent(cleanQuery)}&limit=20`);
        const data = response.data;

        if (!data || !data.data || !data.data.movies) {
            console.warn('[Torrent] YTS returned no movies (or invalid format)', data?.status_message || '');
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
                    score: calculateScore({ name, seeders: torrent.seeds, leechers: torrent.peers }, 'YTS'),
                    source: 'YTS'
                });
            });
        });

        return results.filter(t => !isNSFW(t));
    } catch (error: any) {
        console.error(`[Torrent] YTS Error: ${error.message}`);
        return [];
    }
};

const searchEZTV = async (imdbId: string): Promise<TorrentResult[]> => {
    if (!imdbId.startsWith('tt')) return [];
    const numericId = imdbId.replace('tt', '');

    try {
        const response = await axios.get(`https://eztv.re/api/get-torrents?imdb_id=${numericId}`);
        const data = response.data;

        if (!data || !data.torrents) return [];

        return data.torrents.map((t: any) => ({
            id: t.id.toString(),
            name: t.title,
            info_hash: t.hash,
            leechers: t.peers.toString(),
            seeders: t.seeds.toString(),
            num_files: '1',
            size: t.size_bytes.toString(),
            username: 'EZTV',
            added: new Date(t.date_released_unix * 1000).toISOString(),
            status: 'active',
            category: 'Series',
            imdb: imdbId,
            magnet: t.magnet_url || `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(t.title)}${TRACKER_STRING}`,
            score: calculateScore({ name: t.title, seeders: t.seeds, leechers: t.peers }, 'EZTV'),
            source: 'EZTV'
        })).filter((t: any) => !isNSFW(t));

    } catch (error) {
        console.error('[Torrent] EZTV error:', error);
        return [];
    }
};

const searchTorrentsCSV = async (query: string): Promise<TorrentResult[]> => {
    try {
        // Torrents-CSV is a fast aggregator API
        const response = await axios.get(`https://torrents-csv.com/service/search?q=${encodeURIComponent(query)}&size=20`);
        const results = response.data.torrents;

        if (!results || !Array.isArray(results)) return [];

        return results.map((t: any) => ({
            id: t.infohash,
            name: t.name,
            info_hash: t.infohash,
            leechers: t.leechers?.toString() || '0',
            seeders: t.seeders?.toString() || '0',
            num_files: '1', // API doesn't always provide this
            size: t.size_bytes?.toString() || '0',
            username: 'TorrentsCSV',
            added: new Date().toISOString(),
            status: 'active',
            category: 'Mixed',
            imdb: '',
            magnet: `magnet:?xt=urn:btih:${t.infohash}&dn=${encodeURIComponent(t.name)}${TRACKER_STRING}`,
            score: calculateScore({ name: t.name, seeders: t.seeders, leechers: t.leechers }, 'TorrentsCSV'),
            source: 'TorrentsCSV'
        })).filter((t: any) => !isNSFW(t));

    } catch (error) {
        console.error('[Torrent] TorrentsCSV error:', error);
        return [];
    }
};

const searchBitSearch = async (query: string): Promise<TorrentResult[]> => {
    try {
        const response = await axios.get(`https://bitsearch.to/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
                'Referer': 'https://bitsearch.to/',
            }
        });

        const $ = cheerio.load(response.data);
        const results: TorrentResult[] = [];

        $('li.search-result').each((i, el) => {
            if (results.length >= 20) return;

            const title = $(el).find('h5.title a').text().trim();
            const magnet = $(el).find('a[href^="magnet:"]').attr('href');
            const stats = $(el).find('.stats div');

            if (magnet && title) {
                // BitSearch stats are messy classes, try to parse text or specific divs if consistent
                // Usually: [Files] [Size] [Seeds] [Leeches]
                const size = $(el).find('.stats div:nth-child(2)').text().trim();
                const seeds = $(el).find('.stats div:nth-child(3)').text().trim().replace(/,/g, '');
                const leeches = $(el).find('.stats div:nth-child(4)').text().trim().replace(/,/g, '');

                results.push({
                    id: `bitsearch-${i}`,
                    name: title,
                    info_hash: magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/)?.[1] || '',
                    leechers: leeches || '0',
                    seeders: seeds || '0',
                    num_files: '1',
                    size: size,
                    username: 'BitSearch',
                    added: new Date().toISOString(),
                    status: 'active',
                    category: 'Mixed',
                    imdb: '',
                    magnet: magnet,
                    score: calculateScore({ name: title, seeders: seeds, leechers: leeches }, 'BitSearch'),
                    source: 'BitSearch'
                });
            }
        });

        return results.filter(t => !isNSFW(t));
    } catch (error) {
        console.error('[Torrent] BitSearch error:', error);
        return [];
    }
};

// --- Aggregator ---

export async function getTorrentList(query: string, imdbId?: string, type?: 'movie' | 'series'): Promise<TorrentResult[]> {
    console.log(`[Torrent] Aggregating search for: ${query}, ID: ${imdbId}, Type: ${type}`);

    // Store promises with their source name for logging
    const searchTasks: { name: string, promise: Promise<TorrentResult[]> }[] = [];

    // Always search APIBay (General)
    searchTasks.push({ name: 'APIBay', promise: searchAPIBay(query) });

    // If it's a movie or unknown, try YTS
    if (type !== 'series') {
        searchTasks.push({ name: 'YTS', promise: searchYTS(query) });
    }

    // If it's a series AND we have IMDb ID, try EZTV
    if ((type === 'series' || !type) && imdbId) {
        searchTasks.push({ name: 'EZTV', promise: searchEZTV(imdbId) });
    }

    // New fast aggregation source
    searchTasks.push({ name: 'TorrentsCSV', promise: searchTorrentsCSV(query) });

    // BitSearch (Lightweight)
    searchTasks.push({ name: 'BitSearch', promise: searchBitSearch(query) });

    const resultsArray = await Promise.all(searchTasks.map(t => t.promise));
    const allResults: TorrentResult[] = [];

    console.log('--- Torrent Search Report ---');
    resultsArray.forEach((res, idx) => {
        const sourceName = searchTasks[idx].name;
        const count = res.length;
        console.log(`[Torrent] Source: ${sourceName.padEnd(12)} | Results: ${count}`);
        allResults.push(...res);
    });
    console.log(`[Torrent] Total aggregated results: ${allResults.length}`);
    console.log('-----------------------------');

    const uniqueResultsMap = new Map<string, TorrentResult>();
    allResults.forEach(torrent => {
        if (!uniqueResultsMap.has(torrent.info_hash) || (torrent.score || 0) > (uniqueResultsMap.get(torrent.info_hash)?.score || 0)) {
            uniqueResultsMap.set(torrent.info_hash, torrent);
        }
    });

    const uniqueResults = Array.from(uniqueResultsMap.values());
    return uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// Backward compatibility
export async function searchTorrent(query: string, quality?: string): Promise<string | null> {
    const results = await getTorrentList(query);
    if (results.length === 0) return null;

    if (quality) {
        const qualityMatch = results.find(t => t.name.toLowerCase().includes(quality.toLowerCase()));
        if (qualityMatch) return qualityMatch.magnet;
    }

    return results[0].magnet;
}