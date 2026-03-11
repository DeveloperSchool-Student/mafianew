// ===========================
// Game API Service
// ===========================
// Centralised API calls extracted from components for cleaner separation.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ReportPayload {
    targetUsername: string;
    reason: string;
    screenshotUrl?: string;
}

export interface ReportResult {
    success: boolean;
    error?: string;
}

/**
 * Submit a player report.
 * Returns a typed result instead of swallowing errors.
 */
export async function submitReport(token: string, payload: ReportPayload): Promise<ReportResult> {
    try {
        const res = await fetch(`${API_URL}/admin/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { success: false, error: body.message || `Помилка сервера (${res.status})` };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: 'Не вдалося зʼєднатися з сервером' };
    }
}
