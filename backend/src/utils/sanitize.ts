/**
 * Lightweight HTML sanitizer for chat messages.
 * Strips all HTML tags and trims to maxLength.
 * Defense-in-depth against XSS (React already escapes JSX output).
 */
export function sanitize(input: string, maxLength = 500): string {
    if (!input || typeof input !== 'string') return '';
    // Strip HTML tags
    let cleaned = input.replace(/<[^>]*>/g, '');
    // Remove null bytes
    cleaned = cleaned.replace(/\0/g, '');
    // Trim whitespace and limit length
    return cleaned.trim().substring(0, maxLength);
}
