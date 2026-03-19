import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store';
import { ROLE_ACTION_MAP } from '../types/game';
import type { Player, Vote, GameRole, ChatMessage } from '../types/game';

export function useGameActions() {
    const { user, gameState, socket } = useAppStore();

    // Night Actions Local State
    const [hasActedNight, setHasActedNight] = useState(false);
    const [nightTargetName, setNightTargetName] = useState('');
    const [donMode, setDonMode] = useState<'KILL' | 'CHECK_DON'>('KILL');
    const [journalistTargets, setJournalistTargets] = useState<string[]>([]);
    
    // Last Will State
    const [lastWill, setLastWill] = useState('');
    const [showLastWill, setShowLastWill] = useState(false);

    // Reset night action state on phase change
    useEffect(() => {
        setHasActedNight(false);
        setNightTargetName('');
        setJournalistTargets([]);
    }, [gameState.phase]);

    const submitLastWill = useCallback(() => {
        if (!socket || !gameState.roomId) return;
        socket.emit('save_last_will', { roomId: gameState.roomId, lastWill });
        setShowLastWill(false);
    }, [socket, gameState.roomId, lastWill]);

    const handleAction = useCallback((targetId: string) => {
        if (!socket || !gameState.roomId) return;
        // Dead players can't act
        const me = gameState.players?.find((p: Player) => p.userId === user?.id);
        if (!me?.isAlive) return;

        if (gameState.phase === 'DAY_VOTING') {
            // Check if already voted
            const alreadyVoted = gameState.votes?.some((v: Vote) => v.voterId === user?.id);
            if (alreadyVoted) {
                // Notify user they already voted
                const newMsg: ChatMessage = { id: Date.now().toString(), sender: 'Система', text: 'Ви вже проголосували! Змінити голос неможливо.', type: 'system' };
                useAppStore.getState().setGameState(state => ({ chat: [...state.chat, newMsg] }));
                return;
            }
            socket.emit('vote', { roomId: gameState.roomId, targetId });
        } else if (gameState.phase === 'NIGHT') {
            if (hasActedNight) {
                const newMsg: ChatMessage = { id: Date.now().toString(), sender: 'Система', text: 'Нічну дію вже обрано. Чекайте на світанок.', type: 'system' };
                useAppStore.getState().setGameState(state => ({ chat: [...state.chat, newMsg] }));
                return;
            }

            // Determine action type from role using the map
            let actionType: string = '';
            const myRole = gameState.myRole as GameRole | null;

            if (myRole === 'DON') {
                actionType = donMode; // DON has dual mode
            } else if (myRole && myRole in ROLE_ACTION_MAP) {
                actionType = ROLE_ACTION_MAP[myRole] || '';
            }

            if (actionType) {
                socket.emit('night_action', { roomId: gameState.roomId, targetId, actionType });
                // Track night action for feedback
                const targetPlayer = gameState.players?.find((p: Player) =>
                    targetId.includes(',') ? targetId.split(',').includes(p.userId) : p.userId === targetId
                );
                setHasActedNight(true);
                setNightTargetName(targetPlayer?.username || '');
            }
        }
    }, [socket, gameState.roomId, gameState.phase, gameState.myRole, gameState.votes, gameState.players, user?.id, donMode, hasActedNight]);

    const handleVeto = useCallback(() => {
        if (!socket || !gameState.roomId) return;
        socket.emit('use_veto', { roomId: gameState.roomId });
    }, [socket, gameState.roomId]);

    return {
        // Night Actions
        hasActedNight,
        nightTargetName,
        donMode,
        setDonMode,
        journalistTargets,
        setJournalistTargets,
        
        // Last Will
        lastWill,
        setLastWill,
        showLastWill,
        setShowLastWill,
        submitLastWill,
        
        // Core Actions
        handleAction,
        handleVeto
    };
}
