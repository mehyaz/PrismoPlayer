import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ParentsGuideItem {
    category: string;
    status: string;
    items: string[];
}

interface ScrapedEpisode {
    id: string;
    title: string;
    episodeNumber: number;
    seasonNumber: number;
    releaseDate: string;
    plot: string;
    rating: string;
    image?: string;
}

interface ScrapedSeason {
    seasonNumber: number;
    episodes: ScrapedEpisode[];
}

const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 15000
};

export const getParentsGuide = async (imdbId: string): Promise<ParentsGuideItem[]> => {
    try {
        const url = `https://www.imdb.com/title/${imdbId}/parentalguide`;
        const { data } = await axios.get(url, AXIOS_CONFIG);

        const jsonMatch = data.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (!jsonMatch) return [];

        const jsonString = jsonMatch[1];
        const parsed = JSON.parse(jsonString);

        const categories = parsed?.props?.pageProps?.contentData?.categories
            || parsed?.props?.pageProps?.mainColumnData?.categories
            || parsed?.props?.pageProps?.b?.categories;

        if (!Array.isArray(categories)) return [];

        interface RawCategory {
            title?: string;
            id?: string;
            severitySummary?: { text?: string };
            items?: Array<{ text?: string }>;
        }

        return categories.map((cat: RawCategory) => ({
            category: cat.title || cat.id || '',
            status: cat.severitySummary?.text || 'Unknown',
            items: Array.isArray(cat.items) ? cat.items.map((it) => it.text).filter((t): t is string => !!t) : []
        }));
    } catch (error) {
        console.error('Error fetching parents guide:', error);
        return [];
    }
};

export const searchMovie = async (query: string) => {
    try {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) return [];

        const firstChar = cleanQuery.charAt(0);
        const url = `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanQuery)}.json`;

        const { data } = await axios.get(url, AXIOS_CONFIG);

        if (!data || !data.d) return [];

        interface RawSearchItem {
            id: string;
            l: string;
            y?: number;
            q?: string;
            yr?: string;
            i?: { imageUrl?: string };
        }

        interface SearchResponse {
            d: RawSearchItem[];
        }

        const typedData = data as SearchResponse;
        const results = typedData.d.map((item) => {
            if (!item.id || !item.id.startsWith('tt') || !item.l) return null;

            let type = 'movie';
            if (item.q === 'TV series' || item.q === 'TV mini-series') type = 'series';
            else if (item.q === 'feature') type = 'movie';
            else if (item.y && item.yr) type = 'series';

            return {
                id: item.id,
                title: item.l,
                year: item.y ? item.y.toString() : '',
                image: item.i?.imageUrl || '',
                type: type
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        return results;
    } catch (error) {
        console.error('Error searching movie:', error);
        return [];
    }
};

export const getSeriesDetails = async (imdbId: string): Promise<ScrapedSeason[]> => {
    try {
        const url = `https://www.imdb.com/title/${imdbId}/episodes?season=1`;
        console.log(`[Scraper] Fetching series info: ${url}`);
        const { data } = await axios.get(url, AXIOS_CONFIG);
        const $ = cheerio.load(data);

        let totalSeasons = 1;

        // Strategy 1: Dropdown (Legacy)
        const seasonOptions = $('#bySeason option');
        if (seasonOptions.length > 0) {
            seasonOptions.each((_, el) => {
                const val = parseInt($(el).attr('value') || '0');
                if (val > totalSeasons) totalSeasons = val;
            });
        }
        // Strategy 2: JSON (Modern)
        else {
            const nextData = $('#__NEXT_DATA__').html();
            if (nextData) {
                try {
                    const json = JSON.parse(nextData);
                    // Path might vary, try a few known ones or assume if we are on S1 page, seasons list is available
                    // Usually contentData.section.seasons is an array
                    const seasons = json?.props?.pageProps?.contentData?.section?.seasons;
                    if (Array.isArray(seasons)) totalSeasons = seasons.length;
                } catch (e) {
                    console.error('[Scraper] Failed to parse JSON for seasons:', e);
                }
            }
        }

        // Strategy 3: Tab list (Modern HTML)
        if (totalSeasons === 1) {
            const tabs = $('a[href*="season="]');
            tabs.each((_, el) => {
                const href = $(el).attr('href') || '';
                const match = href.match(/season=(\d+)/);
                if (match) {
                    const val = parseInt(match[1]);
                    if (val > totalSeasons) totalSeasons = val;
                }
            });
        }

        console.log(`[Scraper] Detected ${totalSeasons} seasons.`);

        if (totalSeasons > 30) totalSeasons = 30; // Safety cap

        const promises = [];
        for (let i = 1; i <= totalSeasons; i++) {
            promises.push(fetchSeason(imdbId, i));
        }

        const results = await Promise.all(promises);
        return results.filter((s): s is ScrapedSeason => s !== null);

    } catch (error) {
        console.error('Error getting series details:', error);
        return [];
    }
};

const fetchSeason = async (imdbId: string, seasonNum: number): Promise<ScrapedSeason | null> => {
    try {
        const url = `https://www.imdb.com/title/${imdbId}/episodes?season=${seasonNum}`;
        const { data } = await axios.get(url, AXIOS_CONFIG);
        const $ = cheerio.load(data);

        const episodes: ScrapedEpisode[] = [];

        // --- Strategy 1: Legacy Layout (.list_item) ---
        $('.list.detail .list_item').each((_, el) => {
            const title = $(el).find('.info strong a').text().trim();
            let episodeNumber = 0;
            const metaEp = $(el).find('meta[itemprop="episodeNumber"]').attr('content');
            if (metaEp) episodeNumber = parseInt(metaEp);
            else {
                const epText = $(el).find('.hover-over-image div').text().trim();
                const match = epText.match(/Ep(\d+)/);
                if (match) episodeNumber = parseInt(match[1]);
            }

            const date = $(el).find('.airdate').text().trim();
            const plot = $(el).find('.item_description').text().trim();
            const rating = $(el).find('.ipl-rating-star__rating').first().text().trim();
            const imgUrl = $(el).find('.image img').attr('src');
            const fullImg = imgUrl ? imgUrl.replace(/_V1_.*\.jpg/, '_V1_.jpg') : undefined;

            if (title) {
                episodes.push({
                    id: `${imdbId}-s${seasonNum}e${episodeNumber}`,
                    title,
                    episodeNumber,
                    seasonNumber: seasonNum,
                    releaseDate: date,
                    plot,
                    rating,
                    image: fullImg
                });
            }
        });

        // --- Strategy 2: Modern Layout (.episode-item-wrapper) ---
        if (episodes.length === 0) {
            $('.episode-item-wrapper').each((idx, el) => {
                const title = $(el).find('h4').text().trim();
                const plot = $(el).find('.ipc-html-content-inner-div').text().trim();
                const img = $(el).find('img.ipc-image').attr('src');
                // Episode number logic for new layout is tricky, let's assume index + 1 if not found
                // Usually "S1.E1 ∙ Title" format in some span
                let episodeNumber = idx + 1;
                const textContent = $(el).text();
                const epMatch = textContent.match(/S\d+\.E(\d+)/);
                if (epMatch) episodeNumber = parseInt(epMatch[1]);

                const rating = $(el).find('span[aria-label*="rating"]').first().text().trim();

                // Try to find date
                const date = '';
                // Date is usually in a span after title

                // High-res image cleaning
                const fullImg = img ? img.replace(/_V1_.*\.jpg/, '_V1_.jpg') : undefined;

                if (title) {
                    episodes.push({
                        id: `${imdbId}-s${seasonNum}e${episodeNumber}`,
                        title,
                        episodeNumber,
                        seasonNumber: seasonNum,
                        releaseDate: date,
                        plot,
                        rating,
                        image: fullImg
                    });
                }
            });
        }

        console.log(`[Scraper] Season ${seasonNum}: Parsed ${episodes.length} episodes.`);
        return { seasonNumber: seasonNum, episodes };

    } catch (err) {
        console.error(`Failed to fetch season ${seasonNum}`, err);
        return null;
    }
};
