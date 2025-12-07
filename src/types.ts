export interface SkipSegment {
    id: string;
    startTime: number;
    endTime: number;
    reason: string;
    severity: 'low' | 'medium' | 'high';
}

// Unified Content Type (Movie or Series)
export interface Content {
    id: string;       // IMDb ID (tt...)
    title: string;
    year: string;
    image: string;
    type: 'movie' | 'series' | 'tvEpisode';
}

// Backward compatibility for existing code
export type Movie = Content;

export interface Episode {
    id: string;       // IMDb ID of the episode
    title: string;
    episodeNumber: number;
    seasonNumber: number;
    releaseDate: string;
    plot: string;
    rating: string;
    image?: string;
}

export interface Season {
    seasonNumber: number;
    episodes: Episode[];
}

export interface TorrentItem {
    id: string;
    name: string;
    info_hash: string;
    leechers: string;
    seeders: string;
    num_files: string;
    size: string;
    username: string;
    added: string;
    status: string;
    category: string;
    imdb: string;
    magnet: string;
    score?: number;
    source?: string;
}

export interface SubtitleItem {
    id: string;
    lang: string;
    name: string;
    url: string;
    rating: number;
    source: 'YIFY' | 'TA' | 'OpenSubtitles';
}

export interface SubtitleTrack {
    kind: 'subtitles';
    src: string;
    srcLang: string;
    label: string;
    default: boolean;
}

export interface TorrentProgress {
    downloadSpeed: number;
    progress: number;
    numPeers: number;
    downloaded: number;
    length: number;
}

export interface AppSettings {
    cacheLimitGB: number;
    uploadLimitKB: number;
    downloadsPath: string;
    openSubtitlesApiKey?: string;
}

export interface RecentlyWatchedItem {
    path: string;
    timestamp: number;
    progress: number;
    duration: number;
    title?: string;
    // Add support for series tracking
    imdbId?: string;
    season?: number;
    episode?: number;
}

export interface TorrentFile {
    name: string;
    index: number;
    size: number;
}

export interface LibraryItem {
    id: string;
    path: string;
    name: string;
    size: number;
    birthtime: number; // Created date
    duration?: number;
    thumbnail?: string;
    format: string; // mp4, mkv, etc.
}