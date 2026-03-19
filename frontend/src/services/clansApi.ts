import axios from 'axios';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

export interface ClanMember {
    id: string;
    userId: string;
    clanId: string;
    clanRole: 'OWNER' | 'OFFICER' | 'MEMBER';
    clanContribution: number;
    user?: { username: string };
    joinedAt: string;
}

export interface Clan {
    id: string;
    name: string;
    ownerId: string;
    points: number;
    owner: { username: string; id?: string };
    members: ClanMember[];
    createdAt: string;
}

export interface ClanWar {
    id: string;
    challengerId: string;
    targetId: string;
    status: 'PENDING' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
    customBet: number;
    durationHours: number;
    challengerScore: number;
    targetScore: number;
    winnerId: string | null;
    ratingChange: number;
    startedAt: string | null;
    endedAt: string | null;
    challenger?: { name: string };
    target?: { name: string };
    contributions?: { userId: string; username?: string; points: number }[];
}

export async function fetchClans(token: string): Promise<Clan[]> {
    const res = await axios.get(`${API_URL}/users/clans`, auth(token));
    return res.data;
}

export async function fetchClanWars(token: string): Promise<ClanWar[]> {
    const res = await axios.get(`${API_URL}/users/clans/wars`, auth(token));
    return res.data;
}

export async function createClan(token: string, name: string): Promise<void> {
    await axios.post(`${API_URL}/users/clans`, { name }, auth(token));
}

export async function joinClan(token: string, clanName: string): Promise<void> {
    await axios.post(`${API_URL}/users/clans/join`, { clanName }, auth(token));
}

export async function leaveClan(token: string): Promise<void> {
    await axios.post(`${API_URL}/users/clans/leave`, {}, auth(token));
}

export async function kickClanMember(token: string, targetUserId: string): Promise<void> {
    await axios.post(`${API_URL}/users/clans/kick`, { targetUserId }, auth(token));
}

export async function promoteClanMember(token: string, targetUserId: string, newRole: string): Promise<void> {
    await axios.post(`${API_URL}/users/clans/promote`, { targetUserId, newRole }, auth(token));
}

export async function declareWar(token: string, targetClanId: string, customBet: number): Promise<void> {
    await axios.post(`${API_URL}/users/clans/war/declare`, { targetClanId, customBet }, auth(token));
}

export async function answerWar(token: string, warId: string, action: 'accept' | 'reject'): Promise<void> {
    await axios.post(`${API_URL}/users/clans/war/${warId}/${action}`, {}, auth(token));
}
