import React, { useRef, useState, useEffect } from 'react';
import { useSkipEngine } from '../../hooks/useSkipEngine';
import { SkipSegment } from '../../types';

interface VideoPlayerProps {
    src: string;
    skipSegments?: SkipSegment[];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, skipSegments = [] }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Integrate Skip Engine
    useSkipEngine({
        currentTime,
        segments: skipSegments,
        onSeek: (time) => {
            if (videoRef.current) {
                videoRef.current.currentTime = time;
            }
        },
    });

    const formatTime = (time: number) => {
        if (!isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            setIsMuted(newVolume === 0);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            videoRef.current.muted = newMuted;
            if (!newMuted && volume === 0) {
                setVolume(0.5);
                videoRef.current.volume = 0.5;
            }
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const time = percentage * (duration || 0);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (video && src) {
            video.volume = 0.8;
            video.load();
            video.play().catch(() => setIsPlaying(false));
        }
    }, [src]);

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                backgroundColor: '#000000',
                cursor: showControls ? 'default' : 'none'
            }}
        >
            {/* Back Button */}
            <button
                onClick={() => window.location.reload()}
                style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    zIndex: 50,
                    padding: '8px 16px',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    opacity: showControls || !isPlaying ? 1 : 0,
                    transition: 'opacity 0.3s',
                    pointerEvents: showControls || !isPlaying ? 'auto' : 'none'
                }}
            >
                ← Back
            </button>

            {/* Video Element */}
            <video
                ref={videoRef}
                src={src}
                autoPlay
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }}
                onTimeUpdate={() => {
                    if (videoRef.current) {
                        setCurrentTime(videoRef.current.currentTime);
                    }
                }}
                onLoadedMetadata={() => {
                    if (videoRef.current) {
                        setDuration(videoRef.current.duration);
                    }
                }}
                onClick={togglePlay}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Controls */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6), transparent)',
                padding: '60px 32px 24px 32px',
                opacity: showControls || !isPlaying ? 1 : 0,
                transform: showControls || !isPlaying ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.3s, transform 0.3s',
                pointerEvents: showControls || !isPlaying ? 'auto' : 'none'
            }}>
                {/* Progress Bar */}
                <div
                    onClick={handleProgressClick}
                    style={{
                        position: 'relative',
                        height: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        marginBottom: '16px'
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${(currentTime / (duration || 1)) * 100}%`,
                        backgroundColor: '#DC2626',
                        borderRadius: '3px'
                    }} />
                </div>

                {/* Control Buttons */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        {/* Play/Pause Button */}
                        <button
                            onClick={togglePlay}
                            style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '32px',
                                padding: '8px'
                            }}
                        >
                            {isPlaying ? '⏸' : '▶'}
                        </button>

                        {/* Volume Control */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                onClick={toggleMute}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '24px',
                                    padding: '8px'
                                }}
                            >
                                {isMuted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                style={{
                                    width: '100px',
                                    height: '4px',
                                    cursor: 'pointer',
                                    background: `linear-gradient(to right, #DC2626 0%, #DC2626 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`,
                                    borderRadius: '2px',
                                    outline: 'none',
                                    WebkitAppearance: 'none',
                                    appearance: 'none'
                                }}
                            />
                        </div>

                        {/* Time Display */}
                        <span style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Fullscreen Button */}
                    <button
                        onClick={() => {
                            if (!document.fullscreenElement) {
                                containerRef.current?.requestFullscreen();
                            } else {
                                document.exitFullscreen();
                            }
                        }}
                        style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '24px',
                            padding: '8px'
                        }}
                    >
                        ⛶
                    </button>
                </div>
            </div>
        </div>
    );
};
