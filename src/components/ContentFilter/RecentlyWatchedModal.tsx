import React from 'react';
import { X, Play, Clock, Trash2 } from 'lucide-react';
import { RecentlyWatchedItem } from '../../types';

interface RecentlyWatchedModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: RecentlyWatchedItem[];
    onSelect: (item: RecentlyWatchedItem) => void;
    onClear: () => void;
}

export const RecentlyWatchedModal: React.FC<RecentlyWatchedModalProps> = ({
    isOpen,
    onClose,
    items,
    onSelect,
    onClear
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-scale-fade" style={{ animation: 'none' }}>
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <Clock className="text-cyan-400" size={24} />
                        <h2 className="text-2xl font-bold text-white">Watch History</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        {items.length > 0 && (
                            <button
                                onClick={onClear}
                                className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
                            >
                                <Trash2 size={16} />
                                Clear History
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {items.length === 0 ? (
                        <div className="text-center py-12 text-white/40">
                            <Clock size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg">No watch history yet</p>
                            <p className="text-sm">Videos you watch will appear here</p>
                        </div>
                    ) : (
                        items.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => {
                                    onSelect(item);
                                    onClose();
                                }}
                                className="w-full flex items-center gap-4 p-4 bg-black/40 hover:bg-white/5 border border-white/5 hover:border-cyan-500/30 rounded-xl transition-all group text-left"
                            >
                                <div className="w-32 aspect-video bg-black rounded-lg overflow-hidden relative flex-shrink-0 border border-white/10">
                                    <div className="absolute inset-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                        <Play size={24} className="text-white/40 group-hover:text-cyan-400 transition-colors" fill="currentColor" />
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                                        <div
                                            className="h-full bg-cyan-500"
                                            style={{ width: `${(item.progress / (item.duration || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-medium text-lg truncate mb-1 group-hover:text-cyan-400 transition-colors">
                                        {item.title}
                                    </h3>
                                    <div className="flex items-center gap-3 text-white/40 text-sm">
                                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className="font-mono text-cyan-500/80">
                                            {Math.floor(item.progress / 60)}:{Math.floor(item.progress % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
