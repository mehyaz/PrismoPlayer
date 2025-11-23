import { useEffect, useState } from 'react';
import { SkipSegment } from '../types';

interface UseSkipEngineProps {
    currentTime: number;
    segments: SkipSegment[];
    onSeek: (time: number) => void;
    enabled?: boolean;
}

export const useSkipEngine = ({ currentTime, segments, onSeek, enabled = true }: UseSkipEngineProps) => {
    const [lastSkippedId, setLastSkippedId] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const activeSegment = segments.find(
            (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
        );

        if (activeSegment) {
            // Prevent infinite loops if we just skipped this segment
            if (lastSkippedId !== activeSegment.id) {
                console.log(`[SkipEngine] Skipping segment: ${activeSegment.reason} (${activeSegment.startTime} -> ${activeSegment.endTime})`);
                onSeek(activeSegment.endTime);
                setLastSkippedId(activeSegment.id);
            }
        } else {
            // Reset last skipped if we are out of any segment
            // This allows rewinding and skipping again if needed, 
            // but we need to be careful not to reset immediately if we just jumped to endTime.
            // A simple check is if we are far enough from the endTime of the last skipped segment.
            if (lastSkippedId) {
                const lastSegment = segments.find(s => s.id === lastSkippedId);
                if (lastSegment && currentTime > lastSegment.endTime + 1) {
                    setLastSkippedId(null);
                }
            }
        }
    }, [currentTime, segments, enabled, onSeek, lastSkippedId]);

    return {
        lastSkippedId
    };
};
