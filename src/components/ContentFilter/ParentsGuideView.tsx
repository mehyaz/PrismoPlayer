import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ParentsGuideItem, SkipSegment } from '../../types';

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

    useEffect(() => {
        if (isOpen && imdbId) {
            fetchGuide();
        }
    }, [isOpen, imdbId]);

    const fetchGuide = async () => {
        setIsLoading(true);
        try {
            const data = await window.ipcRenderer.invoke('get-parents-guide', imdbId);
            setGuide(data);
            // Auto-expand categories with Severe or Moderate content
            const toExpand = data
                .filter((item: ParentsGuideItem) => item.status === 'Severe' || item.status === 'Moderate')
                .map((item: ParentsGuideItem) => item.category);
            setExpandedCategories(toExpand);
        } catch (error) {
            console.error('Failed to fetch guide:', error);
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
            case 'Severe': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'Moderate': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'Mild': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            default: return 'text-green-500 bg-green-500/10 border-green-500/20';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Parents Guide</h2>
                        <p className="text-white/60 mt-1">Content warnings for <span className="text-cyan-400">{movieTitle}</span></p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="animate-spin text-cyan-500" size={40} />
                            <p className="text-white/60">Fetching content data from IMDb...</p>
                        </div>
                    ) : (
                        <>
                            {guide.length === 0 && (
                                <div className="text-center text-white/40 py-12">
                                    No parents guide data found for this title.
                                </div>
                            )}

                            {guide.map((item) => (
                                <div
                                    key={item.category}
                                    className="border border-white/10 rounded-xl overflow-hidden bg-white/5"
                                >
                                    <button
                                        onClick={() => toggleCategory(item.category)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            {expandedCategories.includes(item.category) ? (
                                                <ChevronUp size={20} className="text-white/40" />
                                            ) : (
                                                <ChevronDown size={20} className="text-white/40" />
                                            )}
                                            <span className="text-lg font-semibold text-white">{item.category}</span>
                                        </div>
                                        <span className={`px - 3 py - 1 rounded - full text - sm font - medium border ${getStatusColor(item.status)} `}>
                                            {item.status}
                                        </span>
                                    </button>

                                    {expandedCategories.includes(item.category) && (
                                        <div className="p-4 pt-0 border-t border-white/10 bg-black/20">
                                            <ul className="space-y-3 mt-4">
                                                {item.items.map((desc, idx) => (
                                                    <li key={idx} className="flex items-start gap-3 text-white/80 text-sm group">
                                                        <AlertTriangle size={16} className="mt-0.5 text-white/20 flex-shrink-0" />
                                                        <span className="flex-1 leading-relaxed">{desc}</span>
                                                        <button
                                                            onClick={() => {
                                                                onOpenSkipCreator(
                                                                    `${item.category}: ${desc.substring(0, 50)}...`,
                                                                    item.status === 'Severe' ? 'high' : item.status === 'Moderate' ? 'medium' : 'low'
                                                                );
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-all"
                                                        >
                                                            <Plus size={14} />
                                                            Add Skip
                                                        </button>
                                                    </li>
                                                ))}
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
