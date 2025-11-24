import { useState, useEffect, useRef } from 'react';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { SkipSegment, Movie, RecentlyWatchedItem } from './types';
import { Download, Upload, FolderOpen, ShieldAlert, Clock } from 'lucide-react';
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
    console.log('handleTorrentStream called, magnetLink:', magnetLink);
    if (!magnetLink) {
      console.log('No magnet link provided');
      return;
    }
    setIsLoading(true);
    try {
      console.log('Invoking start-torrent IPC with:', magnetLink);
      const url = await window.ipcRenderer.invoke('start-torrent', magnetLink);
      console.log('Received streaming URL:', url);
      if (url) {
        setVideoSrc(url);
        console.log('Video source set to:', url);
      } else {
        console.error('No URL returned from start-torrent');
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
      console.log('Searching for torrent:', query);
      const magnet = await window.ipcRenderer.invoke('search-torrent', query);
      if (magnet) {
        setMagnetLink(magnet);
        // Automatically start streaming
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
    console.log('Movie selected:', movie);
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
    console.log('Added skip segment:', segment);
  };

  const handleClearHistory = () => {
    setRecentlyWatched([]);
    localStorage.removeItem('recentlyWatched');
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      {/* Video Player or Welcome Screen */}
      <div className="h-full w-full relative" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        {videoSrc ? (
          <VideoPlayer src={videoSrc} skipSegments={skipSegments} onTimeUpdate={setPlayerCurrentTime} />
        ) : (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <div className="text-center space-y-8 max-w-2xl px-8">
              {/* Logo */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <img src="/prismo-logo.png" alt="Prismo Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))' }} />
                <h1 className="text-6xl font-bold text-white tracking-tight">Prismo</h1>
              </div>

              {/* Magnet Link Input */}
              <div className="flex flex-col items-center space-y-4 mt-4">
                <input
                  type="text"
                  placeholder="Enter magnet link"
                  value={magnetLink}
                  onChange={e => setMagnetLink(e.target.value)}
                  className="w-full max-w-md p-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleTorrentStream}
                  disabled={!magnetLink || isLoading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Start Torrent'}
                </button>
              </div>

              {/* Drag & Drop Zone */}
              <div className={`relative border-2 border-dashed rounded-2xl p-16 transition-all duration-300 ${isDragging ? 'border-red-500 bg-red-500/10 scale-105' : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'}`}>
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-red-500/20 scale-110' : 'bg-white/10'}`}>
                      <Upload className={`transition-all duration-300 ${isDragging ? 'text-red-500' : 'text-white/60'}`} size={48} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white">{isDragging ? 'Drop your video here' : 'Drop video file here'}</h2>
                    <p className="text-white/60 text-lg">or click below to browse</p>
                  </div>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button onClick={handleFileSelect} className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3">
                      <FolderOpen size={24} /> Browse Files
                    </button>
                    <button onClick={() => setIsSearchOpen(true)} className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3 border border-white/10">
                      <ShieldAlert size={24} className="text-cyan-400" /> Check Content
                    </button>
                    <button
                      onClick={handleFindTorrent}
                      disabled={!selectedMovie || isLoading}
                      className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!selectedMovie ? "Önce bir film seçin" : "Torrent ara ve izle"}
                    >
                      <Download size={24} /> {isLoading ? 'Aranıyor...' : 'Torrent Bul'}
                    </button>
                    {recentlyWatched.length > 0 && (
                      <button onClick={() => setIsHistoryOpen(true)} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3 border border-white/10">
                        <Clock size={24} className="text-purple-400" /> History
                      </button>
                    )}
                  </div>
                  <p className="text-white/40 text-sm">Supports: MP4, MKV, AVI, MOV, WEBM, and more</p>
                </div>
              </div>
            </div>
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
