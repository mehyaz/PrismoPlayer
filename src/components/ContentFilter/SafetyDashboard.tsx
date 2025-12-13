import React, { useEffect, useState } from 'react';
import { X, Shield, AlertTriangle, Loader2, Eye, Users, Skull, Wine, Ghost } from 'lucide-react';
import { ContentRiskScore, FamilyProfile } from '../../types';
import { SafetyBadge } from './SafetyBadge';

interface SafetyDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    imdbId: string;
    movieTitle: string;
    onProceed: () => void;
}

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    violence: <Skull size={18} />,
    sexuality: <Eye size={18} />,
    profanity: <AlertTriangle size={18} />,
    substances: <Wine size={18} />,
    frightening: <Ghost size={18} />
};

const CATEGORY_LABELS: Record<string, string> = {
    violence: 'Şiddet',
    sexuality: 'Cinsellik',
    profanity: 'Küfür',
    substances: 'Madde Kullanımı',
    frightening: 'Korkutucu Sahneler'
};

export const SafetyDashboard: React.FC<SafetyDashboardProps> = ({
    isOpen,
    onClose,
    imdbId,
    movieTitle,
    onProceed
}) => {
    const [score, setScore] = useState<ContentRiskScore | null>(null);
    const [profile, setProfile] = useState<FamilyProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && imdbId) {
            fetchSafetyData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, imdbId]);

    const fetchSafetyData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Fetch both safety score and active profile in parallel
            const [riskScore, activeProfile] = await Promise.all([
                window.ipcRenderer.invoke('safety:analyze-content', imdbId) as Promise<ContentRiskScore>,
                window.ipcRenderer.invoke('profiles:get-active') as Promise<FamilyProfile>
            ]);

            setScore(riskScore);
            setProfile(activeProfile);
        } catch (err) {
            console.error('Failed to fetch safety data:', err);
            setError('Güvenlik analizi yüklenemedi');
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (value: number): string => {
        if (value >= 70) return 'bg-red-500';
        if (value >= 50) return 'bg-orange-500';
        if (value >= 25) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getScoreTextColor = (value: number): string => {
        if (value >= 70) return 'text-red-400';
        if (value >= 50) return 'text-orange-400';
        if (value >= 25) return 'text-yellow-400';
        return 'text-green-400';
    };

    const isContentAllowed = (): boolean => {
        if (!score || !profile) return true;

        const ageNum = parseInt(score.ageRecommendation || '0');
        if (ageNum > profile.maxAge) return false;

        // Check blocked categories
        const categories = ['violence', 'sexuality', 'profanity', 'substances', 'frightening'];
        for (const cat of categories) {
            if (profile.blockedCategories.includes(cat)) {
                const catScore = score[cat as keyof ContentRiskScore];
                if (typeof catScore === 'number' && catScore >= 50) {
                    return false;
                }
            }
        }

        return true;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
            {/* Backdrop Click */}
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                            <Shield size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Güvenlik Raporu</h2>
                            <p className="text-white/40 text-sm mt-1">
                                <span className="text-white font-medium">{movieTitle}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse"></div>
                                <Loader2 className="animate-spin text-cyan-400 relative z-10" size={48} />
                            </div>
                            <p className="text-white/60 font-medium">İçerik analiz ediliyor...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-16 text-red-400/80 gap-4">
                            <AlertTriangle size={40} />
                            <p className="text-lg font-medium">{error}</p>
                            <button
                                onClick={fetchSafetyData}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
                            >
                                Tekrar Dene
                            </button>
                        </div>
                    ) : score ? (
                        <>
                            {/* Overall Score */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                                <div className="flex items-center gap-4">
                                    <SafetyBadge score={score} size="lg" />
                                    <div>
                                        <p className="text-white/40 text-sm">Genel Risk Skoru</p>
                                        <p className={`text-2xl font-bold ${getScoreTextColor(score.overallScore)}`}>
                                            {score.overallScore}/100
                                        </p>
                                    </div>
                                </div>

                                {profile && (
                                    <div className="text-right">
                                        <p className="text-white/40 text-sm">Aktif Profil</p>
                                        <p className="text-white font-medium flex items-center gap-2 justify-end">
                                            <span className="text-xl">{profile.icon}</span>
                                            {profile.name}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Category Bars */}
                            <div className="space-y-3">
                                <h3 className="text-white/60 text-sm font-medium uppercase tracking-wider">
                                    Kategori Analizi
                                </h3>

                                {(['violence', 'sexuality', 'profanity', 'substances', 'frightening'] as const).map((category) => {
                                    const value = score[category];
                                    const isBlocked = profile?.blockedCategories.includes(category);

                                    return (
                                        <div key={category} className="group">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2 text-white/60">
                                                    {CATEGORY_ICONS[category]}
                                                    <span className="text-sm">{CATEGORY_LABELS[category]}</span>
                                                    {isBlocked && value >= 50 && (
                                                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                                            Engelli
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-sm font-bold ${getScoreTextColor(value)}`}>
                                                    {value}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${getScoreColor(value)}`}
                                                    style={{ width: `${value}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Flags */}
                            {score.flags.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-white/60 text-sm font-medium uppercase tracking-wider">
                                        Tespit Edilen İşaretler
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {score.flags.slice(0, 10).map((flag, idx) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1 bg-orange-500/10 text-orange-400 text-xs rounded-full border border-orange-500/20"
                                            >
                                                {flag}
                                            </span>
                                        ))}
                                        {score.flags.length > 10 && (
                                            <span className="px-3 py-1 bg-white/5 text-white/40 text-xs rounded-full">
                                                +{score.flags.length - 10} daha
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Profile Compatibility */}
                            <div className={`p-4 rounded-xl border ${isContentAllowed()
                                ? 'bg-green-500/10 border-green-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <Users size={20} className={isContentAllowed() ? 'text-green-400' : 'text-red-400'} />
                                    <div>
                                        <p className={`font-medium ${isContentAllowed() ? 'text-green-400' : 'text-red-400'}`}>
                                            {isContentAllowed()
                                                ? `${profile?.name} profili için uygun`
                                                : `${profile?.name} profili için uygun değil`
                                            }
                                        </p>
                                        {!isContentAllowed() && (
                                            <p className="text-white/40 text-sm mt-1">
                                                Bu içerik profil ayarlarınızı aşıyor. İzlemek için yetişkin profiline geçin.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10"
                    >
                        İptal
                    </button>
                    <button
                        onClick={onProceed}
                        disabled={!isContentAllowed()}
                        className={`px-6 py-2.5 rounded-lg font-medium transition-all ${isContentAllowed()
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white'
                            : 'bg-white/5 text-white/30 cursor-not-allowed'
                            }`}
                    >
                        {isContentAllowed() ? 'İzlemeye Başla' : 'İzin Verilmedi'}
                    </button>
                </div>
            </div>
        </div>
    );
};
