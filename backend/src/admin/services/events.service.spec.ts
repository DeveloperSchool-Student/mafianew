import { ForbiddenException } from '@nestjs/common';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let prismaMock: any;
  let redisMock: any;
  let gameGatewayMock: any;

  beforeEach(() => {
    prismaMock = {
      clanWar: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      clan: { findUnique: jest.fn() },
      wallet: { updateMany: jest.fn() },
      match: { count: jest.fn() },
      matchParticipant: { groupBy: jest.fn() },
      user: { count: jest.fn() },
      // for transactions
      $transaction: jest.fn(),
    };

    redisMock = {
      getClient: () => ({
        set: jest.fn(),
      }),
    };

    gameGatewayMock = {
      server: {
        emit: jest.fn(),
        fetchSockets: jest.fn(),
      },
    };

    service = new EventsService(prismaMock as any, redisMock as any, gameGatewayMock as any);
  });

  it('throws ForbiddenException when actor power is insufficient for resolveClanWar', async () => {
    await expect(
      service.resolveClanWar(
        { id: 'actor1', staffRoleKey: 'MOD' }, // power=3 < 7
        { warId: 'w1', winnerId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when actor power is insufficient for launchEvent', async () => {
    await expect(
      service.launchEvent(
        { id: 'actor1', staffRoleKey: 'ADMIN' }, // power=6 < 9
        { eventName: 'SNOWMAN', rewardCoins: 10 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

