import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// Lazy initialization for paths
const getSettingsPath = (): string => {
    return path.join(app.getPath('userData'), 'settings.json');
};

const getDefaultDownloadsPath = (): string => {
    return path.join(app.getPath('downloads'), 'PrismoPlayer');
};

export interface AppSettings {
    cacheLimitGB: number;
    uploadLimitKB: number; // KB/s
    downloadsPath: string;
    openSubtitlesApiKey: string;
    tmdbApiKey?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    cacheLimitGB: 10,
    uploadLimitKB: 0, // 2 MB/s
    downloadsPath: '',
    openSubtitlesApiKey: ''
};

export const getSettings = (): AppSettings => {
    if (!fs.existsSync(getSettingsPath())) {
        return { ...DEFAULT_SETTINGS, downloadsPath: getDefaultDownloadsPath() };
    }
    try {
        const data = fs.readFileSync(getSettingsPath(), 'utf-8');
        return { ...DEFAULT_SETTINGS, downloadsPath: getDefaultDownloadsPath(), ...JSON.parse(data) };
    } catch (error) {
        console.error('[Settings] Failed to read settings:', error);
        return { ...DEFAULT_SETTINGS, downloadsPath: getDefaultDownloadsPath() };
    }
};

export const saveSettings = (settings: Partial<AppSettings>) => {
    try {
        const current = getSettings();
        const newSettings = { ...current, ...settings };
        fs.writeFileSync(getSettingsPath(), JSON.stringify(newSettings, null, 2));
        console.log('[Settings] Saved:', newSettings);
        return newSettings;
    } catch (error) {
        console.error('[Settings] Failed to save settings:', error);
        return null;
    }
};
