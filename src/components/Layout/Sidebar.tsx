import React from 'react';
import { Home, Search, FolderOpen, Clock, Settings } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onSettingsClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onSettingsClick }) => {
    const menuItems = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'search', icon: Search, label: 'Discover' },
        { id: 'library', icon: FolderOpen, label: 'Library' },
        { id: 'history', icon: Clock, label: 'History' },
    ];

    return (
        <div className="w-20 min-w-[5rem] h-full bg-black/95 border-r border-white/5 flex flex-col items-center py-6 z-20 shrink-0 backdrop-blur-sm">
            {/* Logo */}
            <div className="mb-10 p-2 hover:scale-110 transition-transform duration-300 cursor-default">
                <img 
                    src="/prismo-logo.svg" 
                    alt="Prismo Logo" 
                    className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" 
                />
            </div>

            {/* Nav Items */}
            <div className="flex-1 flex flex-col gap-6 w-full px-3 items-center pt-12">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`relative group w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-300 ${
                                isActive 
                                    ? 'bg-white/10 text-cyan-400 shadow-inner' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="mb-1" />
                            
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-500 rounded-r-full" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Settings */}
            <div className="w-full px-3 pb-4">
                <button
                    onClick={onSettingsClick}
                    className="w-full aspect-square flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all duration-300"
                    title="Settings"
                >
                    <Settings size={22} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            </div>
        </div>
    );
};
