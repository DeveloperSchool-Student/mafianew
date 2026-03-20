import { ForbiddenException } from '@nestjs/common';
import { UserModerationService } from './user-moderation.service';

describe('UserModerationService', () => {
  let service: UserModerationService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: jest.fn() },
      profile: { update: jest.fn() },
      $transaction: jest.fn(),
    };

    service = new UserModerationService(prismaMock as any);
  });

  describe('deleteUser', () => {
    it('throws ForbiddenException when actor power is insufficient (DELETE_USER)', async () => {
      await expect(
        service.deleteUser(
          { id: 'actor1', staffRoleKey: 'ADMIN' }, // power=6 < 9
          { targetUsername: 'target' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('setPlayerTitle', () => {
    it('throws ForbiddenException when actor power is insufficient (SET_TITLE)', async () => {
      await expect(
        service.setPlayerTitle(
          { id: 'actor1', staffRoleKey: 'MOD' }, // power=3 < 7
          { targetUsername: 'target', title: 'Hero' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

