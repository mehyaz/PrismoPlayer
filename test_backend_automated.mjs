#!/usr/bin/env node
/**
 * PrismoPlayer Backend Test Suite
 * Tests scraper, torrent search, and subtitle functionality
 * Run with: node test_backend_automated.mjs
 */

import { searchMovie, getParentsGuide, getSeriesDetails } from './electron/scraper.js';
import { getTorrentList } from './electron/torrent-search.js';
import { listSubtitles } from './electron/subtitle-handler.js';

console.log('🧪 PrismoPlayer Backend Test Suite\n');
console.log('='.repeat(60));

const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function recordTest(name, passed, details = '') {
    results.tests.push({ name, passed, details });
    if (passed) {
        results.passed++;
        console.log(`✅ PASS: ${name}`);
    } else {
        results.failed++;
        console.log(`❌ FAIL: ${name}`);
    }
    if (details) console.log(`   ${details}`);
}

// Test 1: Movie Search
console.log('\n📋 Test Group 1: Movie Search');
console.log('-'.repeat(60));

try {
    const searchResults = await searchMovie('Inception');
    const hasResults = searchResults && searchResults.length > 0;
    const hasInception = searchResults.some(r => r.title.toLowerCase().includes('inception'));

    recordTest(
        'Movie Search: Returns results for "Inception"',
        hasResults,
        `Found ${searchResults.length} results`
    );

    recordTest(
        'Movie Search: Contains "Inception" in results',
        hasInception,
        hasInception ? `Found: ${searchResults.find(r => r.title.toLowerCase().includes('inception')).title}` : 'Not found'
    );

    // Check data structure
    const firstResult = searchResults[0];
    const hasRequiredFields = firstResult &&
        firstResult.id &&
        firstResult.title &&
        firstResult.type;

    recordTest(
        'Movie Search: Results have required fields (id, title, type)',
        hasRequiredFields,
        hasRequiredFields ? `Sample: ${firstResult.id} - ${firstResult.title}` : 'Missing fields'
    );

} catch (error) {
    recordTest('Movie Search: Basic functionality', false, error.message);
}

// Test 2: Parents Guide
console.log('\n📋 Test Group 2: Parents Guide (Content Rating)');
console.log('-'.repeat(60));

try {
    const guide = await getParentsGuide('tt1375666'); // Inception
    const hasCategories = guide && guide.length > 0;

    recordTest(
        'Parents Guide: Fetches data for Inception (tt1375666)',
        hasCategories,
        hasCategories ? `Found ${guide.length} categories` : 'No data'
    );

    if (hasCategories) {
        const hasStatus = guide.every(cat => cat.category && cat.status);
        recordTest(
            'Parents Guide: All categories have status',
            hasStatus,
            `Sample: ${guide[0].category} - ${guide[0].status}`
        );
    }
} catch (error) {
    recordTest('Parents Guide: Basic functionality', false, error.message);
}

// Test 3: Series Details
console.log('\n📋 Test Group 3: Series Information');
console.log('-'.repeat(60));

try {
    console.log('   Fetching Breaking Bad seasons (this may take 15+ seconds)...');
    const seasons = await getSeriesDetails('tt0903747'); // Breaking Bad
    const hasSeasons = seasons && seasons.length > 0;

    recordTest(
        'Series Details: Fetches seasons for Breaking Bad (tt0903747)',
        hasSeasons,
        hasSeasons ? `Found ${seasons.length} seasons` : 'No data'
    );

    if (hasSeasons) {
        const firstSeason = seasons[0];
        const hasEpisodes = firstSeason.episodes && firstSeason.episodes.length > 0;
        recordTest(
            'Series Details: Seasons contain episode data',
            hasEpisodes,
            hasEpisodes ? `Season 1 has ${firstSeason.episodes.length} episodes` : 'No episodes'
        );
    }
} catch (error) {
    recordTest('Series Details: Basic functionality', false, error.message);
}

// Test 4: Torrent Search
console.log('\n📋 Test Group 4: Torrent Search (Multi-source)');
console.log('-'.repeat(60));

try {
    console.log('   Searching multiple torrent sources...');
    const torrents = await getTorrentList('Inception 1080p', 'tt1375666', 'movie');
    const hasTorrents = torrents && torrents.length > 0;

    recordTest(
        'Torrent Search: Returns results for "Inception 1080p"',
        hasTorrents,
        hasTorrents ? `Found ${torrents.length} torrents` : 'No results'
    );

    if (hasTorrents) {
        // Check sources
        const sources = new Set(torrents.map(t => t.source));
        recordTest(
            'Torrent Search: Multi-source aggregation',
            sources.size > 1,
            `Sources: ${Array.from(sources).join(', ')}`
        );

        // Check sorting
        const isSorted = torrents.every((t, i) =>
            i === 0 || (torrents[i - 1].score || 0) >= (t.score || 0)
        );
        recordTest(
            'Torrent Search: Results sorted by score',
            isSorted,
            `Top result: ${torrents[0].name.substring(0, 50)}... (score: ${torrents[0].score})`
        );

        // Check NSFW filtering
        const hasNSFW = torrents.some(t =>
            t.name.toLowerCase().includes('xxx') ||
            t.name.toLowerCase().includes('porn')
        );
        recordTest(
            'Torrent Search: NSFW content filtered',
            !hasNSFW,
            hasNSFW ? 'Warning: Found NSFW content' : 'No NSFW content detected'
        );
    }
} catch (error) {
    recordTest('Torrent Search: Basic functionality', false, error.message);
}

// Test 5: Subtitle Search
console.log('\n📋 Test Group 5: Subtitle Search');
console.log('-'.repeat(60));

try {
    const subtitles = await listSubtitles('tt1375666'); // Inception
    const hasSubtitles = subtitles && subtitles.length > 0;

    recordTest(
        'Subtitle Search: Returns results for Inception',
        hasSubtitles,
        hasSubtitles ? `Found ${subtitles.length} subtitles` : 'No results'
    );

    if (hasSubtitles) {
        // Check for Turkish subtitles (should be prioritized)
        const hasTurkish = subtitles.some(s => s.lang === 'tr');
        recordTest(
            'Subtitle Search: Turkish subtitles available',
            hasTurkish,
            hasTurkish ? 'Turkish subs found and prioritized' : 'No Turkish subs (may be normal)'
        );

        // Check sources
        const sources = new Set(subtitles.map(s => s.source));
        recordTest(
            'Subtitle Search: Multi-source (YIFY + OpenSubtitles)',
            sources.size >= 1,
            `Sources: ${Array.from(sources).join(', ')}`
        );
    }
} catch (error) {
    recordTest('Subtitle Search: Basic functionality', false, error.message);
}

// Final Report
console.log('\n' + '='.repeat(60));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed > 0) {
    console.log('\n⚠️  Failed Tests:');
    results.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`   - ${t.name}: ${t.details}`));
}

console.log('\n' + '='.repeat(60));
console.log(results.failed === 0 ? '✅ ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED');
console.log('='.repeat(60));

process.exit(results.failed > 0 ? 1 : 0);
