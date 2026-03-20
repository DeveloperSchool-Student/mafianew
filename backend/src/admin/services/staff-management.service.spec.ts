import { ForbiddenException } from '@nestjs/common';
import { StaffManagementService } from './staff-management.service';

describe('StaffManagementService', () => {
  let service: StaffManagementService;
  let prismaMock: any;
  let gameGatewayMock: any;

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      staffRole: { upsert: jest.fn() },
      adminActionLog: { create: jest.fn() },
    };

    gameGatewayMock = {
      server: { to: jest.fn(() => ({ emit: jest.fn() })) },
      userSockets: new Map<string, string>(),
    };

    service = new StaffManagementService(prismaMock, gameGatewayMock as any);
  });

  describe('setStaffRole', () => {
    it('throws ForbiddenException when actor power is insufficient for MANAGE_STAFF', async () => {
      await expect(
        service.setStaffRole(
          { id: 'actor1', staffRoleKey: 'ADMIN' }, // power=6 < 8
          { targetUsername: 'target', roleKey: 'SENIOR_ADMIN' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires confirmPin when assigning 7+ role by CURATOR (power=8)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'target1',
        staffRoleKey: null,
      });

      await expect(
        service.setStaffRole(
          { id: 'curator1', staffRoleKey: 'CURATOR' }, // power=8
          {
            targetUsername: 'target',
            roleKey: 'SENIOR_ADMIN', // power=7 => confirmPin required
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('removeStaffRole', () => {
    it('throws ForbiddenException when actor power is insufficient for MANAGE_STAFF', async () => {
      await expect(
        service.removeStaffRole(
          { id: 'actor1', staffRoleKey: 'JUNIOR_ADMIN' }, // power=5 < 8
          { targetUsername: 'target' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

