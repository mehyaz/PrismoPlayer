import axios from 'axios';


export interface ParentsGuideItem {
    category: string;
    status: string; // "None", "Mild", "Moderate", "Severe"
    items: string[];
}

export const getParentsGuide = async (imdbId: string): Promise<ParentsGuideItem[]> => {
    try {
        const url = `https://www.imdb.com/title/${imdbId}/parentalguide`;
        const { data } = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        // Extract the __NEXT_DATA__ JSON script
        const jsonMatch = data.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (!jsonMatch) {
            console.error('Failed to locate __NEXT_DATA__ script');
            return [];
        }
        const jsonString = jsonMatch[1];
        const parsed = JSON.parse(jsonString);
        
        // Try multiple paths to find categories, as IMDb changes this structure often
        let categories = parsed?.props?.pageProps?.contentData?.categories 
            || parsed?.props?.pageProps?.mainColumnData?.categories
            || parsed?.props?.pageProps?.b?.categories; // Another potential path

        if (!Array.isArray(categories)) {
            console.error('Categories not found in __NEXT_DATA__. Structure:', JSON.stringify(parsed?.props?.pageProps, null, 2));
            return [];
        }
        const guide: ParentsGuideItem[] = categories.map((cat: any) => {
            const title = cat.title || cat.id || '';
            const status = cat.severitySummary?.text || 'Unknown';
            const items = Array.isArray(cat.items) ? cat.items.map((it: any) => it.text).filter((t: any) => !!t) : [];
            return {
                category: title,
                status,
                items,
            } as ParentsGuideItem;
        });
        return guide;
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

        console.log(`[Scraper] Fetching from API: ${url}`);

        const { data } = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!data || !data.d) {
            console.log('[Scraper] No data found in API response');
            return [];
        }

        const results = data.d.map((item: any) => {
            // Filter: Only accept items with an ID starting with 'tt' (titles)
            // Exclude 'nm' (names/people) and others
            if (!item.id || !item.id.startsWith('tt') || !item.l) return null;

            return {
                id: item.id,
                title: item.l,
                year: item.y ? item.y.toString() : '',
                image: item.i ? item.i.imageUrl : ''
            };
        }).filter((item: any) => item !== null);

        console.log(`[Scraper] Found ${results.length} results via API`);
        return results;
    } catch (error) {
        console.error('Error searching movie:', error);
        // Fallback to HTML scraping if API fails? For now, let's stick to API as it's much better.
        return [];
    }
};
