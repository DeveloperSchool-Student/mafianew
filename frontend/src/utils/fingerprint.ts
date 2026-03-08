export async function getFingerprint(): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("Browser Fingerprint 123", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("Browser Fingerprint 123", 4, 17);
    }
    const canvasHash = btoa(canvas.toDataURL());

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const resolution = `${window.screen.width}x${window.screen.height}`;

    const str = `${canvasHash}|${tz}|${resolution}`;

    if (!crypto.subtle) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
