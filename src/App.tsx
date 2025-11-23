import { useState } from 'react';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { SkipSegment } from './types';
import { Link2, Upload, FolderOpen } from 'lucide-react';

function App() {
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [skipSegments] = useState<SkipSegment[]>([
    { id: '1', startTime: 10, endTime: 15, reason: 'Test Skip', severity: 'low' },
  ]);
  const [magnetLink, setMagnetLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
          <VideoPlayer src={videoSrc} skipSegments={skipSegments} />
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

                  <button
                    onClick={handleFileSelect}
                    className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-xl hover:shadow-2xl hover:scale-105 flex items-center gap-3 mx-auto"
                  >
                    <FolderOpen size={24} />
                    Browse Files
                  </button>

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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
