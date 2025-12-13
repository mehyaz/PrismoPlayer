import React, { useRef, useEffect } from 'react';
import { X, FileVideo } from 'lucide-react';
import { TorrentFile } from '../../types';

interface FileSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    files: TorrentFile[];
    onSelect: (index: number) => void;
}

export const FileSelectionModal: React.FC<FileSelectionModalProps> = ({ isOpen, onClose, files, onSelect }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="w-full max-w-2xl bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-xl font-semibold text-white tracking-wide">Select File to Play</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* File List */}
                <div className="overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                    {files.map((file, idx) => (
                        <button
                            key={file.index}
                            onClick={() => onSelect(file.index)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 transition-all group text-left"
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                                    <FileVideo size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-medium truncate pr-4 text-base group-hover:text-cyan-400 transition-colors">
                                        {file.name}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded">
                                            {((file.size || 0) / 1024 / 1024).toFixed(1)} MB
                                        </span>
                                        {idx === 0 && (
                                            <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded uppercase tracking-wider">
                                                Largest
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
