import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

// ─── Types ───

export interface LeaderboardEntry {
    mmr: number;
    user: { username: string };
}

export interface ClanLeaderboardEntry {
    id: string;
    name: string;
    owner: { username: string };
    rating: number;
    points: number;
}

export interface MatchDetails {
    id: string;
    createdAt: string;
    winner: string;
    duration: number;
    participants: MatchParticipant[];
    logs: MatchLog[];
}

export interface MatchParticipant {
    profile: { user: { username: string } };
    role: string;
    won: boolean;
}

export interface MatchLog {
    day: number;
    phase: string;
    text: string;
}

export interface RewardStatus {
    loginStreak: number;
    canClaim: boolean;
}

export interface RewardClaimResult {
    softReward: number;
    hardReward: number;
}

// ─── API ───

export async function fetchLeaderboard(token: string): Promise<LeaderboardEntry[]> {
    const res = await axios.get(`${API_URL}/users/leaderboard`, auth(token));
    return res.data;
}

export async function fetchClanLeaderboard(token: string): Promise<ClanLeaderboardEntry[]> {
    const res = await axios.get(`${API_URL}/users/clans`, auth(token));
    return res.data;
}

export async function fetchMatchDetails(id: string, token?: string): Promise<MatchDetails> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await axios.get(`${API_URL}/matches/${id}`, { headers });
    return res.data;
}

// ─── Auth helpers (pages that still have inline calls) ───

export async function login(username: string, password: string, fingerprint?: string): Promise<any> {
    const res = await axios.post(`${API_URL}/auth/login`, { username, password, fingerprint });
    return res.data;
}

export async function register(username: string, password: string, fingerprint?: string): Promise<any> {
    const res = await axios.post(`${API_URL}/auth/register`, { username, password, fingerprint });
    return res.data;
}

export async function authenticate2FA(userId: string, token: string): Promise<any> {
    const res = await axios.post(`${API_URL}/auth/2fa/authenticate`, { userId, token });
    return res.data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
    const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    return res.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await axios.post(`${API_URL}/auth/reset-password`, { token, newPassword });
    return res.data;
}

// ─── Reward ───

export async function fetchRewardStatus(token: string): Promise<RewardStatus> {
    const res = await axios.get(`${API_URL}/reward/status`, auth(token));
    return res.data;
}

export async function claimDailyReward(token: string): Promise<RewardClaimResult> {
    const res = await axios.post(`${API_URL}/reward/claim`, {}, auth(token));
    return res.data;
}
