import React from 'react';
import { Loader2, XCircle } from 'lucide-react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
    onCancel?: () => void; // New prop
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = 'Loading...', onCancel }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                <Loader2 className="relative z-10 text-cyan-400 animate-spin" size={64} strokeWidth={1.5} />
            </div>
            <p className="mt-8 text-xl font-medium text-white/80 tracking-wide animate-pulse">
                {message}
            </p>
            <p className="mt-2 text-sm text-white/40">This may take a few moments depending on peers.</p>
            
            {onCancel && (
                <button 
                    onClick={onCancel}
                    className="mt-8 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all flex items-center gap-2 group"
                >
                    <XCircle size={20} className="text-red-400 group-hover:scale-110 transition-transform" />
                    <span>Cancel</span>
                </button>
            )}
        </div>
    );
};
