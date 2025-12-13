/**
 * Safety Manager - Family Safety Shield
 * 
 * Subtitle-tabanlı akıllı sessize alma (Smart Mute) sistemi.
 * Altyazılardan küfür ve uygunsuz kelimeleri tespit eder, 
 * oynatma sırasında otomatik sessize alır ve metni sansürler.
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// Lazy initialization
let customWordsPath: string | null = null;
const getCustomWordsPath = (): string => {
    if (!customWordsPath) {
        customWordsPath = path.join(app.getPath('userData'), 'custom-blocked-words.json');
    }
    return customWordsPath;
};

// Sessize alınacak zaman aralığı
export interface MuteRange {
    start: number;          // Saniye
    end: number;            // Saniye
    reason: string;         // Kategorisi
    originalWord: string;   // Orijinal kelime
    replacement: string;    // Değiştirilen metin
}

// Parse edilmiş altyazı bloğu
export interface SubtitleCue {
    start: number;
    end: number;
    text: string;
}

// Default profanity list (English + Turkish)
const DEFAULT_BLOCKLIST: Record<string, string[]> = {
    en: [
        // F-word variations
        'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'motherfucking',
        // S-word
        'shit', 'shitting', 'bullshit', 'shitty',
        // Other common
        'asshole', 'bitch', 'bastard', 'damn', 'crap', 'piss', 'dick', 'cock',
        'pussy', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard'
    ],
    tr: [
        // Turkish profanity
        'siktir', 'amk', 'orospu', 'piç', 'göt', 'yarrak', 'am', 'sikik',
        'kahpe', 'pezevenk', 'ibne', 'gavat', 'bok', 'sik', 'dalyarak'
    ]
};

class SafetyManager {
    private blocklist: Set<string>;
    private customWords: Set<string>;
    private muteRanges: MuteRange[] = [];

    constructor() {
        this.blocklist = new Set<string>();
        this.customWords = new Set<string>();

        // Default kelimeleri yükle
        this.loadDefaultBlocklist();

        // Custom kelimeleri yükle
        this.loadCustomWords();
    }

    /**
     * Varsayılan blocklist'i yükler (tüm diller)
     */
    private loadDefaultBlocklist(): void {
        Object.values(DEFAULT_BLOCKLIST).forEach(words => {
            words.forEach(word => this.blocklist.add(word.toLowerCase()));
        });
        console.log(`[SafetyManager] Loaded ${this.blocklist.size} blocked words`);
    }

    /**
     * Kullanıcının eklediği özel kelimeleri yükler
     */
    private loadCustomWords(): void {
        try {
            if (fs.existsSync(getCustomWordsPath())) {
                const data = fs.readFileSync(getCustomWordsPath(), 'utf-8');
                const words: string[] = JSON.parse(data);
                words.forEach(word => {
                    this.customWords.add(word.toLowerCase());
                    this.blocklist.add(word.toLowerCase());
                });
                console.log(`[SafetyManager] Loaded ${this.customWords.size} custom words`);
            }
        } catch (error) {
            console.error('[SafetyManager] Failed to load custom words:', error);
        }
    }

    /**
     * Özel kelime ekler
     */
    addCustomWord(word: string): boolean {
        const normalized = word.toLowerCase().trim();
        if (!normalized) return false;

        this.customWords.add(normalized);
        this.blocklist.add(normalized);

        try {
            const words = Array.from(this.customWords);
            fs.writeFileSync(getCustomWordsPath(), JSON.stringify(words, null, 2));
            console.log(`[SafetyManager] Added custom word: ${normalized}`);
            return true;
        } catch (error) {
            console.error('[SafetyManager] Failed to save custom word:', error);
            return false;
        }
    }

    /**
     * Özel kelime siler
     */
    removeCustomWord(word: string): boolean {
        const normalized = word.toLowerCase().trim();

        if (!this.customWords.has(normalized)) return false;

        this.customWords.delete(normalized);

        // Default listede değilse blocklist'ten de sil
        const isInDefault = Object.values(DEFAULT_BLOCKLIST)
            .flat()
            .map(w => w.toLowerCase())
            .includes(normalized);

        if (!isInDefault) {
            this.blocklist.delete(normalized);
        }

        try {
            const words = Array.from(this.customWords);
            fs.writeFileSync(getCustomWordsPath(), JSON.stringify(words, null, 2));
            console.log(`[SafetyManager] Removed custom word: ${normalized}`);
            return true;
        } catch (error) {
            console.error('[SafetyManager] Failed to save:', error);
            return false;
        }
    }

    /**
     * Tüm engelli kelimeleri döner
     */
    getBlockedWords(): string[] {
        return Array.from(this.blocklist);
    }

    /**
     * Özel kelimeleri döner
     */
    getCustomWords(): string[] {
        return Array.from(this.customWords);
    }

    /**
     * VTT/SRT formatındaki altyazıyı parse eder
     */
    parseSubtitle(content: string): SubtitleCue[] {
        const cues: SubtitleCue[] = [];

        // VTT formatını tespit et (gelecekte kullanılabilir)


        // Zaman damgası regex'i (SRT ve VTT için)
        // VTT: 00:00:00.000 --> 00:00:02.000
        // SRT: 00:00:00,000 --> 00:00:02,000
        const timeRegex = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/g;

        const blocks = content.split(/\n\s*\n/);

        blocks.forEach(block => {
            const timeMatch = timeRegex.exec(block);
            if (!timeMatch) return;

            // Reset regex state
            timeRegex.lastIndex = 0;

            const startTime = this.parseTime(timeMatch[1]);
            const endTime = this.parseTime(timeMatch[2]);

            // Zaman satırından sonraki metin
            const lines = block.split('\n');
            const textStartIndex = lines.findIndex(line => timeRegex.test(line));
            timeRegex.lastIndex = 0;

            if (textStartIndex === -1) return;

            const textLines = lines.slice(textStartIndex + 1);
            const text = textLines
                .join(' ')
                .replace(/<[^>]+>/g, '')  // HTML tag'lerini kaldır
                .trim();

            if (text && startTime < endTime) {
                cues.push({ start: startTime, end: endTime, text });
            }
        });

        console.log(`[SafetyManager] Parsed ${cues.length} subtitle cues`);
        return cues;
    }

    /**
     * Zaman damgasını saniyeye çevirir
     */
    private parseTime(timeStr: string): number {
        // 00:00:00.000 veya 00:00:00,000
        const normalized = timeStr.replace(',', '.');
        const parts = normalized.split(':');

        if (parts.length !== 3) return 0;

        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const secondsParts = parts[2].split('.');
        const seconds = parseInt(secondsParts[0], 10);
        const milliseconds = parseInt(secondsParts[1] || '0', 10);

        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }

    /**
     * Altyazı içeriğini analiz eder ve mute range'lerini döner
     */
    analyzeSubtitles(content: string): MuteRange[] {
        const cues = this.parseSubtitle(content);
        this.muteRanges = [];

        cues.forEach(cue => {
            const words = cue.text.toLowerCase().split(/\s+/);

            words.forEach(word => {
                // Noktalama işaretlerini temizle
                const cleanWord = word.replace(/[.,!?;:"'()[\]{}]/g, '');

                if (this.blocklist.has(cleanWord)) {
                    // Bu cue için mute range ekle
                    // Küçük bir buffer ekle (0.3 saniye önce ve sonra)
                    const existingRange = this.muteRanges.find(
                        r => Math.abs(r.start - cue.start) < 0.5
                    );

                    if (!existingRange) {
                        this.muteRanges.push({
                            start: Math.max(0, cue.start - 0.3),
                            end: cue.end + 0.3,
                            reason: 'profanity',
                            originalWord: cleanWord,
                            replacement: '*'.repeat(cleanWord.length)
                        });
                    } else {
                        // Mevcut range'i genişlet
                        existingRange.end = Math.max(existingRange.end, cue.end + 0.3);
                        existingRange.originalWord += ', ' + cleanWord;
                    }
                }
            });
        });

        console.log(`[SafetyManager] Found ${this.muteRanges.length} mute ranges`);
        return this.muteRanges;
    }

    /**
     * Belirli bir zamanın unsafe olup olmadığını kontrol eder
     */
    isTimeUnsafe(currentTime: number): boolean {
        return this.muteRanges.some(
            range => currentTime >= range.start && currentTime <= range.end
        );
    }

    /**
     * Metni sansürler
     */
    censorText(text: string): string {
        let censored = text;

        this.blocklist.forEach(word => {
            // Case-insensitive replace
            const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
            censored = censored.replace(regex, '*'.repeat(word.length));
        });

        return censored;
    }

    /**
     * Regex special karakterlerini escape eder
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Mute range'lerini döner
     */
    getMuteRanges(): MuteRange[] {
        return this.muteRanges;
    }

    /**
     * Mute range'lerini temizler
     */
    clearMuteRanges(): void {
        this.muteRanges = [];
    }
}

// Singleton instance
let safetyManagerInstance: SafetyManager | null = null;

export const getSafetyManager = (): SafetyManager => {
    if (!safetyManagerInstance) {
        safetyManagerInstance = new SafetyManager();
    }
    return safetyManagerInstance;
};

// Export convenience functions
export const analyzeSubtitles = (content: string): MuteRange[] => {
    return getSafetyManager().analyzeSubtitles(content);
};

export const isTimeUnsafe = (currentTime: number): boolean => {
    return getSafetyManager().isTimeUnsafe(currentTime);
};

export const censorText = (text: string): string => {
    return getSafetyManager().censorText(text);
};

export const addBlockedWord = (word: string): boolean => {
    return getSafetyManager().addCustomWord(word);
};

export const removeBlockedWord = (word: string): boolean => {
    return getSafetyManager().removeCustomWord(word);
};

export const getBlockedWords = (): string[] => {
    return getSafetyManager().getBlockedWords();
};

export const getCustomBlockedWords = (): string[] => {
    return getSafetyManager().getCustomWords();
};

export const getMuteRanges = (): MuteRange[] => {
    return getSafetyManager().getMuteRanges();
};
