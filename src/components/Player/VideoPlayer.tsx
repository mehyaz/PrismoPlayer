import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSkipEngine } from '../../hooks/useSkipEngine';
import { SkipSegment, SubtitleItem } from '../../types';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
    RotateCcw,
    ClosedCaption,
    Settings,
    X,
    SkipBack,
    SkipForward,
    ArrowLeft,
    Check,
    Languages,
    Download,
    ShieldAlert,
    RefreshCw,
    Gauge,
    PictureInPicture2,
    Music
} from 'lucide-react';

const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface VideoPlayerProps {
    src: string;
    skipSegments?: SkipSegment[];
    onTimeUpdate?: (time: number) => void;
    onBack: () => void;
    onQualityChange?: (quality: string) => void;
    onChangeSource?: () => void;
    onCheckContent?: () => void;
    onOpenVLC?: () => void; // New
    availableSubtitles: SubtitleItem[];
    onDownloadSubtitle: (item: SubtitleItem) => Promise<string | null>;
    initialTime?: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src, skipSegments = [], onTimeUpdate, onBack, availableSubtitles, onDownloadSubtitle,
    onChangeSource, onCheckContent, onOpenVLC, initialTime = 0
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();

    const [currentTime, setCurrentTime] = useState(initialTime);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [subtitleSrc, setSubtitleSrc] = useState<string>('');
    const [activeTrackLabel, setActiveTrackLabel] = useState<string>('Off');

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isDownloadingSub, setIsDownloadingSub] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true); // Start buffering by default
    const [error, setError] = useState<string | null>(null);
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [activeAudioTrack, setActiveAudioTrack] = useState<number>(0);

    useSkipEngine({
        currentTime,
        segments: skipSegments,
        onSeek: (time) => {
            if (videoRef.current) videoRef.current.currentTime = time;
        },
    });

    const [playbackRate, setPlaybackRate] = useState(1);

    const togglePiP = useCallback(async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (videoRef.current && videoRef.current !== document.pictureInPictureElement) {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (err) {
            console.error('PiP failed:', err);
        }
    }, []);

    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => setIsPlaying(false));
        }
    }, [isPlaying]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        if (videoRef.current) {
            videoRef.current.volume = newVol;
            videoRef.current.muted = newVol === 0;
        }
        setIsMuted(newVol === 0);
    }, []);

    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
        if (!newMuted && volume === 0) {
            setVolume(0.5);
            videoRef.current.volume = 0.5;
        }
    }, [isMuted, volume]);

    const seek = useCallback((seconds: number) => {
        if (videoRef.current) {
            const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
            videoRef.current.currentTime = newTime;
        }
    }, []);

    const toggleFullscreen = useCallback(() => {
        const element = containerRef.current;
        if (!element) return;
        if (!document.fullscreenElement) {
            element.requestFullscreen?.().catch((err) => console.error('Fullscreen error', err));
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.().catch((err) => console.error('Exit fullscreen error', err));
            setIsFullscreen(false);
        }
    }, []);

    const handleSubtitleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setSubtitleSrc(url);
            setActiveTrackLabel('Custom');
            setShowSettings(false);
        }
    }, []);

    const handleSubtitleDownload = async (item: SubtitleItem) => {
        setIsDownloadingSub(true);
        try {
            const path = await onDownloadSubtitle(item);
            if (path) {
                setSubtitleSrc(path);
                setActiveTrackLabel(item.name);
                setShowSettings(false);
            }
        } finally {
            setIsDownloadingSub(false);
        }
    };

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const time = percentage * (duration || 0);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    }, [duration]);

    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) {
            const t = videoRef.current.currentTime;
            setCurrentTime(t);
            onTimeUpdate?.(t);
            // If playing, stop buffering
            if (isBuffering && isPlaying) setIsBuffering(false);
        }
    }, [onTimeUpdate, isBuffering, isPlaying]);

    const handleLoadedMetadata = useCallback(() => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
            if (initialTime > 0) {
                videoRef.current.currentTime = initialTime;
            }

            // Detect Audio Tracks
            const video = videoRef.current as any;
            if (video.audioTracks) {
                const tracks = [];
                for (let i = 0; i < video.audioTracks.length; i++) {
                    tracks.push({
                        id: i,
                        label: video.audioTracks[i].label || `Track ${i + 1}`,
                        language: video.audioTracks[i].language,
                        enabled: video.audioTracks[i].enabled
                    });
                    if (video.audioTracks[i].enabled) {
                        setActiveAudioTrack(i);
                    }
                }
                setAudioTracks(tracks);
            }

            setTimeout(() => {
                if (videoRef.current) {
                    const video = videoRef.current as any;
                    const hasAudio = video.mozHasAudio || video.webkitAudioDecodedByteCount > 0 || (video.audioTracks && video.audioTracks.length > 0);
                    if (!hasAudio) {
                        console.warn('No audio detected');
                    }
                }
            }, 1000);
        }
    }, []);

    const changeAudioTrack = (index: number) => {
        const video = videoRef.current as any;
        if (video && video.audioTracks) {
            for (let i = 0; i < video.audioTracks.length; i++) {
                video.audioTracks[i].enabled = (i === index);
            }
            setActiveAudioTrack(index);
            // Refresh list to update UI checkmarks if needed, though state update handles the active index
            const tracks = [];
            for (let i = 0; i < video.audioTracks.length; i++) {
                tracks.push({
                    id: i,
                    label: video.audioTracks[i].label || `Track ${i + 1}`,
                    language: video.audioTracks[i].language,
                    enabled: video.audioTracks[i].enabled
                });
            }
            setAudioTracks(tracks);
        }
    };

    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [isPlaying]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (!videoRef.current) return;
            switch (e.code) {
                case 'ArrowLeft': seek(-5); break;
                case 'ArrowRight': seek(5); break;
                case 'ArrowUp': setVolume((v) => { const nv = Math.min(1, v + 0.1); if (videoRef.current) videoRef.current.volume = nv; return nv; }); break;
                case 'ArrowDown': setVolume((v) => { const nv = Math.max(0, v - 0.1); if (videoRef.current) videoRef.current.volume = nv; return nv; }); break;
                case 'KeyF': toggleFullscreen(); break;
                case 'KeyK': case 'Space': togglePlay(); break;
                case 'KeyM': toggleMute(); break;
                case 'Escape': if (showSettings) setShowSettings(false); else if (document.fullscreenElement) { document.exitFullscreen(); setIsFullscreen(false); } break;
            }
            handleMouseMove();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleFullscreen, togglePlay, toggleMute, seek, handleMouseMove, showSettings]);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlaying = () => {
            setIsPlaying(true);
            setIsBuffering(false);
        };
        const onPause = () => setIsPlaying(false);
        const onWaiting = () => setIsBuffering(true);
        const onCanPlay = () => setIsBuffering(false);

        video.addEventListener('playing', onPlaying);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('canplay', onCanPlay);

        video.volume = isMuted ? 0 : volume;

        return () => {
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('canplay', onCanPlay);
        };
    }, [isMuted, volume]);

    useEffect(() => {
        const video = videoRef.current;
        if (video && src) {
            video.src = src;
            video.load();
            setIsBuffering(true);
            video.play().catch((e) => {
                console.log("Autoplay prevented or failed:", e);
                setIsPlaying(false);
            });
        }

        return () => {
            if (video) {
                video.pause();
                video.removeAttribute('src'); // Remove src attribute completely
                video.load(); // Force cancel pending requests
            }
        };
    }, [src]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group overflow-hidden font-sans"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            {isBuffering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                        <RefreshCw className="relative z-10 text-cyan-400 animate-spin w-12 h-12" />
                    </div>
                    <p className="mt-4 text-white/60 text-sm font-medium animate-pulse">Buffering video...</p>
                    <button
                        onClick={onBack}
                        className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors border border-white/5"
                    >
                        Cancel
                    </button>
                </div>
            )}



            <video
                ref={videoRef}
                src={src}
                className="absolute top-0 left-0 w-full h-full object-contain"
                onClick={togglePlay}
                onDoubleClick={toggleFullscreen}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onError={(e) => {
                    console.error('Video error:', e);
                    setIsBuffering(false);
                    setError('Playback failed. The source might be unavailable.');
                }}
                autoPlay
                playsInline
                controls={false}
            >
                {subtitleSrc && (
                    <track kind="subtitles" src={subtitleSrc} srcLang="active" label="Active" default />
                )}
                Your browser does not support the video tag.
            </video>

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/90 text-white animate-in fade-in">
                    <ShieldAlert size={48} className="text-red-500 mb-4" />
                    <p className="text-lg font-medium mb-2">{error}</p>
                    <button
                        onClick={onBack}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            )}

            {/* Top Bar */}
            <div
                className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 transition-opacity duration-300 flex justify-between items-center ${showControls ? 'opacity-100' : 'opacity-0'}`}
            >
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/80 hover:text-white bg-black/20 hover:bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm transition-all border border-white/5"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium text-sm">Back to Menu</span>
                </button>

                <div className="flex gap-3">
                    {onCheckContent && (
                        <button
                            onClick={onCheckContent}
                            className="p-2.5 rounded-full bg-black/20 text-white/80 hover:bg-white/20 hover:text-orange-400 backdrop-blur-sm transition-all"
                            title="Content Guide"
                        >
                            <ShieldAlert size={20} />
                        </button>
                    )}

                    <button
                        onClick={togglePiP}
                        className="p-2.5 rounded-full bg-black/20 text-white/80 hover:bg-white/20 hover:text-white backdrop-blur-sm transition-all"
                        title="Picture in Picture"
                    >
                        <PictureInPicture2 size={20} />
                    </button>

                    <button
                        onClick={toggleFullscreen}
                        className="p-2.5 rounded-full bg-black/20 text-white/80 hover:bg-white/20 hover:text-white backdrop-blur-sm transition-all"
                        title="Fullscreen"
                    >
                        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
                </div>
            </div>

            {/* Bottom Controls */}
            <div
                className={`absolute bottom-0 left-0 right-0 px-6 py-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
                {/* Progress Bar */}
                <div
                    className="relative w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer mb-4 group/progress transition-all"
                    onClick={handleProgressClick}
                >
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full relative"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity scale-125" />
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white hover:text-cyan-400 transition-colors p-2 hover:bg-white/10 rounded-full">
                            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                        </button>

                        <div className="flex items-center gap-2 group/volume">
                            <button onClick={toggleMute} className="text-white/80 hover:text-white p-2">
                                {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                            </button>
                            <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 ease-out flex items-center">
                                <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                            </div>
                        </div>

                        <div className="flex items-center text-sm font-mono text-white/60 space-x-1 select-none">
                            <span>{formatTime(currentTime)}</span>
                            <span className="opacity-50">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative">
                        <button onClick={() => seek(-10)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors" title="-10s"><SkipBack size={22} /></button>
                        <button onClick={() => seek(10)} className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors" title="+10s"><SkipForward size={22} /></button>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <div className="relative">
                            <button onClick={() => setShowSettings((s) => !s)} className={`text-white/70 hover:text-white p-2 rounded-full transition-colors ${showSettings ? 'bg-white/10 text-white' : ''}`}>
                                <Settings size={22} />
                            </button>

                            {/* Settings Dropdown */}
                            {showSettings && (
                                <div className="absolute bottom-full right-0 mb-4 w-72 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 max-h-96 flex flex-col">
                                    <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center sticky top-0 bg-gray-900/95 z-10 shrink-0">
                                        <span className="font-semibold text-white text-sm">Settings</span>
                                        <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
                                    </div>

                                    <div className="p-2 space-y-1 overflow-y-auto scrollbar-hide">
                                        {/* Speed Control */}
                                        <button onClick={() => {
                                            const speeds = [0.5, 1, 1.25, 1.5, 2];
                                            const currentIdx = speeds.indexOf(playbackRate);
                                            const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
                                            setPlaybackRate(nextSpeed);
                                            if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
                                        }} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group">
                                            <span className="flex items-center gap-2"><Gauge size={16} className="text-pink-400" /> Speed</span>
                                            <span className="font-mono text-xs opacity-60">{playbackRate}x</span>
                                        </button>

                                        <div className="h-px bg-white/10 my-1" />

                                        {audioTracks.length > 1 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">Audio</div>
                                                {audioTracks.map((track) => (
                                                    <button
                                                        key={track.id}
                                                        onClick={() => changeAudioTrack(track.id)}
                                                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group"
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <Music size={16} className={activeAudioTrack === track.id ? "text-cyan-400" : "text-white/40"} />
                                                            {track.label}
                                                            {track.language && <span className="text-[10px] bg-white/10 px-1.5 rounded uppercase">{track.language}</span>}
                                                        </span>
                                                        {activeAudioTrack === track.id && <Check size={14} className="text-cyan-400" />}
                                                    </button>
                                                ))}
                                                <div className="h-px bg-white/10 my-1" />
                                            </>
                                        )}


                                        {/* Actions Section */}
                                        <div className="px-2 py-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">Actions</div>

                                        {onChangeSource && (
                                            <button onClick={() => { setShowSettings(false); onChangeSource(); }} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group">
                                                <span className="flex items-center gap-2"><RefreshCw size={16} className="text-cyan-400" /> Change Source</span>
                                            </button>
                                        )}

                                        {onCheckContent && (
                                            <button onClick={() => { setShowSettings(false); onCheckContent(); }} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group">
                                                <span className="flex items-center gap-2"><ShieldAlert size={16} className="text-orange-400" /> Parents Guide</span>
                                            </button>
                                        )}

                                        {onOpenVLC && (
                                            <button onClick={() => { setShowSettings(false); onOpenVLC(); }} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group">
                                                <span className="flex items-center gap-2"><Download size={16} className="text-purple-400" /> Open in VLC</span>
                                            </button>
                                        )}

                                        <div className="h-px bg-white/10 my-1" />

                                        {/* Subtitle Section */}
                                        <div className="px-2 py-1.5 text-xs font-bold text-white/40 uppercase tracking-wider">Subtitles</div>
                                        <button onClick={() => { setSubtitleSrc(''); setActiveTrackLabel('Off'); setShowSettings(false); }} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group">
                                            <span className="flex items-center gap-2"><Languages size={16} className="text-red-400" /> Off</span>
                                            {activeTrackLabel === 'Off' && <Check size={14} className="text-red-400" />}
                                        </button>

                                        {availableSubtitles.length > 0 ? availableSubtitles.map(item => (
                                            <button key={item.id} disabled={isDownloadingSub} onClick={() => handleSubtitleDownload(item)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white group disabled:opacity-50">
                                                <span className="flex items-center gap-2 truncate max-w-[180px]" title={item.name}>
                                                    <Languages size={16} className={item.lang === 'tr' ? "text-red-500 shrink-0" : "text-blue-400 shrink-0"} />
                                                    <span className="truncate">{item.name}</span>
                                                </span>
                                                {activeTrackLabel === item.name ? <Check size={14} className="text-green-400 flex-shrink-0" /> : <Download size={14} className="text-white/20 group-hover:text-white/60 flex-shrink-0" />}
                                            </button>
                                        )) : <p className="px-3 py-2 text-sm text-white/40 italic">No online subtitles found.</p>}

                                        <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm text-white flex items-center gap-2">
                                            <ClosedCaption size={16} className="text-yellow-400" /> Upload Custom (.srt)
                                        </button>

                                        <div className="h-px bg-white/10 my-1" />
                                        <button onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.pause(); setIsPlaying(false); } setShowSettings(false); }} className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors flex items-center gap-2">
                                            <RotateCcw size={16} /> Reset Video
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <input type="file" accept=".srt,.vtt" ref={fileInputRef} onChange={handleSubtitleFileSelect} style={{ display: 'none' }} />
        </div>
    );
};
