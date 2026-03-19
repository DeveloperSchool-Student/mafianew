/**
 * Shared staff role definitions — single source of truth for frontend.
 * Mirrors backend admin.roles.ts
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

export function getStaffPower(staffRoleKey?: string | null): number {
  if (!staffRoleKey) return 0;
  return STAFF_ROLE_MAP.get(staffRoleKey)?.power ?? 0;
}

export function getStaffRole(staffRoleKey?: string | null): StaffRoleDef | undefined {
  if (!staffRoleKey) return undefined;
  return STAFF_ROLE_MAP.get(staffRoleKey);
}
