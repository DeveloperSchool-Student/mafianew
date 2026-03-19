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
export class UserModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string },
  ) {
    const actorPower = ensureMinPower(
      requestUser,
      PERMISSION.DELETE_USER,
      'Видалення акаунту',
    );

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    if (target.id === requestUser.id) {
      throw new BadRequestException('Не можна видалити свій акаунт.');
    }

    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= actorPower && actorPower < 9) {
      throw new ForbiddenException(
        'Не можна видалити акаунт адміна рівного або вищого за вас.',
      );
    }

    const userId = target.id;

    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { userId } });
      if (profile) {
        await tx.userQuest.deleteMany({ where: { profileId: profile.id } });
        await tx.achievement.deleteMany({ where: { profileId: profile.id } });
        await tx.matchParticipant.deleteMany({
          where: { profileId: profile.id },
        });
      }

      await tx.punishment.deleteMany({ where: { userId } });
      await tx.privateMessage.deleteMany({
        where: { OR: [{ fromId: userId }, { toId: userId }] },
      });
      await tx.friendship.deleteMany({
        where: { OR: [{ userId }, { friendId: userId }] },
      });
      await tx.userCollection.deleteMany({ where: { userId } });
      await tx.adminActionLog.deleteMany({
        where: { OR: [{ actorId: userId }, { targetId: userId }] },
      });
      await tx.report.deleteMany({
        where: { OR: [{ reporterId: userId }, { targetId: userId }] },
      });
      await tx.wallet.deleteMany({ where: { userId } });
      if (profile) {
        await tx.profile.delete({ where: { userId } });
      }
      await tx.user.delete({ where: { id: userId } });
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'DELETE_USER',
      null,
      `Видалено акаунт ${params.targetUsername} (ID: ${userId})`,
    );

    return { success: true };
  }

  async setPlayerTitle(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; title: string | null },
  ) {
    ensureMinPower(requestUser, PERMISSION.SET_TITLE, 'Видача титулу');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { profile: true },
    });

    if (!target) throw new NotFoundException('Користувача не знайдено');
    if (!target.profile) throw new NotFoundException('Профіль не знайдено');

    await this.prisma.profile.update({
      where: { id: target.profile.id },
      data: { title: params.title },
    });

    const displayTitle = params.title ? `«${params.title}»` : 'Знято';
    await logAdminAction(
      this.prisma,
      requestUser.id,
      'SET_TITLE',
      target.id,
      `Встановлено титул: ${displayTitle}`,
    );

    return { success: true };
  }
}
