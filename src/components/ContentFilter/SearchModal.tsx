import React, { useState } from 'react';
import { Search, X, Loader2, Film, AlertCircle } from 'lucide-react';
import { Movie } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectMovie }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');
    setResults([]);

    try {
      console.log('Searching for:', query);
      const data = await window.ipcRenderer.invoke('search-movie', query);
      console.log('Search results:', data);

      if (Array.isArray(data)) {
        setResults(data);
        if (data.length === 0) {
          setError('No results found. Try a different term.');
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to search. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)'
      }}
    >
      {/* Backdrop Click Handler */}
      <div
        style={{ position: 'absolute', inset: 0 }}
        onClick={() => {
          console.log('Backdrop clicked, closing modal');
          onClose();
        }}
      />

      {/* Modal Content */}
      <div
        className="relative bg-gray-900/90 border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{
          width: '90%',
          maxWidth: '450px',
          maxHeight: '70vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header & Search */}
        <div className="p-4 border-b border-white/10 bg-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Film className="text-cyan-400" size={18} />
              Search IMDb
            </h2>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Movie title..."
              className="w-full bg-black/50 border border-white/10 rounded-lg py-2.5 pl-10 pr-8 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:bg-black/70 transition-all text-sm"
              autoFocus
            />
            {isLoading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="animate-spin text-cyan-500" size={16} />
              </div>
            ) : query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide max-h-[50vh]">
          {error ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-400/80 gap-2">
              <AlertCircle size={24} />
              <p className="text-xs">{error}</p>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-white/20 gap-2">
              <Search size={24} />
              <p className="text-xs">Enter a movie title</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => onSelectMovie(movie)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-all group text-left border border-transparent hover:border-white/5"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <h3 className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors truncate">
                      {movie.title}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-1 rounded group-hover:bg-white/10 transition-colors">
                    {movie.year}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
