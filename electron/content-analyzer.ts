/**
 * Content Analyzer - Family Safety Shield
 * 
 * IMDb Parents Guide ve TMDB verilerini analiz ederek içerik risk skoru oluşturur.
 * Aileler için güvenli içerik filtreleme sisteminin temel bileşenidir.
 */

import { getParentsGuide, ParentsGuideItem } from './scraper';

// Risk kategorileri ve anahtar kelimeler
const RISK_KEYWORDS = {
    violence: [
        'blood', 'gore', 'murder', 'torture', 'death', 'brutal', 'kill', 'shot', 'stab',
        'beat', 'fight', 'wound', 'injury', 'assault', 'violence', 'attack', 'war',
        'kan', 'şiddet', 'ölüm', 'cinayet', 'dövüş', 'kavga', 'yaralanma'
    ],
    sexuality: [
        'nude', 'sex', 'breast', 'naked', 'intercourse', 'explicit', 'erotic', 'sexual',
        'topless', 'buttocks', 'genitals', 'affair', 'adultery', 'seductive', 'sensual',
        'çıplak', 'seks', 'cinsel', 'erotik', 'yetişkin'
    ],
    profanity: [
        'f-word', 'f***', 's***', 'profanity', 'slur', 'damn', 'hell', 'ass', 'bastard',
        'bitch', 'crap', 'piss', 'racial', 'derogatory', 'offensive', 'vulgar',
        'küfür', 'argo', 'hakaret', 'kötü söz'
    ],
    substances: [
        'drug', 'cocaine', 'alcohol', 'smoking', 'marijuana', 'heroin', 'overdose',
        'drunk', 'intoxicated', 'cigarette', 'beer', 'wine', 'pills', 'injection',
        'uyuşturucu', 'alkol', 'sigara', 'içki', 'sarhoş'
    ],
    frightening: [
        'scary', 'horror', 'disturbing', 'intense', 'nightmare', 'creepy', 'terror',
        'jump scare', 'graphic', 'shocking', 'traumatic', 'unsettling', 'disturbing',
        'korkunç', 'ürkütücü', 'rahatsız edici', 'travmatik'
    ]
};

// Severity multipliers
const SEVERITY_SCORES: Record<string, number> = {
    'None': 0,
    'Mild': 25,
    'Moderate': 60,
    'Severe': 100,
    'Unknown': 30
};

// Category mappings from Parents Guide
const CATEGORY_MAPPINGS: Record<string, keyof typeof RISK_KEYWORDS> = {
    'Sex & Nudity': 'sexuality',
    'Violence & Gore': 'violence',
    'Profanity': 'profanity',
    'Alcohol, Drugs & Smoking': 'substances',
    'Frightening & Intense Scenes': 'frightening'
};

export interface ContentRiskScore {
    overall: 'safe' | 'caution' | 'warning' | 'danger';
    overallScore: number;           // 0-100
    violence: number;               // 0-100
    sexuality: number;              // 0-100
    profanity: number;              // 0-100
    substances: number;             // 0-100
    frightening: number;            // 0-100
    flags: string[];                // Detected keywords
    ageRecommendation: string;      // '7+', '13+', '16+', '18+'
    categories: CategoryAnalysis[];
}

export interface CategoryAnalysis {
    name: string;
    status: string;
    score: number;
    keywords: string[];
    items: string[];
}

/**
 * Bir metin içindeki risk anahtar kelimelerini bulur
 */
const findKeywords = (text: string, category: keyof typeof RISK_KEYWORDS): string[] => {
    const lowerText = text.toLowerCase();
    return RISK_KEYWORDS[category].filter(keyword =>
        lowerText.includes(keyword.toLowerCase())
    );
};

/**
 * Parents Guide öğelerini analiz eder ve keyword'leri çıkarır
 */
const analyzeCategory = (items: string[], category: keyof typeof RISK_KEYWORDS): string[] => {
    const allKeywords: string[] = [];
    items.forEach(item => {
        const found = findKeywords(item, category);
        allKeywords.push(...found);
    });
    return [...new Set(allKeywords)]; // Unique keywords
};

/**
 * Severity string'ini skora çevirir
 */
const getSeverityScore = (status: string): number => {
    return SEVERITY_SCORES[status] ?? SEVERITY_SCORES['Unknown'];
};

/**
 * Overall skordan yaş önerisi hesaplar
 */
const calculateAgeRecommendation = (score: ContentRiskScore): string => {
    const maxScore = Math.max(
        score.violence,
        score.sexuality,
        score.profanity,
        score.substances,
        score.frightening
    );

    // Sexuality ve gore için daha strict
    if (score.sexuality >= 70 || score.violence >= 80) return '18+';
    if (maxScore >= 70) return '18+';
    if (maxScore >= 50) return '16+';
    if (maxScore >= 25) return '13+';
    return '7+';
};

/**
 * Overall kategorisini hesaplar
 */
const calculateOverallCategory = (score: number): 'safe' | 'caution' | 'warning' | 'danger' => {
    if (score >= 70) return 'danger';
    if (score >= 50) return 'warning';
    if (score >= 25) return 'caution';
    return 'safe';
};

/**
 * IMDb ID ile içerik analizi yapar
 */
export const analyzeContent = async (imdbId: string): Promise<ContentRiskScore> => {
    console.log(`[ContentAnalyzer] Analyzing content: ${imdbId}`);

    try {
        // Parents Guide verisini al
        const parentsGuide = await getParentsGuide(imdbId);

        // Başlangıç skorları
        const scores: ContentRiskScore = {
            overall: 'safe',
            overallScore: 0,
            violence: 0,
            sexuality: 0,
            profanity: 0,
            substances: 0,
            frightening: 0,
            flags: [],
            ageRecommendation: '7+',
            categories: []
        };

        // Her kategoriyi analiz et
        parentsGuide.forEach((category: ParentsGuideItem) => {
            const mappedCategory = CATEGORY_MAPPINGS[category.category];
            if (!mappedCategory) return;

            const severityScore = getSeverityScore(category.status);
            const keywords = analyzeCategory(category.items, mappedCategory);

            // Keyword bonus: Her keyword skoru %5 artırır (max +20)
            const keywordBonus = Math.min(keywords.length * 5, 20);
            const finalScore = Math.min(severityScore + keywordBonus, 100);

            // Skoru ata
            scores[mappedCategory] = finalScore;

            // Detected keywords'ü ekle
            scores.flags.push(...keywords);

            // Kategori analizini kaydet
            scores.categories.push({
                name: category.category,
                status: category.status,
                score: finalScore,
                keywords,
                items: category.items
            });
        });

        // Overall skoru hesapla (ağırlıklı ortalama)
        const weights = {
            sexuality: 1.5,    // Sexuality daha ağır
            violence: 1.3,     // Violence daha ağır
            profanity: 0.8,
            substances: 0.9,
            frightening: 1.0
        };

        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        scores.overallScore = Math.round(
            (scores.sexuality * weights.sexuality +
                scores.violence * weights.violence +
                scores.profanity * weights.profanity +
                scores.substances * weights.substances +
                scores.frightening * weights.frightening) / totalWeight
        );

        // Overall kategori ve yaş önerisi
        scores.overall = calculateOverallCategory(scores.overallScore);
        scores.ageRecommendation = calculateAgeRecommendation(scores);

        // Unique flags
        scores.flags = [...new Set(scores.flags)];

        console.log(`[ContentAnalyzer] Analysis complete:`, {
            imdbId,
            overall: scores.overall,
            score: scores.overallScore,
            age: scores.ageRecommendation
        });

        return scores;

    } catch (error) {
        console.error('[ContentAnalyzer] Error analyzing content:', error);

        // Hata durumunda güvenli varsayılan
        return {
            overall: 'caution',
            overallScore: 30,
            violence: 0,
            sexuality: 0,
            profanity: 0,
            substances: 0,
            frightening: 0,
            flags: [],
            ageRecommendation: '13+',
            categories: []
        };
    }
};

/**
 * Belirli bir profil için içeriğin güvenli olup olmadığını kontrol eder
 */
export const isContentSafeForAge = (score: ContentRiskScore, maxAge: number): boolean => {
    const ageNum = parseInt(score.ageRecommendation);
    return ageNum <= maxAge;
};

/**
 * Belirli kategorilerin engellenip engellenmediğini kontrol eder
 */
export const hasBlockedCategories = (
    score: ContentRiskScore,
    blockedCategories: string[]
): { blocked: boolean; reasons: string[] } => {
    const reasons: string[] = [];

    blockedCategories.forEach(category => {
        const categoryScore = score[category as keyof ContentRiskScore];
        if (typeof categoryScore === 'number' && categoryScore >= 50) {
            reasons.push(`${category}: ${categoryScore}% risk detected`);
        }
    });

    return {
        blocked: reasons.length > 0,
        reasons
    };
};
