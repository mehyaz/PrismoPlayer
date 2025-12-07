import React, { useEffect, useState } from 'react';
import { X, Save, Trash2, Folder, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<AppSettings>({
        cacheLimitGB: 15,
        uploadLimitKB: 2048,
        downloadsPath: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('get-settings');
            setSettings(data);
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await window.ipcRenderer.invoke('save-settings', settings);
            onClose();
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearCache = async () => {
        if (confirm('Are you sure you want to clear all downloaded cache? This cannot be undone.')) {
            try {
                await window.ipcRenderer.invoke('clear-cache');
                alert('Cache cleared successfully.');
            } catch (error) {
                console.error('Failed to clear cache:', error);
                alert('Failed to clear cache.');
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="text-cyan-400" size={20} />
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="text-center text-white/40 py-8">Loading settings...</div>
                    ) : (
                        <>
                            {/* Cache Limit */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">Cache Limit (GB)</label>
                                <p className="text-xs text-white/40">Maximum disk space used for storing movies.</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.cacheLimitGB}
                                        onChange={(e) => setSettings({ ...settings, cacheLimitGB: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                                        min="1"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">GB</span>
                                </div>
                            </div>

                            {/* Upload Limit */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">Upload Speed Limit (KB/s)</label>
                                <p className="text-xs text-white/40">Limit upload bandwidth to peers.</p>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.uploadLimitKB}
                                        onChange={(e) => setSettings({ ...settings, uploadLimitKB: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                                        min="0"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">KB/s</span>
                                </div>
                            </div>

                            {/* OpenSubtitles API Key */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80">OpenSubtitles API Key</label>
                                <p className="text-xs text-white/40">Required for additional subtitles. <a href="https://www.opensubtitles.com/en/consumers" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Get a free key here.</a></p>
                                <input
                                    type="text"
                                    value={settings.openSubtitlesApiKey || ''}
                                    onChange={(e) => setSettings({ ...settings, openSubtitlesApiKey: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all font-mono text-sm placeholder:text-white/20"
                                    placeholder="Enter your API Key..."
                                />
                            </div>

                            {/* Download Path (Read Only) */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                                    <Folder size={14} /> Cache Location
                                </label>
                                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/60 break-all select-all">
                                    {settings.downloadsPath}
                                </div>
                            </div>

                            {/* Clear Cache Action */}
                            <div className="pt-4 border-t border-white/10">
                                <button
                                    onClick={handleClearCache}
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all group"
                                >
                                    <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                                    <span>Clear Cache Now</span>
                                </button>
                                <p className="text-[10px] text-center text-white/30 mt-2">
                                    This will delete all downloaded movies from your disk.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
