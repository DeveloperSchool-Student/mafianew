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
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  async createReport(
    reporterId: string,
    params: { targetUsername: string; reason: string; screenshotUrl?: string },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    if (target.id === reporterId) {
      throw new BadRequestException('Не можна скаржитися на самого себе.');
    }

    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetId: target.id,
        status: 'PENDING',
      },
    });

    if (existingReport) {
      throw new BadRequestException(
        'Ви вже подали скаргу на цього гравця, вона ще на розгляді.',
      );
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetId: target.id,
        reason: params.reason,
        screenshotUrl: params.screenshotUrl,
      },
    });
  }

  async listReports(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    ensureMinPower(
      requestUser,
      PERMISSION.VIEW_REPORTS,
      'Перегляд скарг',
    );
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: { select: { username: true } },
        target: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getMyReports(userId: string) {
    return this.prisma.report.findMany({
      where: { reporterId: userId },
      include: {
        target: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async resolveReport(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: {
      reportId: string;
      status: 'RESOLVED' | 'REJECTED';
      note?: string;
    },
  ) {
    ensureMinPower(
      requestUser,
      PERMISSION.RESOLVE_REPORTS,
      'Розгляд скарги',
    );

    const report = await this.prisma.report.findUnique({
      where: { id: params.reportId },
    });
    if (!report) throw new NotFoundException('Скаргу не знайдено');

    await this.prisma.report.update({
      where: { id: params.reportId },
      data: {
        status: params.status,
        resolvedBy: requestUser.id,
        resolvedNote: params.note,
      },
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'RESOLVE_REPORT',
      report.targetId,
      `Report ${params.reportId} → ${params.status}: ${params.note || '—'}`,
    );

    try {
      const reporterSocketId = (this.gameGateway as any).userSockets?.get(
        report.reporterId,
      );
      if (reporterSocketId) {
        this.gameGateway.server.to(reporterSocketId).emit('report_resolved', {
          type: params.status === 'RESOLVED' ? 'success' : 'info',
          message: `Вашу скаргу було ${params.status === 'RESOLVED' ? 'розглянуто та вирішено' : 'відхилено'} адміністратором.${params.note ? ' Коментар: ' + params.note : ''}`,
        });
      }
      if (params.status === 'RESOLVED' && report.targetId) {
        const targetSocketId = (this.gameGateway as any).userSockets?.get(
          report.targetId,
        );
        if (targetSocketId) {
          this.gameGateway.server.to(targetSocketId).emit('report_resolved', {
            type: 'warning',
            message: `На вас було подано скаргу, яку адміністратор визнав обґрунтованою. Будь ласка, дотримуйтесь правил.`,
          });
        }
      }
    } catch {}

    return { success: true };
  }
}
