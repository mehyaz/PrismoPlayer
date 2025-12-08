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

// Updated Tracker List (More robust)
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

const TRACKER_STRING = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');

interface RawTorrent {
    name: string;
    seeders: string | number;
    leechers: string | number;
    source?: string;
    category?: string;
}

const calculateScore = (torrent: RawTorrent, source?: string) => {
    const seeders = parseInt(String(torrent.seeders || '0'));
    const leechers = parseInt(String(torrent.leechers || '0'));

    let score = seeders + (leechers * 0.1);

    const name = torrent.name.toLowerCase();
    const src = source || torrent.source || '';

    if (src === 'YTS') score += 50;
    if (src === 'EZTV') score += 40;
    if (src === 'TorrentsCSV') score += 20;
    if (src === 'APIBay') score += 10;

    if (name.includes('2160p') || name.includes('4k')) score += 20;
    if (name.includes('1080p')) score += 15;
    if (name.includes('720p')) score += 10;

    if (name.includes('x265') || name.includes('h265') || name.includes('hevc')) score += 10;

    if (name.includes('cam') || name.includes('telesync') || name.includes('ts')) score -= 500;
    if (name.includes('sample')) score -= 200;

    return score;
};

const NSFW_KEYWORDS = ['porn', 'xxx', 'erotic', 'adult', 'sex', 'hentai', 'gay', 'lesbian', 'cuckold', 'incest', 'deepfake', 'nude'];
const NSFW_CATEGORIES_APIBAY = ['adult', 'porn', 'xxx'];

const isNSFW = (torrent: RawTorrent): boolean => {
    const nameLower = torrent.name.toLowerCase();
    if (NSFW_KEYWORDS.some(keyword => nameLower.includes(keyword))) return true;
    if (torrent.source === 'APIBay' && torrent.category) {
        const categoryLower = torrent.category.toLowerCase();
        if (NSFW_CATEGORIES_APIBAY.some(cat => categoryLower.includes(cat))) return true;
    }
    return false;
};

const searchAPIBay = async (query: string): Promise<TorrentResult[]> => {
    try {
        const response = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`);
        const results = response.data;

        if (!results || results.length === 0 || results[0].name === 'No results returned') {
            return [];
        }

        interface APIBayResult {
            id: string;
            name: string;
            info_hash: string;
            leechers: number;
            seeders: number;
            num_files: number;
            size: number;
            added: string;
            status: string;
            category: string;
            imdb: string;
        }

        return results.map((t: APIBayResult) => ({
            id: t.id,
            name: t.name,
            info_hash: t.info_hash,
            leechers: String(t.leechers),
            seeders: String(t.seeders),
            num_files: String(t.num_files),
            size: String(t.size),
            username: 'APIBay',
            added: t.added,
            status: t.status,
            category: t.category,
            imdb: t.imdb,
            magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}${TRACKER_STRING}`,
            score: calculateScore(t, 'APIBay'),
            source: 'APIBay'
        })).filter((t: TorrentResult) => !isNSFW(t));
    } catch (error) {
        console.error('[Torrent] APIBay error:', error);
        return [];
    }
};

const searchYTS = async (query: string): Promise<TorrentResult[]> => {
    try {
        const cleanQuery = query.replace(/\s+\d{4}$/, '');
        const response = await axios.get(`https://en.yts-official.org/api/v2/list_movies.json?query_term=${encodeURIComponent(cleanQuery)}&limit=20`);
        const data = response.data;

        if (!data || !data.data || !data.data.movies) {
            console.warn('[Torrent] YTS returned no movies (or invalid format)', data?.status_message || '');
            return [];
        }

        interface YTSMovie {
            id: number;
            title: string;
            year: number;
            imdb_code: string;
            torrents?: YTSTorrent[];
        }

        interface YTSTorrent {
            hash: string;
            quality: string;
            type: string;
            seeds: number;
            peers: number;
            size_bytes: number;
            date_uploaded: string;
        }

        const movies: YTSMovie[] = data.data.movies;
        const results: TorrentResult[] = [];

        movies.forEach((movie) => {
            if (!movie.torrents) return;
            movie.torrents.forEach((torrent) => {
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
    } catch (error) {
        const err = error as Error;
        console.error(`[Torrent] YTS Error: ${err.message}`);
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

        interface EZTVTorrent {
            id: number;
            title: string;
            hash: string;
            peers: number;
            seeds: number;
            size_bytes: number;
            date_released_unix: number;
            magnet_url?: string;
        }

        return data.torrents.map((t: EZTVTorrent) => ({
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
        })).filter((t: TorrentResult) => !isNSFW(t));

    } catch (error) {
        console.error('[Torrent] EZTV error:', error);
        return [];
    }
};

const searchTorrentsCSV = async (query: string): Promise<TorrentResult[]> => {
    try {
        const response = await axios.get(`https://torrents-csv.com/service/search?q=${encodeURIComponent(query)}&size=20`);
        const results = response.data.torrents;

        if (!results || !Array.isArray(results)) return [];

        interface TorrentsCSVItem {
            infohash: string;
            name: string;
            seeders?: number;
            leechers?: number;
            size_bytes?: number;
        }

        return results.map((t: TorrentsCSVItem) => ({
            id: t.infohash,
            name: t.name,
            info_hash: t.infohash,
            leechers: t.leechers?.toString() || '0',
            seeders: t.seeders?.toString() || '0',
            num_files: '1',
            size: t.size_bytes?.toString() || '0',
            username: 'TorrentsCSV',
            added: new Date().toISOString(),
            status: 'active',
            category: 'Mixed',
            imdb: '',
            magnet: `magnet:?xt=urn:btih:${t.infohash}&dn=${encodeURIComponent(t.name)}${TRACKER_STRING}`,
            score: calculateScore({ name: t.name, seeders: t.seeders || 0, leechers: t.leechers || 0 }, 'TorrentsCSV'),
            source: 'TorrentsCSV'
        })).filter((t) => !isNSFW(t));

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
            // Stats might be used in future

            if (magnet && title) {
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

export async function getTorrentList(query: string, imdbId?: string, type?: 'movie' | 'series'): Promise<TorrentResult[]> {
    console.log(`[Torrent] Aggregating search for: ${query}, ID: ${imdbId}, Type: ${type}`);

    const searchTasks: { name: string, promise: Promise<TorrentResult[]> }[] = [];

    searchTasks.push({ name: 'APIBay', promise: searchAPIBay(query) });

    if (type !== 'series') {
        searchTasks.push({ name: 'YTS', promise: searchYTS(query) });
    }

    if ((type === 'series' || !type) && imdbId) {
        searchTasks.push({ name: 'EZTV', promise: searchEZTV(imdbId) });
    }

    searchTasks.push({ name: 'TorrentsCSV', promise: searchTorrentsCSV(query) });

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

export async function searchTorrent(query: string, quality?: string): Promise<string | null> {
    const results = await getTorrentList(query);
    if (results.length === 0) return null;

    if (quality) {
        const qualityMatch = results.find(t => t.name.toLowerCase().includes(quality.toLowerCase()));
        if (qualityMatch) return qualityMatch.magnet;
    }

    return results[0].magnet;
}