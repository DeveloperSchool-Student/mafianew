import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { audioManager } from '../utils/audio';
import type { Player } from '../types/game';

export function useGameSocket() {
    const { user, gameState, socket, soundSettings } = useAppStore();
    const navigate = useNavigate();

    const [showPhaseOverlay, setShowPhaseOverlay] = useState(false);
    const [overlayPhase, setOverlayPhase] = useState<string | null>(null);

    // Simple audio player helper for one-off sounds
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
    }, [gameState.phase]);

    useEffect(() => {
        if (!user || !socket) return;

        // Emit check_active_game on mount to catch state updates missed during navigation
        socket.emit('check_active_game');

        const handleStateUpdate = (newGameState: Record<string, unknown>) => {
            const currentUserId = useAppStore.getState().user?.id;

            useAppStore.getState().setGameState((oldState) => {
                const newPhase = newGameState.phase as string | null;
                const newPlayers = newGameState.players as Player[] | undefined;

                if (oldState.phase && newPhase && oldState.phase !== newPhase) {
                    if (newPhase === 'NIGHT') playSound('night.mp3');
                    if (newPhase === 'DAY_DISCUSSION') playSound('day.mp3');
                    if (newPhase === 'DAY_VOTING') playSound('voting.mp3');
                    if (newPhase === 'END_GAME') playSound('win.mp3');

                    setOverlayPhase(newPhase);
                    setShowPhaseOverlay(true);
                    setTimeout(() => setShowPhaseOverlay(false), 3000);
                }

                // Check deaths
                if (oldState.players?.length) {
                    oldState.players.forEach((oldP: Player) => {
                        const newP = newPlayers?.find((p: Player) => p.userId === oldP.userId);
                        if (oldP.isAlive && newP && !newP.isAlive) {
                            playSound('death.mp3');
                            audioManager.playShotSound();
                        }
                    });
                }

                // Extract myRole from the current user's player entry
                const me = newPlayers?.find((p: Player) => p.userId === currentUserId);
                const myRole = (me?.role as string) || oldState.myRole;

                // Preserve chat and roomId that server doesn't send
                return {
                    ...(newGameState as Partial<typeof oldState>),
                    myRole,
                    chat: oldState.chat,
                    roomId: oldState.roomId || (newGameState.roomId as string | null),
                };
            });
        };

        const handleSystemChat = (msg: string) => {
            const newMsg = { id: Date.now().toString(), sender: 'Система', text: msg, type: 'system' as const };
            useAppStore.getState().setGameState(state => ({ chat: [...state.chat, newMsg] }));
        };

        const handleChatMessage = (msgData: { sender: string, text: string, type: 'general' | 'mafia' | 'dead' | 'lobby', staffRoleTitle?: string, staffRoleColor?: string }) => {
            const newMsg = { id: Date.now().toString() + Math.random(), ...msgData };
            useAppStore.getState().setGameState(state => ({ chat: [...state.chat, newMsg] }));
        };

        const handleGameEnded = () => {
            // Reset game state and navigate back to lobby
            setTimeout(() => {
                useAppStore.getState().setGameState(() => ({
                    phase: null,
                    players: [],
                    myRole: null,
                    timerMs: 0,
                    chat: [],
                    votes: [],
                    bets: [],
                    roomId: null,
                    hostId: null,
                }));
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
    }, [user, socket, navigate, soundSettings.master, soundSettings.sfx]);

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
                blinkInterval = window.setInterval(() => {
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
    }, [gameState.phase, gameState.players, user?.id, gameState.myRole]);

    return {
        showPhaseOverlay,
        overlayPhase,
    };
}
