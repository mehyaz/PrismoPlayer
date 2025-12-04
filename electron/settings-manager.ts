import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

export interface AppSettings {
    cacheLimitGB: number;
    uploadLimitKB: number; // KB/s
    downloadsPath: string;
}

const defaultSettings: AppSettings = {
    cacheLimitGB: 15,
    uploadLimitKB: 2048, // 2 MB/s
    downloadsPath: path.join(app.getPath('userData'), 'PrismoPlayerCache')
};

export const getSettings = (): AppSettings => {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            return { ...defaultSettings, ...JSON.parse(data) };
        }
    } catch (error) {
        console.error('[Settings] Failed to read settings:', error);
    }
    return defaultSettings;
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
