import axios from 'axios';
import type { Friend } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

export async function fetchFriends(token: string): Promise<Friend[]> {
    const res = await axios.get(`${API_URL}/friends`, auth(token));
    return res.data;
}

export async function sendFriendRequest(token: string, friendUsername: string): Promise<void> {
    await axios.post(`${API_URL}/friends/request`, { friendUsername }, auth(token));
}

export async function acceptFriend(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/friends/accept/${id}`, {}, auth(token));
}

export async function rejectFriend(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/friends/reject/${id}`, {}, auth(token));
}

export async function removeFriend(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/friends/remove/${id}`, {}, auth(token));
}
