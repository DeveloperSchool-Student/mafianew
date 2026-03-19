import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION, getStaffPower } from '../admin.roles';
import { ensureMinPower, logAdminAction } from '../admin.helpers';

@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustGold(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; delta: number },
  ) {
    ensureMinPower(requestUser, PERMISSION.ADJUST_GOLD, 'Зміна золота');
    if (!params.delta || params.delta === 0) {
      throw new BadRequestException('Сума зміни повинна бути ненульовою');
    }
    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException(
        'Не можна змінювати золото адміну рівному або вищому за вас.',
      );
    }
    await this.prisma.wallet.update({
      where: { userId: target.id },
      data: { soft: { increment: params.delta } },
    });
    await logAdminAction(
      this.prisma,
      requestUser.id,
      'ADJUST_GOLD',
      target.id,
      `${params.delta > 0 ? '+' : ''}${params.delta}`,
    );
    return { success: true };
  }

  async adjustExp(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; delta: number },
  ) {
    ensureMinPower(requestUser, PERMISSION.ADJUST_EXP, 'Зміна досвіду');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException(
        'Не можна змінювати досвід адміну рівному або вищому за вас.',
      );
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: target.id },
    });
    if (!profile) throw new NotFoundException('Профіль не знайдено');

    let newXp = profile.xp + params.delta;
    let newLevel = profile.level;

    while (newXp >= newLevel * 500) {
      newXp -= newLevel * 500;
      newLevel++;
    }
    while (newLevel > 1 && newXp < 0) {
      newLevel--;
      newXp += newLevel * 500;
    }
    if (newLevel === 1 && newXp < 0) newXp = 0;

    await this.prisma.profile.update({
      where: { userId: target.id },
      data: { xp: newXp, level: newLevel },
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'ADJUST_EXP',
      target.id,
      `${params.delta > 0 ? '+' : ''}${params.delta} → level ${newLevel}, xp ${newXp}`,
    );

    return { success: true };
  }
}
