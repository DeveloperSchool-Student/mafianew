import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  let service: FriendsService;
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
      user: { findUnique: jest.fn() },
      friendship: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new FriendsService(prismaMock, gameGatewayMock as any);
  });

  describe('sendRequest', () => {
    it('throws BadRequestException when friendUsername is empty', async () => {
      await expect(service.sendRequest('u1', '')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws NotFoundException when friend user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendRequest('u1', 'unknown'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when trying to add yourself', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(
        service.sendRequest('u1', 'me'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException when request already exists (pending)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'f1' });
      prismaMock.friendship.findFirst.mockResolvedValue({
        status: 'pending',
      });

      await expect(
        service.sendRequest('u1', 'friend'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates friendship request and emits notification', async () => {
      const friendUser = {
        id: 'f1',
        username: 'friendUser',
      };

      prismaMock.user.findUnique.mockResolvedValue(friendUser);
      prismaMock.friendship.findFirst.mockResolvedValue(null);

      prismaMock.friendship.create.mockResolvedValue({
        id: 'req1',
        userId: 'u1',
        friendId: 'f1',
        status: 'pending',
        user: { username: 'alice' },
      });

      const result = await service.sendRequest('u1', 'friendUser');

      expect(result).toMatchObject({ id: 'req1', status: 'pending' });
      expect(prismaMock.friendship.create).toHaveBeenCalled();
      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'info',
          title: 'Новий запит у друзі',
          message: 'Користувач alice хоче додати вас у друзі.',
        }),
      );
    });
  });

  describe('acceptRequest', () => {
    it('throws NotFoundException when friendship does not exist or not pending for user', async () => {
      prismaMock.friendship.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptRequest('u1', 'fid'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('accepts request and emits notification to original sender', async () => {
      const friendship = {
        id: 'req1',
        friendId: 'u1', // receiver in service terms
        userId: 'sender1',
        status: 'pending',
      };

      prismaMock.friendship.findUnique.mockResolvedValue(friendship);

      const updated = {
        id: 'req1',
        status: 'accepted',
        userId: 'sender1',
        friend: { username: 'friendUser' },
      };

      prismaMock.friendship.update.mockResolvedValue(updated);

      const result = await service.acceptRequest('u1', 'req1');
      expect(result).toMatchObject({ id: 'req1', status: 'accepted' });

      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'success',
          title: 'Запит у друзі прийнято',
          message: 'friendUser прийняв(ла) ваш запит.',
        }),
      );
    });
  });

  describe('rejectRequest', () => {
    it('throws NotFoundException when friendship does not exist or is not pending for user', async () => {
      prismaMock.friendship.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectRequest('u1', 'fid'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes request when user rejects', async () => {
      prismaMock.friendship.findUnique.mockResolvedValue({
        id: 'req1',
        friendId: 'u1',
        status: 'pending',
      });

      prismaMock.friendship.delete.mockResolvedValue({
        id: 'req1',
      });

      const result = await service.rejectRequest('u1', 'req1');
      expect(result).toMatchObject({ id: 'req1' });
      expect(prismaMock.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'req1' },
      });
    });
  });

  // Optional: keep coverage for removeFriend permissions (blocker missing in list.md)
  describe('removeFriend', () => {
    it('throws NotFoundException when friendship does not exist', async () => {
      prismaMock.friendship.findUnique.mockResolvedValue(null);

      await expect(
        service.removeFriend('uC', 'f1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes friendship when user has permission (treat as block/remove)', async () => {
      prismaMock.friendship.findUnique.mockResolvedValue({
        id: 'fship1',
        userId: 'uA',
        friendId: 'uB',
      });

      prismaMock.friendship.delete.mockResolvedValue({ id: 'fship1' });

      const result = await service.removeFriend('uA', 'fship1');
      expect(result).toMatchObject({ id: 'fship1' });
      expect(prismaMock.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'fship1' },
      });
    });

    it('throws ForbiddenException when user has no permission', async () => {
      prismaMock.friendship.findUnique.mockResolvedValue({
        id: 'f1',
        userId: 'uA',
        friendId: 'uB',
      });

      await expect(
        service.removeFriend('uC', 'f1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

