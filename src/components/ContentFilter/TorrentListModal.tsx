import React from 'react';
import { X, Download, HardDrive, Users, FileVideo } from 'lucide-react';
import { TorrentItem, Movie } from '../../types';

interface TorrentListModalProps {
    isOpen: boolean;
    onClose: () => void;
    torrents: TorrentItem[];
    movie: Movie | null;
    onSelectTorrent: (magnet: string) => void;
    isLoading: boolean;
}

export const TorrentListModal: React.FC<TorrentListModalProps> = ({ 
    isOpen, onClose, torrents, movie, onSelectTorrent, isLoading 
}) => {
    if (!isOpen) return null;

    const formatSize = (bytes: string) => {
        // API Bay returns size in bytes as string usually, or formatted.
        // Assuming it comes formatted from API or handle it?
        // API Bay returns raw bytes usually. Let's assume raw bytes.
        const size = parseInt(bytes);
        if (isNaN(size)) return bytes; // If already formatted
        if (size === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={onClose} />
            
            <div className="relative w-full max-w-4xl bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <Download className="text-purple-400" />
                            Select Source
                        </h2>
                        {movie && (
                            <p className="text-white/40 text-sm mt-1">
                                Available streams for <span className="text-white">{movie.title}</span>
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/40 animate-pulse">
                            <p>Searching for best streams...</p>
                        </div>
                    ) : torrents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/40">
                            <p>No streams found for this title.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {torrents.map((torrent) => (
                                <button
                                    key={torrent.info_hash}
                                    onClick={() => onSelectTorrent(torrent.magnet)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group text-left"
                                >
                                    <div className="p-3 bg-white/5 rounded-lg group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                                        <FileVideo size={24} />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-medium truncate pr-4" title={torrent.name}>
                                            {torrent.name}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-white/40 font-mono">
                                            {torrent.username && (
                                                <span className="bg-white/5 px-2 py-0.5 rounded">{torrent.username}</span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <HardDrive size={12} /> {formatSize(torrent.size)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 text-sm tabular-nums">
                                        <div className="flex flex-col items-end">
                                            <span className="flex items-center gap-1.5 text-green-400 font-bold">
                                                <Users size={14} />
                                                {torrent.seeders}
                                            </span>
                                            <span className="text-[10px] text-white/20">Seeds</span>
                                        </div>
                                        <div className="flex flex-col items-end text-red-400/60">
                                            <span>{torrent.leechers}</span>
                                            <span className="text-[10px] text-white/20">Leech</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
