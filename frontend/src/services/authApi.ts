import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function auth(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

// ─── Bind email ───

export async function bindEmail(token: string, email: string): Promise<{ message: string }> {
    const res = await axios.post(`${API_URL}/auth/bind-email`, { email }, auth(token));
    return res.data;
}

// ─── 2FA ───

export async function generate2FA(token: string): Promise<{ qrCodeDataUrl: string }> {
    const res = await axios.post(`${API_URL}/auth/2fa/generate`, {}, auth(token));
    return res.data;
}

export async function enable2FA(token: string, code: string): Promise<{ message: string }> {
    const res = await axios.post(`${API_URL}/auth/2fa/turn-on`, { token: code }, auth(token));
    return res.data;
}

export async function disable2FA(token: string, code: string): Promise<{ message: string }> {
    const res = await axios.post(`${API_URL}/auth/2fa/turn-off`, { token: code }, auth(token));
    return res.data;
}
