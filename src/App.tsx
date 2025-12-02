import { useState, useEffect, useRef } from 'react';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { SkipSegment, Movie, RecentlyWatchedItem, TorrentProgress } from './types';
import { Download, Upload, FolderOpen, ShieldAlert, Clock, Play, Magnet } from 'lucide-react';
import { SearchModal } from './components/ContentFilter/SearchModal';
import { ParentsGuideView } from './components/ContentFilter/ParentsGuideView';
import { SkipCreatorModal } from './components/ContentFilter/SkipCreatorModal';
import { RecentlyWatchedModal } from './components/ContentFilter/RecentlyWatchedModal';

function App() {
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [skipSegments, setSkipSegments] = useState<SkipSegment[]>([]);
  const [magnetLink, setMagnetLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadStats, setDownloadStats] = useState<TorrentProgress | null>(null);

  // Torrent progress listener
  useEffect(() => {
    const removeListener = window.ipcRenderer.on('torrent-progress', (_event, stats: TorrentProgress) => {
      setDownloadStats(stats);
    });
    return () => removeListener();
  }, []);

  // Content Filter State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSkipCreatorOpen, setIsSkipCreatorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [skipCreatorInitialData, setSkipCreatorInitialData] = useState<{ reason: string; severity: 'low' | 'medium' | 'high' }>({ reason: '', severity: 'medium' });

  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatchedItem[]>([]);

  // Load recently watched on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentlyWatched');
    if (saved) {
      try {
        setRecentlyWatched(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recently watched', e);
      }
    }
  }, []);

  const updateRecentlyWatched = (path: string, time: number, duration: number) => {
    setRecentlyWatched(prev => {
      const filtered = prev.filter(item => item.path !== path);
      const newItem = { path, timestamp: Date.now(), progress: time, duration, title: path.split('/').pop() || 'Unknown Video' };
      const updated = [newItem, ...filtered].slice(0, 5);
      localStorage.setItem('recentlyWatched', JSON.stringify(updated));
      return updated;
    });
  };

  const playerCurrentTimeRef = useRef(playerCurrentTime);
  useEffect(() => {
    playerCurrentTimeRef.current = playerCurrentTime;
  }, [playerCurrentTime]);

  // Periodic save of progress
  useEffect(() => {
    if (videoSrc) {
      const interval = setInterval(() => {
        if (playerCurrentTimeRef.current > 0) {
          updateRecentlyWatched(videoSrc, playerCurrentTimeRef.current, 0);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [videoSrc]);

  // Persistence of skips
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

  const saveSkips = (newSkips: SkipSegment[]) => {
    setSkipSegments(newSkips);
    if (videoSrc) {
      localStorage.setItem(`skips-${videoSrc}`, JSON.stringify(newSkips));
    }
  };

  const handleFileSelect = async () => {
    try {
      const filePath = await window.ipcRenderer.invoke('dialog:openFile');
      if (filePath) {
        const fileUrl = `file://${filePath}`;
        setVideoSrc(fileUrl);
      }
    } catch (error) {
      console.error('Error opening file', error);
      alert('Error: ' + error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleTorrentStream = async () => {
    if (!magnetLink) return;
    setIsLoading(true);
    try {
      const url = await window.ipcRenderer.invoke('start-torrent', magnetLink);
      if (url) {
        setVideoSrc(url);
      } else {
        alert('Failed to start torrent. No streaming URL received.');
      }
    } catch (error) {
      console.error('Failed to start torrent:', error);
      alert('Failed to start torrent. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindTorrent = async () => {
    if (!selectedMovie) return;
    setIsLoading(true);
    try {
      const query = `${selectedMovie.title} ${selectedMovie.year || ''}`;
      const magnet = await window.ipcRenderer.invoke('search-torrent', query);
      if (magnet) {
        setMagnetLink(magnet);
        const url = await window.ipcRenderer.invoke('start-torrent', magnet);
        setVideoSrc(url);
      } else {
        alert('No torrents found for this movie.');
      }
    } catch (error) {
      console.error('Failed to search torrent:', error);
      alert('Failed to search for torrent. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMovieSelect = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsSearchOpen(false);
    setIsGuideOpen(true);
  };

  const handleOpenSkipCreator = (reason: string, severity: 'low' | 'medium' | 'high') => {
    setSkipCreatorInitialData({ reason, severity });
    setIsSkipCreatorOpen(true);
  };

  const handleAddSkip = (segment: SkipSegment) => {
    const newSkips = [...skipSegments, segment].sort((a, b) => a.startTime - b.startTime);
    saveSkips(newSkips);
  };

  const handleClearHistory = () => {
    setRecentlyWatched([]);
    localStorage.removeItem('recentlyWatched');
  };

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans">
      {/* Main Content */}
      <div className="h-full w-full relative" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        {videoSrc ? (
          <div className="relative h-full w-full bg-black animate-fade-in">
            <VideoPlayer src={videoSrc} skipSegments={skipSegments} onTimeUpdate={setPlayerCurrentTime} />
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
                <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    style={{ width: `${downloadStats.progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black relative">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            
            <div className="z-10 w-full max-w-4xl px-8 flex flex-col items-center space-y-12">
              
              {/* Logo Section */}
              <div className="flex flex-col items-center gap-6 animate-fade-in">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                  <img 
                    src="/prismo-logo.png" 
                    alt="Prismo Logo" 
                    className="relative w-24 h-24 object-contain drop-shadow-2xl transform transition duration-500 hover:scale-105" 
                    style={{ width: '6rem', height: '6rem' }}
                  />
                </div>
                <h1 className="text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                  Prismo
                </h1>
                <p className="text-white/40 text-lg max-w-md text-center leading-relaxed">
                  Advanced video player with intelligent content filtering and secure playback.
                </p>
              </div>

              {/* Magnet Input */}
              <div className="w-full max-w-xl relative group animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative flex bg-black rounded-xl border border-white/10 p-1.5 items-center shadow-2xl">
                  <div className="pl-4 text-white/30">
                    <Magnet size={20} />
                  </div>
                  <input
                    type="text"
                    placeholder="Paste magnet link to stream..."
                    value={magnetLink}
                    onChange={e => setMagnetLink(e.target.value)}
                    className="w-full bg-transparent border-none text-white placeholder-white/30 focus:ring-0 px-4 py-3 outline-none font-mono text-sm"
                  />
                  <button
                    onClick={handleTorrentStream}
                    disabled={!magnetLink || isLoading}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading ? <span className="animate-pulse">Loading...</span> : <Play size={16} fill="currentColor" />}
                  </button>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full animate-fade-in" style={{ animationDelay: '0.2s' }}>
                
                {/* Local File */}
                <button 
                  onClick={handleFileSelect}
                  className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 text-left hover:-translate-y-1 hover:shadow-2xl hover:border-white/20 flex flex-col gap-4"
                >
                  <div className="p-3 bg-red-500/10 w-fit rounded-xl text-red-400 group-hover:scale-110 transition-transform duration-300">
                    <FolderOpen size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-red-400 transition-colors">Local File</h3>
                    <p className="text-sm text-white/40 mt-1">Browse and play videos from your computer</p>
                  </div>
                </button>

                {/* Check Content */}
                <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 text-left hover:-translate-y-1 hover:shadow-2xl hover:border-white/20 flex flex-col gap-4"
                >
                  <div className="p-3 bg-cyan-500/10 w-fit rounded-xl text-cyan-400 group-hover:scale-110 transition-transform duration-300">
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">Check Content</h3>
                    <p className="text-sm text-white/40 mt-1">Search IMDb guide and auto-skip scenes</p>
                  </div>
                </button>

                {/* Find Torrent */}
                <button 
                  onClick={handleFindTorrent}
                  disabled={!selectedMovie}
                  className={`group relative p-6 rounded-2xl bg-white/5 border border-white/10 transition-all duration-300 text-left flex flex-col gap-4 ${!selectedMovie ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 hover:-translate-y-1 hover:shadow-2xl hover:border-white/20'}`}
                >
                  <div className="p-3 bg-purple-500/10 w-fit rounded-xl text-purple-400 group-hover:scale-110 transition-transform duration-300">
                    <Download size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
                      {isLoading ? 'Searching...' : 'Stream Torrent'}
                    </h3>
                    <p className="text-sm text-white/40 mt-1">
                      {selectedMovie ? `Stream "${selectedMovie.title}"` : 'Select a movie first to enable'}
                    </p>
                  </div>
                </button>

              </div>
              
              {/* Drag Drop Overlay Hint */}
              <div className={`absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-50 transition-all duration-300 pointer-events-none ${isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                <div className="text-center animate-bounce">
                  <Upload size={64} className="mx-auto mb-4 text-cyan-400" />
                  <h2 className="text-3xl font-bold text-white">Drop Video Here</h2>
                </div>
              </div>

            </div>
            
            {/* Footer / History */}
            {recentlyWatched.length > 0 && (
               <div className="absolute bottom-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                 <button 
                   onClick={() => setIsHistoryOpen(true)} 
                   className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-white/20"
                 >
                   <Clock size={14} />
                   <span>Continue watching ({recentlyWatched.length})</span>
                 </button>
               </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onSelectMovie={handleMovieSelect} />
      <RecentlyWatchedModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} items={recentlyWatched} onSelect={setVideoSrc} onClear={handleClearHistory} />
      <ParentsGuideView isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} imdbId={selectedMovie?.id || ''} movieTitle={selectedMovie?.title || ''} onOpenSkipCreator={handleOpenSkipCreator} />
      <SkipCreatorModal isOpen={isSkipCreatorOpen} onClose={() => setIsSkipCreatorOpen(false)} onSave={handleAddSkip} initialReason={skipCreatorInitialData.reason} currentTime={playerCurrentTime} />
    </div>
  );
}

export default App;