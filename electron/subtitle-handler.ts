import { app } from 'electron';
import { getSettings } from './settings-manager';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

const SUBS_CACHE_DIR = path.join(app.getPath('userData'), 'PrismoPlayerSubs');

if (!fs.existsSync(SUBS_CACHE_DIR)) {
    fs.mkdirSync(SUBS_CACHE_DIR, { recursive: true });
}

const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    responseType: 'arraybuffer' as const
};

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
                    name: `${lang === 'Turkish' ? '🇹🇷' : '🇺🇸'} ${releaseName} (★${rating})`,
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
            id: item.attributes.files[0].file_id.toString(), // Store file_id
            lang: item.attributes.language === 'tr' ? 'tr' : 'en',
            name: `${item.attributes.language === 'tr' ? '🇹🇷' : '🇺🇸'} ${item.attributes.release} (★${item.attributes.ratings}) [OS]`,
            url: '', // Not used for direct download, we use ID
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
    console.log(`[Subtitles] Aggregating for ${imdbId}`);

    // Only YIFY for now
    const yifyPromise = listYIFY(imdbId);
    const osPromise = listOpenSubtitles(imdbId);

    const [yify, os] = await Promise.all([yifyPromise, osPromise]);

    const combined = [...yify, ...os];

    // Sort: TR first, then Rating
    return combined.sort((a, b) => {
        if (a.lang === 'tr' && b.lang !== 'tr') return -1;
        if (a.lang !== 'tr' && b.lang === 'tr') return 1;
        return b.rating - a.rating;
    });
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
            const settings = getSettings();
            const apiKey = settings.openSubtitlesApiKey;
            if (!apiKey) throw new Error('No API Key');

            // Request download link
            const { data } = await axios.post('https://api.opensubtitles.com/api/v1/download', {
                file_id: parseInt(item.id)
            }, {
                headers: {
                    'Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    'User-Agent': 'PrismoPlayer v1.0'
                }
            });

            if (data && data.link) {
                downloadUrl = data.link;
                // OpenSubtitles usually returns exact file, not zip, but sometimes zip?
                // Actually REST API returns a link that might resolve to the file directly or a temp download link.
                // Let's assume it might be raw file or zip. WE will check Content-Type or magic bytes if easier?
                // But `processZipBuffer` expects ZIP. If it is raw SRT/VTT, we need to handle it.
                // Let's download it first.
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
                // Need to convert to VTT if SRT
                // And save.
                // Naive conversion if unknown encoding? OpenSubtitles mostly UTF-8 now.
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
                const filePath = path.join(SUBS_CACHE_DIR, filename);
                fs.writeFileSync(filePath, vttData);
                return `file://${filePath}`;
            }
        }

        return null;

    } catch (error) {
        console.error('[Subtitles] Download failed:', error);
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
        const filePath = path.join(SUBS_CACHE_DIR, filename);
        fs.writeFileSync(filePath, vttData);

        return `file://${filePath}`;
    } catch (e) {
        console.error(e);
        return null;
    }
};
