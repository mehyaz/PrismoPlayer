import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

export interface AppSettings {
    cacheLimitGB: number;
    uploadLimitKB: number; // KB/s
    downloadsPath: string;
    openSubtitlesApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    cacheLimitGB: 10,
    uploadLimitKB: 0, // 2 MB/s
    downloadsPath: path.join(app.getPath('downloads'), 'PrismoPlayer'),
    openSubtitlesApiKey: ''
};

export const getSettings = (): AppSettings => {
    if (!fs.existsSync(settingsPath)) {
        return DEFAULT_SETTINGS;
    }
    try {
        const data = fs.readFileSync(settingsPath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (error) {
        console.error('[Settings] Failed to read settings:', error);
        return DEFAULT_SETTINGS;
    }
};

export const saveSettings = (settings: Partial<AppSettings>) => {
    try {
        const current = getSettings();
        const newSettings = { ...current, ...settings };
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
        console.log('[Settings] Saved:', newSettings);
        return newSettings;
    } catch (error) {
        console.error('[Settings] Failed to save settings:', error);
        return null;
    }
};
