import { useState, useEffect, useRef, useCallback } from 'react';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { SkipSegment, Movie, RecentlyWatchedItem, TorrentProgress, SubtitleItem, TorrentItem, Episode } from './types';
import { FileSelectionModal } from './components/ContentFilter/FileSelectionModal';
import { Clock } from 'lucide-react';
import { SearchModal } from './components/ContentFilter/SearchModal';
import { ParentsGuideView } from './components/ContentFilter/ParentsGuideView';
import { SkipCreatorModal } from './components/ContentFilter/SkipCreatorModal';
import { RecentlyWatchedModal } from './components/ContentFilter/RecentlyWatchedModal';
import { TorrentListModal } from './components/ContentFilter/TorrentListModal';
import { SeriesDetailModal } from './components/ContentFilter/SeriesDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { MainLayout } from './components/Layout/MainLayout';
import { Hero } from './components/Home/Hero';
import { LoadingOverlay } from './components/Player/LoadingOverlay';
import { LibraryView } from './components/Library/LibraryView';

function App() {
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [skipSegments, setSkipSegments] = useState<SkipSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadStats, setDownloadStats] = useState<TorrentProgress | null>(null);
  const [subtitleList, setSubtitleList] = useState<SubtitleItem[]>([]);
  const [torrentList, setTorrentList] = useState<TorrentItem[]>([]);

  // New State for File Selection
  const [isFileSelectionOpen, setIsFileSelectionOpen] = useState(false);
  const [pendingTorrentMagnet, setPendingTorrentMagnet] = useState<string>('');
  const [availableFiles, setAvailableFiles] = useState<{ name: string; index: number }[]>([]);

  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searchError, setSearchError] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTorrentListOpen, setIsTorrentListOpen] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSkipCreatorOpen, setIsSkipCreatorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [skipCreatorInitialData, setSkipCreatorInitialData] = useState<{ reason: string; severity: 'low' | 'medium' | 'high' }>({ reason: '', severity: 'medium' });

  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatchedItem[]>([]);
  // State for tracking actual playable source (magnet or file path) and resume time
  const [activeSource, setActiveSource] = useState<string>('');
  const [initialPlaybackTime, setInitialPlaybackTime] = useState(0);

  const playerCurrentTimeRef = useRef(playerCurrentTime);
  const activeSourceRef = useRef(activeSource); // Ref to access inside interval
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoDurationRef = useRef(0);

  // --- Effects ---

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      const removeListener = window.ipcRenderer.on('torrent-progress', (_event, ...args) => {
        const stats = args[0] as TorrentProgress;
        setDownloadStats(stats);
      });
      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentlyWatched');
      if (saved) {
        setRecentlyWatched(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse recently watched', e);
    }
  }, []);

  useEffect(() => {
    playerCurrentTimeRef.current = playerCurrentTime;
  }, [playerCurrentTime]);

  useEffect(() => {
    if (videoSrc) {
      const interval = setInterval(() => {
        if (playerCurrentTimeRef.current > 0) {
          updateRecentlyWatched(videoSrc, playerCurrentTimeRef.current);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]); // updateRecentlyWatched is stable via useCallback, excluding to avoid dep warnings

  useEffect(() => {
    if (videoSrc) {
      const saved = localStorage.getItem(`skips-${videoSrc}`);
      if (saved) {
        try {
          setSkipSegments(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved skips', e);
        }
      } else {
        setSkipSegments([]);
      }
    }
  }, [videoSrc]);

  // --- Handlers ---

  const updateRecentlyWatched = useCallback((path: string, time: number) => {
    setRecentlyWatched(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const filtered = safePrev.filter(item => item.path !== path);

      const title = selectedMovie?.title || path.split('/').pop() || 'Unknown Video';
      const duration = videoDurationRef.current;

      const newItem = {
        path,
        timestamp: Date.now(),
        progress: time,
        duration,
        title
      };
      // Keep only top 10
      const updated = [newItem, ...filtered].slice(0, 10);
      localStorage.setItem('recentlyWatched', JSON.stringify(updated));
      return updated;
    });
  }, [selectedMovie]);

  useEffect(() => {
    activeSourceRef.current = activeSource;
  }, [activeSource]);

  useEffect(() => {
    if (videoSrc && activeSource) {
      const interval = setInterval(() => {
        if (playerCurrentTimeRef.current > 0) {
          updateRecentlyWatched(activeSource, playerCurrentTimeRef.current);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [videoSrc, activeSource, updateRecentlyWatched]);

  const saveSkips = useCallback((newSkips: SkipSegment[]) => {
    setSkipSegments(newSkips);
    if (videoSrc) {
      localStorage.setItem(`skips-${videoSrc}`, JSON.stringify(newSkips));
    }
  }, [videoSrc]);

  const handleBack = useCallback(async () => {
    setVideoSrc('');
    setDownloadStats(null);
    setSubtitleList([]);
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('stop-active-torrent');
      }
    } catch (e) { console.error('Failed to stop active torrent:', e); }
  }, []);

  const handleCancelLoading = useCallback(async () => {
    setIsLoading(false);
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('stop-active-torrent');
      }
    } catch (e) { console.error(e); }

    if (videoSrc) {
      setVideoSrc('');
      setDownloadStats(null);
      setSubtitleList([]);
    }
    else if (selectedMovie && torrentList.length > 0) {
      setIsTorrentListOpen(true);
    }
  }, [selectedMovie, torrentList, videoSrc]);

  const handleFileSelect = useCallback(async () => {
    if (!window.ipcRenderer) return;
    try {
      const filePath = await window.ipcRenderer.invoke('dialog:openFile');
      if (filePath) {
        setVideoSrc(`file://${filePath}`);
        setActiveSource(`file://${filePath}`);
      }
    } catch (error) {
      console.error('Error opening file', error);
      alert('Error: ' + error);
    }
  }, []);

  const handleTorrentStream = useCallback(async (magnet: string, fileIndex?: number) => {
    if (!magnet) return;
    setIsLoading(true);
    setIsTorrentListOpen(false);

    // If starting a new torrent flow without specific file index, clear previous pending state
    if (fileIndex === undefined) {
      setPendingTorrentMagnet('');
      setAvailableFiles([]);
    }

    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      alert('Stream connection timed out. Try another source with more seeds.');
      handleCancelLoading();
    }, 60000);

    try {
      const response = await window.ipcRenderer.invoke('start-torrent', magnet, fileIndex) as string | { status: 'select-files'; files: { name: string; index: number }[] } | undefined;

      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);

      if (typeof response === 'string') {
        // Direct URL received
        setVideoSrc(response);
        setActiveSource(magnet); // Track original magnet
        setIsFileSelectionOpen(false);
      } else if (response && response.status === 'select-files') {
        // Multiple files found, ask user
        setPendingTorrentMagnet(magnet);
        setAvailableFiles(response.files);
        setIsFileSelectionOpen(true);
      } else {
        alert('Failed to start torrent. No streaming URL received.');
      }
    } catch (error) {
      const err = error as Error & { message?: string };
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);
      console.error('Failed to start torrent:', error);

      if (err.message && !err.message.includes('reply was never sent')) {
        alert('Failed to start torrent. Check console for details.');
      }
    }
  }, [handleCancelLoading]);

  const handleFileSelected = useCallback((index: number) => {
    if (pendingTorrentMagnet) {
      handleTorrentStream(pendingTorrentMagnet, index);
    }
  }, [pendingTorrentMagnet, handleTorrentStream]);

  const handleTimeUpdate = useCallback((time: number) => {
    setPlayerCurrentTime(time);
    if (videoDurationRef.current === 0 && time > 0) {
      const videoElement = document.querySelector('video');
      if (videoElement) videoDurationRef.current = videoElement.duration;
    }
  }, []);

  const handleHeroSearch = useCallback(async (query: string) => {
    if (query.match(/^magnet:\?xt=urn:btih:[a-zA-Z0-9]*/)) {
      handleTorrentStream(query);
      return;
    }

    setSearchInitialQuery(query);
    setSearchResults([]);
    setSearchError('');
    setIsLoading(true);
    setIsSearchOpen(true);

    try {
      if (window.ipcRenderer) {
        const data = await window.ipcRenderer.invoke('search-movie', query);
        if (Array.isArray(data)) {
          setSearchResults(data);
        } else {
          setSearchError('Invalid response from server');
        }
      } else {
        console.warn('IPC not available');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError('Failed to search. Check connection.');
    } finally {
      setIsLoading(false);
    }
  }, [handleTorrentStream]);

  const handleFindTorrent = useCallback(async (movieOverride?: Movie, overrideQuery?: string) => {
    const movieToSearch = movieOverride || selectedMovie;
    if (!movieToSearch) return;

    setIsLoading(true);
    setTorrentList([]);
    setSubtitleList([]);

    try {
      if (window.ipcRenderer) {
        // Subtitles might be less accurate for series episode, but let's try show ID
        window.ipcRenderer.invoke('list-subtitles', movieToSearch.id).then(items => {
          setSubtitleList(items as SubtitleItem[]);
        }).catch(err => console.error('Subtitle listing failed:', err));

        // Use overrideQuery if provided (for episodes), otherwise default movie logic
        const query = overrideQuery || `${movieToSearch.title} ${movieToSearch.year || ''}`;
        const type = movieToSearch.type; // 'movie' or 'series'

        const results = await window.ipcRenderer.invoke('list-torrents', query, movieToSearch.id, type);

        setIsSearchOpen(false);

        if (Array.isArray(results)) {
          setTorrentList(results);
          setIsLoading(false);
          if (results.length === 0) {
            alert('No streams found.');
          } else {
            setIsTorrentListOpen(true);
          }
        } else {
          alert('Invalid response from torrent provider.');
          setIsLoading(false);
        }
      } else {
        console.warn('IPC Renderer not available for torrent search.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to search torrent:', error);
      alert('Search failed: ' + error);
      setIsLoading(false);
    }
  }, [selectedMovie]);

  const handleChangeSource = useCallback(async () => {
    if (!selectedMovie) {
      alert('Cannot change source: No movie context.');
      return;
    }
    await handleBack();
    setIsTorrentListOpen(true);
    if (torrentList.length === 0) {
      handleFindTorrent(selectedMovie);
    }
  }, [selectedMovie, handleBack, torrentList, handleFindTorrent]);

  const handleDownloadSubtitle = useCallback(async (item: SubtitleItem) => {
    if (!selectedMovie) return null;
    try {
      if (window.ipcRenderer) {
        const path = await window.ipcRenderer.invoke('download-subtitle', item, selectedMovie.id) as string | null;
        return path;
      }
      return null;
    } catch (err) {
      console.error('Download failed:', err);
      return null;
    }
  }, [selectedMovie]);

  const handleOpenVLC = useCallback(async () => {
    if (!videoSrc) return;
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('open-in-vlc', videoSrc);
      }
    } catch (err) {
      console.error('Failed to open VLC:', err);
      alert('Failed to open VLC. Make sure it is installed.');
    }
  }, [videoSrc]);

  const handleMovieSelect = useCallback((movie: Movie) => {
    setSelectedMovie(movie);
    setIsSearchOpen(false);

    if (movie.type === 'series') {
      // Open series detail modal
      setIsSeriesModalOpen(true);
    } else {
      // Open torrent search for movie
      handleFindTorrent(movie);
    }
  }, [handleFindTorrent]);

  const handlePlayEpisode = useCallback((episode: Episode) => {
    if (!selectedMovie) return;
    setIsSeriesModalOpen(false);

    const s = episode.seasonNumber.toString().padStart(2, '0');
    const e = episode.episodeNumber.toString().padStart(2, '0');
    const query = `${selectedMovie.title} S${s}E${e}`;

    console.log(`[Series] Searching for episode: ${query}`);
    handleFindTorrent(selectedMovie, query);
  }, [selectedMovie, handleFindTorrent]);

  const handleOpenSkipCreator = useCallback((reason: string, severity: 'low' | 'medium' | 'high') => {
    setSkipCreatorInitialData({ reason, severity });
    setIsSkipCreatorOpen(true);
  }, []);

  const handleAddSkip = useCallback((segment: SkipSegment) => {
    const newSkips = [...skipSegments, segment].sort((a, b) => a.startTime - b.startTime);
    saveSkips(newSkips);
  }, [saveSkips, skipSegments]);

  const handleClearHistory = useCallback(() => {
    setRecentlyWatched([]);
    localStorage.removeItem('recentlyWatched');
  }, []);

  const handleResumeWatch = useCallback((item: RecentlyWatchedItem) => {
    // Determine type by checking prefix
    setInitialPlaybackTime(item.progress);

    if (item.path.startsWith('magnet:')) {
      handleTorrentStream(item.path);
    } else if (item.path.includes('127.0.0.1') || item.path.includes('localhost')) {
      // Stale local stream URL from old history
      alert('This replay link is expired. Please search for the movie again.');
    } else {
      // Local file or direct link
      setVideoSrc(item.path);
      setActiveSource(item.path);
    }
  }, [handleTorrentStream]);

  // --- Render ---

  if (videoSrc) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black z-[9999] flex flex-col">
        <VideoPlayer
          src={videoSrc}
          initialTime={initialPlaybackTime} // Pass resume time
          skipSegments={skipSegments}
          onTimeUpdate={handleTimeUpdate}
          onBack={handleBack}
          onChangeSource={handleChangeSource}
          onCheckContent={() => setIsGuideOpen(true)}
          availableSubtitles={subtitleList}
          onDownloadSubtitle={handleDownloadSubtitle}
          onOpenVLC={handleOpenVLC}
        />
        {downloadStats && downloadStats.progress < 1 && (
          <div className="absolute top-24 right-4 bg-black/60 text-white p-4 rounded-xl backdrop-blur-md border border-white/10 z-50 font-mono text-xs space-y-2 shadow-2xl select-none pointer-events-none animate-in fade-in duration-500 w-64">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Speed</span>
              <span className="text-cyan-400 font-bold bg-cyan-400/10 px-2 py-0.5 rounded text-[10px]">{(downloadStats.downloadSpeed / 1024 / 1024).toFixed(1)} MB/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Peers</span>
              <span className="text-purple-400 font-bold">{downloadStats.numPeers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Progress</span>
              <span className="text-green-400 font-bold">{(downloadStats.progress * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-1">
              <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${downloadStats.progress * 100}%` }} />
            </div>
          </div>
        )}

        <ParentsGuideView
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          imdbId={selectedMovie?.id || ''}
          movieTitle={selectedMovie?.title || ''}
          onOpenSkipCreator={handleOpenSkipCreator}
        />
        <TorrentListModal
          isOpen={isTorrentListOpen}
          onClose={() => setIsTorrentListOpen(false)}
          torrents={torrentList}
          movie={selectedMovie}
          onSelectTorrent={handleTorrentStream}
          isLoading={isLoading}
        />

        <SkipCreatorModal isOpen={isSkipCreatorOpen} onClose={() => setIsSkipCreatorOpen(false)} onSave={handleAddSkip} initialReason={skipCreatorInitialData.reason} currentTime={playerCurrentTime} />
        <FileSelectionModal
          isOpen={isFileSelectionOpen}
          onClose={() => setIsFileSelectionOpen(false)}
          files={availableFiles}
          onSelect={handleFileSelected}
        />
        <LoadingOverlay isVisible={isLoading} message="Buffering stream..." onCancel={handleCancelLoading} />
      </div>
    );
  }

  return (
    <MainLayout
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        if (tab === 'search') {
          setSearchInitialQuery('');
          setIsSearchOpen(true);
        }
        if (tab === 'history') setIsHistoryOpen(true);
      }}
      onSettingsClick={() => setIsSettingsOpen(true)}
    >
      {/* Home Content */}
      {activeTab === 'home' && (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-12 animate-fade-in pb-20 pt-10 px-4">
          <Hero onSearch={handleHeroSearch} onFileSelect={handleFileSelect} />

          {/* Recently Watched */}
          {recentlyWatched.length > 0 && (
            <div className="w-full">
              <div className="flex items-center gap-3 mb-6 text-white/60">
                <Clock size={20} />
                <h2 className="text-xl font-semibold tracking-wide">Continue Watching</h2>
              </div>
              <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x">
                {recentlyWatched.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleResumeWatch(item)}
                    className="relative group flex-shrink-0 w-64 aspect-video bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all hover:scale-105 snap-start text-left"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/40 flex flex-col justify-end p-4">
                      <h3 className="text-white font-medium truncate text-lg">{item.title || 'Unknown Video'}</h3>
                      <div className="w-full bg-white/20 h-1 rounded-full mt-3 overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full"
                          style={{ width: `${(item.progress / (item.duration || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Library Tab */}
      {activeTab === 'library' && (
        <LibraryView onPlay={(path) => {
          // Use encodeURI to handle spaces and special characters in file path
          const safePath = encodeURI(path);
          setVideoSrc(`file://${safePath}`);
          setActiveSource(`file://${path}`); // Keep raw path for history/display
          // setActiveTab('home'); // No need to switch tab, video player overlay takes over
        }} />
      )}

      {/* Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          setSearchInitialQuery('');
          setSearchResults([]);
          setSearchError('');
          if (activeTab === 'search') setActiveTab('home');
        }}
        onSelectMovie={handleMovieSelect}
        results={searchResults}
        query={searchInitialQuery}
        isLoading={isLoading && isSearchOpen}
        error={searchError}
      />

      <RecentlyWatchedModal isOpen={isHistoryOpen} onClose={() => { setIsHistoryOpen(false); if (activeTab === 'history') setActiveTab('home'); }} items={recentlyWatched} onSelect={handleResumeWatch} onClear={handleClearHistory} />

      <TorrentListModal
        isOpen={isTorrentListOpen}
        onClose={() => setIsTorrentListOpen(false)}
        torrents={torrentList}
        movie={selectedMovie}
        onSelectTorrent={handleTorrentStream}
        isLoading={false}
      />

      <SeriesDetailModal
        isOpen={isSeriesModalOpen}
        onClose={() => setIsSeriesModalOpen(false)}
        show={selectedMovie}
        onPlayEpisode={handlePlayEpisode}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <LoadingOverlay isVisible={isLoading && !isSearchOpen} message={isTorrentListOpen ? "Searching sources..." : "Buffering stream..."} onCancel={handleCancelLoading} />
    </MainLayout>
  );
}

export default App;
