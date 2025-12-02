import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Plus, Loader2, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { ParentsGuideItem } from '../../types';

interface ParentsGuideViewProps {
    isOpen: boolean;
    onClose: () => void;
    imdbId: string;
    movieTitle: string;
    onOpenSkipCreator: (reason: string, severity: 'low' | 'medium' | 'high') => void;
}

export const ParentsGuideView: React.FC<ParentsGuideViewProps> = ({
    isOpen,
    onClose,
    imdbId,
    movieTitle,
    onOpenSkipCreator
}) => {
    const [guide, setGuide] = useState<ParentsGuideItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && imdbId) {
            fetchGuide();
        } else {
            // Reset state when closed or invalid
            setGuide([]);
            setError(null);
        }
    }, [isOpen, imdbId]);

    const decodeHtml = (html: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    };

    const fetchGuide = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await window.ipcRenderer.invoke('get-parents-guide', imdbId);
            
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format received');
            }

            setGuide(data);
            // Auto-expand categories with Severe or Moderate content
            const toExpand = data
                .filter((item: ParentsGuideItem) => item.status === 'Severe' || item.status === 'Moderate')
                .map((item: ParentsGuideItem) => item.category);
            setExpandedCategories(toExpand);
        } catch (error) {
            console.error('Failed to fetch guide:', error);
            setError('Failed to load content guide. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Severe': return 'text-red-400 bg-red-500/10 border-red-500/20 shadow-[0_0_10px_rgba(248,113,113,0.2)]';
            case 'Moderate': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'Mild': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-green-400 bg-green-500/10 border-green-500/20';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
            {/* Backdrop Click */}
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
                            <ShieldAlert size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Parents Guide</h2>
                            <p className="text-white/40 text-sm mt-1">Content warnings for <span className="text-white font-medium">{movieTitle}</span></p>
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
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse"></div>
                                <Loader2 className="animate-spin text-cyan-400 relative z-10" size={48} />
                            </div>
                            <p className="text-white/60 font-medium animate-pulse">Analyzing content data from IMDb...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-red-400/80 gap-4">
                            <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                                <AlertTriangle size={40} />
                            </div>
                            <p className="text-lg font-medium">{error}</p>
                            <button 
                                onClick={fetchGuide}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors border border-white/5 hover:border-white/20"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {guide.length === 0 && (
                                <div className="text-center text-white/40 py-20 flex flex-col items-center gap-4">
                                    <ShieldAlert size={48} strokeWidth={1} opacity={0.5} />
                                    <p>No parents guide data found for this title.</p>
                                </div>
                            )}

                            {guide.map((item) => (
                                <div
                                    key={item.category}
                                    className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                                >
                                    <button
                                        onClick={() => toggleCategory(item.category)}
                                        className="w-full flex items-center justify-between p-5 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-1 rounded-full transition-colors ${expandedCategories.includes(item.category) ? 'bg-white/10 text-white' : 'text-white/40 group-hover:text-white/80'}`}>
                                                {expandedCategories.includes(item.category) ? (
                                                    <ChevronUp size={20} />
                                                ) : (
                                                    <ChevronDown size={20} />
                                                )}
                                            </div>
                                            <span className="text-lg font-semibold text-white tracking-wide">{decodeHtml(item.category)}</span>
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </button>

                                    {expandedCategories.includes(item.category) && (
                                        <div className="p-5 pt-0 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                                            <ul className="space-y-4 mt-4">
                                                {item.items.map((desc, idx) => {
                                                    const decodedDesc = decodeHtml(desc);
                                                    return (
                                                    <li key={idx} className="flex items-start gap-4 text-white/70 text-sm group/item p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                                        <AlertTriangle size={18} className="mt-0.5 text-white/20 flex-shrink-0 group-hover/item:text-orange-400/80 transition-colors" />
                                                        <span className="flex-1 leading-relaxed font-light tracking-wide">{decodedDesc}</span>
                                                        <button
                                                            onClick={() => {
                                                                onOpenSkipCreator(
                                                                    `${decodeHtml(item.category)}: ${decodedDesc.substring(0, 50)}...`,
                                                                    item.status === 'Severe' ? 'high' : item.status === 'Moderate' ? 'medium' : 'low'
                                                                );
                                                            }}
                                                            className="opacity-0 group-hover/item:opacity-100 flex items-center gap-2 bg-cyan-500/10 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-cyan-500/20"
                                                        >
                                                            <Plus size={14} />
                                                            Add Skip
                                                        </button>
                                                    </li>
                                                )})}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};