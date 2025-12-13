import axios from 'axios';
import { getSettings } from './settings-manager';



interface TMDBReleaseDates {
    results: Array<{
        iso_3166_1: string; // Country code (US, GB, etc.)
        release_dates: Array<{
            certification: string; // G, PG, PG-13, R, NC-17, etc.
            type: number;
        }>;
    }>;
}

export interface MovieCertification {
    rating: string; // G, PG, PG-13, R, NC-17, or 'NR' (Not Rated)
    country: string; // US, GB, etc.
    isAdult: boolean;
}

/**
 * Convert IMDb ID to TMDB ID using TMDB find endpoint
 * @param imdbId - IMDb ID (e.g., "tt1234567")
 * @returns TMDB movie ID or null
 */
const convertIMDbToTMDB = async (imdbId: string): Promise<string | null> => {
    const settings = getSettings();
    const apiKey = settings.tmdbApiKey;

    if (!apiKey) {
        return null;
    }

    try {
        const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
        const { data } = await axios.get(url);

        if (data && data.movie_results && data.movie_results.length > 0) {
            const tmdbId = data.movie_results[0].id;
            console.log(`[TMDB] Converted ${imdbId} → TMDB ID: ${tmdbId}`);
            return tmdbId.toString();
        }

        console.log(`[TMDB] No TMDB match found for ${imdbId}`);
        return null;
    } catch (error) {
        console.error('[TMDB] IMDb conversion failed:', error);
        return null;
    }
};

/**
 * Fetch movie certification/rating from TMDB
 * @param imdbId - IMDb movie ID (tt1234567) - will be converted to TMDB ID
 * @returns Certification object with rating, country, and adult flag
 */
export const getTMDBCertification = async (imdbId: string): Promise<MovieCertification | null> => {
    const settings = getSettings();
    const apiKey = settings.tmdbApiKey;

    if (!apiKey) {
        console.warn('[TMDB] No API key configured');
        return null;
    }

    try {
        // First convert IMDb ID to TMDB ID
        const tmdbId = await convertIMDbToTMDB(imdbId);
        if (!tmdbId) {
            console.log(`[TMDB] Could not convert ${imdbId} to TMDB ID`);
            return null;
        }

        // Then fetch release dates which include certifications
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${apiKey}`;
        const { data } = await axios.get<TMDBReleaseDates>(url);

        if (!data || !data.results || data.results.length === 0) {
            console.log(`[TMDB] No release dates found for TMDB ID ${tmdbId}`);
            return null;
        }

        // Prioritize US certifications (most standardized)
        const usRelease = data.results.find(r => r.iso_3166_1 === 'US');
        if (usRelease && usRelease.release_dates.length > 0) {
            // Get theatrical release (type 3) or any available
            const theatrical = usRelease.release_dates.find(r => r.type === 3) || usRelease.release_dates[0];
            const rating = theatrical.certification || 'NR';

            console.log(`[TMDB] Found US rating for ${imdbId}: ${rating}`);
            return {
                rating,
                country: 'US',
                isAdult: rating === 'NC-17' || rating === 'R'
            };
        }

        // Fallback to first available certification
        const firstCountry = data.results.find(r => r.release_dates.length > 0 && r.release_dates[0].certification);
        if (firstCountry) {
            const rating = firstCountry.release_dates[0].certification || 'NR';
            console.log(`[TMDB] Found ${firstCountry.iso_3166_1} rating for ${imdbId}: ${rating}`);
            return {
                rating,
                country: firstCountry.iso_3166_1,
                isAdult: false // Conservative default for non-US ratings
            };
        }

        console.log(`[TMDB] No certification found for ${imdbId}`);
        return null;
    } catch (error) {
        console.error('[TMDB] Failed to fetch certification:', error);
        return null;
    }
};

/**
 * Check if a rating requires PIN based on profile age limit
 * @param rating - Movie rating (G, PG, PG-13, R, NC-17, NR)
 * @param profileMaxAge - Profile's maximum age limit
 * @returns true if PIN is required
 */
export const requiresPINForRating = (rating: string, profileMaxAge: number): boolean => {
    // Rating to minimum age mapping (US system)
    const ratingAges: Record<string, number> = {
        'G': 0,        // General Audiences
        'PG': 7,       // Parental Guidance
        'PG-13': 13,   // Parents Strongly Cautioned
        'R': 17,       // Restricted (17+ or with parent)
        'NC-17': 18,   // No Children (18+)
        'NR': 13       // Not Rated - assume PG-13 for safety
    };

    const requiredAge = ratingAges[rating] || 13; // Default to PG-13 if unknown
    return requiredAge > profileMaxAge;
};

/**
 * Get user-friendly description of rating
 */
export const getRatingDescription = (rating: string): string => {
    const descriptions: Record<string, string> = {
        'G': 'General Audiences - All ages',
        'PG': 'Parental Guidance Suggested',
        'PG-13': 'Parents Strongly Cautioned - 13+',
        'R': 'Restricted - 17+ or with parent',
        'NC-17': 'Adults Only - 18+',
        'NR': 'Not Rated'
    };
    return descriptions[rating] || 'Unknown Rating';
};
