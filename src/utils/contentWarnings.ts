export interface ContentWarning {
    category: string;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    items: string[];
}

interface ParentsGuideItem {
    category: string;
    status: string;
    items: string[];
}

/**
 * Convert IMDb status to severity level
 */
function statusToSeverity(status: string): 'none' | 'mild' | 'moderate' | 'severe' {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('severe') || lowerStatus.includes('high')) {
        return 'severe';
    }
    if (lowerStatus.includes('moderate') || lowerStatus.includes('medium')) {
        return 'moderate';
    }
    if (lowerStatus.includes('mild') || lowerStatus.includes('low') || lowerStatus.includes('some')) {
        return 'mild';
    }
    if (lowerStatus.includes('none') || lowerStatus.includes('no')) {
        return 'none';
    }
    return 'moderate'; // Default
}

/**
 * Estimate MPAA-style rating from content warnings
 * Uses a point-based system to analyze severity across categories
 * @param warnings - Array of content warnings from Parents Guide
 * @returns Estimated rating: G, PG, PG-13, R, or NC-17
 */
export function estimateRatingFromWarnings(warnings: ContentWarning[]): string {
    if (!warnings || warnings.length === 0) {
        return 'Not Rated';
    }

    // Severity point values
    const severityPoints: Record<string, number> = {
        'none': 0,
        'mild': 1,
        'moderate': 2,
        'severe': 3
    };

    // Category weights (some categories have more impact on rating)
    const categoryWeights: Record<string, number> = {
        'SEX & NUDITY': 1.5,
        'VIOLENCE & GORE': 1.3,
        'PROFANITY': 1.0,
        'ALCOHOL, DRUGS & SMOKING': 1.0,
        'FRIGHTENING & INTENSE SCENES': 0.8
    };

    let totalScore = 0;
    let maxSeverity = 0;
    let hasSevereContent = false;
    let hasSexNudity = false;

    for (const warning of warnings) {
        const points = severityPoints[warning.severity] || 0;
        const category = warning.category.toUpperCase();
        const weight = categoryWeights[category] || 1.0;

        totalScore += points * weight;

        if (points > maxSeverity) {
            maxSeverity = points;
        }

        if (warning.severity === 'severe') {
            hasSevereContent = true;

            // Check for explicit sexual content
            if (category.includes('SEX') || category.includes('NUDITY')) {
                hasSexNudity = true;
            }
        }
    }

    // Rating decision logic
    // NC-17: Severe sexual content or extreme violence
    if (hasSexNudity && hasSevereContent) {
        return 'NC-17';
    }

    // R: Any severe content or high total score
    if (hasSevereContent || totalScore >= 8) {
        return 'R';
    }

    // PG-13: Moderate content in multiple categories or high moderate score
    if (maxSeverity >= 2 || totalScore >= 5) {
        return 'PG-13';
    }

    // PG: Some mild content
    if (totalScore >= 2) {
        return 'PG';
    }

    // G: Minimal or no concerning content
    return 'G';
}

/**
 * Fetch real parents guide data from IMDb via IPC
 * @param imdbId - IMDb ID (e.g., "tt1234567")
 * @returns Array of content warnings
 */
export async function fetchParentsGuide(imdbId: string): Promise<ContentWarning[]> {
    try {
        if (!window.ipcRenderer) {
            console.warn('[ContentWarnings] IPC not available');
            return [];
        }

        const guide = await window.ipcRenderer.invoke('get-parents-guide', imdbId) as ParentsGuideItem[];

        if (!Array.isArray(guide) || guide.length === 0) {
            console.log('[ContentWarnings] No parents guide data found for', imdbId);
            return [];
        }

        // Convert to ContentWarning format
        return guide.map(item => ({
            category: item.category.toUpperCase(),
            severity: statusToSeverity(item.status),
            items: item.items.slice(0, 5) // Limit to first 5 items per category
        })).filter(w => w.items.length > 0 || w.severity !== 'none');

    } catch (error) {
        console.error('[ContentWarnings] Failed to fetch parents guide:', error);
        return [];
    }
}

/**
 * Simple demo mapping of movie titles to content warnings.
 * Fallback when real data is not available.
 */
export function getContentWarnings(movieTitle: string): ContentWarning[] {
    const lower = movieTitle.toLowerCase();

    // Example mapping for demonstration purposes
    if (lower.includes('jurassic') || lower.includes('dinosaur')) {
        return [
            {
                category: 'VIOLENCE & GORE',
                severity: 'moderate',
                items: ['Dinosaur attacks', 'Intense chase sequences', 'Some blood'],
            },
            {
                category: 'PROFANITY',
                severity: 'mild',
                items: ['Mild language'],
            },
            {
                category: 'FRIGHTENING SCENES',
                severity: 'moderate',
                items: ['Intense suspense', 'Jump scares', 'Perilous situations'],
            },
        ];
    }

    // Default empty warnings
    return [];
}

