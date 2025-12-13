import { useState, useEffect, useRef, useCallback } from 'react';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { getContentWarnings, fetchParentsGuide, estimateRatingFromWarnings } from './utils/contentWarnings';
import { SkipSegment, Movie, RecentlyWatchedItem, TorrentProgress, SubtitleItem, TorrentItem, Episode, FamilyProfile } from './types';
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
import { PINPromptModal } from './components/PINPromptModal';

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

  // Family Safety State
  const [activeProfile, setActiveProfile] = useState<FamilyProfile & { color: string }>({
    id: 'adult',
    name: 'Adult',
    maxAge: 99,
    blockedCategories: [],
    blockedKeywords: [],
    color: 'from-purple-500 to-pink-500'
  });
  const [isPINModalOpen, setIsPINModalOpen] = useState(false);
  const [pinModalContext, setPinModalContext] = useState<{
    movieTitle: string;
    rating: string;
    reason: string;
    contentWarnings?: Array<{ category: string; severity: 'none' | 'mild' | 'moderate' | 'severe'; items?: string[] }>;
  } | null>(null);
  const [pendingMovie, setPendingMovie] = useState<Movie | null>(null);

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

  // Load active profile on mount
  useEffect(() => {
    const loadActiveProfile = async () => {
      try {
        if (window.ipcRenderer) {
          const profile = await window.ipcRenderer.invoke('family:get-active-profile') as FamilyProfile;
          // Map profile to state with color (demo logic for color)
          const color = profile.id === 'kids-7' ? 'from-green-500 to-teal-500' :
            profile.id === 'teens-13' ? 'from-orange-500 to-red-500' :
              profile.id === 'family-16' ? 'from-purple-500 to-indigo-500' :
                'from-purple-500 to-pink-500';

          setActiveProfile({ ...profile, color });
          console.log('[FamilySafety] Loaded active profile:', profile?.name || 'Unknown');
        }
      } catch (error) {
        console.error('[FamilySafety] Failed to load profile:', error);
      }
    };
    loadActiveProfile();
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
      const imdbId = selectedMovie?.id; // Save IMDb ID for subtitle search

      const newItem = {
        path,
        timestamp: Date.now(),
        progress: time,
        duration,
        title,
        imdbId // Add IMDb ID to history
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
    setActiveSource('');
    setInitialPlaybackTime(0);
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
        setInitialPlaybackTime(0); // Reset to start from beginning
        setVideoSrc(`file://${filePath}`);
        setActiveSource(`file://${filePath}`);
      }
    } catch (error) {
      console.error('Error opening file', error);
      alert('Error: ' + error);
    }
  }, []);

  const handleTorrentStream = useCallback(async (magnet: string, fileIndex?: number, skipTimeReset = false) => {
    if (!magnet) return;
    // Only reset time if NOT resuming from history
    if (!skipTimeReset) {
      setInitialPlaybackTime(0);
    }
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



  // Define proceedWithMovie before it's used in handleMovieSelect


  const proceedWithMovie = useCallback((movie: Movie) => {
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

  const handleMovieSelect = useCallback(async (movie: Movie) => {
    // Check if content is restricted for active profile using TMDB ratings
    if (activeProfile) {
      let requiresPIN = false;
      let reason = '';

      // Kids profile: require PIN for all content unless we verify it's G-rated
      if (activeProfile.id === 'kids-7') {
        // Try to get TMDB rating
        if (window.ipcRenderer && movie.id) {
          try {
            const cert = await window.ipcRenderer.invoke('tmdb:get-certification', movie.id) as { rating: string; country: string; isAdult: boolean } | null;

            if (cert && cert.rating) {
              // Only G-rated movies are OK for kids without PIN
              if (cert.rating !== 'G') {
                requiresPIN = true;
                reason = `This movie is rated ${cert.rating}. Kids (7+) profile only allows G-rated content without parental approval.`;

                // Fetch real parents guide data from IMDb
                let contentWarnings = await fetchParentsGuide(movie.id);

                // Fallback to demo warnings if no real data
                if (contentWarnings.length === 0) {
                  contentWarnings = getContentWarnings(movie.title);
                }

                // Set context for PIN modal
                setPinModalContext({
                  movieTitle: movie.title,
                  rating: cert.rating,
                  reason: reason,
                  contentWarnings: contentWarnings
                });
              }
            } else {
              // No TMDB rating found - fetch parents guide and estimate rating
              const contentWarnings = await fetchParentsGuide(movie.id);

              if (contentWarnings.length > 0) {
                // Estimate rating from content warnings
                const estimatedRating = estimateRatingFromWarnings(contentWarnings);
                console.log(`[FamilySafety] Estimated rating for "${movie.title}": ${estimatedRating}`);

                // Apply same rating logic as if we had a TMDB rating
                if (estimatedRating !== 'G') {
                  requiresPIN = true;
                  reason = `Based on content analysis, this movie is estimated as ${estimatedRating}. Kids (7+) profile only allows G-rated content without parental approval.`;

                  setPinModalContext({
                    movieTitle: movie.title,
                    rating: estimatedRating,
                    reason: reason,
                    contentWarnings: contentWarnings
                  });
                }
              } else {
                // No rating AND no parents guide - require PIN for safety
                requiresPIN = true;
                reason = `Rating information not available for "${movie.title}". PIN required for Kids (7+) profile.`;

                setPinModalContext({
                  movieTitle: movie.title,
                  rating: 'Not Rated',
                  reason: reason
                });
              }
            }
          } catch (err) {
            console.error('[Family] Failed to fetch TMDB rating:', err);
            // Fallback to safe mode - require PIN
            requiresPIN = true;
            reason = `All content requires parental approval for Kids (7+) profile.`;
          }
        } else {
          // No TMDB API - require PIN for all
          requiresPIN = true;
          reason = `All content requires parental approval for Kids (7+) profile.`;
        }
      }
      // Teens profile (13+): check TMDB rating
      else if (activeProfile.id === 'teens-13') {
        if (window.ipcRenderer && movie.id) {
          try {
            const cert = await window.ipcRenderer.invoke('tmdb:get-certification', movie.id) as { rating: string; country: string; isAdult: boolean } | null;

            if (cert && cert.rating) {
              // Teens can watch G, PG, PG-13. R and NC-17 need PIN
              if (cert.rating === 'R' || cert.rating === 'NC-17') {
                requiresPIN = true;
                reason = `This movie is rated ${cert.rating}. Teens (13+) profile restricts R and NC-17 rated content.`;

                // Fetch real parents guide data from IMDb
                let contentWarnings = await fetchParentsGuide(movie.id);

                // Fallback to demo warnings if no real data
                if (contentWarnings.length === 0) {
                  contentWarnings = getContentWarnings(movie.title);
                }

                setPinModalContext({
                  movieTitle: movie.title,
                  rating: cert.rating,
                  reason: reason,
                  contentWarnings: contentWarnings
                });
              }
            } else {
              // No TMDB rating - estimate from Parents Guide
              const contentWarnings = await fetchParentsGuide(movie.id);

              if (contentWarnings.length > 0) {
                const estimatedRating = estimateRatingFromWarnings(contentWarnings);
                console.log(`[FamilySafety] Estimated rating for "${movie.title}": ${estimatedRating}`);

                // Teens (13+) require PIN for R and NC-17
                if (estimatedRating === 'R' || estimatedRating === 'NC-17') {
                  requiresPIN = true;
                  reason = `Based on content analysis, this movie is estimated as ${estimatedRating}. Teens (13+) profile restricts R and NC-17 rated content.`;

                  setPinModalContext({
                    movieTitle: movie.title,
                    rating: estimatedRating,
                    reason: reason,
                    contentWarnings: contentWarnings
                  });
                }
              }
            }
          } catch (err) {
            console.error('[Family] TMDB check failed, using keyword fallback:', err);
            // Fallback to keyword-based check
            const titleLower = movie.title.toLowerCase();
            const hasBlockedKeyword = activeProfile.blockedKeywords.some(keyword =>
              titleLower.includes(keyword.toLowerCase())
            );

            if (hasBlockedKeyword) {
              requiresPIN = true;
              reason = `This movie may contain mature content. PIN required for Teens (13+) profile.`;
            }
          }
        }
      }
      // Family profile (16+): only NC-17 blocked
      else if (activeProfile.id === 'family-16') {
        if (window.ipcRenderer && movie.id) {
          try {
            const cert = await window.ipcRenderer.invoke('tmdb:get-certification', movie.id) as { rating: string; country: string; isAdult: boolean } | null;

            if (cert && cert.rating === 'NC-17') {
              requiresPIN = true;
              reason = `This movie is rated ${cert.rating}. Family (16+) profile restricts NC-17 rated content.`;

              // Fetch real parents guide data from IMDb
              let contentWarnings = await fetchParentsGuide(movie.id);

              // Fallback to demo warnings if no real data
              if (contentWarnings.length === 0) {
                contentWarnings = getContentWarnings(movie.title);
              }

              setPinModalContext({
                movieTitle: movie.title,
                rating: cert.rating,
                reason: reason,
                contentWarnings: contentWarnings
              });
            } else if (!cert) {
              // No TMDB rating - estimate from Parents Guide
              const contentWarnings = await fetchParentsGuide(movie.id);

              if (contentWarnings.length > 0) {
                const estimatedRating = estimateRatingFromWarnings(contentWarnings);
                console.log(`[FamilySafety] Estimated rating for "${movie.title}": ${estimatedRating}`);

                // Family (16+) only require PIN for NC-17
                if (estimatedRating === 'NC-17') {
                  requiresPIN = true;
                  reason = `Based on content analysis, this movie is estimated as ${estimatedRating}. Family (16+) profile restricts NC-17 rated content.`;

                  setPinModalContext({
                    movieTitle: movie.title,
                    rating: estimatedRating,
                    reason: reason,
                    contentWarnings: contentWarnings
                  });
                }
              }
            }
          } catch (err) {
            // Keyword fallback
            const titleLower = movie.title.toLowerCase();
            const hasBlockedKeyword = activeProfile.blockedKeywords.some(keyword =>
              titleLower.includes(keyword.toLowerCase())
            );

            if (hasBlockedKeyword) {
              requiresPIN = true;
              reason = `This movie may contain explicit content. PIN required for Family (16+) profile.`;
            }
          }
        }
      }
      // Adult profile: no restrictions

      if (requiresPIN) {
        setPendingMovie(movie);
        setIsPINModalOpen(true);
        console.log(`[FamilySafety] PIN required for "${movie.title}": ${reason}`);
        return;
      }
    }

    // No restriction, proceed
    proceedWithMovie(movie);
  }, [activeProfile, proceedWithMovie]);

  const handlePINSuccess = useCallback(() => {
    if (pendingMovie) {
      proceedWithMovie(pendingMovie);
      setPendingMovie(null);
    }
  }, [pendingMovie, proceedWithMovie]);

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

    // If IMDb ID is available, automatically search for subtitles
    if (item.imdbId && window.ipcRenderer) {
      window.ipcRenderer.invoke('list-subtitles', item.imdbId).then(items => {
        const subtitles = items as SubtitleItem[];
        setSubtitleList(subtitles);
        console.log(`[Resume] Loaded ${subtitles.length} subtitles for ${item.title}`);
      }).catch(err => {
        console.error('[Resume] Subtitle listing failed:', err);
        setSubtitleList([]);
      });
    } else {
      // Clear subtitles if no IMDb ID
      setSubtitleList([]);
    }

    if (item.path.startsWith('magnet:')) {
      // Pass skipTimeReset=true to preserve initialPlaybackTime
      handleTorrentStream(item.path, undefined, true);
    } else if (item.path.includes('127.0.0.1') || item.path.includes('localhost')) {
      // Stale local stream URL from old history
      alert('This replay link is expired. Please search for the movie again.');
    } else {
      // Local file or direct link - don't reset time
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
          initialTime={initialPlaybackTime}
          skipSegments={skipSegments}
          onTimeUpdate={handleTimeUpdate}
          onBack={handleBack}
          availableSubtitles={subtitleList}
          onDownloadSubtitle={handleDownloadSubtitle}
          onSearchSubtitles={() => {
            // Trigger subtitle search manually
            if (selectedMovie?.id && window.ipcRenderer) {
              window.ipcRenderer.invoke('list-subtitles', selectedMovie.id).then(items => {
                const subtitles = items as SubtitleItem[];
                setSubtitleList(subtitles);
                console.log(`[Manual Search] Loaded ${subtitles.length} subtitles`);
              }).catch(err => {
                console.error('[Manual Search] Failed:', err);
              });
            }
          }}
          onCheckContent={() => setIsGuideOpen(true)}
          onChangeSource={() => setIsTorrentListOpen(true)}
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
        activeProfile={activeProfile}
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

      {/* PIN Prompt Modal */}
      <PINPromptModal
        isOpen={isPINModalOpen}
        onClose={() => {
          setIsPINModalOpen(false);
          setPendingMovie(null);
          setPinModalContext(null);
        }}
        onSuccess={handlePINSuccess}
        title="Restricted Content"
        message={pinModalContext?.reason || `This content may not be appropriate for your current profile (${activeProfile?.name}). Enter PIN to continue.`}
        movieTitle={pinModalContext?.movieTitle || pendingMovie?.title}
        rating={pinModalContext?.rating}
        profileName={activeProfile?.name}
        profileAgeLimit={activeProfile?.maxAge}
        contentWarnings={pinModalContext?.contentWarnings}
      />

      <LoadingOverlay isVisible={isLoading && !isSearchOpen} message={isTorrentListOpen ? "Searching sources..." : "Buffering stream..."} onCancel={handleCancelLoading} />
    </MainLayout>
  );
}

export default App;
