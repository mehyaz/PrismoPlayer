import React, { useState } from 'react';
import { Lock, X, Shield, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface ContentWarning {
    category: string;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    items?: string[];
}

interface PINPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
    message?: string;
    movieTitle?: string;
    rating?: string; // G, PG, PG-13, R, NC-17
    profileName?: string;
    profileAgeLimit?: number;
    contentWarnings?: ContentWarning[];
}

// Get rating display with age label
const getRatingWithAge = (rating: string) => {
    switch (rating) {
        case 'G': return { label: 'G', age: 'Tüm Yaşlar', emoji: '👶' };
        case 'PG': return { label: 'PG', age: '7+', emoji: '👦' };
        case 'PG-13': return { label: 'PG-13', age: '13+', emoji: '🧒' };
        case 'R': return { label: 'R', age: '17+', emoji: '🔞' };
        case 'NC-17': return { label: 'NC-17', age: '18+', emoji: '🔞' };
        default: return { label: 'NR', age: 'Belirsiz', emoji: '❓' };
    }
};

const getRatingColor = (rating: string) => {
    switch (rating) {
        case 'G': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'PG': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'PG-13': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'R': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'NC-17': return 'bg-red-500/20 text-red-400 border-red-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
};

const getRatingDescription = (rating: string) => {
    switch (rating) {
        case 'G': return 'Genel İzleyici - Tüm yaşlar için uygundur. Şiddet, küfür veya uygunsuz içerik yoktur.';
        case 'PG': return 'Ebeveyn Rehberliği Önerilir - Bazı sahneler küçük çocuklar için uygun olmayabilir.';
        case 'PG-13': return 'Ebeveyn Uyarısı (13+) - Şiddet, korkutucu sahneler veya hafif cinsel içerik olabilir.';
        case 'R': return 'Kısıtlı (17+) - Yetişkin temalı içerik. Şiddet, cinsellik veya ağır dil içerebilir.';
        case 'NC-17': return 'Sadece Yetişkinler (18+) - Açık cinsel içerik veya aşırı şiddet. Çocuklar için kesinlikle uygun değil.';
        default: return 'Derecelendirilmemiş - İçerik bilgisi mevcut değil. Dikkatli olunması önerilir.';
    }
};

const getSeverityColor = (severity: string) => {
    switch (severity) {
        case 'none': return 'text-green-400';
        case 'mild': return 'text-yellow-400';
        case 'moderate': return 'text-orange-400';
        case 'severe': return 'text-red-400';
        default: return 'text-gray-400';
    }
};

const getSeverityLabel = (severity: string) => {
    switch (severity) {
        case 'none': return 'None';
        case 'mild': return 'Mild';
        case 'moderate': return 'Moderate';
        case 'severe': return 'Severe';
        default: return 'Unknown';
    }
};

export const PINPromptModal: React.FC<PINPromptModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    title = 'Parental Control',
    message = 'This content is restricted. Please enter the parental PIN to continue.',
    movieTitle,
    rating,
    profileName,
    profileAgeLimit,
    contentWarnings = []
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [showWarnings, setShowWarnings] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (pin.length !== 4) {
            setError('PIN must be 4 digits');
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            const isValid = await window.ipcRenderer.invoke('family:verify-pin', pin);

            if (isValid) {
                onSuccess();
                setPin('');
                onClose();
            } else {
                setError('Incorrect PIN. Please try again.');
                setPin('');
            }
        } catch (err) {
            setError('Failed to verify PIN. Please try again.');
            console.error('PIN verification error:', err);
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePinChange = (value: string) => {
        // Only allow digits
        const digits = value.replace(/\D/g, '').slice(0, 4);
        setPin(digits);
        setError('');
    };

    if (!isOpen) return null;

    const hasWarnings = contentWarnings && contentWarnings.length > 0;

    // Get complete modal color scheme based on rating
    const getModalColors = () => {
        switch (rating) {
            case 'NC-17':
                return {
                    gradient: 'from-red-900/30 to-red-800/20',
                    border: 'border-red-500/40',
                    headerBg: 'bg-red-500/10',
                    headerBorder: 'border-red-500/20',
                    iconBg: 'bg-red-500/20',
                    iconColor: 'text-red-400',
                    accentText: 'text-red-400',
                    buttonBg: 'bg-red-600 hover:bg-red-500',
                    inputBorder: 'border-red-500/30 focus:ring-red-500 focus:border-red-500'
                };
            case 'R':
                return {
                    gradient: 'from-orange-900/30 to-orange-800/20',
                    border: 'border-orange-500/40',
                    headerBg: 'bg-orange-500/10',
                    headerBorder: 'border-orange-500/20',
                    iconBg: 'bg-orange-500/20',
                    iconColor: 'text-orange-400',
                    accentText: 'text-orange-400',
                    buttonBg: 'bg-orange-600 hover:bg-orange-500',
                    inputBorder: 'border-orange-500/30 focus:ring-orange-500 focus:border-orange-500'
                };
            case 'PG-13':
                return {
                    gradient: 'from-yellow-900/30 to-yellow-800/20',
                    border: 'border-yellow-500/40',
                    headerBg: 'bg-yellow-500/10',
                    headerBorder: 'border-yellow-500/20',
                    iconBg: 'bg-yellow-500/20',
                    iconColor: 'text-yellow-400',
                    accentText: 'text-yellow-400',
                    buttonBg: 'bg-yellow-600 hover:bg-yellow-500',
                    inputBorder: 'border-yellow-500/30 focus:ring-yellow-500 focus:border-yellow-500'
                };
            case 'PG':
                return {
                    gradient: 'from-blue-900/30 to-blue-800/20',
                    border: 'border-blue-500/40',
                    headerBg: 'bg-blue-500/10',
                    headerBorder: 'border-blue-500/20',
                    iconBg: 'bg-blue-500/20',
                    iconColor: 'text-blue-400',
                    accentText: 'text-blue-400',
                    buttonBg: 'bg-blue-600 hover:bg-blue-500',
                    inputBorder: 'border-blue-500/30 focus:ring-blue-500 focus:border-blue-500'
                };
            case 'G':
                return {
                    gradient: 'from-green-900/30 to-green-800/20',
                    border: 'border-green-500/40',
                    headerBg: 'bg-green-500/10',
                    headerBorder: 'border-green-500/20',
                    iconBg: 'bg-green-500/20',
                    iconColor: 'text-green-400',
                    accentText: 'text-green-400',
                    buttonBg: 'bg-green-600 hover:bg-green-500',
                    inputBorder: 'border-green-500/30 focus:ring-green-500 focus:border-green-500'
                };
            default:
                return {
                    gradient: 'from-gray-900/30 to-gray-800/20',
                    border: 'border-gray-500/40',
                    headerBg: 'bg-gray-500/10',
                    headerBorder: 'border-gray-500/20',
                    iconBg: 'bg-gray-500/20',
                    iconColor: 'text-gray-400',
                    accentText: 'text-gray-400',
                    buttonBg: 'bg-gray-600 hover:bg-gray-500',
                    inputBorder: 'border-gray-500/30 focus:ring-gray-500 focus:border-gray-500'
                };
        }
    };

    const modalColors = getModalColors();

    // Get warning box colors based on movie rating (not severity)
    const getWarningBoxColors = () => {
        switch (rating) {
            case 'NC-17':
                return 'bg-red-500/10 border-red-500/30 text-red-400';
            case 'R':
                return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
            case 'PG-13':
                return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
            case 'PG':
                return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
            case 'G':
                return 'bg-green-500/10 border-green-500/30 text-green-400';
            default:
                return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
        }
    };

    // Get content severity label based on rating
    const getRatingSeverityLabel = () => {
        switch (rating) {
            case 'NC-17':
                return '🔴 Adults Only (18+)';
            case 'R':
                return '🟠 Restricted (17+)';
            case 'PG-13':
                return '🟡 Teens (13+)';
            case 'PG':
                return '🔵 Parental Guidance';
            case 'G':
                return '🟢 General Audiences';
            default:
                return '⚪ Not Rated';
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            {/* Backdrop - can't close by clicking */}
            <div className="absolute inset-0" />

            {/* Modal Content - Dynamic color based on rating */}
            <div className={`relative w-full max-w-md bg-gradient-to-br ${modalColors.gradient} backdrop-blur-xl border ${modalColors.border} rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col`}>

                {/* Header */}
                <div className={`p-6 border-b ${modalColors.headerBorder} ${modalColors.headerBg} shrink-0`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${modalColors.iconBg} flex items-center justify-center`}>
                                <Shield className={modalColors.iconColor} size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">{title}</h2>
                                <p className={`text-xs ${modalColors.accentText}/80`}>Protected Content</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setPin('');
                                setError('');
                                onClose();
                            }}
                            className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Movie Title */}
                    {movieTitle && (
                        <div className="mb-3">
                            <p className="text-white font-medium text-base">{movieTitle}</p>
                        </div>
                    )}

                    {/* Rating Badge */}
                    {rating && (
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm flex items-center gap-2 ${getRatingColor(rating)}`}>
                                <span>{rating}</span>
                                <span className="w-px h-3 bg-current opacity-30"></span>
                                <span className="text-xs opacity-90">{getRatingWithAge(rating).age}</span>
                            </div>
                            {profileName && profileAgeLimit !== undefined && (
                                <div className="flex items-center gap-1.5 text-xs text-white/60">
                                    <Info size={12} />
                                    <span>Current: {profileName} ({profileAgeLimit}+)</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rating Description */}
                    {rating && (
                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <p className="text-xs text-white/70 leading-relaxed">
                                <span className="font-semibold text-white">{rating}:</span> {getRatingDescription(rating)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto scrollbar-hide flex-1">
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Restriction Reason - Color coded by rating */}
                        <div className={`border rounded-lg p-4 flex gap-3 ${getWarningBoxColors()}`}>
                            <AlertTriangle className="shrink-0" size={20} />
                            <div className="flex-1">
                                <p className="text-sm text-white/90 leading-relaxed font-medium">
                                    {message}
                                </p>
                                <p className="text-xs text-white/60 mt-2">
                                    {getRatingSeverityLabel()}
                                </p>
                            </div>
                        </div>

                        {/* Expandable Content Warnings */}
                        {hasWarnings && (
                            <div className="border border-white/10 rounded-lg overflow-hidden bg-white/5">
                                <button
                                    type="button"
                                    onClick={() => setShowWarnings(!showWarnings)}
                                    className="w-full bg-white/5 hover:bg-white/10 transition-colors px-4 py-3 flex items-center justify-between"
                                >
                                    <span className="text-sm font-medium text-white flex items-center gap-2">
                                        <Info size={16} className="text-blue-400" />
                                        Content Warnings ({contentWarnings.length})
                                    </span>
                                    {showWarnings ? (
                                        <ChevronUp size={16} className="text-white/60" />
                                    ) : (
                                        <ChevronDown size={16} className="text-white/60" />
                                    )}
                                </button>

                                {showWarnings && (
                                    <div className="border-t border-white/10 p-4 space-y-4 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                        {contentWarnings.map((warning, idx) => (
                                            <div key={idx} className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-bold text-white uppercase tracking-wide">
                                                        {warning.category}
                                                    </span>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${warning.severity === 'severe' ? 'bg-red-500/20 text-red-400' :
                                                        warning.severity === 'moderate' ? 'bg-orange-500/20 text-orange-400' :
                                                            warning.severity === 'mild' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-green-500/20 text-green-400'
                                                        }`}>
                                                        {getSeverityLabel(warning.severity).toUpperCase()}
                                                    </span>
                                                </div>
                                                {warning.items && warning.items.length > 0 && (
                                                    <div className="space-y-1">
                                                        {warning.items.map((item, itemIdx) => (
                                                            <div key={itemIdx} className="flex items-start gap-2 text-xs text-white/80">
                                                                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${getSeverityColor(warning.severity).replace('text-', 'bg-')}`} />
                                                                <span className="leading-relaxed">{item}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PIN Input */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60 uppercase tracking-wide font-medium">
                                Enter Parental PIN
                            </label>
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => handlePinChange(e.target.value)}
                                maxLength={4}
                                placeholder="••••"
                                autoFocus
                                className={`w-full bg-white/5 border ${modalColors.inputBorder} rounded-lg px-4 py-3 text-white text-center font-mono text-2xl tracking-widest focus:ring-2 outline-none transition-all`}
                            />

                            {error && (
                                <p className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 px-3 py-2 rounded-lg">
                                    <Lock size={12} />
                                    {error}
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={pin.length !== 4 || isVerifying}
                            className={`w-full ${modalColors.buttonBg} text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                        >
                            {isVerifying ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <Lock size={16} />
                                    Unlock Content
                                </>
                            )}
                        </button>

                        {/* Help Text */}
                        <p className="text-[10px] text-white/40 text-center">
                            Don't know the PIN? Contact the account administrator.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};
