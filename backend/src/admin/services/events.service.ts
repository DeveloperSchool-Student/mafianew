import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { GameGateway } from '../../game/game.gateway';
import { PERMISSION } from '../admin.roles';
import { ensureMinPower, logAdminAction } from '../admin.helpers';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  async launchEvent(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { eventName: string; rewardCoins?: number; eventRoles?: string[] },
  ) {
    ensureMinPower(requestUser, PERMISSION.EVENTS, 'Запуск Івенту');

    if (!params.eventName || params.eventName.trim().length < 3) {
      throw new BadRequestException('Назва івенту занадто коротка');
    }

    let targetCount = 0;
    if (params.rewardCoins && params.rewardCoins > 0) {
      const result = await this.prisma.wallet.updateMany({
        data: { soft: { increment: params.rewardCoins } },
      });
      targetCount = result.count;
    }

    const activatedRoles: string[] = [];
    const redis = this.redisService.getClient();
    if (params.eventRoles && params.eventRoles.length > 0) {
      const validRoles = [
        'KRAMPUS',
        'CUPID',
        'SNOWMAN',
        'WITCH',
        'SANTA',
        'GHOST',
      ];
      const filtered = params.eventRoles.filter((r) => validRoles.includes(r));
      if (filtered.length > 0) {
        await redis.set('global:eventRoles', JSON.stringify(filtered));
        await redis.set('global:eventName', params.eventName);
        activatedRoles.push(...filtered);
      }
    }

    const rolesText =
      activatedRoles.length > 0
        ? ` Увімкнені спеціальні ролі: ${activatedRoles.join(', ')}!`
        : '';

    this.gameGateway.server.emit('notification', {
      type: 'success',
      title: '🌟 ГЛОБАЛЬНИЙ ІВЕНТ!',
      message: `Стартував івент «${params.eventName}»! ${params.rewardCoins ? `Усі гравці отримали ${params.rewardCoins} монет!` : ''}${rolesText}`,
      duration: 10000,
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'LAUNCH_EVENT',
      null,
      `Launched event: ${params.eventName} with ${params.rewardCoins || 0} coins to ${targetCount} users. Event roles: ${activatedRoles.join(', ') || 'none'}`,
    );

    return {
      success: true,
      message: 'Івент успішно запущено.',
      rewardedUsers: targetCount,
      activatedRoles,
    };
  }

  async listClanWars(
    //  NOTE: keep here temporarily — can move to a ClanWarsService later
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    ensureMinPower(
      requestUser,
      PERMISSION.VIEW_CLAN_WARS,
      'Перегляд Війн Кланів',
    );
    return this.prisma.clanWar.findMany({
      where: status ? { status } : undefined,
      include: {
        challenger: { select: { id: true, name: true, rating: true } },
        target: { select: { id: true, name: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveClanWar(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { warId: string; winnerId: string | null },
  ) {
    ensureMinPower(
      requestUser,
      PERMISSION.RESOLVE_CLAN_WARS,
      'Вирішення Війн Кланів',
    );

    const war = await this.prisma.clanWar.findUnique({
      where: { id: params.warId },
    });

    if (!war) throw new NotFoundException('Війну не знайдено');
    if (war.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Ця війна не є активною (або вже завершена).',
      );
    }

    const bet = war.customBet > 0 ? war.customBet : 25;

    if (params.winnerId) {
      if (
        params.winnerId !== war.challengerId &&
        params.winnerId !== war.targetId
      ) {
        throw new BadRequestException(
          'Переможець має бути одним із кланів у війні.',
        );
      }
      const loserId =
        params.winnerId === war.challengerId ? war.targetId : war.challengerId;

      const winnerClan = await this.prisma.clan.findUnique({
        where: { id: params.winnerId },
      });
      const loserClan = await this.prisma.clan.findUnique({
        where: { id: loserId },
      });

      await this.prisma.$transaction([
        this.prisma.clan.update({
          where: { id: params.winnerId },
          data: { rating: (winnerClan?.rating || 0) + bet },
        }),
        this.prisma.clan.update({
          where: { id: loserId },
          data: { rating: Math.max(0, (loserClan?.rating || 0) - bet) },
        }),
        this.prisma.clanWar.update({
          where: { id: params.warId },
          data: {
            status: 'FINISHED',
            winnerId: params.winnerId,
            ratingChange: bet,
            endedAt: new Date(),
          },
        }),
      ]);
    } else {
      await this.prisma.clanWar.update({
        where: { id: params.warId },
        data: {
          status: 'FINISHED',
          winnerId: null,
          ratingChange: 0,
          endedAt: new Date(),
        },
      });
    }

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'RESOLVE_CLAN_WAR',
      null,
      `ClanWar ${params.warId} resolved. WinnerId: ${params.winnerId || 'DRAW'}`,
    );

    return { success: true };
  }

  async getGlobalStats(requestUser: {
    id: string;
    staffRoleKey?: string | null;
  }) {
    ensureMinPower(
      requestUser,
      PERMISSION.VIEW_GAME_LOGS,
      'Перегляд статистики',
    );

    const totalUsers = await this.prisma.user.count();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const matchesToday = await this.prisma.match.count({
      where: { createdAt: { gte: today } },
    });
    const matchesWeek = await this.prisma.match.count({
      where: { createdAt: { gte: lastWeek } },
    });
    const matchesMonth = await this.prisma.match.count({
      where: { createdAt: { gte: lastMonth } },
    });

    const rolesQuery = await this.prisma.matchParticipant.groupBy({
      by: ['role'],
      _count: { role: true },
      orderBy: { _count: { role: 'desc' } },
      take: 5,
    });

    const sockets = await this.gameGateway.server.fetchSockets();
    const online = sockets.length;

    return {
      totalUsers,
      online,
      matches: {
        today: matchesToday,
        week: matchesWeek,
        month: matchesMonth,
      },
      popularRoles: rolesQuery.map((r) => ({
        role: r.role,
        count: r._count.role,
      })),
    };
  }
}
