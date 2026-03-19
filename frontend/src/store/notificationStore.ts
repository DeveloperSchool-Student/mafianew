import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
}

export interface HistoryNotification extends Notification {
    timestamp: number;
    read: boolean;
}

interface NotificationStore {
    notifications: Notification[];
    history: HistoryNotification[];
    addNotification: (notification: Omit<Notification, 'id'>) => void;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearHistory: () => void;
}

const loadHistory = (): HistoryNotification[] => {
    try {
        const data = localStorage.getItem('mafia_notifications_history');
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error('Failed to parse notification history:', e);
    }
    return [];
};

const saveHistory = (history: HistoryNotification[]) => {
    localStorage.setItem('mafia_notifications_history', JSON.stringify(history));
};

export const useNotificationStore = create<NotificationStore>((set) => ({
    notifications: [],
    history: loadHistory(),

    addNotification: (notification) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newNotification = { ...notification, id };
        const historyNotif: HistoryNotification = { ...newNotification, timestamp: Date.now(), read: false };

        set((state) => {
            const newHistory = [historyNotif, ...state.history].slice(0, 50);
            saveHistory(newHistory);
            return {
                notifications: [...state.notifications, newNotification],
                history: newHistory,
            };
        });

        // Play sound
        try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch((e) => {
                console.warn('Audio play prevented or failed:', e);
            });
        } catch (e) {
            console.error('Failed to initialize or play notification sound:', e);
        }

        const duration = notification.duration || 5000;
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    notifications: state.notifications.filter(n => n.id !== id)
                }));
            }, duration);
        }
    },

    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
    })),

    markAsRead: (id) => set((state) => {
        const newHistory = state.history.map(n => n.id === id ? { ...n, read: true } : n);
        saveHistory(newHistory);
        return { history: newHistory };
    }),

    markAllAsRead: () => set((state) => {
        const newHistory = state.history.map(n => ({ ...n, read: true }));
        saveHistory(newHistory);
        return { history: newHistory };
    }),

    clearHistory: () => set(() => {
        saveHistory([]);
        return { history: [] };
    }),
}));
