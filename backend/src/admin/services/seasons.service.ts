import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameGateway } from '../../game/game.gateway';
import { PERMISSION } from '../admin.roles';
import { ensureMinPower, logAdminAction } from '../admin.helpers';

@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  async getSeasons(requestUser: { id: string; staffRoleKey?: string | null }) {
    ensureMinPower(
      requestUser,
      PERMISSION.MANAGE_SERVER,
      'Перегляд сезонів',
    );
    return this.prisma.season.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { rewards: true } },
      },
    });
  }

  async startSeason(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { name: string },
  ) {
    ensureMinPower(requestUser, PERMISSION.MANAGE_SERVER, 'Старт сезону');

    const active = await this.prisma.season.findFirst({
      where: { isActive: true },
    });
    if (active)
      throw new BadRequestException(
        'Вже є активний сезон. Спочатку завершіть його.',
      );

    if (!params.name) throw new BadRequestException("Назва сезону обов'язкова");

    const season = await this.prisma.season.create({
      data: { name: params.name, isActive: true },
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'START_SEASON',
      null,
      `Started season ${params.name}`,
    );
    return season;
  }

  async endSeason(requestUser: { id: string; staffRoleKey?: string | null }) {
    ensureMinPower(
      requestUser,
      PERMISSION.MANAGE_SERVER,
      'Завершення сезону',
    );

    const activeSeason = await this.prisma.season.findFirst({
      where: { isActive: true },
    });
    if (!activeSeason) throw new BadRequestException('Немає активних сезонів.');

    const topPlayers = await this.prisma.profile.findMany({
      orderBy: { mmr: 'desc' },
      take: 100,
      include: { user: true },
    });

    const rewardsData: {
      seasonId: string;
      userId: string;
      rank: number;
      reward: string;
    }[] = [];
    let rank = 1;

    for (const p of topPlayers) {
      if (p.mmr <= 1000) continue;

      let coins = 0;
      let frame: string | null = null;
      let desc = '';

      if (rank === 1) {
        coins = 10000;
        frame =
          'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-pulse';
        desc = `Топ ${rank} сезону: 10000 Монет + Рамка Чемпіона`;
      } else if (rank <= 3) {
        coins = 5000;
        frame =
          'border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.6)] animate-pulse';
        desc = `Топ ${rank} сезону: 5000 Монет + Платинова Рамка`;
      } else if (rank <= 10) {
        coins = 2500;
        frame = 'border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]';
        desc = `Топ ${rank} сезону: 2500 Монет + Епічна Рамка`;
      } else if (rank <= 50) {
        coins = 1000;
        desc = `Топ ${rank} сезону: 1000 Монет`;
      } else {
        coins = 500;
        desc = `Топ ${rank} сезону: 500 Монет`;
      }

      rewardsData.push({
        seasonId: activeSeason.id,
        userId: p.userId,
        rank,
        reward: desc,
      });

      await this.prisma.wallet.update({
        where: { userId: p.userId },
        data: { soft: { increment: coins } },
      });

      if (frame) {
        await this.prisma.profile.update({
          where: { id: p.id },
          data: { activeFrame: frame },
        });
      }
      rank++;
    }

    if (rewardsData.length > 0) {
      await this.prisma.seasonReward.createMany({ data: rewardsData });
    }

    await this.prisma.profile.updateMany({
      data: { mmr: 1500 },
    });

    const closed = await this.prisma.season.update({
      where: { id: activeSeason.id },
      data: { isActive: false, endDate: new Date() },
    });

    this.gameGateway.server.emit('chat_message', {
      id: 'system-season-end',
      senderId: 'SYSTEM',
      senderName: 'Система',
      text: `🏆 Сезон "${activeSeason.name}" закінчився! Нагороди роздано топ-100 гравцям. Весь MMR скинуто до 1500.`,
      role: 'SERVER',
      isSystem: true,
      timestamp: Date.now(),
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'END_SEASON',
      null,
      `Ended season ${activeSeason.name}`,
    );
    return { success: true, closed, rewardsGiven: rewardsData.length };
  }
}
