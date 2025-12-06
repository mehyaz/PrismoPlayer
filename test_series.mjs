import axios from 'axios';
import * as cheerio from 'cheerio';

const AXIOS_CONFIG = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 15000
};

const fetchSeason = async (imdbId, seasonNum) => {
    const url = `https://www.imdb.com/title/${imdbId}/episodes?season=${seasonNum}`;
    const { data } = await axios.get(url, AXIOS_CONFIG);
    const $ = cheerio.load(data);
    
    const items = $('.episode-item-wrapper');
    if (items.length > 0) {
        console.log('First Item HTML Structure:');
        console.log($(items[0]).html().substring(0, 1000)); // Print first 1000 chars
    }
};

fetchSeason('tt0903747', 1);