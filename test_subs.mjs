import axios from 'axios';
import * as cheerio from 'cheerio';

const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    responseType: 'text'
};

const listSubtitles = async (imdbId) => {
    const url = `https://yifysubtitles.org/movie-imdb/${imdbId}`;
    console.log(`Testing URL: ${url}`);

    try {
        const { data } = await axios.get(url, AXIOS_CONFIG);
        const $ = cheerio.load(data);

        console.log('Page Title:', $('title').text());
        
        // Try to find ANY table row
        const rows = $('tr');
        console.log(`Total rows found: ${rows.length}`);

        if (rows.length > 0) {
            // Print the HTML of the first row to inspect structure
            console.log('First Row HTML:', $(rows[1]).html()); // Skip header row 0
        } else {
            console.log('No table rows found. Dumping body structure:');
            // console.log($('body').html().substring(0, 500));
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
};

listSubtitles('tt1375666');