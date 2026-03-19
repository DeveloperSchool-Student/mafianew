import axios from 'axios';
import type { Report, Appeal, AdminUser, AdminLog } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

// ─── Reports ───

export async function fetchReports(token: string, status: string): Promise<Report[]> {
    const res = await axios.get(`${API_URL}/admin/reports?status=${status}`, auth(token));
    return res.data;
}

export async function resolveReport(token: string, id: string, status: 'RESOLVED' | 'REJECTED', note?: string): Promise<void> {
    await axios.post(`${API_URL}/admin/reports/${id}/resolve`, { status, note: note || undefined }, auth(token));
}

export async function fetchMyReports(token: string): Promise<Report[]> {
    const res = await axios.get(`${API_URL}/admin/my-reports`, auth(token));
    return res.data;
}

// ─── Appeals ───

export async function fetchAppeals(token: string, status: string): Promise<Appeal[]> {
    const res = await axios.get(`${API_URL}/admin/appeals?status=${status}`, auth(token));
    return res.data;
}

export async function resolveAppeal(token: string, id: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    await axios.post(`${API_URL}/admin/appeals/${id}/resolve`, { status }, auth(token));
}

// ─── Punishments ───

export interface PunishPayload {
    targetUsername: string;
    type: 'KICK' | 'BAN' | 'MUTE' | 'WARN';
    durationSeconds?: number;
    scope?: string;
    reason?: string;
}

export async function punishUser(token: string, payload: PunishPayload): Promise<void> {
    await axios.post(`${API_URL}/admin/punish`, payload, auth(token));
}

// ─── Users ───

export interface AdminUsersResponse {
    data: AdminUser[];
    nextCursor: string | null;
}

export async function fetchAdminUsers(token: string, cursor?: string | null): Promise<AdminUsersResponse> {
    const res = await axios.get(`${API_URL}/admin/users?limit=50${cursor ? `&cursor=${cursor}` : ''}`, auth(token));
    return res.data;
}

export async function adjustGold(token: string, targetUsername: string, delta: number): Promise<void> {
    await axios.post(`${API_URL}/admin/adjust-gold`, { targetUsername, delta }, auth(token));
}

export async function adjustExp(token: string, targetUsername: string, delta: number): Promise<void> {
    await axios.post(`${API_URL}/admin/adjust-exp`, { targetUsername, delta }, auth(token));
}

export async function changeNickname(token: string, targetUsername: string, newUsername: string): Promise<void> {
    await axios.post(`${API_URL}/admin/change-nickname`, { targetUsername, newUsername }, auth(token));
}

export async function deleteUser(token: string, targetUsername: string): Promise<void> {
    await axios.post(`${API_URL}/admin/delete-user`, { targetUsername }, auth(token));
}

// ─── Staff ───

export async function fetchStaff(token: string): Promise<AdminUser[]> {
    const res = await axios.get(`${API_URL}/admin/staff`, auth(token));
    return res.data;
}

export async function setStaffRole(token: string, targetUsername: string, roleKey: string): Promise<void> {
    await axios.post(`${API_URL}/admin/staff/set-role`, { targetUsername, roleKey }, auth(token));
}

export async function removeStaffRole(token: string, targetUsername: string): Promise<void> {
    await axios.post(`${API_URL}/admin/staff/remove-role`, { targetUsername }, auth(token));
}

// ─── Logs ───

export interface AdminLogsResponse {
    data: AdminLog[];
    nextCursor: string | null;
}

export async function fetchAdminLogs(token: string, cursor?: string | null): Promise<AdminLogsResponse> {
    const res = await axios.get(`${API_URL}/admin/logs?limit=50${cursor ? `&cursor=${cursor}` : ''}`, auth(token));
    return res.data;
}

export async function clearAdminLogs(token: string, olderThanDays?: number): Promise<{ deleted: number }> {
    const body: Record<string, number> = {};
    if (olderThanDays !== undefined) body.olderThanDays = olderThanDays;
    const res = await axios.post(`${API_URL}/admin/logs/clear`, body, auth(token));
    return res.data;
}

// ─── Titles ───

export async function setTitle(token: string, targetUsername: string, title: string | null): Promise<void> {
    await axios.post(`${API_URL}/admin/set-title`, { targetUsername, title }, auth(token));
}

// ─── Rooms ───

export interface AdminRoom {
    id: string;
    status: string;
    playersCount: number;
    phase?: string;
    dayCount?: number;
}

export async function fetchAdminRooms(token: string): Promise<AdminRoom[]> {
    const res = await axios.get(`${API_URL}/admin/rooms`, auth(token));
    return res.data;
}

export async function closeRoom(token: string, roomId: string): Promise<void> {
    await axios.post(`${API_URL}/admin/rooms/${roomId}/close`, {}, auth(token));
}

// ─── Events ───

export interface LaunchEventPayload {
    eventName: string;
    rewardCoins: number;
    eventRoles: string[];
}

export interface LaunchEventResult {
    message: string;
    rewardedUsers?: number;
    activatedRoles?: string[];
}

export async function launchEvent(token: string, payload: LaunchEventPayload): Promise<LaunchEventResult> {
    const res = await axios.post(`${API_URL}/admin/events/launch`, payload, auth(token));
    return res.data;
}

// ─── Clan Wars (admin) ───

export interface AdminClanWar {
    id: string;
    challengerId: string;
    targetId: string;
    status: 'PENDING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
    customBet: number;
    challenger?: { name: string; rating?: number };
    target?: { name: string; rating?: number };
    winnerId?: string | null;
    createdAt: string;
}

export async function fetchAdminClanWars(token: string, status: string): Promise<AdminClanWar[]> {
    const res = await axios.get(`${API_URL}/admin/clan-wars?status=${status}`, auth(token));
    return res.data;
}

export async function resolveAdminClanWar(token: string, warId: string, winnerId: string | null): Promise<void> {
    await axios.post(`${API_URL}/admin/clan-wars/${warId}/resolve`, { winnerId }, auth(token));
}

// ─── Stats ───

export interface AdminStats {
    totalUsers: number;
    online: number;
    matches: { today: number; week: number; month: number };
    popularRoles: { role: string; count: number }[];
}

export async function fetchAdminStats(token: string): Promise<AdminStats> {
    const res = await axios.get(`${API_URL}/admin/stats`, auth(token));
    return res.data;
}

// ─── Seasons ───

export interface Season {
    id: string;
    name: string;
    isActive: boolean;
    startDate: string;
    endDate: string | null;
    _count?: { rewards: number };
}

export async function fetchSeasons(token: string): Promise<Season[]> {
    const res = await axios.get(`${API_URL}/admin/seasons`, auth(token));
    return res.data;
}

export async function startSeason(token: string, name: string): Promise<void> {
    await axios.post(`${API_URL}/admin/seasons/start`, { name }, auth(token));
}

export async function endSeason(token: string): Promise<{ rewardsGiven: number }> {
    const res = await axios.post(`${API_URL}/admin/seasons/end`, {}, auth(token));
    return res.data;
}
