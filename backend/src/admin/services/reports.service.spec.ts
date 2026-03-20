import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaMock: any;
  let emitMock: jest.Mock;

  beforeEach(() => {
    emitMock = jest.fn();

    prismaMock = {
      user: { findUnique: jest.fn() },
      report: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      adminActionLog: {
        create: jest.fn(),
      },
    };

    const gameGatewayMock = {
      server: {
        to: jest.fn(() => ({ emit: emitMock })),
      },
      userSockets: new Map<string, string>(),
    };

    service = new ReportsService(prismaMock, gameGatewayMock as any);
  });

  describe('createReport', () => {
    it('throws NotFoundException if target user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createReport('r1', {
          targetUsername: 'missing',
          reason: 'spam',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when reporter reports himself', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'r1' });

      await expect(
        service.createReport('r1', {
          targetUsername: 'me',
          reason: 'spam',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates report on success', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 't1' });
      prismaMock.report.create.mockResolvedValue({ id: 'rep1' });

      const result = await service.createReport('r1', {
        targetUsername: 'target',
        reason: 'abuse',
        screenshotUrl: 'http://img/1.png',
      });

      expect(prismaMock.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            reporterId: 'r1',
            targetId: 't1',
            reason: 'abuse',
            screenshotUrl: 'http://img/1.png',
          },
        }),
      );
      expect(result).toMatchObject({ id: 'rep1' });
    });
  });

  describe('resolveReport', () => {
    it('throws ForbiddenException if staff power is insufficient', async () => {
      await expect(
        service.resolveReport(
          { id: 'staff1', staffRoleKey: 'TRAINEE' },
          { reportId: 'rep1', status: 'RESOLVED', note: 'nope' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates report status and emits report_resolved on success (RESOLVED)', async () => {
      const requestUser = { id: 'staff1', staffRoleKey: 'MOD' }; // power=3

      prismaMock.report.findUnique.mockResolvedValue({
        id: 'rep1',
        reporterId: 'reporter1',
        targetId: 'target1',
      });

      prismaMock.report.update.mockResolvedValue({
        id: 'rep1',
        reporterId: 'reporter1',
        targetId: 'target1',
      });

      // Attach sockets to gameGateway mock through service reference
      (service as any).gameGateway.userSockets.set('reporter1', 'sockR');
      (service as any).gameGateway.userSockets.set('target1', 'sockT');

      const result = await service.resolveReport(requestUser, {
        reportId: 'rep1',
        status: 'RESOLVED',
        note: 'ok',
      });

      expect(prismaMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rep1' },
          data: {
            status: 'RESOLVED',
            resolvedBy: requestUser.id,
            resolvedNote: 'ok',
          },
        }),
      );

      expect(result).toEqual({ success: true });

      // reporter gets a success report_resolved
      expect(emitMock).toHaveBeenCalledWith(
        'report_resolved',
        expect.objectContaining({
          type: 'success',
          message: expect.stringContaining('розглянуто та вирішено'),
        }),
      );

      // target gets warning report_resolved (RESOLVED only)
      expect(emitMock).toHaveBeenCalledWith(
        'report_resolved',
        expect.objectContaining({
          type: 'warning',
          message: expect.stringContaining('обґрунтованою'),
        }),
      );
    });
  });
});

