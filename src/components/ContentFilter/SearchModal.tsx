import React from 'react';
import { X, Film, AlertCircle, ChevronRight, Search, Loader2 } from 'lucide-react';
import { Movie } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  results: Movie[];
  query: string;
  isLoading: boolean;
  error?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({ 
    isOpen, onClose, onSelectMovie, results, query, isLoading, error 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Backdrop Click Handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Search className="text-cyan-400" size={20} />
              Search Results
            </h2>
            <p className="text-xs text-white/40 mt-1">
                for "<span className="text-white/80 font-medium">{query}</span>"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-3">
                <Loader2 className="animate-spin text-cyan-500" size={32} />
                <p className="text-sm">Searching IMDb...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400/80 gap-3">
              <AlertCircle size={32} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/20 gap-3">
              <Film size={32} strokeWidth={1.5} />
              <p className="text-sm">No results found.</p>
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