import axios from 'axios';

// Mock implementation of scraper functions directly to test logic
// Copy-pasted logic from electron/scraper.ts and torrent-search.ts for standalone testing

const getParentsGuide = async (imdbId) => {
    console.log(`Testing getParentsGuide for ID: ${imdbId}`);
    try {
        const url = `https://www.imdb.com/title/${imdbId}/parentalguide`;
        console.log(`Fetching URL: ${url}`);
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
        
        // Logic verification
        const categories = parsed?.props?.pageProps?.contentData?.categories;
        
        if (!Array.isArray(categories)) {
            console.error('Categories not found in __NEXT_DATA__ or not an array');
            // Inspect what we actually got
            console.log('Structure found:', JSON.stringify(parsed?.props?.pageProps?.contentData, null, 2));
            return [];
        }
        
        const guide = categories.map((cat) => {
            const title = cat.title || cat.id || '';
            const status = cat.severitySummary?.text || 'Unknown';
            const items = Array.isArray(cat.items) ? cat.items.map((it) => it.text).filter((t) => !!t) : [];
            return {
                category: title,
                status,
                items,
            };
        });
        
        console.log(`Successfully parsed ${guide.length} categories.`);
        return guide;
    } catch (error) {
        console.error('Error fetching parents guide:', error.message);
        return [];
    }
};

const searchMovie = async (query) => {
    console.log(`Testing searchMovie for query: ${query}`);
    try {
        const cleanQuery = query.toLowerCase().trim();
        if (!cleanQuery) return [];

        const firstChar = cleanQuery.charAt(0);
        const url = `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanQuery)}.json`;

        const { data } = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!data || !data.d) {
            console.log('No data found in API response');
            return [];
        }

        const results = data.d.map((item) => {
            if (!item.id || !item.l) return null;
            return {
                id: item.id,
                title: item.l,
                year: item.y ? item.y.toString() : '',
                image: item.i ? item.i.imageUrl : ''
            };
        }).filter((item) => item !== null);

        console.log(`Found ${results.length} movies.`);
        return results;
    } catch (error) {
        console.error('Error searching movie:', error.message);
        return [];
    }
};

// Mock implementation of searchTorrent
const searchTorrent = async (query) => {
    try {
        console.log(`Testing searchTorrent for: ${query}`);
        const response = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=200`, {
            timeout: 5000
        });

        const results = response.data;

        if (!results || results.length === 0 || results[0].name === 'No results returned') {
            console.log('No torrents found.');
            return null;
        }

        const scoredResults = results.map(torrent => {
            let score = parseInt(torrent.seeders);
            const name = torrent.name.toLowerCase();
            if (name.includes('aac')) score += 100;
            if (name.includes('x264') || name.includes('h264')) score += 50;
            if (name.includes('x265') || name.includes('h265') || name.includes('hevc')) score += 75;
            if (name.includes('xvid') || name.includes('divx')) score -= 50;
            if (name.includes('web-dl') || name.includes('webrip')) score += 30;
            return { ...torrent, score };
        });

        scoredResults.sort((a, b) => b.score - a.score);
        const bestMatch = scoredResults[0];
        console.log(`Found torrent: ${bestMatch.name} (Seeders: ${bestMatch.seeders}, Score: ${bestMatch.score})`);

        const trackers = [
            'udp://tracker.coppersurfer.tk:6969/announce',
            'udp://tracker.openbittorrent.com:80',
            'udp://tracker.opentrackr.org:1337',
        ];
        const trackerString = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
        const magnetLink = `magnet:?xt=urn:btih:${bestMatch.info_hash}&dn=${encodeURIComponent(bestMatch.name)}${trackerString}`;
        return magnetLink;
    } catch (error) {
        console.error('Error searching torrents:', error.message);
        return null;
    }
};

// Run the test flow
(async () => {
    console.log('--- Starting Backend Logic Test ---');
    
    // 1. Search Movie
    const movies = await searchMovie('Inception');
    if (movies.length === 0) {
        console.error('Movie search failed. Aborting.');
        process.exit(1);
    }
    
    const movie = movies[0];
    console.log(`Selected Movie: ${movie.title} (${movie.year}) [ID: ${movie.id}]`);
    
    // 2. Get Parents Guide
    const guide = await getParentsGuide(movie.id);
    console.log('Parents Guide Result Length:', guide.length);
    
    // 3. Search Torrent
    const torrentQuery = `${movie.title} ${movie.year}`;
    const magnet = await searchTorrent(torrentQuery);
    
    if (magnet) {
        console.log('Torrent Search Successful. Magnet Link Generated.');
    } else {
        console.error('Torrent Search Failed.');
    }
    
    console.log('--- Test Complete ---');
})();
