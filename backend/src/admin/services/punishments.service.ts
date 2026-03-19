import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameGateway } from '../../game/game.gateway';
import { PERMISSION, getStaffPower, getMaxPunishSeconds } from '../admin.roles';
import { ensureMinPower, logAdminAction, PunishmentType } from '../admin.helpers';

@Injectable()
export class PunishmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  async getUserPunishments(
    requestUser: { id: string; staffRoleKey?: string | null },
    userId: string,
  ) {
    ensureMinPower(requestUser, PERMISSION.PUNISH, 'Покарання');
    return this.prisma.punishment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async punishUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: {
      targetUsername: string;
      type: PunishmentType;
      durationSeconds?: number | null;
      scope?: string;
      reason?: string;
    },
  ) {
    const power = ensureMinPower(
      requestUser,
      PERMISSION.PUNISH_WARN,
      'Покарання',
    );

    if (params.type === 'WARN') {
      ensureMinPower(requestUser, PERMISSION.PUNISH_WARN, 'Попередження');
    }
    if (params.type === 'MUTE') {
      ensureMinPower(requestUser, PERMISSION.PUNISH_MUTE, 'Видача Муту');
    }
    if (params.type === 'KICK') {
      ensureMinPower(
        requestUser,
        PERMISSION.PUNISH_KICK,
        'Викидання з кімнати (Кік)',
      );
    }
    if (params.type === 'BAN') {
      ensureMinPower(requestUser, PERMISSION.PUNISH_BAN, 'Видача Бану');
    }

    const isPermanent = !params.durationSeconds || params.durationSeconds <= 0;
    if (isPermanent && params.type !== 'KICK' && params.type !== 'WARN') {
      ensureMinPower(requestUser, 6, 'Перманентне покарання (назавжди)');
    }

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { profile: true },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException(
        'Не можна карати адміна рівного або вищого за вас.',
      );
    }

    if (!isPermanent && params.type !== 'WARN') {
      const maxSec = getMaxPunishSeconds(power);
      if (params.durationSeconds! > maxSec) {
        throw new ForbiddenException(
          `Ваш максимальний термін покарання: ${maxSec} сек.`,
        );
      }
    }

    const now = new Date();
    let expiresAt: Date | null = null;
    if (!isPermanent && params.type !== 'WARN') {
      expiresAt = new Date(now.getTime() + params.durationSeconds! * 1000);
    }

    const scope = params.scope || 'GLOBAL';

    await this.prisma.punishment.create({
      data: {
        userId: target.id,
        type: params.type,
        scope,
        reason: params.reason,
        createdBy: requestUser.id,
        expiresAt:
          params.type === 'WARN' ? undefined : (expiresAt ?? undefined),
      },
    });

    if (params.type === 'BAN') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { bannedUntil: expiresAt },
      });
    }
    if (params.type === 'MUTE') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { mutedUntil: expiresAt },
      });
    }

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'PUNISH',
      target.id,
      `${params.type} ${params.type === 'WARN' ? '' : (params.durationSeconds || 'permanent') + 's '}scope=${scope} reason=${params.reason || '—'}`,
    );

    if (params.type === 'WARN') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentWarns = await this.prisma.punishment.count({
        where: {
          userId: target.id,
          type: 'WARN',
          createdAt: { gte: sevenDaysAgo },
        },
      });

      if (recentWarns >= 5) {
        const banExpires = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        await this.prisma.punishment.create({
          data: {
            userId: target.id,
            type: 'BAN',
            scope: 'GLOBAL',
            reason: `Автоматичний бан: ${recentWarns} попереджень за 7 днів`,
            createdBy: 'SYSTEM',
            expiresAt: banExpires,
          },
        });
        await this.prisma.profile.update({
          where: { userId: target.id },
          data: { bannedUntil: banExpires },
        });
        await logAdminAction(
          this.prisma,
          'SYSTEM',
          'AUTO_BAN',
          target.id,
          `Автобан 3 дні: ${recentWarns} попереджень за 7 днів`,
        );

        try {
          const targetSocketId = (this.gameGateway as any).userSockets?.get(
            target.id,
          );
          if (targetSocketId) {
            this.gameGateway.server
              .to(targetSocketId)
              .emit('punishment_notification', {
                type: 'BAN',
                reason: `Автоматичний бан: ${recentWarns} попереджень за 7 днів`,
                expiresAt: banExpires.toISOString(),
                message: `Ваш акаунт заблоковано на 3 дні через ${recentWarns} попереджень за останні 7 днів.`,
              });
          }
        } catch {}
      } else if (recentWarns >= 3) {
        const muteExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await this.prisma.punishment.create({
          data: {
            userId: target.id,
            type: 'MUTE',
            scope: 'GLOBAL',
            reason: `Автоматичний мут: ${recentWarns} попереджень за 7 днів`,
            createdBy: 'SYSTEM',
            expiresAt: muteExpires,
          },
        });
        await this.prisma.profile.update({
          where: { userId: target.id },
          data: { mutedUntil: muteExpires },
        });
        await logAdminAction(
          this.prisma,
          'SYSTEM',
          'AUTO_MUTE',
          target.id,
          `Автомут 24 год: ${recentWarns} попереджень за 7 днів`,
        );

        try {
          const targetSocketId = (this.gameGateway as any).userSockets?.get(
            target.id,
          );
          if (targetSocketId) {
            this.gameGateway.server
              .to(targetSocketId)
              .emit('punishment_notification', {
                type: 'MUTE',
                reason: `Автоматичний мут: ${recentWarns} попереджень за 7 днів`,
                expiresAt: muteExpires.toISOString(),
                message: `Вам заборонено писати в чат на 24 години через ${recentWarns} попереджень за останні 7 днів.`,
              });
          }
        } catch {}
      }
    }

    try {
      const targetSocketId = (this.gameGateway as any).userSockets?.get(
        target.id,
      );
      if (targetSocketId) {
        this.gameGateway.server
          .to(targetSocketId)
          .emit('punishment_notification', {
            type: params.type,
            reason: params.reason || 'Порушення правил',
            durationSeconds:
              params.type === 'WARN' ? null : params.durationSeconds || null,
            expiresAt: expiresAt?.toISOString() || null,
            message:
              params.type === 'BAN'
                ? `Ваш акаунт заблоковано${expiresAt ? ' до ' + expiresAt.toLocaleString('uk-UA') : ' назавжди'}. Причина: ${params.reason || '—'}. Ви можете подати апеляцію у профілі.`
                : params.type === 'MUTE'
                  ? `Вам заборонено писати в чат${expiresAt ? ' до ' + expiresAt.toLocaleString('uk-UA') : ' назавжди'}. Причина: ${params.reason || '—'}.`
                  : params.type === 'WARN'
                    ? `⚠️ Ви отримали попередження. Причина: ${params.reason || '—'}. Увага: 3 попередження за 7 днів = автомут, 5 = автобан.`
                    : `Вас викинуто з кімнати. Причина: ${params.reason || '—'}.`,
          });
      }
    } catch {}

    return { success: true };
  }

  async unpunishUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; type: PunishmentType },
  ) {
    ensureMinPower(requestUser, PERMISSION.PUNISH, 'Зняття покарання');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { profile: true },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException(
        'Не можна знімати покарання з адміна рівного або вищого за вас.',
      );
    }

    if (params.type === 'BAN') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { bannedUntil: null },
      });
    }
    if (params.type === 'MUTE') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { mutedUntil: null },
      });
    }

    await this.prisma.punishment.updateMany({
      where: { userId: target.id, type: params.type, expiresAt: null },
      data: { expiresAt: new Date() },
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'UNPUNISH',
      target.id,
      params.type,
    );

    return { success: true };
  }
}
