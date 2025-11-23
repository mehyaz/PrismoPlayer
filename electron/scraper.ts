import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ParentsGuideItem {
    category: string;
    status: string; // "None", "Mild", "Moderate", "Severe"
    items: string[];
}

export const getParentsGuide = async (imdbId: string): Promise<ParentsGuideItem[]> => {
    try {
        const url = `https://www.imdb.com/title/${imdbId}/parentalguide`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const guide: ParentsGuideItem[] = [];

        // Categories usually: Sex & Nudity, Violence & Gore, Profanity, Alcohol, Drugs & Smoking, Frightening & Intense Scenes
        const categories = [
            'Sex & Nudity',
            'Violence & Gore',
            'Profanity',
            'Alcohol, Drugs & Smoking',
            'Frightening & Intense Scenes'
        ];

        // Note: IMDb structure changes often. This is a best-effort selector based on common structure.
        // Usually sections have ids like 'advisory-nudity', 'advisory-violence', etc.

        const categoryMap: Record<string, string> = {
            'Sex & Nudity': 'advisory-nudity',
            'Violence & Gore': 'advisory-violence',
            'Profanity': 'advisory-profanity',
            'Alcohol, Drugs & Smoking': 'advisory-alcohol',
            'Frightening & Intense Scenes': 'advisory-frightening'
        };

        for (const cat of categories) {
            const id = categoryMap[cat];
            const section = $(`#${id}`);

            if (section.length) {
                const status = section.find('.ipl-status-pill').text().trim() || 'Unknown';
                const items: string[] = [];

                section.find('.ipl-zebra-list__item').each((_, el) => {
                    const text = $(el).text().trim();
                    if (text && !text.includes('Edit') && !text.includes('Add an item')) {
                        items.push(text);
                    }
                });

                guide.push({
                    category: cat,
                    status,
                    items
                });
            }
        }

        return guide;
    } catch (error) {
        console.error('Error fetching parents guide:', error);
        return [];
    }
};

export const searchMovie = async (query: string) => {
    try {
        const url = `https://www.imdb.com/find?q=${encodeURIComponent(query)}&s=tt`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const results: { id: string; title: string; year: string; image: string }[] = [];

        $('.ipc-metadata-list-summary-item').each((_, el) => {
            const link = $(el).find('a.ipc-metadata-list-summary-item__t');
            const href = link.attr('href');
            const idMatch = href?.match(/tt\d+/);
            const id = idMatch ? idMatch[0] : '';
            const title = link.text().trim();
            const year = $(el).find('.ipc-metadata-list-summary-item__li').first().text().trim();
            const image = $(el).find('img').attr('src') || '';

            if (id && title) {
                results.push({ id, title, year, image });
            }
        });

        return results;
    } catch (error) {
        console.error('Error searching movie:', error);
        return [];
    }
};
