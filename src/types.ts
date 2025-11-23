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

export interface Movie {
    id: string;
    title: string;
    year: string;
    image: string;
}

export interface ParentsGuideItem {
    category: string;
    status: string;
    items: string[];
}

export interface RecentlyWatchedItem {
    path: string;
    timestamp: number; // Last watched timestamp (Date.now())
    progress: number; // Video progress in seconds
    duration: number; // Total duration in seconds
    title?: string; // Optional title (filename or scraped title)
}
