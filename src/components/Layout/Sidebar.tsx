import React from 'react';
import { Home, Search, FolderOpen, Clock, Settings, Film } from 'lucide-react';

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
        <div className="w-20 min-w-[5rem] h-full bg-black border-r border-white/10 flex flex-col items-center py-8 z-20 shrink-0">
            {/* Logo Icon */}
            <div className="mb-12 p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20">
                <Film className="text-white" size={28} />
            </div>

            {/* Nav Items */}
            <div className="flex-1 flex flex-col gap-8 w-full px-2 items-center">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`relative group p-3 rounded-xl transition-all duration-300 ${
                                isActive 
                                    ? 'bg-white/10 text-white shadow-inner' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                            }`}
                            title={item.label}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            
                            {/* Active Indicator */}
                            {isActive && (
                                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-500 rounded-r-full" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Settings (Bottom) */}
            <div className="w-full flex justify-center pb-4">
                <button
                    onClick={onSettingsClick}
                    className="p-3 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all duration-300"
                    title="Settings"
                >
                    <Settings size={24} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
            </div>
        </div>
    );
};