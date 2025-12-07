import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.m4v'];

export interface ScannedFile {
    id: string;
    path: string;
    name: string;
    size: number;
    birthtime: number;
    format: string;
}

const generateId = (filePath: string) => {
    return crypto.createHash('md5').update(filePath).digest('hex');
};

export const scanFolder = async (folderPath: string): Promise<ScannedFile[]> => {
    const results: ScannedFile[] = [];

    try {
        const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);

            if (entry.isDirectory()) {
                // Recursive scan
                const subResults = await scanFolder(fullPath);
                results.push(...subResults);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (VIDEO_EXTENSIONS.includes(ext)) {
                    const stats = await fs.promises.stat(fullPath);
                    results.push({
                        id: generateId(fullPath),
                        path: fullPath,
                        name: entry.name,
                        size: stats.size,
                        birthtime: stats.birthtimeMs,
                        format: ext.replace('.', '')
                    });
                }
            }
        }
    } catch (error) {
        console.error(`[Library] Error scanning folder ${folderPath}:`, error);
    }

    return results;
};
