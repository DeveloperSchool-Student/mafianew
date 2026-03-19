import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getStaffPower } from './admin.roles';
import { PrismaService } from '../prisma/prisma.service';

export type PunishmentType = 'BAN' | 'MUTE' | 'KICK' | 'WARN';

export function ensureMinPower(
  user: { id: string; role?: string; staffRoleKey?: string | null },
  minPower: number,
  label?: string,
) {
  const power = getStaffPower(user.staffRoleKey);
  if (power < minPower) {
    throw new ForbiddenException(
      `Недостатньо прав${label ? ` для дії «${label}»` : ''}. Потрібен мін. рівень ${minPower}.`,
    );
  }
  return power;
}

export async function logAdminAction(
  prisma: PrismaService,
  actorId: string,
  action: string,
  targetId?: string | null,
  details?: string | null,
) {
  await prisma.adminActionLog.create({
    data: { actorId, action, targetId, details },
  });
}
