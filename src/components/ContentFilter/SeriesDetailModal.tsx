import React, { useState, useEffect } from 'react';
import { X, Play, Calendar, Star, Loader2, Film } from 'lucide-react';
import { Content, Season, Episode } from '../../types';

interface SeriesDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    show: Content | null;
    onPlayEpisode: (episode: Episode) => void;
}

export const SeriesDetailModal: React.FC<SeriesDetailModalProps> = ({ isOpen, onClose, show, onPlayEpisode }) => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeSeason, setActiveSeason] = useState<number>(1);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && show) {
            fetchDetails();
        } else {
            setSeasons([]);
            setError('');
            setActiveSeason(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, show]); // fetchDetails changes on every render so it's excluded

    const fetchDetails = async () => {
        if (!show) return;
        setIsLoading(true);
        setError('');
        try {
            const data = await window.ipcRenderer.invoke('get-series-details', show.id);
            if (Array.isArray(data) && data.length > 0) {
                setSeasons(data);
                setActiveSeason(data[0].seasonNumber);
            } else {
                setError('No episodes found for this series.');
            }
        } catch (err) {
            console.error('Failed to fetch series details:', err);
            setError('Failed to load episode list.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !show) return null;

    const currentSeason = seasons.find(s => s.seasonNumber === activeSeason);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative w-full max-w-5xl bg-gray-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] animate-in zoom-in-95 duration-300">

                {/* Close Button (Mobile) */}
                <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white md:hidden">
                    <X size={20} />
                </button>

                {/* Left Panel: Show Info */}
                <div className="w-full md:w-1/3 bg-black/40 p-6 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto">
                    <div className="aspect-[2/3] w-full bg-white/5 rounded-xl overflow-hidden shadow-lg relative group">
                        {show.image ? (
                            <img src={show.image} alt={show.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                <Film size={48} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                            <h2 className="text-2xl font-bold text-white leading-tight">{show.title}</h2>
                            <p className="text-white/60 text-sm mt-1">{show.year}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-cyan-400 border border-cyan-500/20">TV Series</span>
                            {seasons.length > 0 && (
                                <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-purple-400 border border-purple-500/20">
                                    {seasons.length} Seasons
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">
                            Select a season and episode to start streaming. We will search for the best available torrent for the specific episode.
                        </p>
                    </div>
                </div>

                {/* Right Panel: Seasons & Episodes */}
                <div className="w-full md:w-2/3 flex flex-col bg-gray-900/50">
                    {/* Header / Season Selector */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-gray-900/95 z-10 backdrop-blur-sm">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 max-w-[80%]">
                            {seasons.map(season => (
                                <button
                                    key={season.seasonNumber}
                                    onClick={() => setActiveSeason(season.seasonNumber)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeSeason === season.seasonNumber
                                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    Season {season.seasonNumber}
                                </button>
                            ))}
                        </div>
                        <button onClick={onClose} className="hidden md:block p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full text-white/40 gap-4">
                                <Loader2 className="animate-spin text-cyan-500" size={40} />
                                <p>Loading episode guide...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full text-red-400/80 gap-2">
                                <AlertCircle size={32} />
                                <p>{error}</p>
                            </div>
                        ) : currentSeason ? (
                            <div className="space-y-3">
                                {currentSeason.episodes.map(episode => (
                                    <div
                                        key={episode.id}
                                        className="group flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer"
                                        onClick={() => onPlayEpisode(episode)}
                                    >
                                        {/* Episode Thumbnail (Optional) */}
                                        <div className="w-32 aspect-video bg-black/40 rounded-lg overflow-hidden flex-shrink-0 relative hidden sm:block">
                                            {episode.image ? (
                                                <img src={episode.image} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Film size={20} className="text-white/20" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                                                <div className="p-2 bg-cyan-500 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                                    <Play size={16} fill="white" className="text-white" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <div className="flex items-baseline gap-3 mb-1">
                                                <span className="text-cyan-400 font-mono text-sm font-bold">E{episode.episodeNumber}</span>
                                                <h3 className="text-white font-medium truncate group-hover:text-cyan-200 transition-colors">{episode.title}</h3>
                                            </div>
                                            <p className="text-white/40 text-xs line-clamp-2 mb-2">{episode.plot}</p>
                                            <div className="flex items-center gap-3 text-[10px] text-white/30">
                                                {episode.releaseDate && <span className="flex items-center gap-1"><Calendar size={10} /> {episode.releaseDate}</span>}
                                                {episode.rating && <span className="flex items-center gap-1 text-yellow-500/60"><Star size={10} /> {episode.rating}</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center sm:hidden">
                                            <Play size={20} className="text-white/20 group-hover:text-cyan-400" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-white/40 py-10">Select a season to view episodes</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

import { AlertCircle } from 'lucide-react'; // Added missing import
