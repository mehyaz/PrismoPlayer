import React, { useState, useEffect } from 'react';
import { FolderPlus, FileVideo, HardDrive, Play, RefreshCw, Trash2, Search, X } from 'lucide-react';
import { LibraryItem } from '../../types';

interface LibraryViewProps {
    onPlay: (path: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onPlay }) => {
    const [files, setFiles] = useState<LibraryItem[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');

    const [ignoredFiles, setIgnoredFiles] = useState<string[]>([]);

    useEffect(() => {
        // Load saved library config
        const savedFolders = localStorage.getItem('libraryFolders');
        if (savedFolders) {
            const parsedFolders = JSON.parse(savedFolders);
            setFolders(parsedFolders);
            refreshLibrary(parsedFolders);
        }

        const savedIgnored = localStorage.getItem('libraryIgnored');
        if (savedIgnored) {
            setIgnoredFiles(JSON.parse(savedIgnored));
        }
    }, []);

    const refreshLibrary = async (folderList: string[]) => {
        setIsLoading(true);
        try {
            let allFiles: LibraryItem[] = [];
            for (const folder of folderList) {
                if (window.ipcRenderer) {
                    const result = await window.ipcRenderer.invoke('library:scan-folder', folder);
                    if (Array.isArray(result)) {
                        allFiles = [...allFiles, ...result];
                    }
                }
            }
            // Sort by recent
            allFiles.sort((a, b) => b.birthtime - a.birthtime);
            setFiles(allFiles);
        } catch (error) {
            console.error('Failed to scan library:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddFolder = async () => {
        if (window.ipcRenderer) {
            const paths = await window.ipcRenderer.invoke('library:open-folder') as string[];
            if (paths && paths.length > 0) {
                const newFolders = [...new Set([...folders, ...paths])];
                setFolders(newFolders);
                localStorage.setItem('libraryFolders', JSON.stringify(newFolders));
                refreshLibrary(newFolders);
            }
        }
    };

    const handleRemoveFolder = (folderPath: string) => {
        const newFolders = folders.filter(f => f !== folderPath);
        setFolders(newFolders);
        localStorage.setItem('libraryFolders', JSON.stringify(newFolders));
        refreshLibrary(newFolders);
    };

    const handleIgnoreFile = (e: React.MouseEvent, path: string) => {
        e.stopPropagation(); // Prevent play trigger
        if (confirm('Remove this video from your library view? The file will remain on your disk.')) {
            const newIgnored = [...ignoredFiles, path];
            setIgnoredFiles(newIgnored);
            localStorage.setItem('libraryIgnored', JSON.stringify(newIgnored));
        }
    };

    const handleRefresh = () => {
        refreshLibrary(folders);
    };

    const filteredFiles = files
        .filter(f => !ignoredFiles.includes(f.path))
        .filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full h-full flex flex-col animate-fade-in p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <HardDrive className="text-pink-500" />
                        Local Library
                    </h2>
                    <p className="text-white/40 mt-1">
                        {filteredFiles.length} videos found in {folders.length} folders
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-pink-400 transition-colors" size={18} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter videos..."
                            className="bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50 transition-all w-64"
                        />
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
                        title="Refresh Library"
                        disabled={isLoading}
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleAddFolder}
                        className="flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-pink-500/20"
                    >
                        <FolderPlus size={20} />
                        Add Folder
                    </button>
                </div>
            </div>

            {/* Folders List (Collapsible or Small) */}
            {folders.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                    {folders.map(folder => (
                        <div key={folder} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-xs text-white/60 group">
                            <span className="truncate max-w-[200px]" title={folder}>{folder}</span>
                            <button
                                onClick={() => handleRemoveFolder(folder)}
                                className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Content Grid */}
            {folders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white/40 space-y-4 border-2 border-dashed border-white/5 rounded-3xl m-4">
                    <div className="p-6 bg-white/5 rounded-full">
                        <FolderPlus size={48} className="opacity-50" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-medium text-white mb-2">Your library is empty</h3>
                        <p className="max-w-md mx-auto mb-6">Add folders from your computer to automatically scan and create your personal video library.</p>
                        <button
                            onClick={handleAddFolder}
                            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-medium"
                        >
                            Select Folders
                        </button>
                    </div>
                </div>
            ) : filteredFiles.length === 0 && !isLoading ? (
                <div className="flex-1 flex items-center justify-center text-white/40">
                    <p>No video files found in selected folders.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 overflow-y-auto pb-20 p-1">
                    {filteredFiles.map((file) => (
                        <div
                            key={file.id}
                            onClick={() => onPlay(file.path)}
                            className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/5 hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-500/10 transition-all duration-300 aspect-video flex flex-col cursor-pointer"
                        >
                            {/* Thumbnail Placeholder */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 group-hover:scale-105 transition-transform duration-500">
                                <FileVideo size={48} className="text-white/20 group-hover:text-pink-500/50 transition-colors" />
                            </div>

                            {/* Play Overlay */}
                            <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                                <div
                                    className="w-16 h-16 rounded-full bg-pink-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform"
                                >
                                    <Play size={32} fill="currentColor" className="ml-1" />
                                </div>
                            </div>

                            {/* Remove Button (Top Right) */}
                            <button
                                onClick={(e) => handleIgnoreFile(e, file.path)}
                                className="absolute top-2 right-2 z-30 p-2 bg-black/50 hover:bg-red-500/80 text-white/60 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                                title="Remove from Library View"
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Info */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                                <h3 className="text-white font-medium truncate mb-1" title={file.name}>
                                    {file.name}
                                </h3>
                                <div className="flex items-center justify-between text-xs text-white/50">
                                    <span className="uppercase tracking-wider font-bold bg-white/10 px-1.5 rounded">{file.format}</span>
                                    <span>{formatSize(file.size)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};
