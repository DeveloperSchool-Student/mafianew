import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../components/ChatPanel';
import { PlayerGrid } from '../components/PlayerGrid';
import { BettingPanel } from '../components/BettingPanel';
import { MobileChatDrawer } from '../components/MobileChatDrawer';
import { MobileGameHeader } from '../components/MobileGameHeader';
import { MobileActionStatus } from '../components/MobileActionStatus';
import { audioManager } from '../utils/audio';
import { WinAnimation } from '../components/WinAnimation';

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
    const { user, gameState, socket, soundSettings, updateSoundSettings } = useAppStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isMobile = useIsMobile();

    const [donMode, setDonMode] = useState<'KILL' | 'CHECK_DON'>('KILL');
    const [lastWill, setLastWill] = useState('');
    const [showLastWill, setShowLastWill] = useState(false);
    const [showSoundSettings, setShowSoundSettings] = useState(false);
    const [showPhaseOverlay, setShowPhaseOverlay] = useState(false);
    const [overlayPhase, setOverlayPhase] = useState<string | null>(null);

    // Mobile chat drawer state
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastSeenChatLen, setLastSeenChatLen] = useState(0);

    // Night action tracking
    const [hasActedNight, setHasActedNight] = useState(false);
    const [nightTargetName, setNightTargetName] = useState('');

    // Journalist targets (lifted state)
    const [journalistTargets, setJournalistTargets] = useState<string[]>([]);

    // Track unread messages when chat is closed on mobile
    useEffect(() => {
        if (isMobile && !isChatOpen) {
            const currentLen = gameState.chat?.length || 0;
            if (currentLen > lastSeenChatLen) {
                setUnreadCount(prev => prev + (currentLen - lastSeenChatLen));
            }
            setLastSeenChatLen(currentLen);
        }
    }, [gameState.chat?.length, isMobile, isChatOpen]);

    // Reset unread when chat opens
    useEffect(() => {
        if (isChatOpen) {
            setUnreadCount(0);
            setLastSeenChatLen(gameState.chat?.length || 0);
        }
    }, [isChatOpen]);

    // Reset night action state on phase change
    useEffect(() => {
        setHasActedNight(false);
        setNightTargetName('');
        setJournalistTargets([]);
    }, [gameState.phase]);

    // Simple audio player helper
    const playSound = (soundFile: string) => {
        if (soundSettings.master === 0 || soundSettings.sfx === 0) return;
        const audio = new Audio(`/sounds/${soundFile}`);
        audio.volume = soundSettings.master * soundSettings.sfx;
        audio.play().catch(() => { });
    };

    // Ambient background sounds using the AudioManager
    useEffect(() => {
        if (!gameState.phase) {
            audioManager.pauseBgMusic();
            audioManager.pauseNightSound();
            return;
        }

        if (gameState.phase === 'NIGHT') {
            audioManager.pauseBgMusic();
            audioManager.playNightSound();
        } else if (gameState.phase === 'DAY_DISCUSSION' || gameState.phase === 'DAY_VOTING') {
            audioManager.pauseNightSound();
            audioManager.playBgMusic();
        } else {
            audioManager.pauseBgMusic();
            audioManager.pauseNightSound();
        }

        return () => {
            // Let it keep playing until phase changes
        };
    }, [gameState.phase]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (!socket) {
            navigate('/lobby');
            return;
        }

        // Emit check_active_game on mount to catch state updates missed during navigation
        socket.emit('check_active_game');

        const handleStateUpdate = (newGameState: any) => {
            const oldState = useAppStore.getState().gameState;
            if (oldState.phase && newGameState.phase && oldState.phase !== newGameState.phase) {
                if (newGameState.phase === 'NIGHT') playSound('night.mp3');
                if (newGameState.phase === 'DAY_DISCUSSION') playSound('day.mp3');
                if (newGameState.phase === 'DAY_VOTING') playSound('voting.mp3');
                if (newGameState.phase === 'END_GAME') playSound('win.mp3');

                setOverlayPhase(newGameState.phase);
                setShowPhaseOverlay(true);
                setTimeout(() => setShowPhaseOverlay(false), 3000);
            }

            // Check deaths
            if (oldState.players?.length) {
                oldState.players.forEach((oldP: any) => {
                    const newP = newGameState.players?.find((p: any) => p.userId === oldP.userId);
                    if (oldP.isAlive && newP && !newP.isAlive) {
                        playSound('death.mp3');
                        audioManager.playShotSound();
                    }
                });
            }

            // Extract myRole from the current user's player entry
            const currentUserId = useAppStore.getState().user?.id;
            const me = newGameState.players?.find((p: any) => p.userId === currentUserId);
            const myRole = me?.role || oldState.myRole;

            // Preserve chat and roomId that server doesn't send
            useAppStore.getState().setGameState({
                ...newGameState,
                myRole,
                chat: oldState.chat,
                roomId: oldState.roomId || newGameState.roomId,
            });
        };

        const handleSystemChat = (msg: string) => {
            const newMsg = { id: Date.now().toString(), sender: 'Система', text: msg, type: 'system' as const };
            useAppStore.getState().setGameState({ chat: [...useAppStore.getState().gameState.chat, newMsg] });
        };

        const handleChatMessage = (msgData: { sender: string, text: string, type: 'general' | 'mafia' | 'dead' | 'lobby' }) => {
            const newMsg = { id: Date.now().toString() + Math.random(), ...msgData };
            useAppStore.getState().setGameState({ chat: [...useAppStore.getState().gameState.chat, newMsg] });
        };

        const handleGameEnded = () => {
            // Reset game state and navigate back to lobby
            setTimeout(() => {
                useAppStore.getState().setGameState({
                    phase: null,
                    players: [],
                    myRole: null,
                    timerMs: 0,
                    chat: [],
                    votes: [],
                    bets: [],
                    roomId: null,
                    hostId: null,
                });
                navigate('/lobby');
            }, 500);
        };

        socket.on('game_state_update', handleStateUpdate);
        socket.on('system_chat', handleSystemChat);
        socket.on('chat_message', handleChatMessage);
        socket.on('game_ended', handleGameEnded);
        socket.on('tick', (data) => {
            useAppStore.getState().setGameState({ timerMs: data.timerMs, phase: data.phase });
        });

        return () => {
            socket.off('game_state_update', handleStateUpdate);
            socket.off('system_chat', handleSystemChat);
            socket.off('chat_message', handleChatMessage);
            socket.off('game_ended', handleGameEnded);
            socket.off('tick');
        };
    }, [user, socket, navigate]);

    // Title Alert for background tabs
    useEffect(() => {
        let blinkInterval: number | undefined;
        let isOriginalTitle = true;
        const originalTitle = 'Mafia Online';

        const me = gameState.players?.find(p => p.userId === user?.id);
        const isMyTurn = me?.isAlive && (
            gameState.phase === 'DAY_VOTING' ||
            (gameState.phase === 'NIGHT' && gameState.myRole !== 'CITIZEN' && gameState.myRole !== 'JESTER')
        );

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isMyTurn) {
                blinkInterval = setInterval(() => {
                    document.title = isOriginalTitle ? '🔴 Твій хід!' : originalTitle;
                    isOriginalTitle = !isOriginalTitle;
                }, 1000);
            } else {
                clearInterval(blinkInterval);
                document.title = originalTitle;
            }
        };

        // Run once on phase change if already hidden
        if (document.visibilityState === 'hidden' && isMyTurn) {
            handleVisibilityChange();
        } else {
            document.title = originalTitle;
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(blinkInterval);
            document.title = originalTitle;
        };
    }, [gameState.phase, gameState.players, user?.id]);


    const submitLastWill = () => {
        if (!socket || !gameState.roomId) return;
        socket.emit('save_last_will', { roomId: gameState.roomId, lastWill });
        setShowLastWill(false);
    };

    const handleAction = useCallback((targetId: string) => {
        if (!socket || !gameState.roomId) return;
        // Dead players can't act
        const me = gameState.players?.find(p => p.userId === user?.id);
        if (!me?.isAlive) return;

        if (gameState.phase === 'DAY_VOTING') {
            // Check if already voted
            const alreadyVoted = gameState.votes?.some((v: any) => v.voterId === user?.id);
            if (alreadyVoted) {
                // Notify user they already voted
                const newMsg = { id: Date.now().toString(), sender: 'Система', text: 'Ви вже проголосували! Змінити голос неможливо.', type: 'system' as const };
                useAppStore.getState().setGameState({ chat: [...useAppStore.getState().gameState.chat, newMsg] });
                return;
            }
            socket.emit('vote', { roomId: gameState.roomId, targetId });
        } else if (gameState.phase === 'NIGHT') {
            let actionType = '';
            if (gameState.myRole === 'MAFIA') actionType = 'KILL';
            if (gameState.myRole === 'DON') actionType = donMode;
            if (gameState.myRole === 'DOCTOR') actionType = 'HEAL';
            if (gameState.myRole === 'SHERIFF') actionType = 'CHECK';
            if (gameState.myRole === 'ESCORT') actionType = 'BLOCK';
            if (gameState.myRole === 'SERIAL_KILLER') actionType = 'KILL_SERIAL';
            if (gameState.myRole === 'LAWYER') actionType = 'DEFEND';
            if (gameState.myRole === 'BODYGUARD') actionType = 'GUARD';
            if (gameState.myRole === 'TRACKER') actionType = 'TRACK';
            if (gameState.myRole === 'INFORMER') actionType = 'INFORM';
            if (gameState.myRole === 'BOMBER') actionType = 'BOMB';
            if (gameState.myRole === 'TRAPPER') actionType = 'TRAP';
            if (gameState.myRole === 'SILENCER') actionType = 'SILENCE';
            if (gameState.myRole === 'WHORE') actionType = 'BLOCK';
            if (gameState.myRole === 'JOURNALIST') actionType = 'COMPARE';

            if (actionType) {
                socket.emit('night_action', { roomId: gameState.roomId, targetId, actionType });
                // Track night action for feedback
                const targetPlayer = gameState.players?.find((p: any) =>
                    targetId.includes(',') ? targetId.split(',').includes(p.userId) : p.userId === targetId
                );
                setHasActedNight(true);
                setNightTargetName(targetPlayer?.username || '');
            }
        }
    }, [socket, gameState.roomId, gameState.phase, gameState.myRole, gameState.votes, gameState.players, user?.id, donMode]);


    const me = gameState.players?.find(p => p.userId === user?.id);
    const isGameOver = gameState.phase === 'END_GAME';
    const hasVoted = gameState.votes?.some((v: any) => v.voterId === user?.id) || false;

    // Find voted target name for feedback
    const votedTarget = gameState.votes?.find((v: any) => v.voterId === user?.id);
    const votedTargetPlayer = votedTarget ? gameState.players?.find((p: any) => p.userId === votedTarget.targetId) : null;
    const votedTargetName = votedTarget?.targetId === 'SKIP' ? 'Пропуск' : votedTargetPlayer?.username;

    // Parse winner from chat
    let winner = null;
    if (isGameOver) {
        const winMsg = gameState.chat.find((m: any) => m.type === 'system' && m.text.includes('ПЕРЕМОГА:'));
        if (winMsg) {
            const match = winMsg.text.match(/ПЕРЕМОГА: (СЕРІЙНИЙ ВБИВЦЯ|МАФІЯ|МИРНІ|БЛАЗЕНЬ|МАНІЯК)/);
            if (match) winner = match[1];
        }
    }

    if (!gameState.roomId) {
        return <div className="p-8 text-center bg-mafia-dark text-white min-h-screen">Loading Game...</div>;
    }

    // Phase display name in Ukrainian
    const phaseLabel = (phase: string | null) => {
        switch (phase) {
            case 'ROLE_DISTRIBUTION': return t('game.phase_ROLE_DISTRIBUTION', 'РОЗПОДІЛ РОЛЕЙ');
            case 'NIGHT': return t('game.phase_NIGHT');
            case 'DAY_DISCUSSION': return t('game.phase_DAY_DISCUSSION');
            case 'DAY_VOTING': return t('game.phase_DAY_VOTING');
            case 'MAYOR_VETO': return t('game.phase_MAYOR_VETO', 'ВЕТО МЕРА');
            case 'END_GAME': return t('game.phase_END_GAME');
            default: return phase || t('game.unknown');
        }
    };

    // Role display name in Ukrainian
    const roleLabel = (role: string | null) => {
        switch (role) {
            case 'MAFIA': return t('game.role_MAFIA');
            case 'DON': return t('game.role_DON');
            case 'DOCTOR': return t('game.role_DOCTOR');
            case 'SHERIFF': return t('game.role_SHERIFF');
            case 'ESCORT': return t('game.role_WHORE');
            case 'SERIAL_KILLER': return t('game.role_SERIAL_KILLER');
            case 'JESTER': return t('game.role_JESTER');
            case 'CITIZEN': return t('game.role_CITIZEN');
            case 'LAWYER': return t('game.role_LAWYER', 'АДВОКАТ');
            case 'BODYGUARD': return t('game.role_BODYGUARD', 'ОХОРОНЕЦЬ');
            case 'TRACKER': return t('game.role_TRACKER', 'СЛІДОПИТ');
            case 'INFORMER': return t('game.role_INFORMER', 'ІНФОРМАТОР');
            case 'MAYOR': return t('game.role_MAYOR', 'МЕР');
            case 'JUDGE': return t('game.role_JUDGE', 'СУДДЯ');
            case 'BOMBER': return t('game.role_BOMBER', 'ПІДРИВНИК');
            case 'TRAPPER': return t('game.role_TRAPPER', 'ТРАПЕР');
            case 'SILENCER': return t('game.role_SILENCER', 'ГЛУШУВАЧ');
            case 'LOVERS': return t('game.role_LOVERS', 'КОХАНЦІ');
            case 'WHORE': return t('game.role_WHORE', 'ПОВІЯ');
            case 'JOURNALIST': return t('game.role_JOURNALIST', 'ЖУРНАЛІСТ');
            default: return role || t('game.unknown');
        }
    };

    // Role color for mobile header
    const getRoleColor = () => {
        const role = gameState.myRole;
        if (role === 'MAFIA' || role === 'DON') return '#ef4444';
        if (role === 'SHERIFF') return '#eab308';
        if (role === 'JESTER') return '#f472b6';
        if (role === 'SERIAL_KILLER') return '#a855f7';
        return '#60a5fa';
    };

    // Determine background color based on phase
    const getBgColor = () => {
        if (!gameState.phase) return 'bg-mafia-dark';
        if (gameState.phase === 'NIGHT') return 'bg-[#050505]';
        if (gameState.phase === 'DAY_DISCUSSION' || gameState.phase === 'DAY_VOTING') return 'bg-[#1a1a1a]';
        if (gameState.phase === 'END_GAME') return 'bg-[#101910]';
        return 'bg-mafia-dark';
    };

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
            animate={{ backgroundColor: getBgColor() === 'bg-[#050505]' ? '#050505' : getBgColor() === 'bg-[#1a1a1a]' ? '#1a1a1a' : getBgColor() === 'bg-[#101910]' ? '#101910' : '#0d0d0d' }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className={`text-mafia-light flex flex-col items-center ${isMobile ? 'h-[100dvh] overflow-hidden' : 'min-h-screen py-6 px-4'}`}
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
                        roleColor={getRoleColor()}
                        isGameOver={isGameOver}
                        isSpectator={me?.isSpectator || false}
                        isMuted={soundSettings.master === 0}
                        onSoundClick={() => setShowSoundSettings(true)}
                    />

                    {/* Mayor Veto Prompt - Mobile */}
                    {gameState.phase === 'MAYOR_VETO' && gameState.myRole === 'MAYOR' && me?.isAlive && !(gameState as any).mayorVetoUsed && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mx-3 mt-2 bg-[#8a1a1a] border border-red-500 rounded-lg p-4 shadow-[0_0_20px_rgba(255,0,0,0.5)] text-center shrink-0"
                        >
                            <h3 className="text-lg font-bold text-white mb-1 tracking-widest uppercase">Рішення Мера</h3>
                            <p className="mb-3 text-red-200 text-sm">Накладіть ВЕТО, щоб врятувати гравця від страти.</p>
                            <button
                                onClick={() => socket?.emit('use_veto', { roomId: gameState.roomId })}
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
                        />
                    </div>

                    {/* Mobile Chat Drawer */}
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
                    {gameState.phase === 'MAYOR_VETO' && gameState.myRole === 'MAYOR' && me?.isAlive && !(gameState as any).mayorVetoUsed && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full max-w-4xl bg-[#8a1a1a] border border-red-500 rounded p-6 mb-8 shadow-[0_0_20px_rgba(255,0,0,0.5)] text-center"
                        >
                            <h3 className="text-2xl font-bold text-white mb-2 tracking-widest uppercase">Рішення Мера</h3>
                            <p className="mb-4 text-red-200">Ви можете накласти ВЕТО і врятувати цього гравця від страти.</p>
                            <button
                                onClick={() => socket?.emit('use_veto', { roomId: gameState.roomId })}
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
                            <PlayerGrid handleAction={handleAction} roleLabel={roleLabel} />
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
