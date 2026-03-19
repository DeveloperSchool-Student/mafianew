import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameGateway } from '../../game/game.gateway';
import { PERMISSION } from '../admin.roles';
import { ensureMinPower, logAdminAction } from '../admin.helpers';

@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  async submitAppeal(
    userId: string,
    params: { type: 'UNBAN' | 'UNMUTE'; reason: string },
  ) {
    if (!params.reason || params.reason.trim().length < 10) {
      throw new BadRequestException(
        'Причина має бути детальною (мінімум 10 символів).',
      );
    }

    const existing = await this.prisma.appeal.findFirst({
      where: { userId, status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('У вас вже є нерозглянута апеляція.');
    }

    return this.prisma.appeal.create({
      data: {
        userId,
        type: params.type,
        reason: params.reason,
      },
    });
  }

  async listAppeals(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    ensureMinPower(
      requestUser,
      PERMISSION.VIEW_APPEALS,
      'Перегляд апеляцій',
    );
    return this.prisma.appeal.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveAppeal(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { appealId: string; status: 'APPROVED' | 'REJECTED' },
  ) {
    ensureMinPower(
      requestUser,
      PERMISSION.RESOLVE_APPEALS,
      'Розгляд апеляції',
    );

    const appeal = await this.prisma.appeal.findUnique({
      where: { id: params.appealId },
      include: { user: true },
    });

    if (!appeal) throw new NotFoundException('Апеляцію не знайдено');
    if (appeal.status !== 'PENDING') {
      throw new BadRequestException('Ця апеляція вже розглянута.');
    }

    await this.prisma.appeal.update({
      where: { id: params.appealId },
      data: {
        status: params.status,
        resolvedBy: requestUser.id,
      },
    });

    if (params.status === 'APPROVED') {
      if (appeal.type === 'UNBAN') {
        await this.prisma.profile.update({
          where: { userId: appeal.userId },
          data: { bannedUntil: null },
        });
        await this.prisma.punishment.updateMany({
          where: { userId: appeal.userId, type: 'BAN', expiresAt: null },
          data: { expiresAt: new Date() },
        });
      } else if (appeal.type === 'UNMUTE') {
        await this.prisma.profile.update({
          where: { userId: appeal.userId },
          data: { mutedUntil: null },
        });
        await this.prisma.punishment.updateMany({
          where: { userId: appeal.userId, type: 'MUTE', expiresAt: null },
          data: { expiresAt: new Date() },
        });
      }
    }

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'RESOLVE_APPEAL',
      appeal.userId,
      `Appeal ${params.appealId} (${appeal.type}) → ${params.status}`,
    );

    const actionText = appeal.type === 'UNBAN' ? 'Блокування' : 'Мут';
    const statusText = params.status === 'APPROVED' ? 'СХВАЛЕНО' : 'ВІДХИЛЕНО';

    this.gameGateway.server.to(appeal.userId).emit('notification', {
      type: params.status === 'APPROVED' ? 'success' : 'error',
      title: 'Апеляцію розглянуто',
      message: `Ваша апеляція на ${actionText} була розглянута. Статус: ${statusText}.`,
    });

    return { success: true };
  }
}
