import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PmService } from './pm.service';

describe('PmService', () => {
  let service: PmService;
  let prismaMock: any;
  let emitMock: jest.Mock;

  beforeEach(() => {
    emitMock = jest.fn();

    const gameGatewayMock = {
      server: {
        to: jest.fn(() => ({ emit: emitMock })),
      },
    };

    prismaMock = {
      profile: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      friendship: { findFirst: jest.fn() },
      privateMessage: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new PmService(prismaMock, gameGatewayMock as any);
  });

  describe('sendMessage', () => {
    it('throws BadRequestException for empty content', async () => {
      await expect(
        service.sendMessage('u1', 'u2', '   '),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when sanitize results in empty message', async () => {
      await expect(
        service.sendMessage('u1', 'u2', '<b></b>'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when user is muted', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({
        mutedUntil: new Date(Date.now() + 60_000).toISOString(),
      });

      await expect(
        service.sendMessage('u1', 'u2', 'hello'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when target user does not exist', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({ mutedUntil: null });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('u1', 'missing', 'hello'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when sender and target are not friends', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({ mutedUntil: null });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' });
      prismaMock.friendship.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage('u1', 'u2', 'hello'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates private message and emits notification/new_message on success', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({ mutedUntil: null });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' });
      prismaMock.friendship.findFirst.mockResolvedValue({
        id: 'f1',
        status: 'accepted',
      });

      prismaMock.privateMessage.create.mockResolvedValue({
        id: 'm1',
        fromId: 'u1',
        toId: 'u2',
        content: 'hello',
        from: { id: 'u1', username: 'alice' },
      });

      const result = await service.sendMessage('u1', 'u2', 'hello');
      expect(result).toMatchObject({ id: 'm1', content: 'hello' });

      // notification + new_message
      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'info',
          title: 'Нове повідомлення від alice',
        }),
      );
      expect(emitMock).toHaveBeenCalledWith(
        'new_message',
        expect.objectContaining({ id: 'm1' }),
      );
    });
  });
});

