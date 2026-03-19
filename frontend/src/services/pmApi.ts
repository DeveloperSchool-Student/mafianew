import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

// ─── Types ───

export interface Conversation {
    user: { id: string; username: string; profile?: { avatarUrl?: string } };
    lastMessage: { content: string; createdAt: string; readAt: string | null };
    unreadCount: number;
}

export interface PrivateMessage {
    id: string;
    fromId: string;
    toId: string;
    content: string;
    createdAt: string;
}

// ─── API ───

export async function fetchConversations(token: string): Promise<Conversation[]> {
    const res = await axios.get(`${API_URL}/pm/conversations`, auth(token));
    return res.data;
}

export async function fetchChatMessages(token: string, targetId: string): Promise<PrivateMessage[]> {
    const res = await axios.get(`${API_URL}/pm/chat/${targetId}`, auth(token));
    return res.data;
}

export async function sendMessage(token: string, targetId: string, content: string): Promise<void> {
    await axios.post(`${API_URL}/pm/send`, { targetId, content }, auth(token));
}
