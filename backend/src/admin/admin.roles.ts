/**
 * Ієрархія адміністрації Mafia Online
 *
 * power 9 = Власник (найвищий)
 * power 1 = Стажер (найнижчий)
 */

export interface StaffRoleDef {
    key: string;
    title: string;
    power: number;
    color: string;
}

export const STAFF_ROLES: StaffRoleDef[] = [
    { key: 'OWNER', title: 'Власник', power: 9, color: '#ff0000' },
    { key: 'CURATOR', title: 'Куратор Адміністраторів', power: 8, color: '#ff4400' },
    { key: 'SENIOR_ADMIN', title: 'Старший Адміністратор', power: 7, color: '#ff6600' },
    { key: 'ADMIN', title: 'Адміністратор', power: 6, color: '#ff8800' },
    { key: 'JUNIOR_ADMIN', title: 'Молодший Адміністратор', power: 5, color: '#ffaa00' },
    { key: 'SENIOR_MOD', title: 'Старший Модератор', power: 4, color: '#00ccff' },
    { key: 'MOD', title: 'Модератор', power: 3, color: '#00aaff' },
    { key: 'HELPER', title: 'Хелпер', power: 2, color: '#44ddaa' },
    { key: 'TRAINEE', title: 'Стажер', power: 1, color: '#88cc88' },
];

export const STAFF_ROLE_MAP = new Map(STAFF_ROLES.map(r => [r.key, r]));

/**
 * Повертає числовий рівень доступу для ролі (0 = звичайний гравець)
 */
export function getStaffPower(staffRoleKey: string | null | undefined): number {
    if (!staffRoleKey) return 0;
    return STAFF_ROLE_MAP.get(staffRoleKey)?.power ?? 0;
}

/* ── Мінімальний power для кожної дії ── */
export const PERMISSION = {
    VIEW_REPORTS: 1,  // Стажер+
    RESOLVE_REPORTS: 2,  // Хелпер+
    CHAT_MODERATION: 3,  // Модератор+
    PUNISH: 3,  // Модератор+
    VIEW_USERS: 3,  // Модератор+
    ADJUST_GOLD: 6,  // Адміністратор+
    ADJUST_EXP: 6,  // Адміністратор+
    CHANGE_NICKNAME: 5,  // Молодший Адміністратор+
    VIEW_APPEALS: 7,  // Старший Адміністратор+
    VIEW_LOGS: 7,  // Старший Адміністратор+
    MANAGE_STAFF: 8,  // Куратор+
    CONFIG: 9,  // Тільки Власник
} as const;

/**
 * Максимальна тривалість покарання (в секундах) за рівнем power.
 * Власник (9) та Куратор (8) не мають ліміту (Infinity).
 */
export function getMaxPunishSeconds(power: number): number {
    if (power >= 8) return Infinity;    // Куратор+
    if (power >= 7) return 30 * 86400;  // Старший Адміністратор: до 30 днів
    if (power >= 6) return 7 * 86400;   // Адміністратор: до 7 днів
    if (power >= 5) return 3 * 86400;   // Молодший Адміністратор: до 3 днів
    if (power >= 4) return 1 * 86400;   // Старший Модератор: до 1 дня
    if (power >= 3) return 6 * 3600;    // Модератор: до 6 годин
    return 0;
}
