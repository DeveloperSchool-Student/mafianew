import { useState } from 'react';
import { useAppStore } from '../store';
import { WhisperModal, ReportInGameModal } from './GameModals';
import { submitReport } from '../services/gameApi';
import type { Player, Vote } from '../types/game';

interface PlayerGridProps {
    handleAction: (targetId: string) => void;
    roleLabel: (role: string | null) => string;
    /** Journalist selected targets for parent tracking */
    journalistSelectedTargets?: string[];
    onJournalistTargetsChange?: (targets: string[]) => void;
    hasActedNight?: boolean;
}

export function PlayerGrid({ handleAction, roleLabel, journalistSelectedTargets, onJournalistTargetsChange, hasActedNight }: PlayerGridProps) {
    const { user, gameState, socket } = useAppStore();
    // Use parent-managed state for journalist targets if provided, otherwise local
    const [localJournalistTargets, setLocalJournalistTargets] = useState<string[]>([]);
    const selectedJournalistTargets = journalistSelectedTargets ?? localJournalistTargets;
    const setSelectedJournalistTargets = onJournalistTargetsChange ?? setLocalJournalistTargets;

    // Whisper modal state
    const [whisperTarget, setWhisperTarget] = useState<{ userId: string; username: string } | null>(null);
    // Report modal state
    const [reportTarget, setReportTarget] = useState<{ userId: string; username: string } | null>(null);

    // Count votes per player
    const getVoteCount = (targetId: string): number => {
        return gameState.votes?.filter((v: Vote) => v.targetId === targetId).length || 0;
    };

    const me = gameState.players?.find((p: Player) => p.userId === user?.id);
    const hasVoted = gameState.votes?.some((v: Vote) => v.voterId === user?.id);

    const handleWhisperSend = async (message: string): Promise<{ success: boolean; error?: string }> => {
        if (!whisperTarget || !socket || !gameState.roomId) return { success: false, error: 'Connection error' };
        return new Promise((resolve) => {
            socket.emit('whisper', { roomId: gameState.roomId, targetId: whisperTarget.userId, message }, (res: any) => {
                if (res && res.success !== undefined) {
                    resolve(res);
                } else {
                    resolve({ success: true }); // Fallback if backend didn't ack
                }
            });
        });
    };

    const handleReportSubmit = async (reason: string, screenshotUrl?: string): Promise<{ success: boolean; error?: string }> => {
        if (!reportTarget) return { success: false, error: 'Не вдалося знайти ціль скарги' };
        const token = useAppStore.getState().user?.token;
        if (!token) return { success: false, error: 'Ви не авторизовані' };

        return submitReport(token, {
            targetUsername: reportTarget.username,
            reason,
            screenshotUrl,
        });
    };

    return (
        <>
            <div className="bg-mafia-gray border border-gray-800 rounded p-2 sm:p-4 h-auto md:h-[600px] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">ГРАВЦІ ({gameState.players?.length || 0})</h3>
                <div className="space-y-2 sm:space-y-3">
                    {gameState.players?.map((p: Player, idx: number) => {
                        const voteCount = getVoteCount(p.userId);
                        const isSelectedByJournalist = selectedJournalistTargets.includes(p.userId);
                        const isDisabled = (hasVoted && gameState.phase === 'DAY_VOTING') || (hasActedNight && gameState.phase === 'NIGHT');
                        return (
                            <div
                                key={p.userId || idx}
                                onClick={() => {
                                    if (!me?.isAlive) return;
                                    if (isDisabled) return;
                                    if (gameState.phase === 'NIGHT' && me?.role === 'JOURNALIST') {
                                        if (selectedJournalistTargets.includes(p.userId)) {
                                            setSelectedJournalistTargets(selectedJournalistTargets.filter(id => id !== p.userId));
                                        } else {
                                            const newTargets = [...selectedJournalistTargets, p.userId];
                                            setSelectedJournalistTargets(newTargets);
                                            if (newTargets.length === 2) {
                                                handleAction(newTargets.join(','));
                                                setTimeout(() => setSelectedJournalistTargets([]), 100);
                                            }
                                        }
                                    } else {
                                        handleAction(p.userId);
                                    }
                                }}
                                className={`p-3 sm:p-4 rounded flex flex-col sm:flex-row justify-between sm:items-center border transform gap-2 sm:gap-0 ${p.isAlive
                                        ? `bg-[#1a1a1a] border-gray-700 ${isDisabled
                                            ? 'opacity-60 cursor-not-allowed'
                                            : 'hover:scale-[1.01] hover:border-mafia-red/50 cursor-pointer active:scale-[0.98] active:bg-[#252525]'
                                        } transition-all duration-200 shadow-md ${isSelectedByJournalist ? 'ring-2 ring-blue-500 bg-[#2a3a4a]' : ''}`
                                        : 'bg-black border-gray-900 scale-[0.98] transition-all duration-[2000ms] grayscale opacity-40 blur-[1px]'
                                    }`}
                                style={{ minHeight: 56 }}
                            >
                                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-1/2 overflow-hidden">
                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm relative transition-all ${p.isAlive ? 'bg-gray-800 shadow-inner group-hover:bg-gray-700' : 'bg-red-900/40 text-red-500 line-through grayscale border border-red-900/50'}`}>
                                        {idx + 1}
                                        {/* My Targeting Indicator */}
                                        {p.isAlive && ((gameState.phase === 'DAY_VOTING' && gameState.votes?.some((v: Vote) => v.voterId === user?.id && v.targetId === p.userId)) || (gameState.phase === 'NIGHT' && hasActedNight && (journalistSelectedTargets?.includes(p.userId)))) && (
                                            <div
                                                className="absolute -top-1 -right-1 bg-mafia-red w-4 h-4 rounded-full border border-white flex items-center justify-center text-[10px] shadow-[0_0_10px_#cc0000]"
                                            >
                                                🎯
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-bold truncate text-base ${!p.isAlive && !p.isSpectator && 'line-through text-red-900 opacity-60'} ${p.isSpectator && 'text-gray-500 italic'}`}
                                            style={p.staffRoleColor ? { color: p.staffRoleColor } : undefined}
                                        >
                                            {p.staffRoleTitle && p.staffRoleColor && (
                                                <span
                                                    className="text-[9px] font-bold px-1 py-0.5 rounded mr-1.5 align-middle border border-current shadow-sm"
                                                    style={{
                                                        color: p.staffRoleColor,
                                                        backgroundColor: p.staffRoleColor + '33',
                                                    }}
                                                >
                                                    {p.staffRoleTitle}
                                                </span>
                                            )}
                                            {p.username} {p.userId === user?.id && <span className="text-gray-500 lowercase font-normal italic ml-1">(Ви)</span>}
                                        </span>
                                        {p.isOnline === false && <span className="text-[10px] text-orange-500 font-bold animate-pulse leading-none flex items-center gap-1 mt-1">🔌 Офлайн</span>}
                                        {p.isKicked && <span className="text-[10px] text-red-400 font-bold leading-none flex items-center gap-1 mt-1">🚫 Вигнано</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 flex-wrap">
                                    {gameState.phase === 'DAY_VOTING' && voteCount > 0 && (
                                        <span className="text-sm bg-red-900 px-3 py-1.5 rounded text-white font-bold shadow-[0_0_8px_rgba(255,0,0,0.6)]">
                                            🗳️ {voteCount}
                                        </span>
                                    )}
                                    {p.role && <span className={`text-xs uppercase px-2 py-1.5 rounded flex items-center font-bold whitespace-nowrap ${(p.role === 'MAFIA' || p.role === 'DON') ? 'bg-red-900/50 text-red-300' :
                                        p.role === 'SERIAL_KILLER' ? 'bg-purple-900/50 text-purple-300' :
                                            p.role === 'SHERIFF' ? 'bg-yellow-900/50 text-yellow-300' :
                                                p.role === 'JESTER' ? 'bg-pink-900/50 text-pink-300' :
                                                    'bg-gray-800 text-gray-400'
                                        }`} style={{ minHeight: 30 }}>{roleLabel(p.role)}</span>}

                                    {(gameState.phase === 'DAY_DISCUSSION' || gameState.phase === 'DAY_VOTING') && me?.isAlive && p.isAlive && p.userId !== me?.userId && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setWhisperTarget({ userId: p.userId, username: p.username });
                                                }}
                                                className="text-xs uppercase font-bold bg-blue-900/40 hover:bg-blue-600 active:bg-blue-700 border border-blue-700/50 text-blue-300 px-3 py-1.5 rounded flex items-center justify-center transition-colors"
                                                style={{ minHeight: 44, minWidth: 44 }}
                                            >
                                                🗣️ (10)
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setReportTarget({ userId: p.userId, username: p.username });
                                                }}
                                                className="text-xs uppercase font-bold bg-orange-900/40 hover:bg-orange-600 active:bg-orange-700 border border-orange-700/50 text-orange-300 px-3 py-1.5 rounded flex items-center justify-center transition-colors"
                                                style={{ minHeight: 44, minWidth: 44 }}
                                            >
                                                ⚠️
                                            </button>
                                        </>
                                    )}
                                    {!p.isAlive && !p.isSpectator && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-2xl">☠️</span>
                                            <span className="text-[10px] text-red-500 font-bold uppercase hidden sm:inline">Вбито</span>
                                        </div>
                                    )}
                                    {p.isSpectator && <span className="text-2xl grayscale opacity-50">👀</span>}
                                </div>
                            </div>
                        );
                    })}

                    {/* Skip Vote Option */}
                    {gameState.phase === 'DAY_VOTING' && me?.isAlive && (
                        <div
                            onClick={() => {
                                if (hasVoted) return;
                                handleAction('SKIP');
                            }}
                            className={`p-3 sm:p-4 rounded flex flex-col sm:flex-row justify-between sm:items-center border transition-all duration-200 transform gap-2 sm:gap-0 ${
                                hasVoted
                                    ? 'bg-yellow-900/10 border-yellow-800/30 opacity-60 cursor-not-allowed'
                                    : 'bg-yellow-900/20 border-yellow-700/50 hover:bg-yellow-900/40 hover:scale-[1.01] active:scale-[0.98] cursor-pointer'
                            } shadow-md`}
                            style={{ minHeight: 56 }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm bg-yellow-900/50 text-yellow-500">
                                    ⏭️
                                </div>
                                <span className="font-bold text-yellow-500 text-sm sm:text-base">
                                    ВІДМОВИТИСЯ ВІД ГОЛОСУВАННЯ
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {getVoteCount('SKIP') > 0 && (
                                    <span className="text-sm bg-yellow-600 px-3 py-1.5 rounded text-white font-bold shadow-[0_0_8px_rgba(202,138,4,0.6)]">
                                        🗳️ {getVoteCount('SKIP')}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <WhisperModal
                isOpen={!!whisperTarget}
                targetUsername={whisperTarget?.username || ''}
                onClose={() => setWhisperTarget(null)}
                onSend={handleWhisperSend}
            />
            <ReportInGameModal
                isOpen={!!reportTarget}
                targetUsername={reportTarget?.username || ''}
                onClose={() => setReportTarget(null)}
                onSubmit={handleReportSubmit}
            />
        </>
    );
}
