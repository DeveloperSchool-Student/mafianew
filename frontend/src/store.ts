import { create } from 'zustand';
import { Socket } from 'socket.io-client';

export interface User {
    id: string;
    username: string;
    token: string;
    role?: string;
    staffRoleKey?: string | null;
    staffColor?: string | null;
    staffTitle?: string | null;
    profile?: any;
    wallet?: { soft: number, hard: number };
}

export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    type: 'system' | 'general' | 'mafia' | 'dead' | 'lobby';
}

export interface GameState {
    roomId: string | null;
    hostId: string | null;
    phase: string | null;
    players: any[];
    myRole: string | null;
    timerMs: number;
    chat: ChatMessage[];
    votes: any[];
    bets: any[];
    settings?: {
        dayTimerMs: number;
        nightTimerMs: number;
        enableSerialKiller: boolean;
        enableEscort: boolean;
        enableJester: boolean;
        enableLawyer?: boolean;
        enableBodyguard?: boolean;
        enableTracker?: boolean;
        enableInformer?: boolean;
        enableMayor?: boolean;
        enableJudge?: boolean;
        enableBomber?: boolean;
        enableTrapper?: boolean;
        enableSilencer?: boolean;
        enableLovers?: boolean;
    };
}

interface AppState {
    user: User | null;
    socket: Socket | null;
    gameState: GameState;
    soundSettings: { master: number; music: number; sfx: number };
    isInitializing: boolean;

    setUser: (user: User | null) => void;
    setSocket: (socket: Socket | null) => void;
    setGameState: (state: Partial<GameState>) => void;
    updateSoundSettings: (settings: Partial<{ master: number; music: number; sfx: number }>) => void;
    logout: () => void;
    fetchCurrentUser: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
    user: null,
    isInitializing: true,
    socket: null,
    gameState: {
        roomId: null,
        hostId: null,
        phase: null,
        players: [],
        myRole: null,
        timerMs: 0,
        chat: [],
        votes: [],
        bets: [],
        settings: {
            dayTimerMs: 60000,
            nightTimerMs: 30000,
            enableSerialKiller: true,
            enableEscort: true,
            enableJester: true,
        }
    },
    soundSettings: JSON.parse(localStorage.getItem('mafia_sound_settings') || '{"master": 1, "music": 0.5, "sfx": 1}'),

    setUser: (user) => {
        if (user) {
            localStorage.setItem('mafia_token', user.token);
        } else {
            localStorage.removeItem('mafia_token');
        }
        set({ user });
    },

    setSocket: (socket) => set({ socket }),

    setGameState: (stateUpdate) => set((state) => ({
        gameState: { ...state.gameState, ...stateUpdate }
    })),

    updateSoundSettings: (updates) => set((state) => {
        const newSettings = { ...state.soundSettings, ...updates };
        localStorage.setItem('mafia_sound_settings', JSON.stringify(newSettings));
        return { soundSettings: newSettings };
    }),

    logout: () => {
        const currentSocket = useAppStore.getState().socket;
        if (currentSocket) {
            currentSocket.disconnect();
        }
        localStorage.removeItem('mafia_token');
        set({ user: null, socket: null, gameState: { roomId: null, hostId: null, phase: null, players: [], myRole: null, timerMs: 0, chat: [], votes: [], bets: [], settings: { dayTimerMs: 60000, nightTimerMs: 30000, enableSerialKiller: true, enableEscort: true, enableJester: true } } });
    },

    fetchCurrentUser: async () => {
        const token = localStorage.getItem('mafia_token');
        if (!token) {
            set({ isInitializing: false, user: null });
            return;
        }

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const res = await fetch(`${API_URL}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Invalid token');

            const data = await res.json();
            set({
                user: {
                    id: data.id,
                    username: data.username,
                    role: data.role,
                    staffRoleKey: data.staffRoleKey ?? null,
                    staffColor: data.staffRole?.color ?? null,
                    staffTitle: data.staffRole?.title ?? null,
                    token,
                    profile: data.profile,
                    wallet: data.wallet,
                },
                isInitializing: false
            });
        } catch (e) {
            localStorage.removeItem('mafia_token');
            set({ user: null, isInitializing: false });
        }
    }
}));
