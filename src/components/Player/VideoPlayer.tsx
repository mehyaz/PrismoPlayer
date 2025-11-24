import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSkipEngine } from '../../hooks/useSkipEngine';
import { SkipSegment } from '../../types';
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
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, skipSegments = [], onTimeUpdate }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSubtitles, setShowSubtitles] = useState(false);
    const [subtitleSrc, setSubtitleSrc] = useState<string>('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useSkipEngine({
        currentTime,
        segments: skipSegments,
        onSeek: (time) => {
            if (videoRef.current) videoRef.current.currentTime = time;
        },
    });

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

    const toggleSubtitles = useCallback(() => setShowSubtitles((prev) => !prev), []);

    const handleSubtitleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setSubtitleSrc(url);
            setShowSubtitles(true);
        }
    }, []);

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
        }
    }, [onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);

            // Check audio tracks
            setTimeout(() => {
                if (videoRef.current) {
                    const video = videoRef.current as any;
                    const hasAudio = video.mozHasAudio ||
                        video.webkitAudioDecodedByteCount > 0 ||
                        (video.audioTracks && video.audioTracks.length > 0);

                    if (!hasAudio) {
                        console.warn('No audio detected - video may have unsupported audio codec (AC3, DTS, etc.)');
                        // Show a subtle warning
                        const audioWarning = document.createElement('div');
                        audioWarning.textContent = '⚠️ Ses codec\'i desteklenmiyor (AC3/DTS). AAC codec\'li torrent deneyin.';
                        audioWarning.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: rgba(255,165,0,0.9); color: white; padding: 12px 24px; border-radius: 8px; z-index: 9999; font-size: 14px;';
                        document.body.appendChild(audioWarning);
                        setTimeout(() => audioWarning.remove(), 8000);
                    }
                }
            }, 1000);
        }
    }, []);

    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [isPlaying]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const handled = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyM', 'KeyF', 'Escape', 'KeyK'];
            if (handled.includes(e.code)) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (!videoRef.current) return;

            switch (e.code) {
                case 'ArrowLeft':
                    seek(-5);
                    break;
                case 'ArrowRight':
                    seek(5);
                    break;
                case 'ArrowUp':
                    setVolume((v) => {
                        const nv = Math.min(1, v + 0.1);
                        if (videoRef.current) videoRef.current.volume = nv;
                        return nv;
                    });
                    break;
                case 'ArrowDown':
                    setVolume((v) => {
                        const nv = Math.max(0, v - 0.1);
                        if (videoRef.current) videoRef.current.volume = nv;
                        return nv;
                    });
                    break;
                case 'KeyF':
                    toggleFullscreen();
                    break;
                case 'KeyK':
                case 'Space':
                    togglePlay();
                    break;
                case 'KeyM':
                    toggleMute();
                    break;
                case 'Escape':
                    if (showSettings) {
                        setShowSettings(false);
                    } else if (document.fullscreenElement) {
                        document.exitFullscreen();
                        setIsFullscreen(false);
                    }
                    break;
                default:
                    break;
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
        const onPlaying = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        video.addEventListener('playing', onPlaying);
        video.addEventListener('pause', onPause);
        video.volume = isMuted ? 0 : volume;

        return () => {
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('pause', onPause);
        };
    }, [isMuted, volume]);

    useEffect(() => {
        const video = videoRef.current;
        if (video && src) {
            video.src = src;
            video.load();
            video.play().catch(() => setIsPlaying(false));
        }
    }, [src]);

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    };

    const videoStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    };

    const topBarStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        opacity: showControls || !isPlaying ? 1 : 0,
        transition: 'opacity 0.3s',
    };

    const bottomBarStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: '16px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
        opacity: showControls || !isPlaying ? 1 : 0,
        transform: showControls || !isPlaying ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.3s',
    };

    const buttonStyle: React.CSSProperties = {
        padding: '8px',
        borderRadius: '50%',
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const progressBarStyle: React.CSSProperties = {
        position: 'relative',
        height: '6px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '3px',
        marginBottom: '12px',
        cursor: 'pointer',
    };

    const progressFillStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        backgroundColor: '#dc2626',
        borderRadius: '3px',
        width: `${(currentTime / (duration || 1)) * 100}%`,
    };

    return (
        <div
            ref={containerRef}
            style={containerStyle}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                src={src}
                style={videoStyle}
                onClick={togglePlay}
                onDoubleClick={toggleFullscreen}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onError={(e) => console.error('Video error:', e)}
                autoPlay
                playsInline
                controls={false}
            >
                {subtitleSrc && showSubtitles && <track kind="subtitles" src={subtitleSrc} srcLang="tr" default />}
                Your browser does not support the video tag.
            </video>

            {/* Top bar */}
            <div style={topBarStyle}>
                <button onClick={() => window.location.reload()} style={{ ...buttonStyle, padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.6)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <RotateCcw size={18} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Geri Dön</span>
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={toggleSubtitles} style={{ ...buttonStyle, color: showSubtitles ? '#60a5fa' : 'white' }} title="Altyazı">
                        <ClosedCaption size={20} />
                    </button>
                    <button onClick={toggleFullscreen} style={buttonStyle} title="Tam Ekran">
                        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
                </div>
            </div>

            {/* Bottom controls */}
            <div style={bottomBarStyle}>
                {/* Progress bar */}
                <div style={progressBarStyle} onClick={handleProgressClick}>
                    <div style={progressFillStyle} />
                </div>

                {/* Time display */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#d1d5db', marginBottom: '12px' }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>

                {/* Control buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={togglePlay} style={buttonStyle} aria-label={isPlaying ? 'Duraklat' : 'Oynat'}>
                            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <button onClick={toggleMute} style={buttonStyle} aria-label={isMuted ? 'Sesi Aç' : 'Sessiz'}>
                            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            style={{
                                width: '96px',
                                height: '6px',
                                cursor: 'pointer',
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: '3px',
                                outline: 'none'
                            }}
                        />
                        <button onClick={() => seek(-10)} style={buttonStyle} aria-label="10s geri">
                            <SkipBack size={20} />
                        </button>
                        <button onClick={() => seek(10)} style={buttonStyle} aria-label="10s ileri">
                            <SkipForward size={20} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                        <button onClick={() => fileInputRef.current?.click()} style={buttonStyle} title="Altyazı Yükle">
                            <ClosedCaption size={20} />
                        </button>
                        <button onClick={() => setShowSettings((s) => !s)} style={buttonStyle} aria-label="Ayarlar">
                            <Settings size={20} />
                        </button>
                        {showSettings && (
                            <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', width: '192px', backgroundColor: '#1f2937', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '8px 0', zIndex: 20 }}>
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 500, fontSize: '14px' }}>Ayarlar</span>
                                    <button onClick={() => setShowSettings(false)} style={{ ...buttonStyle, padding: '4px', color: '#9ca3af' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        if (videoRef.current) {
                                            videoRef.current.currentTime = 0;
                                            videoRef.current.pause();
                                            setIsPlaying(false);
                                        }
                                        setShowSettings(false);
                                    }}
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', color: '#f87171', fontSize: '14px', cursor: 'pointer' }}
                                >
                                    Videoyu Sıfırla
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden file input for subtitles */}
            <input type="file" accept=".srt,.vtt" ref={fileInputRef} onChange={handleSubtitleSelect} style={{ display: 'none' }} />
        </div>
    );
};
