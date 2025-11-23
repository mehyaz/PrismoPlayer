export interface SkipSegment {
    id: string;
    startTime: number; // in seconds
    endTime: number; // in seconds
    reason: string; // e.g., "Nudity", "Violence"
    severity: 'low' | 'medium' | 'high';
}

export interface ContentProvider {
    type: 'local' | 'url' | 'torrent';
    source: string; // File path, URL, or Magnet link
    title?: string;
    duration?: number;
}

export interface PlayerState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
}
