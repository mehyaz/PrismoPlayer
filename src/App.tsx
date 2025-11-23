import { useState, useEffect } from 'react';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { SkipSegment, Movie, RecentlyWatchedItem } from './types';
import { Link2, Upload, FolderOpen, ShieldAlert, Clock, Play } from 'lucide-react';
import { SearchModal } from './components/ContentFilter/SearchModal';
import { ParentsGuideView } from './components/ContentFilter/ParentsGuideView';
import { SkipCreatorModal } from './components/ContentFilter/SkipCreatorModal';

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
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [skipCreatorInitialData, setSkipCreatorInitialData] = useState<{ reason: string, severity: 'low' | 'medium' | 'high' }>({ reason: '', severity: 'medium' });

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
      const newItem: RecentlyWatchedItem = {
        path,
        timestamp: Date.now(),
        progress: time,
        duration,
        title: path.split('/').pop() || 'Unknown Video'
      };
      const updated = [newItem, ...filtered].slice(0, 5); // Keep last 5
      localStorage.setItem('recentlyWatched', JSON.stringify(updated));
      return updated;
    });
  };

  // Update recently watched periodically
  useEffect(() => {
    if (videoSrc && playerCurrentTime > 0) {
      const timeout = setTimeout(() => {
        // We don't have duration here easily unless we lift it up from VideoPlayer
        // For now, we'll pass 0 as duration or try to get it
        // A better way is to have VideoPlayer call a prop onProgress
        // But we can just update it here with what we have
        updateRecentlyWatched(videoSrc, playerCurrentTime, 0);
      }, 5000); // Update every 5 seconds
      return () => clearTimeout(timeout);
    }
  }, [videoSrc, playerCurrentTime]);

  // Persistence
  useEffect(() => {
    // Load skips when video source changes
    if (videoSrc) {
      const savedSkips = localStorage.getItem(`skips-${videoSrc}`);
      if (savedSkips) {
        try {
          setSkipSegments(JSON.parse(savedSkips));
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
    console.log('[App] Opening file dialog...');
    try {
      const filePath = await window.ipcRenderer.invoke('dialog:openFile');
      console.log('[App] Selected file:', filePath);
      if (filePath) {
        const fileUrl = `file://${filePath}`;
        console.log('[App] Setting video src to:', fileUrl);
        setVideoSrc(fileUrl);
      }
    } catch (error) {
      console.error('[App] Error in handleFileSelect:', error);
      alert('Error: ' + error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      console.log('[App] Drag-drop video URL:', url);
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
      setVideoSrc(url);
    } catch (error) {
      console.error('Failed to start torrent:', error);
      alert('Failed to start torrent. Check console for details.');
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
    console.log('Added skip segment:', segment);
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden">
      {/* Video Player or Welcome Screen */}
      <div
        className="h-full w-full relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {videoSrc ? (
          <VideoPlayer
            src={videoSrc}
            skipSegments={skipSegments}
            onTimeUpdate={setPlayerCurrentTime}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <div className="text-center space-y-8 max-w-2xl px-8">
              {/* Logo */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <img
                  src="/prismo-logo.png"
                  alt="Prismo Logo"
                  style={{
                    width: '80px',
                    height: '80px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 10px 30px rgba(102, 126, 234, 0.3))'
                  }}
                />
                <h1 className="text-6xl font-bold text-white tracking-tight">
                  Prismo
                </h1>
              </div>

              {/* Drag & Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-16 transition-all duration-300 ${isDragging
                  ? 'border-red-500 bg-red-500/10 scale-105'
                  : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
                  }`}
              >
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-red-500/20 scale-110' : 'bg-white/10'
                      }`}>
                      <Upload className={`transition-all duration-300 ${isDragging ? 'text-red-500' : 'text-white/60'
                        }`} size={48} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white">
                      {isDragging ? 'Drop your video here' : 'Drop video file here'}
                    </h2>
                    <p className="text-white/60 text-lg">
                      or click below to browse
                    </p>
                  </div>

                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleFileSelect}
                      className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3"
                    >
                      <FolderOpen size={24} />
                      Browse Files
                    </button>

                    <button
                      onClick={() => setIsSearchOpen(true)}
                      className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3 border border-white/10"
                    >
                      <ShieldAlert size={24} className="text-cyan-400" />
                      Check Content
                    </button>
                  </div>

                  <p className="text-white/40 text-sm">
                    Supports: MP4, MKV, AVI, MOV, WEBM, and more
                  </p>
                </div>
              </div>

              {/* Torrent Section */}
              <div className="pt-8 border-t border-white/10">
                <p className="text-white/60 mb-4 text-lg">Or stream from a torrent</p>
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden max-w-xl mx-auto">
                  <div className="flex items-center gap-3 px-5 flex-1">
                    <Link2 size={20} className="text-white/40" />
                    <input
                      type="text"
                      placeholder="Paste magnet link here..."
                      value={magnetLink}
                      onChange={(e) => setMagnetLink(e.target.value)}
                      className="bg-transparent text-white placeholder-white/30 outline-none w-full py-4 text-lg"
                    />
                  </div>
                  <button
                    onClick={handleTorrentStream}
                    disabled={isLoading || !magnetLink}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold transition-colors duration-200"
                  >
                    {isLoading ? 'Loading...' : 'Stream'}
                  </button>
                </div>
              </div>

              {/* Recently Watched */}
              {recentlyWatched.length > 0 && (
                <div className="pt-8 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-4 justify-center text-white/60">
                    <Clock size={16} />
                    <span className="text-sm font-medium uppercase tracking-wider">Recently Watched</span>
                  </div>
                  <div className="grid gap-3 max-w-xl mx-auto">
                    {recentlyWatched.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => setVideoSrc(item.path)}
                        className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                          <Play size={16} fill="currentColor" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">{item.title}</h3>
                          <p className="text-white/40 text-xs">
                            {new Date(item.timestamp).toLocaleDateString()} • {Math.floor(item.progress / 60)}:{Math.floor(item.progress % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectMovie={handleMovieSelect}
        />

        <ParentsGuideView
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          imdbId={selectedMovie?.id || ''}
          movieTitle={selectedMovie?.title || ''}
          onOpenSkipCreator={handleOpenSkipCreator}
        />

        <SkipCreatorModal
          isOpen={isSkipCreatorOpen}
          onClose={() => setIsSkipCreatorOpen(false)}
          onSave={handleAddSkip}
          initialReason={skipCreatorInitialData.reason}
          currentTime={playerCurrentTime}
        />
      </div>
    </div>
  );
}

export default App;
