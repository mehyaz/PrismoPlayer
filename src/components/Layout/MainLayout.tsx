import React from 'react';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onSettingsClick: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, onTabChange, onSettingsClick }) => {
    return (
        <div className="flex h-screen w-screen bg-black overflow-hidden text-white">
            {/* Sidebar */}
            <Sidebar 
                activeTab={activeTab} 
                onTabChange={onTabChange} 
                onSettingsClick={onSettingsClick} 
            />

            {/* Main Content Area */}
            <main className="flex-1 h-full relative flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
                    {children}
                </div>
            </main>
        </div>
    );
};