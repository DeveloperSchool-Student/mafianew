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
  {
    key: 'CURATOR',
    title: 'Куратор Адміністраторів',
    power: 8,
    color: '#ff4400',
  },
  {
    key: 'SENIOR_ADMIN',
    title: 'Старший Адміністратор',
    power: 7,
    color: '#ff6600',
  },
  { key: 'ADMIN', title: 'Адміністратор', power: 6, color: '#ff8800' },
  {
    key: 'JUNIOR_ADMIN',
    title: 'Молодший Адміністратор',
    power: 5,
    color: '#ffaa00',
  },
  { key: 'SENIOR_MOD', title: 'Старший Модератор', power: 4, color: '#00ccff' },
  { key: 'MOD', title: 'Модератор', power: 3, color: '#00aaff' },
  { key: 'HELPER', title: 'Хелпер', power: 2, color: '#44ddaa' },
  { key: 'TRAINEE', title: 'Стажер', power: 1, color: '#88cc88' },
];

export const STAFF_ROLE_MAP = new Map(STAFF_ROLES.map((r) => [r.key, r]));

/**
 * Повертає числовий рівень доступу для ролі (0 = звичайний гравець)
 */
export function getStaffPower(staffRoleKey: string | null | undefined): number {
  if (!staffRoleKey) return 0;
  return STAFF_ROLE_MAP.get(staffRoleKey)?.power ?? 0;
}

/* ── Мінімальний power для кожної дії ── */
/* ── Мінімальний power для кожної дії ── */
export const PERMISSION = {
  // Вкладки
  VIEW_GAME_LOGS: 1, // Стажер (Lv.1+)
  VIEW_REPORTS: 3, // Модератор (Lv.3+)
  RESOLVE_REPORTS: 3, // Модератор (Lv.3+)
  VIEW_ROOMS: 5, // Молодший Адміністратор (Lv.5+)
  VIEW_APPEALS: 5, // Молодший Адміністратор (Lv.5+ базові), Старший (Lv.7+ складні)
  RESOLVE_APPEALS: 5, // Молодший Адмін+
  VIEW_USERS: 6, // Адміністратор (Lv.6+)
  VIEW_ADMIN_LOGS: 8, // Куратор (Lv.8+)
  MANAGE_STAFF: 8, // Куратор (Lv.8+)
  MANAGE_SERVER: 8, // Куратор (Lv.8+)
  EVENTS: 9, // Власник (Lv.9)
  CONFIG: 9, // Власник (Lv.9)

  // Дії над гравцями
  PUNISH_WARN: 1, // Стажер (Lv.1+) — попередження
  PUNISH_MUTE: 2, // Хелпер (Lv.2+)
  PUNISH_KICK: 3, // Модератор (Lv.3+)
  PUNISH_BAN: 4, // Старший Модератор (Lv.4+)
  CHAT_MODERATION: 3, // Модератор+
  PUNISH: 2, // Базовий рівень для доступу до покарань
  CHANGE_NICKNAME: 5, // Молодший Адміністратор+
  ADJUST_GOLD: 9, // Власник (Фінанси)
  ADJUST_EXP: 9, // Власник (Серверна логіка)
  DELETE_USER: 9, // Тільки Власник (база даних)

  // Клани і Титули
  VIEW_CLAN_WARS: 7, // Старший Адміністратор+
  RESOLVE_CLAN_WARS: 7, // Старший Адміністратор+
  SET_TITLE: 7, // Старший Адміністратор+
} as const;

/**
 * Максимальна тривалість покарання (в секундах) за рівнем power.
 */
export function getMaxPunishSeconds(power: number): number {
  if (power >= 6) return Infinity; // Адміністратор (6) та вище: Пермабан (Infinity)
  if (power >= 4) return 7 * 86400; // Старший Модератор (4) - Мл. Адмін (5): до 7 днів
  if (power >= 3) return 86400; // Модератор (3): кік або мут до 1 дня
  if (power >= 2) return 3600; // Хелпер (2): мут до 1 години
  return 0; // Стажер (1): тільки попередження (0 сек, або без муту)
}
