import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { SkipSegment } from '../../types';

interface SkipCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (segment: SkipSegment) => void;
    initialReason?: string;
    currentTime: number;
}

export const SkipCreatorModal: React.FC<SkipCreatorModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialReason = '',
    currentTime
}) => {
    const [startTime, setStartTime] = useState<string>('0');
    const [endTime, setEndTime] = useState<string>('0');
    const [reason, setReason] = useState('');
    const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');

    useEffect(() => {
        if (isOpen) {
            setReason(initialReason);
            // Default to current time for start, and current + 5s for end
            setStartTime(Math.floor(currentTime).toString());
            setEndTime(Math.floor(currentTime + 5).toString());
        }
    }, [isOpen, initialReason, currentTime]);

    if (!isOpen) return null;

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: Math.random().toString(36).substr(2, 9),
            startTime: parseFloat(startTime),
            endTime: parseFloat(endTime),
            reason,
            severity
        });
        onClose();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Add Skip Segment</h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/60">Reason</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 min-h-[80px]"
                            placeholder="Why skip this scene?"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60">Start Time (s)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setStartTime(currentTime.toFixed(1))}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-white/10 hover:bg-white/20 text-cyan-400 px-2 py-1 rounded"
                                >
                                    Set Current
                                </button>
                            </div>
                            <p className="text-xs text-white/40 text-right">{formatTime(parseFloat(startTime) || 0)}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60">End Time (s)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setEndTime(currentTime.toFixed(1))}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-white/10 hover:bg-white/20 text-cyan-400 px-2 py-1 rounded"
                                >
                                    Set Current
                                </button>
                            </div>
                            <p className="text-xs text-white/40 text-right">{formatTime(parseFloat(endTime) || 0)}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/60">Severity</label>
                        <div className="flex gap-2">
                            {(['low', 'medium', 'high'] as const).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setSeverity(s)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${severity === s
                                        ? s === 'high' ? 'bg-red-500 text-white' : s === 'medium' ? 'bg-orange-500 text-white' : 'bg-yellow-500 text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        Save Segment
                    </button>
                </form>
            </div>
        </div>
    );
};
