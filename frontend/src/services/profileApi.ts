import axios from 'axios';
import type { UserProfile, Quest } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

// ─── Own profile ───

export async function fetchMyProfile(token: string): Promise<UserProfile> {
    const res = await axios.get(`${API_URL}/users/me`, auth(token));
    return res.data;
}

export async function fetchUserProfile(token: string, userId: string): Promise<UserProfile> {
    const res = await axios.get(`${API_URL}/users/profile/${userId}`, auth(token));
    return res.data;
}

// ─── Quests ───

export async function fetchQuests(token: string): Promise<Quest[]> {
    const res = await axios.get(`${API_URL}/users/quests`, auth(token));
    return res.data;
}

export async function claimQuest(token: string, questId: string): Promise<{ success: boolean; reward: number }> {
    const res = await axios.post(`${API_URL}/users/quests/claim`, { questId }, auth(token));
    return res.data;
}

// ─── Avatar ───

export async function updateAvatar(token: string, avatarUrl: string): Promise<void> {
    await axios.post(`${API_URL}/users/avatar`, { avatarUrl }, auth(token));
}

// ─── Appeal ───

export async function submitAppeal(token: string, type: 'UNBAN' | 'UNMUTE', reason: string): Promise<void> {
    await axios.post(`${API_URL}/admin/appeals/submit`, { type, reason }, auth(token));
}
export async function searchUsersByUsername(token: string, username: string): Promise<{ id: string; username: string }> {
    const res = await axios.get(`${API_URL}/users/find/${username}`, auth(token));
    return res.data;
}
