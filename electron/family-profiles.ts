/**
 * Family Profiles - Family Safety Shield
 * 
 * Önceden tanımlı aile profilleri ve tercih yönetimi.
 * Her profil farklı yaş grupları için uygun içerik filtreleme kuralları içerir.
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// Lazy initialization
let profilesPath: string | null = null;
const getProfilesPath = (): string => {
    if (!profilesPath) {
        profilesPath = path.join(app.getPath('userData'), 'family-profiles.json');
    }
    return profilesPath;
};

// Profil interface'i
export interface FamilyProfile {
    id: string;
    name: string;
    icon: string;                      // Emoji icon
    maxAge: number;                    // Maximum allowed age rating
    blockedCategories: string[];       // ['sexuality', 'violence', etc.]
    allowedGenres: string[];           // ['animation', 'family', 'comedy']
    blockedKeywords: string[];         // Custom blocked keywords
    requirePin: boolean;               // PIN required for access
    isDefault: boolean;                // Default profile
    isCustom: boolean;                 // User-created profile
}

export interface ProfilesData {
    activeProfileId: string;
    profiles: FamilyProfile[];
    parentalPin: string | null;        // Hashed PIN
}

// Varsayılan profiller
const DEFAULT_PROFILES: FamilyProfile[] = [
    {
        id: 'kids-7',
        name: 'Çocuklar (7+)',
        icon: '👶',
        maxAge: 7,
        blockedCategories: ['sexuality', 'violence', 'profanity', 'substances', 'frightening'],
        allowedGenres: ['Animation', 'Family', 'Comedy', 'Adventure', 'Fantasy'],
        blockedKeywords: [],
        requirePin: false,
        isDefault: false,
        isCustom: false
    },
    {
        id: 'teens-13',
        name: 'Gençler (13+)',
        icon: '👦',
        maxAge: 13,
        blockedCategories: ['sexuality', 'substances'],
        allowedGenres: [],  // All allowed
        blockedKeywords: ['explicit', 'nudity', 'drug'],
        requirePin: false,
        isDefault: true,
        isCustom: false
    },
    {
        id: 'family-16',
        name: 'Aile (16+)',
        icon: '👨‍👩‍👧',
        maxAge: 16,
        blockedCategories: ['sexuality'],
        allowedGenres: [],
        blockedKeywords: ['explicit', 'porn'],
        requirePin: false,
        isDefault: false,
        isCustom: false
    },
    {
        id: 'adult',
        name: 'Yetişkin (18+)',
        icon: '👤',
        maxAge: 18,
        blockedCategories: [],
        allowedGenres: [],
        blockedKeywords: [],
        requirePin: true,
        isDefault: false,
        isCustom: false
    }
];

const DEFAULT_PROFILES_DATA: ProfilesData = {
    activeProfileId: 'teens-13',
    profiles: DEFAULT_PROFILES,
    parentalPin: null
};

/**
 * Profil verilerini yükler
 */
export const getProfiles = (): ProfilesData => {
    if (!fs.existsSync(getProfilesPath())) {
        return DEFAULT_PROFILES_DATA;
    }
    try {
        const data = fs.readFileSync(getProfilesPath(), 'utf-8');
        const parsed = JSON.parse(data);

        // Merge with defaults to ensure all default profiles exist
        const existingIds = parsed.profiles.map((p: FamilyProfile) => p.id);

        // Add missing default profiles
        DEFAULT_PROFILES.forEach(defaultProfile => {
            if (!existingIds.includes(defaultProfile.id)) {
                parsed.profiles.push(defaultProfile);
            }
        });

        return { ...DEFAULT_PROFILES_DATA, ...parsed };
    } catch (error) {
        console.error('[FamilyProfiles] Failed to read profiles:', error);
        return DEFAULT_PROFILES_DATA;
    }
};

/**
 * Profil verilerini kaydeder
 */
export const saveProfiles = (data: Partial<ProfilesData>): ProfilesData => {
    try {
        const current = getProfiles();
        const newData = { ...current, ...data };
        fs.writeFileSync(getProfilesPath(), JSON.stringify(newData, null, 2));
        console.log('[FamilyProfiles] Saved profiles');
        return newData;
    } catch (error) {
        console.error('[FamilyProfiles] Failed to save profiles:', error);
        return getProfiles();
    }
};

/**
 * Aktif profili döner
 */
export const getActiveProfile = (): FamilyProfile => {
    const data = getProfiles();
    const activeProfile = data.profiles.find(p => p.id === data.activeProfileId);
    return activeProfile || data.profiles.find(p => p.isDefault) || DEFAULT_PROFILES[1];
};

/**
 * Aktif profili değiştirir
 */
export const setActiveProfile = (profileId: string): FamilyProfile | null => {
    const data = getProfiles();
    const profile = data.profiles.find(p => p.id === profileId);

    if (!profile) {
        console.error('[FamilyProfiles] Profile not found:', profileId);
        return null;
    }

    saveProfiles({ activeProfileId: profileId });
    console.log('[FamilyProfiles] Active profile changed to:', profile.name);
    return profile;
};

/**
 * Yeni özel profil oluşturur
 */
export const createProfile = (profile: Omit<FamilyProfile, 'id' | 'isCustom'>): FamilyProfile => {
    const data = getProfiles();

    const newProfile: FamilyProfile = {
        ...profile,
        id: `custom-${Date.now()}`,
        isCustom: true
    };

    data.profiles.push(newProfile);
    saveProfiles({ profiles: data.profiles });

    console.log('[FamilyProfiles] Created new profile:', newProfile.name);
    return newProfile;
};

/**
 * Profili günceller
 */
export const updateProfile = (profileId: string, updates: Partial<FamilyProfile>): FamilyProfile | null => {
    const data = getProfiles();
    const index = data.profiles.findIndex(p => p.id === profileId);

    if (index === -1) {
        console.error('[FamilyProfiles] Profile not found:', profileId);
        return null;
    }

    // Varsayılan profiller silinemez ama bazı ayarları değiştirilebilir
    const profile = data.profiles[index];

    // Custom profiller tamamen düzenlenebilir
    if (profile.isCustom) {
        data.profiles[index] = { ...profile, ...updates };
    } else {
        // Default profiller için sadece bazı alanlar düzenlenebilir
        data.profiles[index] = {
            ...profile,
            blockedKeywords: updates.blockedKeywords ?? profile.blockedKeywords,
            requirePin: updates.requirePin ?? profile.requirePin
        };
    }

    saveProfiles({ profiles: data.profiles });
    return data.profiles[index];
};

/**
 * Özel profili siler
 */
export const deleteProfile = (profileId: string): boolean => {
    const data = getProfiles();
    const profile = data.profiles.find(p => p.id === profileId);

    if (!profile) {
        console.error('[FamilyProfiles] Profile not found:', profileId);
        return false;
    }

    if (!profile.isCustom) {
        console.error('[FamilyProfiles] Cannot delete default profile:', profileId);
        return false;
    }

    data.profiles = data.profiles.filter(p => p.id !== profileId);

    // Aktif profil siliniyorsa varsayılana geç
    if (data.activeProfileId === profileId) {
        const defaultProfile = data.profiles.find(p => p.isDefault);
        data.activeProfileId = defaultProfile?.id || data.profiles[0].id;
    }

    saveProfiles(data);
    return true;
};

/**
 * Parental PIN ayarlar (hash'lenmiş)
 */
export const setParentalPin = (pin: string): boolean => {
    try {
        // Basit hash (production'da bcrypt kullanılmalı)
        const hashedPin = Buffer.from(pin).toString('base64');
        saveProfiles({ parentalPin: hashedPin });
        console.log('[FamilyProfiles] Parental PIN set');
        return true;
    } catch (error) {
        console.error('[FamilyProfiles] Failed to set PIN:', error);
        return false;
    }
};

/**
 * Parental PIN doğrular
 */
export const verifyParentalPin = (pin: string): boolean => {
    const data = getProfiles();
    if (!data.parentalPin) return true; // PIN ayarlanmamışsa her zaman geçerli

    const hashedPin = Buffer.from(pin).toString('base64');
    return hashedPin === data.parentalPin;
};

/**
 * PIN ayarlanmış mı kontrol eder
 */
export const isPinSet = (): boolean => {
    const data = getProfiles();
    return data.parentalPin !== null;
};
