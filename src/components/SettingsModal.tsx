import React, { useEffect, useState } from 'react';
import { X, Save, Trash2, Folder, Settings as SettingsIcon, Loader2, Shield, User, Lock } from 'lucide-react';
import { AppSettings } from '../types';

interface FamilyProfile {
    id: string;
    name: string;
    icon: string;
    maxAge: number;
    requirePin: boolean;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'general' | 'family';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [settings, setSettings] = useState<AppSettings>({
        cacheLimitGB: 15,
        uploadLimitKB: 2048,
        downloadsPath: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Family Safety State
    const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
    const [activeProfile, setActiveProfileState] = useState<FamilyProfile | null>(null);
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [isPinSet, setIsPinSet] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            loadFamilyProfiles();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('get-settings') as AppSettings;
            setSettings(data);
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadFamilyProfiles = async () => {
        try {
            const data = await window.ipcRenderer.invoke('family:get-profiles') as { profiles: FamilyProfile[] };
            setProfiles(data.profiles || []);

            const active = await window.ipcRenderer.invoke('family:get-active-profile') as FamilyProfile | null;
            setActiveProfileState(active);

            const pinStatus = await window.ipcRenderer.invoke('family:is-pin-set') as boolean;
            setIsPinSet(pinStatus);
        } catch (error) {
            console.error('Failed to load family profiles:', error);
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

    const handleProfileChange = async (profileId: string) => {
        try {
            const newProfile = await window.ipcRenderer.invoke('family:set-active-profile', profileId) as FamilyProfile | null;
            setActiveProfileState(newProfile);
        } catch (error) {
            console.error('Failed to change profile:', error);
            alert('Failed to change profile');
        }
    };

    const handleSetPin = async () => {
        if (pin !== pinConfirm) {
            alert('PIN codes do not match!');
            return;
        }
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            alert('PIN must be 4 digits');
            return;
        }

        try {
            await window.ipcRenderer.invoke('family:set-pin', pin);
            setIsPinSet(true);
            setPin('');
            setPinConfirm('');
            alert('PIN set successfully!');
        } catch (error) {
            console.error('Failed to set PIN:', error);
            alert('Failed to set PIN');
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

            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="text-cyan-400" size={20} />
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-white/5 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'general'
                            ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <SettingsIcon size={16} />
                            General
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('family')}
                        className={`flex-1 px-6 py-3 text-sm font-medium transition-all ${activeTab === 'family'
                            ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Shield size={16} />
                            Family Safety
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {activeTab === 'general' && (
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

                                    {/* TMDB API Key */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/80">TMDB API Key</label>
                                        <p className="text-xs text-white/40">For age ratings & content filtering. <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">Get yours here.</a></p>
                                        <input
                                            type="text"
                                            value={settings.tmdbApiKey || ''}
                                            onChange={(e) => setSettings({ ...settings, tmdbApiKey: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-mono text-sm placeholder:text-white/20"
                                            placeholder="Enter your TMDB API Key..."
                                        />
                                    </div>

                                    {/* Download Path */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                                            <Folder size={14} /> Cache Location
                                        </label>
                                        <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white/60 break-all select-all">
                                            {settings.downloadsPath}
                                        </div>
                                    </div>

                                    {/* Clear Cache */}
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
                    )}

                    {activeTab === 'family' && (
                        <div className="p-6 space-y-6">
                            {/* Active Profile */}
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                                    <User size={14} /> Active Profile
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {profiles.map((profile) => (
                                        <button
                                            key={profile.id}
                                            onClick={() => handleProfileChange(profile.id)}
                                            className={`p-4 rounded-xl border transition-all ${activeProfile?.id === profile.id
                                                ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                                                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="text-3xl mb-2">{profile.icon}</div>
                                            <div className="text-sm font-medium text-white">{profile.name}</div>
                                            <div className="text-xs text-white/40 mt-1">{profile.maxAge}+ yaş</div>
                                            {profile.requirePin && (
                                                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-yellow-400">
                                                    <Lock size={10} /> PIN Required
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* PIN Management */}
                            <div className="space-y-3 pt-6 border-t border-white/10">
                                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                                    <Lock size={14} /> Parental PIN
                                </label>
                                {isPinSet ? (
                                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                        <div className="flex items-center gap-2 text-green-400 text-sm">
                                            <Shield size={16} />
                                            <span>PIN is active and protecting your content</span>
                                        </div>
                                        <p className="text-xs text-white/40 mt-2">
                                            To change PIN, enter a new 4-digit code below
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                        <p className="text-yellow-400 text-sm">No PIN set. Set a PIN to protect adult content.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-white/60">New PIN (4 digits)</label>
                                        <input
                                            type="password"
                                            maxLength={4}
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-center font-mono text-lg tracking-widest focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-white/60">Confirm PIN</label>
                                        <input
                                            type="password"
                                            maxLength={4}
                                            value={pinConfirm}
                                            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-center font-mono text-lg tracking-widest focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSetPin}
                                    disabled={pin.length !== 4 || pinConfirm.length !== 4}
                                    className="w-full p-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                                >
                                    {isPinSet ? 'Update PIN' : 'Set PIN'}
                                </button>
                            </div>

                            {/* Info */}
                            <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                                <p className="text-xs text-white/60 leading-relaxed">
                                    <strong className="text-white">How it works:</strong> Family profiles filter content based on age ratings and categories. When a PIN is set, adult content (18+) requires PIN verification before playback.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {activeTab === 'general' && (
                    <div className="p-5 border-t border-white/10 bg-white/5 flex justify-end gap-3 flex-shrink-0">
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
                )}

                {activeTab === 'family' && (
                    <div className="p-5 border-t border-white/10 bg-white/5 flex justify-end flex-shrink-0">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 transition-all text-sm font-medium"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
