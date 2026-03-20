import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppealsService } from './appeals.service';

describe('AppealsService', () => {
  let service: AppealsService;
  let prismaMock: any;
  let emitMock: jest.Mock;

  beforeEach(() => {
    emitMock = jest.fn();

    prismaMock = {
      appeal: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      profile: { update: jest.fn() },
      punishment: { updateMany: jest.fn() },
      adminActionLog: { create: jest.fn() },
    };

    const gameGatewayMock = {
      server: {
        to: jest.fn(() => ({ emit: emitMock })),
      },
    };

    service = new AppealsService(prismaMock, gameGatewayMock as any);
  });

  describe('submitAppeal', () => {
    it('throws BadRequestException when reason is too short', async () => {
      await expect(
        service.submitAppeal('u1', { type: 'UNBAN', reason: 'short' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when user already has pending appeal', async () => {
      prismaMock.appeal.findFirst.mockResolvedValue({ id: 'a1' });

      await expect(
        service.submitAppeal('u1', {
          type: 'UNBAN',
          reason: 'Причина повинна бути досить детальна',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates appeal on success', async () => {
      prismaMock.appeal.findFirst.mockResolvedValue(null);
      prismaMock.appeal.create.mockResolvedValue({ id: 'a1' });

      const result = await service.submitAppeal('u1', {
        type: 'UNBAN',
        reason: 'Детальна причина для апеляції (мінімум 10 символів)',
      });

      expect(prismaMock.appeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: 'u1',
            type: 'UNBAN',
            reason: expect.any(String),
          },
        }),
      );
      expect(result).toMatchObject({ id: 'a1' });
    });
  });

  describe('resolveAppeal', () => {
    it('throws ForbiddenException when staff power is insufficient', async () => {
      await expect(
        service.resolveAppeal(
          { id: 'staff1', staffRoleKey: 'TRAINEE' },
          { appealId: 'a1', status: 'APPROVED' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when appeal does not exist', async () => {
      prismaMock.appeal.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveAppeal(
          { id: 'staff1', staffRoleKey: 'JUNIOR_ADMIN' },
          { appealId: 'a1', status: 'APPROVED' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('approves UNBAN: clears bannedUntil, expires BAN punishment and emits notification', async () => {
      const requestUser = { id: 'staff1', staffRoleKey: 'JUNIOR_ADMIN' }; // power=5

      prismaMock.appeal.findUnique.mockResolvedValue({
        id: 'a1',
        status: 'PENDING',
        type: 'UNBAN',
        userId: 'targetUser',
      });

      prismaMock.appeal.update.mockResolvedValue({
        id: 'a1',
        status: 'APPROVED',
      });

      prismaMock.profile.update.mockResolvedValue({ id: 'targetUser' });
      prismaMock.punishment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resolveAppeal(requestUser, {
        appealId: 'a1',
        status: 'APPROVED',
      });

      expect(result).toEqual({ success: true });

      expect(prismaMock.profile.update).toHaveBeenCalledWith({
        where: { userId: 'targetUser' },
        data: { bannedUntil: null },
      });

      expect(prismaMock.punishment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'targetUser', type: 'BAN', expiresAt: null },
          data: { expiresAt: expect.any(Date) },
        }),
      );

      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'success',
          title: 'Апеляцію розглянуто',
          message: expect.stringContaining('Блокування'),
        }),
      );
    });

    it('throws BadRequestException when appeal is not pending', async () => {
      prismaMock.appeal.findUnique.mockResolvedValue({
        id: 'a1',
        status: 'APPROVED',
        type: 'UNBAN',
        userId: 'targetUser',
      });

      await expect(
        service.resolveAppeal(
          { id: 'staff1', staffRoleKey: 'JUNIOR_ADMIN' },
          { appealId: 'a1', status: 'REJECTED' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

