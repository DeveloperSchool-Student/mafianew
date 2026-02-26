import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '../components/ChatPanel';
import { PlayerGrid } from '../components/PlayerGrid';
import { BettingPanel } from '../components/BettingPanel';

export function Game() {
    const { user, gameState, socket, soundSettings, updateSoundSettings } = useAppStore();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [donMode, setDonMode] = useState<'KILL' | 'CHECK_DON'>('KILL');
    const [lastWill, setLastWill] = useState('');
    const [showLastWill, setShowLastWill] = useState(false);
    const [showSoundSettings, setShowSoundSettings] = useState(false);
    const [showPhaseOverlay, setShowPhaseOverlay] = useState(false);
    const [overlayPhase, setOverlayPhase] = useState<string | null>(null);
    const ambientAudioRef = useRef<HTMLAudioElement | null>(null);



    // Simple audio player helper
    const playSound = (soundFile: string) => {
        if (soundSettings.master === 0 || soundSettings.sfx === 0) return;
        const audio = new Audio(`/sounds/${soundFile}`);
        audio.volume = soundSettings.master * soundSettings.sfx;
        audio.play().catch(() => { });
    };

    // Ambient background sounds
    useEffect(() => {
        if (!gameState.phase || soundSettings.master === 0 || soundSettings.music === 0) {
            if (ambientAudioRef.current) {
                ambientAudioRef.current.pause();
                ambientAudioRef.current = null;
            }
            return;
        }

        let bgSound = '';
        if (gameState.phase === 'NIGHT') bgSound = 'ambient_night.mp3';
        else if (gameState.phase === 'DAY_DISCUSSION' || gameState.phase === 'DAY_VOTING') bgSound = 'ambient_day.mp3';

        if (bgSound) {
            const desiredVolume = 0.2 * soundSettings.master * soundSettings.music;
            if (!ambientAudioRef.current || ambientAudioRef.current.src !== window.location.origin + '/sounds/' + bgSound) {
                if (ambientAudioRef.current) ambientAudioRef.current.pause();
                ambientAudioRef.current = new Audio(`/sounds/${bgSound}`);
                ambientAudioRef.current.loop = true;
                ambientAudioRef.current.volume = desiredVolume; // Background volume lower
                ambientAudioRef.current.play().catch(() => { });
            } else if (ambientAudioRef.current.paused) {
                ambientAudioRef.current.volume = desiredVolume;
                ambientAudioRef.current.play().catch(() => { });
            } else {
                ambientAudioRef.current.volume = desiredVolume;
            }
        }

        return () => {
            // Let it keep playing until phase changes, cleanup handled by logic above
        };
    }, [gameState.phase, soundSettings.master, soundSettings.music]);

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
            }, 500); // Small delay so the room_updated event sets lobby data first
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



    const submitLastWill = () => {
        if (!socket || !gameState.roomId) return;
        socket.emit('save_last_will', { roomId: gameState.roomId, lastWill });
        setShowLastWill(false);
    };

    const handleAction = (targetId: string) => {
        if (!socket || !gameState.roomId) return;
        // Dead players can't act
        const me = gameState.players?.find(p => p.userId === user?.id);
        if (!me?.isAlive) return;

        if (gameState.phase === 'DAY_VOTING') {
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

            if (actionType) {
                socket.emit('night_action', { roomId: gameState.roomId, targetId, actionType });
            }
        }
    };



    const me = gameState.players?.find(p => p.userId === user?.id);
    const isGameOver = gameState.phase === 'END_GAME';

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
            default: return role || t('game.unknown');
        }
    };

    // Determine background color based on phase
    const getBgColor = () => {
        if (!gameState.phase) return 'bg-mafia-dark';
        if (gameState.phase === 'NIGHT') return 'bg-[#050505]'; // Very dark
        if (gameState.phase === 'DAY_DISCUSSION' || gameState.phase === 'DAY_VOTING') return 'bg-[#1a1a1a]'; // Lighter day
        if (gameState.phase === 'END_GAME') return 'bg-[#101910]'; // Greenish tint
        return 'bg-mafia-dark';
    };

    return (
        <motion.div
            animate={{ backgroundColor: getBgColor() === 'bg-[#050505]' ? '#050505' : getBgColor() === 'bg-[#1a1a1a]' ? '#1a1a1a' : getBgColor() === 'bg-[#101910]' ? '#101910' : '#0d0d0d' }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="min-h-screen text-mafia-light flex flex-col items-center py-6 px-4"
        >

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

            {/* Header Info */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold font-mono tracking-widest text-mafia-red">ROOM: {gameState.roomId}</h2>
                        <p className="text-gray-400">PHASE: <span className="font-bold text-white bg-[#1a1a1a] px-2 py-1 rounded">{phaseLabel(gameState.phase)}</span></p>
                    </div>
                    <button
                        onClick={() => setShowSoundSettings(true)}
                        className="bg-gray-800 p-2 rounded-full hover:bg-gray-700 transition"
                        title={t('game.sound_settings')}
                    >
                        {soundSettings.master > 0 ? <Volume2 size={20} className="text-white" /> : <VolumeX size={20} className="text-gray-500" />}
                    </button>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400">{t('game.time_left', { time: gameState.timerMs ? Math.ceil(gameState.timerMs / 1000) : '--' }).replace(/: \d+с/, '')}</p>
                    <div className={`text-3xl font-mono ${isGameOver ? 'text-green-400' : 'text-mafia-red animate-pulse'}`}>
                        {isGameOver ? '🏆' : gameState.timerMs ? Math.ceil(gameState.timerMs / 1000) : '--'}
                    </div>
                </div>
            </div>

            {/* Role Reveal Block */}
            <div className="w-full max-w-4xl bg-[#161616] border border-gray-800 rounded p-6 mb-8 shadow-2xl text-center">
                {gameState.myRole || me?.isSpectator ? (
                    <div className="text-2xl font-bold uppercase tracking-[0.2em] text-white">
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
            </div>

            {/* Main Game Grid */}
            <div className="w-full max-w-4xl grid md:grid-cols-3 gap-6">

                <div className="md:col-span-2 space-y-6">
                    <BettingPanel />
                    <PlayerGrid handleAction={handleAction} roleLabel={roleLabel} />
                </div>

                <ChatPanel
                    donMode={donMode}
                    setDonMode={setDonMode}
                    lastWill={lastWill}
                    setLastWill={setLastWill}
                    showLastWill={showLastWill}
                    setShowLastWill={setShowLastWill}
                    submitLastWill={submitLastWill}
                />

            </div>
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
