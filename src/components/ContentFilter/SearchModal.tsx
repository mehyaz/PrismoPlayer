import React, { useState } from 'react';
import { Search, X, Loader2, Film } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: any) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectMovie }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const data = await window.ipcRenderer.invoke('search-movie', query);
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Search IMDb</h2>
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="p-6 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a movie..."
              className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 transition-colors"
              autoFocus
            />
            {isLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="animate-spin text-cyan-500" size={20} />
              </div>
            )}
          </div>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {results.length === 0 && !isLoading && query && (
            <div className="text-center text-white/40 py-12">
              No results found
            </div>
          )}
          
          {results.map((movie) => (
            <button
              key={movie.id}
              onClick={() => onSelectMovie(movie)}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors group text-left"
            >
              <div className="w-16 h-24 bg-black/40 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                {movie.image ? (
                  <img src={movie.image} alt={movie.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="text-white/20" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                  {movie.title}
                </h3>
                <p className="text-white/60">{movie.year}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
