import React, { useState } from 'react';
import { Search, Upload, Magnet, ArrowRight } from 'lucide-react';

interface HeroProps {
    onSearch: (query: string) => void;
    onFileSelect: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSearch, onFileSelect }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSearch(input);
            setInput(''); 
        }
    };

    return (
        <div className="w-full flex flex-col items-center justify-center py-20 px-4 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="z-10 w-full max-w-3xl text-center space-y-8">
                
                {/* Logo and App Name (Previous Style) */}
                <div className="flex flex-col items-center gap-6 animate-fade-in">
                    <img 
                        src="/prismo-logo.svg" 
                        alt="Prismo Logo" 
                        className="w-28 h-28 object-contain drop-shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_35px_rgba(6,182,212,0.6)]" 
                    />
                    <h1 className="text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                        Prismo
                    </h1>
                </div>

                {/* Subtitle / Call to action */}
                <p className="text-lg text-white/40 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    Discover your next favorite story
                </p>

                {/* Unified Command Bar */}
                <div className="w-full relative group animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                    
                    <form onSubmit={handleSubmit} className="relative flex items-center bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl transition-all duration-300 group-focus-within:scale-[1.01]">
                        <div className="pl-4 text-white/40 group-focus-within:text-cyan-400 transition-colors">
                            <Search size={22} />
                        </div>
                        
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Search movies, series or paste magnet link..."
                            className="w-full bg-transparent border-none text-white placeholder-white/30 px-4 py-3 focus:ring-0 outline-none text-base font-medium"
                        />

                        <div className="flex items-center gap-2 pr-1">
                            {input ? (
                                <button 
                                    type="submit"
                                    className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                                >
                                    <ArrowRight size={20} />
                                </button>
                            ) : (
                                <>
                                    <div className="h-8 w-px bg-white/5 mx-2" />
                                    <button 
                                        type="button"
                                        onClick={onFileSelect}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all text-sm font-medium whitespace-nowrap"
                                        title="Open Local File"
                                    >
                                        <Upload size={18} />
                                        <span>Local File</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};