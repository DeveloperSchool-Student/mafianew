import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

export async function buyFrame(token: string, frameId: string): Promise<void> {
    await axios.post(`${API_URL}/users/store/buy`, { frameId }, auth(token));
}

export async function equipFrame(token: string, frameId: string): Promise<void> {
    await axios.post(`${API_URL}/users/store/equip`, { frameId }, auth(token));
}
