import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

interface MobileGameHeaderProps {
    roomId: string | null;
    phaseLabel: string;
    timerMs: number;
    roleLabel: string;
    roleColor: string;
    isGameOver: boolean;
    isSpectator: boolean;
    isMuted?: boolean;
    onSoundClick?: () => void;
}

export function MobileGameHeader({
    roomId,
    phaseLabel,
    timerMs,
    roleLabel,
    roleColor,
    isGameOver,
    isSpectator,
    isMuted,
    onSoundClick,
}: MobileGameHeaderProps) {
    const timerSeconds = timerMs ? Math.ceil(timerMs / 1000) : null;

    return (
        <div className="w-full bg-[#0d0d0d]/90 backdrop-blur-md border-b border-gray-800/60 px-3 py-2 flex items-center justify-between gap-2 shrink-0 sticky top-0 z-30" id="mobile-game-header">
            {/* Left: Room + Phase */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[11px] font-mono text-mafia-red font-bold shrink-0">
                    #{roomId}
                </span>
                <span className="text-[10px] font-bold text-gray-400 bg-[#1a1a1a] px-1.5 py-0.5 rounded truncate">
                    {phaseLabel}
                </span>
            </div>

            {/* Center: Role */}
            <div className="shrink-0">
                {isSpectator ? (
                    <span className="text-[11px] font-bold text-gray-500 uppercase">👀 Глядач</span>
                ) : (
                    <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: roleColor }}
                    >
                        {roleLabel}
                    </span>
                )}
            </div>

            {/* Right: Timer + Sound */}
            <div className="flex items-center gap-2 shrink-0">
                {onSoundClick && (
                    <button
                        onClick={onSoundClick}
                        className="p-1.5 rounded-full bg-gray-800/50 active:bg-gray-700 transition"
                        style={{ minWidth: 32, minHeight: 32 }}
                    >
                        {isMuted ? <VolumeX size={14} className="text-gray-500" /> : <Volume2 size={14} className="text-gray-300" />}
                    </button>
                )}
                {isGameOver ? (
                    <span className="text-lg">🏆</span>
                ) : (
                    <motion.span
                        key={timerSeconds}
                        initial={{ scale: 1.2, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-lg font-mono font-bold ${
                            timerSeconds && timerSeconds <= 10 ? 'text-red-500' : 'text-mafia-red'
                        }`}
                    >
                        {timerSeconds ?? '--'}
                    </motion.span>
                )}
            </div>
        </div>
    );
}
