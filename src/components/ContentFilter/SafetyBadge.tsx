import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { ContentRiskScore } from '../../types';

interface SafetyBadgeProps {
    score: ContentRiskScore | null;
    size?: 'sm' | 'md' | 'lg';
    showAge?: boolean;
    onClick?: () => void;
}

export const SafetyBadge: React.FC<SafetyBadgeProps> = ({
    score,
    size = 'md',
    showAge = true,
    onClick
}) => {
    if (!score) return null;

    const sizeClasses = {
        sm: 'px-2 py-1 text-xs gap-1',
        md: 'px-3 py-1.5 text-sm gap-2',
        lg: 'px-4 py-2 text-base gap-2'
    };

    const iconSizes = {
        sm: 14,
        md: 16,
        lg: 20
    };

    const getStatusConfig = () => {
        switch (score.overall) {
            case 'safe':
                return {
                    icon: ShieldCheck,
                    bg: 'bg-green-500/10',
                    border: 'border-green-500/30',
                    text: 'text-green-400',
                    glow: 'shadow-[0_0_10px_rgba(34,197,94,0.2)]',
                    label: 'Güvenli'
                };
            case 'caution':
                return {
                    icon: Shield,
                    bg: 'bg-yellow-500/10',
                    border: 'border-yellow-500/30',
                    text: 'text-yellow-400',
                    glow: 'shadow-[0_0_10px_rgba(234,179,8,0.2)]',
                    label: 'Dikkat'
                };
            case 'warning':
                return {
                    icon: ShieldAlert,
                    bg: 'bg-orange-500/10',
                    border: 'border-orange-500/30',
                    text: 'text-orange-400',
                    glow: 'shadow-[0_0_10px_rgba(249,115,22,0.2)]',
                    label: 'Uyarı'
                };
            case 'blocked':
            default:
                return {
                    icon: ShieldX,
                    bg: 'bg-red-500/10',
                    border: 'border-red-500/30',
                    text: 'text-red-400',
                    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]',
                    label: 'Engellendi'
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <button
            onClick={onClick}
            className={`
                inline-flex items-center rounded-lg border font-medium
                transition-all duration-200 hover:scale-105
                ${sizeClasses[size]}
                ${config.bg}
                ${config.border}
                ${config.text}
                ${config.glow}
                ${onClick ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
            `}
        >
            <Icon size={iconSizes[size]} />
            <span>{config.label}</span>
            {showAge && (
                <span className="opacity-70 font-bold">{score.ageRecommendation}</span>
            )}
        </button>
    );
};

// Mini version for inline display
interface SafetyBadgeMiniProps {
    overall: 'safe' | 'caution' | 'warning' | 'blocked';
    ageRecommendation?: string;
}

export const SafetyBadgeMini: React.FC<SafetyBadgeMiniProps> = ({
    overall,
    ageRecommendation
}) => {
    const colorMap = {
        safe: 'bg-green-500',
        caution: 'bg-yellow-500',
        warning: 'bg-orange-500',
        blocked: 'bg-red-500'
    };

    return (
        <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${colorMap[overall]}`} />
            {ageRecommendation && (
                <span className="text-xs text-white/60 font-medium">
                    {ageRecommendation}
                </span>
            )}
        </div>
    );
};
