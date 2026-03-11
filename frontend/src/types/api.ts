/**
 * Shared API types used across the frontend.
 * Centralizes type definitions to eliminate `any` from components.
 */

// ─── Common API response ───

export interface ApiResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

// ─── User / Profile ───

export interface UserProfile {
    id: string;
    username: string;
    email?: string | null;
    isTwoFactorEnabled?: boolean;
    createdAt: string;
    staffRoleKey?: string | null;
    staffRole?: { title: string; color: string } | null;
    profile?: ProfileData;
    wallet?: Wallet;
}

export interface ProfileData {
    matches: number;
    wins: number;
    losses: number;
    avatarUrl?: string;
    xp?: number;
    level?: number;
    activeFrame?: string;
    unlockedFrames?: string[];
    title?: string | null;
    mmr?: number;
    bannedUntil?: string | null;
    mutedUntil?: string | null;
    favoriteRole?: string | null;
    maxWinStreak?: number;
    totalDuration?: number;
    survivedMatches?: number;
    matchHistory?: MatchHistoryEntry[];
}

export interface MatchHistoryEntry {
    id: string;
    role: string;
    won: boolean;
    match: {
        id: string;
        winner: string;
        duration: number;
        createdAt: string;
    };
}

export interface Wallet {
    soft: number;
    hard: number;
}

// ─── Quest ───

export interface Quest {
    id: string;
    title: string;
    progress: number;
    target: number;
    reward: number;
    claimed: boolean;
}

// ─── Friend ───

export interface Friend {
    id: string;
    status: 'pending' | 'accepted' | 'blocked';
    isSender: boolean;
    friend: {
        id: string;
        username: string;
        profile?: {
            avatarUrl?: string;
            level: number;
        };
    };
    createdAt: string;
}

// ─── Tournament ───

export interface Tournament {
    id: string;
    name: string;
    status: 'REGISTRATION' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
    maxParticipants: number;
    prizePool: number;
    entryFee: number;
    rules: string | null;
    createdById: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    participants: TournamentParticipant[];
}

export interface TournamentParticipant {
    id: string;
    userId: string;
    username: string;
    status: 'REGISTERED' | 'ACTIVE' | 'ELIMINATED' | 'WINNER';
    wins: number;
    losses: number;
    placement: number | null;
}

// ─── Admin ───

export interface Report {
    id: string;
    reporterId: string;
    targetId: string;
    reporter?: { username: string };
    target?: { username: string };
    reason: string;
    screenshotUrl?: string;
    status: 'OPEN' | 'RESOLVED' | 'REJECTED';
    resolvedNote?: string;
    createdAt: string;
}

export interface Appeal {
    id: string;
    userId: string;
    user?: { username: string };
    type: 'UNBAN' | 'UNMUTE';
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

export interface AdminUser {
    id: string;
    username: string;
    staffRoleKey?: string | null;
    staffRole?: { title: string; color: string; power: number } | null;
    role?: string;
    lastLoginAt?: string;
    profile?: {
        level?: number;
        mmr?: number;
        bannedUntil?: string | null;
        mutedUntil?: string | null;
    };
    wallet?: { soft: number; hard: number };
}

export interface AdminLog {
    id: string;
    action: string;
    actorId: string;
    actor?: { username: string };
    targetId?: string;
    target?: { username: string };
    details?: string;
    createdAt: string;
}

// ─── Notification (already in notificationStore, re-export shape here) ───

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// ─── Store room settings ───

export interface RoomSettings {
    dayTimerMs: number;
    nightTimerMs: number;
    enableSerialKiller: boolean;
    enableEscort: boolean;
    enableJester: boolean;
    enableLawyer: boolean;
    enableBodyguard: boolean;
    enableTracker: boolean;
    enableInformer: boolean;
    enableMayor: boolean;
    enableJudge: boolean;
    enableBomber: boolean;
    enableTrapper: boolean;
    enableSilencer: boolean;
    enableLovers: boolean;
    enableWhore: boolean;
    enableJournalist: boolean;
    [key: string]: boolean | number; // for dynamic access by settings key
}

// ─── Staff role constant (shared between admin and tournaments) ───

export interface StaffRoleDefinition {
    key: string;
    title: string;
    power: number;
    color: string;
}

export const STAFF_ROLES: StaffRoleDefinition[] = [
    { key: 'OWNER', title: 'Власник', power: 9, color: '#ff0000' },
    { key: 'CURATOR', title: 'Куратор Адміністраторів', power: 8, color: '#ff4400' },
    { key: 'SENIOR_ADMIN', title: 'Старший Адміністратор', power: 7, color: '#ff6600' },
    { key: 'ADMIN', title: 'Адміністратор', power: 6, color: '#ff8800' },
    { key: 'JUNIOR_ADMIN', title: 'Молодший Адміністратор', power: 5, color: '#ffaa00' },
    { key: 'SENIOR_MOD', title: 'Старший Модератор', power: 4, color: '#00ccff' },
    { key: 'MOD', title: 'Модератор', power: 3, color: '#00aaff' },
    { key: 'HELPER', title: 'Хелпер', power: 2, color: '#44ddaa' },
    { key: 'TRAINEE', title: 'Стажер', power: 1, color: '#88cc88' },
];

export function getStaffPower(staffRoleKey?: string | null): number {
    if (!staffRoleKey) return 0;
    return STAFF_ROLES.find(r => r.key === staffRoleKey)?.power ?? 0;
}
