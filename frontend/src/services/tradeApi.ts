import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

export interface Trade {
    id: string;
    senderId: string;
    receiverId: string;
    offerAmount: number;
    offerCurrency: 'SOFT' | 'HARD';
    requestAmount: number;
    requestCurrency: 'SOFT' | 'HARD';
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
    createdAt: string;
    sender: { username: string };
    receiver: { username: string };
}

export async function createTrade(token: string, data: {
    receiverId: string;
    offerAmount: number;
    offerCurrency: 'SOFT' | 'HARD';
    requestAmount: number;
    requestCurrency: 'SOFT' | 'HARD';
}): Promise<Trade> {
    const res = await axios.post(`${API_URL}/trade/create`, data, auth(token));
    return res.data;
}

export async function fetchTrades(token: string): Promise<Trade[]> {
    const res = await axios.get(`${API_URL}/trade/list`, auth(token));
    return res.data;
}

export async function acceptTrade(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/trade/${id}/accept`, {}, auth(token));
}

export async function rejectTrade(token: string, id: string): Promise<void> {
    await axios.post(`${API_URL}/trade/${id}/reject`, {}, auth(token));
}
