import { ForbiddenException } from '@nestjs/common';
import { PunishmentsService } from './punishments.service';

describe('PunishmentsService.punishUser', () => {
  let service: PunishmentsService;
  let prismaMock: any;
  let gameGatewayMock: any;

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: jest.fn() },
      punishment: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      profile: { update: jest.fn() },
      adminActionLog: { create: jest.fn() },
    };

    gameGatewayMock = {
      server: {
        to: jest.fn(() => ({ emit: jest.fn() })),
      },
      userSockets: new Map<string, string>(),
    };

    service = new PunishmentsService(prismaMock, gameGatewayMock as any);
  });

  it('throws ForbiddenException when durationSeconds exceeds max allowed', async () => {
    // HELPER power=2 => maxSec = 3600 (see getMaxPunishSeconds)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'target1',
      staffRoleKey: null,
      profile: {},
    });

    await expect(
      service.punishUser(
        { id: 'staff1', staffRoleKey: 'HELPER' },
        {
          targetUsername: 'target',
          type: 'MUTE',
          durationSeconds: 5000,
          reason: 'spam',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when actor power is insufficient for BAN', async () => {
    // MOD power=3 < PERMISSION.PUNISH_BAN (=4)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'target1',
      staffRoleKey: null,
      profile: {},
    });

    await expect(
      service.punishUser(
        { id: 'actor1', staffRoleKey: 'MOD' },
        {
          targetUsername: 'target',
          type: 'BAN',
          durationSeconds: null,
          reason: 'spam',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates punishment and updates profile when durationSeconds is within max', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'target1',
      staffRoleKey: null,
      profile: {},
    });

    prismaMock.punishment.create.mockResolvedValue({ id: 'pun1' });
    prismaMock.profile.update.mockResolvedValue({ id: 'target1' });
    prismaMock.adminActionLog.create.mockResolvedValue({});

    await expect(
      service.punishUser(
        { id: 'staff1', staffRoleKey: 'HELPER' },
        {
          targetUsername: 'target',
          type: 'MUTE',
          durationSeconds: 100,
          reason: 'spam',
          scope: 'GLOBAL',
        },
      ),
    ).resolves.toEqual({ success: true });

    const expectedExpiresAt = new Date(
      '2026-01-01T00:00:00.000Z',
    );
    expectedExpiresAt.setSeconds(expectedExpiresAt.getSeconds() + 100);

    expect(prismaMock.punishment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'target1',
          type: 'MUTE',
          scope: 'GLOBAL',
          createdBy: 'staff1',
          expiresAt: expectedExpiresAt,
        }),
      }),
    );

    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { userId: 'target1' },
      data: { mutedUntil: expectedExpiresAt },
    });
  });
});

