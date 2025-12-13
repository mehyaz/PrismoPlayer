import { app } from 'electron';
import { getSettings } from './settings-manager';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

// Lazy initialization for getSubsCacheDir()
let _subsCacheDir: string | null = null;
const getSubsCacheDir = (): string => {
    if (!_subsCacheDir) {
        _subsCacheDir = path.join(app.getPath('userData'), 'PrismoPlayerSubs');
        if (!fs.existsSync(_subsCacheDir)) {
            fs.mkdirSync(_subsCacheDir, { recursive: true });
        }
    }
    return _subsCacheDir;
};

const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 10000
};

/**
 * Subscene - Primary subtitle source (No API key, great Turkish support)
 */
const listSubscene = async (imdbId: string): Promise<SubtitleItem[]> => {
    try {
        // Subscene uses movie title URLs, we'll search by IMDb ID
        const searchUrl = `https://subscene.com/subtitles/title?q=${imdbId}`;
        const { data: searchHtml } = await axios.get(searchUrl, AXIOS_CONFIG);
        const $search = cheerio.load(searchHtml);

        // Find the movie link
        const movieLink = $search('.search-result a').first().attr('href');
        if (!movieLink) {
            console.log('[Subscene] No movie found for', imdbId);
            return [];
        }

        // Fetch subtitle list for that movie
        const movieUrl = `https://subscene.com${movieLink}`;
        const { data: movieHtml } = await axios.get(movieUrl, AXIOS_CONFIG);
        const $ = cheerio.load(movieHtml);

        const items: SubtitleItem[] = [];

        $('.table tbody tr').each((_, el) => {
            const lang = $(el).find('.a1 span').text().trim();
            const name = $(el).find('.a1 span[2]').text().trim();
            const link = $(el).find('.a1 a').attr('href');
            const rating = $(el).find('.a3').text().trim();

            // Focus on Turkish and English
            if ((lang.toLowerCase().includes('turkish') || lang.toLowerCase().includes('english')) && link) {
                const fullLink = `https://subscene.com${link}`;
                const ratingNum = rating.includes('positive') ? 10 : rating.includes('neutral') ? 5 : 1;

                items.push({
                    id: Buffer.from(fullLink).toString('base64'),
                    lang: lang.toLowerCase().includes('turkish') ? 'tr' : 'en',
                    name: `[Subscene] ${lang.includes('Turkish') ? '🇹🇷' : '🇺🇸'} ${name || 'Subscene'} (★${ratingNum})`,
                    url: fullLink,
                    rating: ratingNum,
                    source: 'YIFY' // Reuse YIFY type for simplicity
                });
            }
        });

        console.log(`[Subscene] Found ${items.length} subtitles for ${imdbId}`);
        return items;
    } catch (error) {
        console.error('[Subscene] Search failed:', error);
        return [];
    }
};

/**
 * YIFY Subtitles - Reliable source, no API key needed
 */
export interface SubtitleItem {
    id: string;
    lang: string;
    name: string;
    url: string;
    rating: number;
    source: 'YIFY' | 'OpenSubtitles';
}

const srtToVtt = (srt: string): string => {
    let vtt = "WEBVTT\n\n";
    vtt += srt
        .replace(/\{[\\/iub]\d?\}|\{\[iub]\d?\}/g, '')
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
    return vtt;
};

// --- Providers ---

const listYIFY = async (imdbId: string): Promise<SubtitleItem[]> => {
    const url = `https://yifysubtitles.org/movie-imdb/${imdbId}`;
    const items: SubtitleItem[] = [];

    try {
        console.log(`[YIFY] Listing from: ${url}`);
        const { data } = await axios.get(url, { ...AXIOS_CONFIG, responseType: 'text' });
        const $ = cheerio.load(data);

        $('tbody tr').each((_, el) => {
            const lang = $(el).find('.sub-lang').text().trim();
            const langLower = lang.toLowerCase();
            const ratingText = $(el).find('.rating-cell').text().trim();
            const rating = parseInt(ratingText) || 0;

            let link = $(el).find('.download-cell a').attr('href');
            if (!link) link = $(el).find('a[href^="/subtitles/"]').attr('href');

            // Debug log for languages found
            // console.log(`[YIFY] Found row: ${lang}`);

            if (link && (langLower.includes('turkish') || langLower.includes('english'))) {
                const fullLink = link.startsWith('http') ? link : `https://yifysubtitles.org${link}`;

                let releaseName = $(el).find('a[href^="/subtitles/"]').text().replace('subtitle', '').trim();
                if (!releaseName) releaseName = `${lang} (Rating: ${rating})`;
                else {
                    releaseName = releaseName.replace(/^subtitle\s+/i, '').trim();
                    if (releaseName.length > 40) releaseName = releaseName.substring(0, 37) + '...';
                }

                items.push({
                    id: Buffer.from(fullLink).toString('base64'),
                    lang: langLower.includes('turkish') ? 'tr' : 'en',
                    name: `[YIFY] ${lang === 'Turkish' ? '🇹🇷' : '🇺🇸'} ${releaseName} (★${rating})`,
                    url: fullLink,
                    rating,
                    source: 'YIFY'
                });
            }
        });
        return items;
    } catch (error) {
        console.error('[YIFY] Error:', error);
        return [];
    }
};

// TA is temporarily disabled due to scraping issues
/*
const listTA = async (imdbId: string): Promise<SubtitleItem[]> => { ... }
*/

const listOpenSubtitles = async (imdbId: string): Promise<SubtitleItem[]> => {
    const settings = getSettings();
    const apiKey = settings.openSubtitlesApiKey;
    if (!apiKey) return [];

    const numericId = imdbId.replace('tt', '');
    const url = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${numericId}&languages=en,tr&order_by=download_count&sort=desc`;

    try {
        console.log(`[OpenSubtitles] Listing from: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
                'User-Agent': 'PrismoPlayer v1.0'
            }
        });

        if (!data || !data.data) return [];

        interface OpenSubtitlesItem {
            attributes: {
                files: Array<{ file_id: number }>;
                language: string;
                release: string;
                ratings: number;
            };
        }

        return data.data.map((item: OpenSubtitlesItem) => ({
            id: item.attributes.files[0]?.file_id?.toString() || '',
            lang: item.attributes.language,
            name: `[OpenSub] ${item.attributes.language === 'tr' ? '🇹🇷' : '🇺🇸'} ${item.attributes.release} (★${Math.round(item.attributes.ratings)})`,
            url: '', // Populated later via download
            rating: item.attributes.ratings,
            source: 'OpenSubtitles' as const
        }));

    } catch (error) {
        const err = error as Error & { response?: { data: unknown } };
        console.error('[OpenSubtitles] Error:', err.response?.data || err.message);
        return [];
    }
};

// --- Aggregator ---

export const listSubtitles = async (imdbId: string): Promise<SubtitleItem[]> => {
    try {
        console.log(`[Subtitles] Searching for IMDb: ${imdbId}`);

        // Try Subscene first (best for Turkish, no API limits)
        let subsceneResults: SubtitleItem[] = [];
        try {
            subsceneResults = await listSubscene(imdbId);
            console.log(`[Subtitles] Subscene found ${subsceneResults.length} results`);
        } catch (err) {
            console.error('[Subtitles] Subscene search failed:', err);
        }

        // Then try YIFY (reliable backup)
        let yifyResults: SubtitleItem[] = [];
        try {
            yifyResults = await listYIFY(imdbId);
            console.log(`[Subtitles] YIFY found ${yifyResults.length} results`);
        } catch (err) {
            console.error('[Subtitles] YIFY search failed:', err);
        }

        // OpenSubtitles as last resort (rate limited)
        let openSubResults: SubtitleItem[] = [];
        try {
            openSubResults = await listOpenSubtitles(imdbId);
            console.log(`[Subtitles] OpenSubtitles found ${openSubResults.length} results`);
        } catch (err) {
            console.error('[Subtitles] OpenSubtitles search failed (expected if rate limited):', err);
        }

        // Combine all sources
        const combined = [...subsceneResults, ...yifyResults, ...openSubResults];

        // Sort: Turkish first, then English, then by rating
        combined.sort((a, b) => {
            // Turkish vs English
            if (a.lang === 'tr' && b.lang !== 'tr') return -1;
            if (a.lang !== 'tr' && b.lang === 'tr') return 1;

            // Same language, sort by rating
            return (b.rating || 0) - (a.rating || 0);
        });

        console.log(`[Subtitles] Total found: ${combined.length} (Subscene: ${subsceneResults.length}, YIFY: ${yifyResults.length}, OpenSub: ${openSubResults.length})`);
        console.log(`[Subtitles] Turkish: ${combined.filter(s => s.lang === 'tr').length} | English: ${combined.filter(s => s.lang === 'en').length}`);
        return combined;
    } catch (error) {
        console.error('[Subtitles] Listing failed:', error);
        return [];
    }
};

export const downloadSubtitle = async (item: SubtitleItem, imdbId: string): Promise<string | null> => {
    try {
        let downloadUrl = '';

        if (item.source === 'YIFY') {
            const { data } = await axios.get(item.url, { ...AXIOS_CONFIG, responseType: 'text' });
            const $ = cheerio.load(data);
            let zipUrl = $('a.btn-icon.download-subtitle').attr('href') ||
                $('a.download-subtitle').attr('href') || '';

            if (!zipUrl) {
                $('a').each((_, el) => {
                    const h = $(el).attr('href');
                    if (h && h.endsWith('.zip')) { zipUrl = h; return false; }
                });
            }
            if (zipUrl && !zipUrl.startsWith('http')) zipUrl = `https://yifysubtitles.org${zipUrl}`;
            downloadUrl = zipUrl;
        } else if (item.source === 'OpenSubtitles') {
            try {
                const settings = getSettings();
                const apiKey = settings.openSubtitlesApiKey || 'kfUEFMeQ6s3WzvvQCMWdPLdSPt6RNfHF';

                // Request download link
                const { data } = await axios.post('https://api.opensubtitles.com/api/v1/download', {
                    file_id: parseInt(item.id)
                }, {
                    headers: {
                        'Api-Key': apiKey,
                        'Content-Type': 'application/json',
                        'User-Agent': 'PrismoPlayer v1.0'
                    },
                    timeout: 10000
                });

                if (data && data.link) {
                    downloadUrl = data.link;
                }
            } catch (apiError: unknown) {
                const error = apiError as { response?: { status?: number }; code?: string; message?: string };

                if (error.response?.status === 503) {
                    console.error('[Subtitles] ⚠️ OpenSubtitles API is temporarily unavailable (503)');
                    throw new Error('OpenSubtitles service is temporarily down. Please try YIFY subtitles instead or wait a few minutes.');
                } else if (error.response?.status === 429) {
                    console.error('[Subtitles] ⚠️ Rate limit exceeded on OpenSubtitles API');
                    throw new Error('Too many subtitle requests. Please wait 60 seconds and try again.');
                } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                    console.error('[Subtitles] ⚠️ Network error connecting to OpenSubtitles');
                    throw new Error('Network error. Check your internet connection and try again.');
                } else {
                    console.error('[Subtitles] OpenSubtitles API error:', error.response?.status || error.message);
                    throw new Error('Failed to download from OpenSubtitles. Try YIFY subtitles instead.');
                }
            }
        }

        if (downloadUrl) {
            console.log(`[Subtitles] Downloading: ${downloadUrl}`);
            const { data: fileData } = await axios.get(downloadUrl, { ...AXIOS_CONFIG, responseType: 'arraybuffer' });

            // Check if it is a ZIP
            const isZip = fileData[0] === 0x50 && fileData[1] === 0x4B; // PK magic bytes

            if (isZip) {
                return processZipBuffer(fileData, item.lang, imdbId, item.source);
            } else {
                // Assuming it's the raw subtitle file (srt/vtt)
                const buffer = Buffer.from(fileData);
                const detected = jschardet.detect(buffer);
                const encoding = detected.encoding || 'utf-8';
                const srtData = iconv.decode(buffer, encoding);

                // Simple check if it is VTT already
                let vttData = srtData;
                if (!srtData.trim().startsWith('WEBVTT')) {
                    vttData = srtToVtt(srtData);
                }

                const filename = `${imdbId}-${item.lang}-${item.source}-${Date.now()}.vtt`;
                const filePath = path.join(getSubsCacheDir(), filename);
                fs.writeFileSync(filePath, vttData);
                return `file://${filePath}`;
            }
        }

        return null;

    } catch (error) {
        console.error('[Subtitles] Download failed:', error);
        // Re-throw user-friendly errors
        if (error instanceof Error && error.message.includes('OpenSubtitles')) {
            throw error;
        }
        return null;
    }
};

const processZipBuffer = (buffer: Buffer, lang: string, imdbId: string, source: string): string | null => {
    try {
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        const srtEntry = zipEntries.find(entry => entry.entryName.endsWith('.srt'));

        if (!srtEntry) return null;

        const srtBuffer = srtEntry.getData();
        const detected = jschardet.detect(srtBuffer);
        let encoding = detected.encoding || 'utf-8';

        if (lang === 'tr' && (encoding === 'windows-1252' || encoding === 'ISO-8859-1')) {
            encoding = 'windows-1254';
        }

        const srtData = iconv.decode(srtBuffer, encoding);
        const vttData = srtToVtt(srtData);

        const filename = `${imdbId}-${lang}-${source}-${Date.now()}.vtt`;
        const filePath = path.join(getSubsCacheDir(), filename);
        fs.writeFileSync(filePath, vttData);

        return `file://${filePath}`;
    } catch (e) {
        console.error(e);
        return null;
    }
};
