import { useState } from 'react';
import { useAppStore } from '../store';


interface PlayerGridProps {
    handleAction: (targetId: string) => void;
    roleLabel: (role: string | null) => string;
}

export function PlayerGrid({ handleAction, roleLabel }: PlayerGridProps) {
    const { user, gameState, socket } = useAppStore();
    const [selectedJournalistTargets, setSelectedJournalistTargets] = useState<string[]>([]);

    // Count votes per player
    const getVoteCount = (targetId: string): number => {
        return gameState.votes?.filter(v => v.targetId === targetId).length || 0;
    };

    const me = gameState.players?.find(p => p.userId === user?.id);

    return (
        <div className="bg-mafia-gray border border-gray-800 rounded p-4 h-[500px] md:h-[600px] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">ГРАВЦІ ({gameState.players?.length || 0})</h3>
            <div className="space-y-3">
                {gameState.players?.map((p: any, idx: number) => {
                    const voteCount = getVoteCount(p.userId);
                    const isSelectedByJournalist = selectedJournalistTargets.includes(p.userId);
                    return (
                        <div
                            key={p.userId || idx}
                            onClick={() => {
                                if (!me?.isAlive) return;
                                if (gameState.phase === 'NIGHT' && me?.role === 'JOURNALIST') {
                                    if (selectedJournalistTargets.includes(p.userId)) {
                                        setSelectedJournalistTargets(prev => prev.filter(id => id !== p.userId));
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
                            className={`p-4 rounded flex flex-col sm:flex-row justify-between sm:items-center border transition-all duration-300 transform min-h-[60px] gap-2 sm:gap-0 ${p.isAlive
                                ? `bg-[#1a1a1a] border-gray-700 hover:scale-[1.01] hover:border-mafia-red/50 cursor-pointer shadow-md ${isSelectedByJournalist ? 'ring-2 ring-blue-500 bg-[#2a3a4a]' : ''}`
                                : 'bg-black opacity-50 border-gray-900 scale-[0.98] grayscale'
                                }`}
                        >
                            <div className="flex items-center gap-3 w-full sm:w-1/2 overflow-hidden">
                                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${p.isAlive ? 'bg-gray-800' : 'bg-red-900/40 text-red-500 line-through'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className={`font-medium truncate text-base ${!p.isAlive && !p.isSpectator && 'line-through text-red-900'} ${p.isSpectator && 'text-gray-500'}`}>
                                        {p.username} {p.userId === user?.id && '(Ви)'}
                                        {p.isSpectator && <span className="ml-2 text-xs italic opacity-70">(Глядач)</span>}
                                    </span>
                                    {p.isOnline === false && <span className="text-xs text-orange-500 font-bold animate-pulse">🔌 Відключився</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                                {gameState.phase === 'DAY_VOTING' && voteCount > 0 && (
                                    <span className="text-sm bg-red-900 px-3 py-1.5 rounded text-white font-bold shadow-[0_0_8px_rgba(255,0,0,0.6)]">
                                        🗳️ {voteCount}
                                    </span>
                                )}
                                {p.role && <span className={`text-xs uppercase px-2 py-1.5 min-h-[30px] rounded flex items-center font-bold whitespace-nowrap ${(p.role === 'MAFIA' || p.role === 'DON') ? 'bg-red-900/50 text-red-300' :
                                    p.role === 'SERIAL_KILLER' ? 'bg-purple-900/50 text-purple-300' :
                                        p.role === 'SHERIFF' ? 'bg-yellow-900/50 text-yellow-300' :
                                            p.role === 'JESTER' ? 'bg-pink-900/50 text-pink-300' :
                                                'bg-gray-800 text-gray-400'
                                    }`}>{roleLabel(p.role)}</span>}

                                {(gameState.phase === 'DAY_DISCUSSION' || gameState.phase === 'DAY_VOTING') && me?.isAlive && p.isAlive && p.userId !== me?.userId && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const msg = prompt(`Шепнути ${p.username} (Вартість 10 coins):`);
                                                if (msg && msg.trim() && socket && gameState.roomId) {
                                                    socket.emit('whisper', { roomId: gameState.roomId, targetId: p.userId, message: msg.trim() });
                                                }
                                            }}
                                            className="text-xs uppercase font-bold bg-blue-900/40 hover:bg-blue-600 border border-blue-700/50 text-blue-300 px-3 py-1.5 rounded min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                                        >
                                            🗣️ (10)
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const reason = prompt(`Причина скарги на ${p.username}:`);
                                                if (!reason || !reason.trim()) return;
                                                const screenshotUrl = prompt('URL скріншота (необовʼязково):');
                                                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                                                const token = useAppStore.getState().user?.token;
                                                if (!token) return;
                                                fetch(`${API_URL}/admin/reports`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                    body: JSON.stringify({ targetUsername: p.username, reason: reason.trim(), screenshotUrl: screenshotUrl?.trim() || undefined }),
                                                }).then(r => r.ok ? alert('✅ Скаргу надіслано!') : r.json().then(d => alert(d.message || 'Помилка'))).catch(() => alert('Помилка'));
                                            }}
                                            className="text-xs uppercase font-bold bg-orange-900/40 hover:bg-orange-600 border border-orange-700/50 text-orange-300 px-3 py-1.5 rounded min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                                        >
                                            ⚠️
                                        </button>
                                    </>
                                )}
                                {!p.isAlive && !p.isSpectator && <span className="text-2xl">☠️</span>}
                                {p.isSpectator && <span className="text-2xl grayscale opacity-50">👀</span>}
                            </div>
                        </div>
                    );
                })}

                {/* Skip Vote Option */}
                {gameState.phase === 'DAY_VOTING' && me?.isAlive && (
                    <div
                        onClick={() => handleAction('SKIP')}
                        className="p-4 rounded flex flex-col sm:flex-row justify-between sm:items-center border transition-all duration-300 transform min-h-[60px] gap-2 sm:gap-0 bg-yellow-900/20 border-yellow-700/50 hover:bg-yellow-900/40 hover:scale-[1.01] cursor-pointer shadow-md"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm bg-yellow-900/50 text-yellow-500">
                                ⏭️
                            </div>
                            <span className="font-bold text-yellow-500 text-base">
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
    );
}
