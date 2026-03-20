import { ForbiddenException } from '@nestjs/common';
import { EconomyService } from './economy.service';

describe('EconomyService', () => {
  let service: EconomyService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: jest.fn() },
      wallet: { update: jest.fn() },
    };
    service = new EconomyService(prismaMock as any);
  });

  describe('adjustGold', () => {
    it('throws ForbiddenException when actor power is insufficient (ADJUST_GOLD)', async () => {
      await expect(
        service.adjustGold(
          { id: 'actor1', staffRoleKey: 'CURATOR' }, // power=8 < 9
          { targetUsername: 'target', delta: 100 },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

