import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION } from '../admin.roles';
import { ensureMinPower, logAdminAction } from '../admin.helpers';

@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActionLogs(
    requestUser: { id: string; staffRoleKey?: string | null },
    cursor?: string,
    limit: number = 50,
  ) {
    ensureMinPower(requestUser, PERMISSION.VIEW_ADMIN_LOGS, 'Логи дій');
    const items = await this.prisma.adminActionLog.findMany({
      include: {
        actor: { select: { username: true } },
        target: { select: { username: true } },
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem!.id;
    }

    return { data: items, nextCursor };
  }

  async clearLogs(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { olderThanDays?: number },
  ) {
    ensureMinPower(requestUser, PERMISSION.CONFIG, 'Очищення логів');

    const where: any = {};
    if (params.olderThanDays && params.olderThanDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - params.olderThanDays);
      where.createdAt = { lt: cutoff };
    }

    const result = await this.prisma.adminActionLog.deleteMany({ where });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'CLEAR_LOGS',
      null,
      params.olderThanDays
        ? `Видалено ${result.count} логів старших за ${params.olderThanDays} днів`
        : `Видалено всі логи (${result.count} записів)`,
    );

    return { success: true, count: result.count, deleted: result.count };
  }
}

