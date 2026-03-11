import axios from 'axios';
import type { Tournament } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

export async function fetchTournaments(token: string, status?: string): Promise<Tournament[]> {
    const url = status ? `${API_URL}/tournaments?status=${status}` : `${API_URL}/tournaments`;
    const res = await axios.get(url, auth(token));
    return res.data;
}

export async function fetchTournament(token: string, id: string): Promise<Tournament> {
    const res = await axios.get(`${API_URL}/tournaments/${id}`, auth(token));
    return res.data;
}

export async function createTournament(token: string, data: {
    name: string;
    maxParticipants: number;
    prizePool: number;
    entryFee: number;
    rules?: string;
}): Promise<void> {
    await axios.post(`${API_URL}/tournaments`, data, auth(token));
}

export async function joinTournament(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/tournaments/${id}/join`, {}, auth(token));
}

export async function leaveTournament(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/tournaments/${id}/leave`, {}, auth(token));
}

export async function startTournament(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/tournaments/${id}/start`, {}, auth(token));
}

export async function endTournament(token: string, id: string, winnerId?: string): Promise<void> {
    await axios.post(`${API_URL}/tournaments/${id}/end`, { winnerId: winnerId || undefined }, auth(token));
}

export async function cancelTournament(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/tournaments/${id}/cancel`, {}, auth(token));
}
