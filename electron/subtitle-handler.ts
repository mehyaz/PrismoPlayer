import { app } from 'electron';
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
}

const srtToVtt = (srt: string): string => {
    let vtt = "WEBVTT\n\n";
    vtt += srt
        .replace(/\{[\\/iub]\d?\}|\{\[iub]\d?\}/g, '') 
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
    return vtt;
};

// 1. List available subtitles (Filtered & Sorted)
export const listSubtitles = async (imdbId: string): Promise<SubtitleItem[]> => {
    const url = `https://yifysubtitles.org/movie-imdb/${imdbId}`;
    const trItems: SubtitleItem[] = [];
    const enItems: SubtitleItem[] = [];

    try {
        console.log(`[Subtitles] Listing from: ${url}`);
        const { data } = await axios.get(url, { ...AXIOS_CONFIG, responseType: 'text' });
        const $ = cheerio.load(data);

        $('tbody tr').each((_, el) => {
            const lang = $(el).find('.sub-lang').text().trim();
            const langLower = lang.toLowerCase();
            const ratingText = $(el).find('.rating-cell').text().trim();
            const rating = parseInt(ratingText) || 0;
            
            let link = $(el).find('.download-cell a').attr('href');
            if (!link) {
                link = $(el).find('a[href^="/subtitles/"]').attr('href');
            }
            
            if (link) {
                const fullLink = link.startsWith('http') ? link : `https://yifysubtitles.org${link}`;
                
                let releaseName = $(el).find('a[href^="/subtitles/"]').text().replace('subtitle', '').trim();
                if (!releaseName) releaseName = `${lang} (Rating: ${rating})`;
                else {
                    // Clean up release name
                    releaseName = releaseName.replace(/^subtitle\s+/i, '').trim();
                    // Truncate if too long
                    if (releaseName.length > 40) releaseName = releaseName.substring(0, 37) + '...';
                }

                const id = Buffer.from(fullLink).toString('base64');
                const item: SubtitleItem = {
                    id,
                    lang: langLower.includes('turkish') ? 'tr' : 'en',
                    name: `${lang === 'Turkish' ? '🇹🇷' : '🇺🇸'} ${releaseName} (★${rating})`,
                    url: fullLink,
                    rating
                };

                if (langLower.includes('turkish')) {
                    trItems.push(item);
                } else if (langLower.includes('english')) {
                    enItems.push(item);
                }
            }
        });

        // Sort by rating descending
        trItems.sort((a, b) => b.rating - a.rating);
        enItems.sort((a, b) => b.rating - a.rating);

        // Take top 5 from each
        const topTr = trItems.slice(0, 5);
        const topEn = enItems.slice(0, 5);

        console.log(`[Subtitles] Found ${trItems.length} TR, ${enItems.length} EN. Returning top results.`);
        
        // Return merged list: Turkish first
        return [...topTr, ...topEn];

    } catch (error) {
        console.error('[Subtitles] Error listing subtitles:', error);
        return [];
    }
};

export const downloadSubtitle = async (item: SubtitleItem, imdbId: string): Promise<string | null> => {
    try {
        console.log(`[Subtitles] Fetching detail page: ${item.url}`);
        const { data: detailData } = await axios.get(item.url, { ...AXIOS_CONFIG, responseType: 'text' });
        const $ = cheerio.load(detailData);
        
        let zipLink = $('a.btn-icon.download-subtitle').attr('href') || 
                      $('a.download-subtitle').attr('href');
        
        if (!zipLink) {
             $('a').each((_, el) => {
                const h = $(el).attr('href');
                if (h && h.endsWith('.zip')) {
                    zipLink = h;
                    return false;
                }
            });
        }

        if (!zipLink) {
            console.error('[Subtitles] ZIP link not found on detail page.');
            return null;
        }

        const fullZipLink = zipLink.startsWith('http') ? zipLink : `https://yifysubtitles.org${zipLink}`;
        console.log(`[Subtitles] Downloading ZIP: ${fullZipLink}`);

        const { data: zipData } = await axios.get(fullZipLink, { ...AXIOS_CONFIG });
        const zip = new AdmZip(Buffer.from(zipData));
        const zipEntries = zip.getEntries();

        const srtEntry = zipEntries.find(entry => entry.entryName.endsWith('.srt'));
        if (!srtEntry) {
            console.error('[Subtitles] SRT not found in zip.');
            return null;
        }

        const buffer = srtEntry.getData();
        const detected = jschardet.detect(buffer);
        let encoding = detected.encoding || 'utf-8';
        
        if (item.lang === 'tr' && (encoding === 'windows-1252' || encoding === 'ISO-8859-1')) {
            encoding = 'windows-1254';
        }

        const srtData = iconv.decode(buffer, encoding);
        const vttData = srtToVtt(srtData);

        const filename = `${imdbId}-${item.id}.vtt`;
        const filePath = path.join(SUBS_CACHE_DIR, filename);
        fs.writeFileSync(filePath, vttData);
        
        return `file://${filePath}`;

    } catch (error) {
        console.error('[Subtitles] Download failed:', error);
        return null;
    }
};
