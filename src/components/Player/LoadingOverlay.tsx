import React from 'react';

interface LoadingOverlayProps {
  progress: number;
  speed: string;
  remaining: string;
  isVisible: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  progress, 
  speed, 
  remaining, 
  isVisible 
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50">
      <div className="w-3/4 max-w-md bg-gray-800 rounded-lg p-6">
        <h3 className="text-white text-lg mb-4">Video Yükleniyor</h3>
        
        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-sm text-gray-300">
          <span>%{Math.round(progress)}</span>
          <span>{speed}/s • Kalan: {remaining}</span>
        </div>
      </div>
    </div>
  );
};
