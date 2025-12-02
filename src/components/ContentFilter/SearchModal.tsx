import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Film, AlertCircle, ChevronRight } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setError('');
    }
  }, [isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setError('');
        return;
      }

      setIsLoading(true);
      setError('');
      setResults([]);

      try {
        const data = await window.ipcRenderer.invoke('search-movie', query);
        if (Array.isArray(data)) {
          setResults(data);
          if (data.length === 0) {
            setError('No results found.');
          }
        } else {
          setError('Invalid response from server');
        }
      } catch (err) {
        console.error('Search failed:', err);
        setError('Failed to search. Check connection.');
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Backdrop Click Handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Header & Search */}
        <div className="p-5 border-b border-white/10 bg-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Film className="text-cyan-400" size={20} />
              Check Content
            </h2>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-xl opacity-0 group-focus-within:opacity-100 transition duration-500 blur"></div>
            <div className="relative flex items-center bg-black border border-white/10 rounded-xl overflow-hidden">
                <div className="pl-4 text-white/40">
                    <Search size={18} />
                </div>
                <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movie title..."
                className="w-full bg-transparent border-none text-white placeholder-white/30 px-4 py-3 focus:ring-0 outline-none text-base"
                autoFocus
                />
                {isLoading ? (
                <div className="pr-4">
                    <Loader2 className="animate-spin text-cyan-500" size={18} />
                </div>
                ) : query && (
                <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="pr-4 text-white/20 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
                )}
            </div>
          </form>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400/80 gap-3">
              <AlertCircle size={32} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/20 gap-3">
              <Film size={32} strokeWidth={1.5} />
              <p className="text-sm">Type to search movies...</p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {results.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => onSelectMovie(movie)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group text-left"
                >
                  {/* Poster Thumbnail */}
                  <div className="w-10 h-14 bg-white/5 rounded-md overflow-hidden flex-shrink-0 border border-white/5 group-hover:border-white/20 transition-colors relative">
                      {movie.image ? (
                          <img src={movie.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10">
                              <Film size={16} />
                          </div>
                      )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-medium text-white group-hover:text-cyan-400 transition-colors truncate">
                      {movie.title}
                    </h3>
                    <p className="text-sm text-white/40 mt-0.5">
                        {movie.year || 'Unknown Year'}
                    </p>
                  </div>

                  <div className="text-white/20 group-hover:text-white/60 transition-colors">
                      <ChevronRight size={20} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};