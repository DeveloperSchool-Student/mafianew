import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../components/ChatPanel';
import { PlayerGrid } from '../components/PlayerGrid';
import { BettingPanel } from '../components/BettingPanel';
import { MobileChatDrawer } from '../components/MobileChatDrawer';
import { MobileGameHeader } from '../components/MobileGameHeader';
import { MobileActionStatus } from '../components/MobileActionStatus';
import { WinAnimation } from '../components/WinAnimation';
import type { Player, Vote } from '../types/game';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameActions } from '../hooks/useGameActions';
import { useMobileChatUI } from '../hooks/useMobileChatUI';
import { getPhaseLabel, getRoleLabel, getRoleColor, getBgColor } from '../game/gameHelpers';

// Hook to detect mobile viewport
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < breakpoint);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, [breakpoint]);
    return isMobile;
}

export function Game() {
    const { user, gameState, soundSettings, updateSoundSettings } = useAppStore();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    
    // Abstracted socket logic
    const { showPhaseOverlay, overlayPhase } = useGameSocket();

    // Game action logic (voting, night actions, veto)
    const {
        hasActedNight,
        nightTargetName,
        donMode,
        setDonMode,
        journalistTargets,
        setJournalistTargets,
        lastWill,
        setLastWill,
        showLastWill,
        setShowLastWill,
        submitLastWill,
        handleAction,
        handleVeto
    } = useGameActions();

    // Mobile Chat UI logically bound
    const { isChatOpen, setIsChatOpen, unreadCount } = useMobileChatUI(isMobile);

    const [showSoundSettings, setShowSoundSettings] = useState(false);

    const me = gameState.players?.find(p => p.userId === user?.id);
    const isGameOver = gameState.phase === 'END_GAME';
    const hasVoted = gameState.votes?.some((v: Vote) => v.voterId === user?.id) || false;

    // Find voted target name for feedback
    const votedTarget = gameState.votes?.find((v: Vote) => v.voterId === user?.id);
    const votedTargetPlayer = votedTarget ? gameState.players?.find((p: Player) => p.userId === votedTarget.targetId) : null;
    const votedTargetName = votedTarget?.targetId === 'SKIP' ? 'Пропуск' : votedTargetPlayer?.username;

    // Parse winner from chat
    let winner = null;
    if (isGameOver) {
        const winMsg = gameState.chat.find(m => m.type === 'system' && m.text.includes('ПЕРЕМОГА:'));
        if (winMsg) {
            const match = winMsg.text.match(/ПЕРЕМОГА: (СЕРІЙНИЙ ВБИВЦЯ|МАФІЯ|МИРНІ|БЛАЗЕНЬ|МАНІЯК)/);
            if (match) winner = match[1];
        }
    }

    if (!gameState.roomId) {
        return <div className="p-8 text-center bg-mafia-dark text-white min-h-screen">Loading Game...</div>;
    }

    // Bound helpers for this render
    const phaseLabel = (phase: string | null) => getPhaseLabel(phase, t);
    const roleLabel = (role: string | null) => getRoleLabel(role, t);

    // Chat panel props (shared between desktop and mobile drawer)
    const chatPanelProps = {
        donMode,
        setDonMode,
        lastWill,
        setLastWill,
        showLastWill,
        setShowLastWill,
        submitLastWill,
    };

    return (
        <motion.div
            animate={{ backgroundColor: getBgColor(gameState.phase) }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className={`text-mafia-light flex flex-col items-center ${isMobile ? 'h-[100dvh] overflow-hidden no-overscroll' : 'min-h-screen py-6 px-4'}`}
        >

            {/* Game Over Animation */}
            {isGameOver && winner && <WinAnimation winner={winner} />}

            {/* Phase Overlay */}
            <AnimatePresence>
                {showPhaseOverlay && overlayPhase && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none phase-overlay-active"
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="bg-black/80 absolute inset-0"
                        ></motion.div>
                        <motion.div
                            initial={{ y: 50 }}
                            animate={{ y: 0 }}
                            transition={{ type: "spring", stiffness: 100 }}
                            className="relative text-5xl md:text-7xl font-bold text-white tracking-widest drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] text-center"
                        >
                            {phaseLabel(overlayPhase)}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== MOBILE LAYOUT ===== */}
            {isMobile ? (
                <div className="flex flex-col h-full w-full">
                    {/* Compact Mobile Header */}
                    <MobileGameHeader
                        roomId={gameState.roomId}
                        phaseLabel={phaseLabel(gameState.phase)}
                        timerMs={gameState.timerMs || 0}
                        roleLabel={roleLabel(gameState.myRole)}
                        roleColor={getRoleColor(gameState.myRole)}
                        isGameOver={isGameOver}
                        isSpectator={me?.isSpectator || false}
                        alivePlayers={gameState.players?.filter(p => p.isAlive && !p.isSpectator).length}
                        totalPlayers={gameState.players?.filter(p => !p.isSpectator).length}
                        isMuted={soundSettings.master === 0}
                        onSoundClick={() => setShowSoundSettings(true)}
                    />

                    {/* Mayor Veto Prompt - Mobile */}
                    {gameState.phase === 'MAYOR_VETO' && gameState.myRole === 'MAYOR' && me?.isAlive && !gameState.mayorVetoUsed && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mx-3 mt-2 bg-[#8a1a1a] border border-red-500 rounded-lg p-4 shadow-[0_0_20px_rgba(255,0,0,0.5)] text-center shrink-0"
                        >
                            <h3 className="text-lg font-bold text-white mb-1 tracking-widest uppercase">Рішення Мера</h3>
                            <p className="mb-3 text-red-200 text-sm">Накладіть ВЕТО, щоб врятувати гравця від страти.</p>
                            <button
                                onClick={handleVeto}
                                className="bg-black hover:bg-gray-900 active:bg-gray-800 border border-red-500 text-white font-bold py-3 px-6 rounded transition text-base tracking-wider"
                                style={{ minHeight: 48 }}
                            >
                                НАКЛАСТИ ВЕТО
                            </button>
                        </motion.div>
                    )}

                    {/* Action Status Feedback */}
                    <div className="px-3 pt-2 shrink-0">
                        <MobileActionStatus
                            phase={gameState.phase}
                            hasVoted={hasVoted}
                            votedTargetName={votedTargetName}
                            hasActedNight={hasActedNight}
                            nightTargetName={nightTargetName}
                            role={gameState.myRole}
                            journalistSelectedCount={journalistTargets.length}
                        />
                    </div>

                    {/* Betting Panel (only shows for spectators/dead) */}
                    <div className="px-3 shrink-0">
                        <BettingPanel />
                    </div>

                    {/* Player Grid - Main Focus Area - takes remaining space */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
                        <PlayerGrid
                            handleAction={handleAction}
                            roleLabel={roleLabel}
                            journalistSelectedTargets={journalistTargets}
                            onJournalistTargetsChange={setJournalistTargets}
                            hasActedNight={hasActedNight}
                        />
                    </div>

                    {/* Mobile Chat Drawer — always mounted to preserve state */}
                    <MobileChatDrawer
                        isOpen={isChatOpen}
                        onToggle={() => setIsChatOpen(prev => !prev)}
                        unreadCount={unreadCount}
                    >
                        <ChatPanel {...chatPanelProps} inDrawer />
                    </MobileChatDrawer>
                </div>
            ) : (
                /* ===== DESKTOP LAYOUT (unchanged) ===== */
                <>
                    {/* Header Info */}
                    <div className="w-full max-w-4xl flex justify-between items-center mb-4 sm:mb-8 border-b border-gray-800 pb-3 sm:pb-4">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div>
                                <h2 className="text-base sm:text-2xl font-bold font-mono tracking-widest text-mafia-red">ROOM: {gameState.roomId}</h2>
                                <p className="text-gray-400 text-xs sm:text-base">PHASE: <span className="font-bold text-white bg-[#1a1a1a] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm">{phaseLabel(gameState.phase)}</span></p>
                            </div>
                            <button
                                onClick={() => setShowSoundSettings(true)}
                                className="bg-gray-800 p-1.5 sm:p-2 rounded-full hover:bg-gray-700 transition"
                                title={t('game.sound_settings')}
                            >
                                {soundSettings.master > 0 ? <Volume2 size={16} className="text-white sm:w-5 sm:h-5" /> : <VolumeX size={16} className="text-gray-500 sm:w-5 sm:h-5" />}
                            </button>
                        </div>
                        <div className="text-right">
                            <p className="text-xs sm:text-sm text-gray-400">{t('game.time_left', { time: gameState.timerMs ? Math.ceil(gameState.timerMs / 1000) : '--' }).replace(/: \d+с/, '')}</p>
                            <div className={`text-xl sm:text-3xl font-mono ${isGameOver ? 'text-green-400' : 'text-mafia-red animate-pulse'}`}>
                                {isGameOver ? '🏆' : gameState.timerMs ? Math.ceil(gameState.timerMs / 1000) : '--'}
                            </div>
                        </div>
                    </div>

                    {/* Role Reveal Block */}
                    <div className="w-full max-w-4xl bg-[#161616] border border-gray-800 rounded p-3 sm:p-6 mb-4 sm:mb-8 shadow-2xl text-center">
                        {gameState.myRole || me?.isSpectator ? (
                            <div className="text-lg sm:text-2xl font-bold uppercase tracking-[0.2em] text-white">
                                {me?.isSpectator ? (
                                    <span className="text-gray-500">SPECTATOR 👀</span>
                                ) : gameState.myRole === 'MAFIA' || gameState.myRole === 'DON' ? (
                                    <span className="text-mafia-red">{roleLabel(gameState.myRole)}</span>
                                ) : gameState.myRole === 'SHERIFF' ? (
                                    <span className="text-yellow-500">{roleLabel(gameState.myRole)}</span>
                                ) : gameState.myRole === 'JESTER' ? (
                                    <span className="text-pink-400">{roleLabel(gameState.myRole)}</span>
                                ) : (
                                    <span className="text-blue-400">{roleLabel(gameState.myRole)}</span>
                                )}
                            </div>
                        ) : null}
                        {/* Voted indicator */}
                        {gameState.phase === 'DAY_VOTING' && me?.isAlive && hasVoted && (
                            <div className="mt-2 text-xs sm:text-sm text-green-400 font-bold animate-pulse">   Ви вже проголосували</div>
                        )}
                    </div>

                    {/* Mayor Veto Prompt */}
                    {gameState.phase === 'MAYOR_VETO' && gameState.myRole === 'MAYOR' && me?.isAlive && !gameState.mayorVetoUsed && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full max-w-4xl bg-[#8a1a1a] border border-red-500 rounded p-6 mb-8 shadow-[0_0_20px_rgba(255,0,0,0.5)] text-center"
                        >
                            <h3 className="text-2xl font-bold text-white mb-2 tracking-widest uppercase">Рішення Мера</h3>
                            <p className="mb-4 text-red-200">Ви можете накласти ВЕТО і врятувати цього гравця від страти.</p>
                            <button
                                onClick={handleVeto}
                                className="bg-black hover:bg-gray-900 border border-red-500 hover:border-red-400 text-white font-bold py-3 px-8 rounded transition duration-200 drop-shadow-md text-lg tracking-wider"
                            >
                                НАКЛАСТИ ВЕТО
                            </button>
                            <span className="text-red-300 opacity-80 mt-4 block text-sm">Якщо нічого не зробити - гравця зіллє набрід.</span>
                        </motion.div>
                    )}

                    {/* Main Game Layout */}
                    <div className="w-full max-w-4xl grid md:grid-cols-3 gap-3 sm:gap-6">
                        <div className="md:col-span-2 space-y-3 sm:space-y-6 flex flex-col">
                            {/* Betting Panel */}
                            <div className="md:block">
                                <BettingPanel />
                            </div>
                            {/* Player Grid */}
                            <PlayerGrid 
                                handleAction={handleAction} 
                                roleLabel={roleLabel} 
                                journalistSelectedTargets={journalistTargets}
                                onJournalistTargetsChange={setJournalistTargets}
                                hasActedNight={hasActedNight} 
                            />
                        </div>

                        {/* Chat Panel */}
                        <ChatPanel {...chatPanelProps} />
                    </div>
                </>
            )}

            {/* Sound Settings Modal */}
            {showSoundSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#111] border border-gray-700 p-6 rounded-xl w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Volume2 /> {t('game.sound_settings')}</h2>
                            <button onClick={() => setShowSoundSettings(false)} className="text-gray-500 hover:text-white">&times;</button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>{t('game.master_volume')}</span>
                                    <span>{Math.round(soundSettings.master * 100)}%</span>
                                </label>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={soundSettings.master}
                                    onChange={(e) => updateSoundSettings({ master: parseFloat(e.target.value) })}
                                    className="w-full accent-blue-500"
                                />
                            </div>
                            <div>
                                <label className="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>Music</span>
                                    <span>{Math.round(soundSettings.music * 100)}%</span>
                                </label>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={soundSettings.music}
                                    onChange={(e) => updateSoundSettings({ music: parseFloat(e.target.value) })}
                                    className="w-full accent-blue-500"
                                />
                            </div>
                            <div>
                                <label className="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>{t('game.sfx_volume')}</span>
                                    <span>{Math.round(soundSettings.sfx * 100)}%</span>
                                </label>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={soundSettings.sfx}
                                    onChange={(e) => updateSoundSettings({ sfx: parseFloat(e.target.value) })}
                                    className="w-full accent-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-8">
                            <button onClick={() => setShowSoundSettings(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition">
                                {t('game.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
