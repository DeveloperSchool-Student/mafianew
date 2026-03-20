import { ForbiddenException } from '@nestjs/common';
import { AdminLogsService } from './admin-logs.service';

describe('AdminLogsService', () => {
  let service: AdminLogsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      adminActionLog: { findMany: jest.fn(), deleteMany: jest.fn() },
    };
    service = new AdminLogsService(prismaMock as any);
  });

  it('throws ForbiddenException when actor power is insufficient for getActionLogs', async () => {
    await expect(
      service.getActionLogs(
        { id: 'actor1', staffRoleKey: 'SENIOR_MOD' }, // power=4 < 8
        undefined,
        10,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when actor power is insufficient for clearLogs', async () => {
    await expect(
      service.clearLogs(
        { id: 'actor1', staffRoleKey: 'CURATOR' }, // power=8 < 9
        { olderThanDays: 7 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

