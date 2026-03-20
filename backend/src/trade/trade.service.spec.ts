import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TradeService } from './trade.service';

describe('TradeService', () => {
  let service: TradeService;

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
      wallet: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      trade: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new TradeService(prismaMock, gameGatewayMock as any);
  });

  describe('createTrade', () => {
    it('throws BadRequestException for self-trade', async () => {
      await expect(
        service.createTrade('u1', {
          receiverId: 'u1',
          offerAmount: 10,
          offerCurrency: 'SOFT',
          requestAmount: 5,
          requestCurrency: 'HARD',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when sender has insufficient offer funds', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue({
        soft: 3,
        hard: 0,
      });

      await expect(
        service.createTrade('s1', {
          receiverId: 'r1',
          offerAmount: 10,
          offerCurrency: 'SOFT',
          requestAmount: 5,
          requestCurrency: 'HARD',
        }),
      ).rejects.toThrow('Недостатньо софт-валюти.');

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.trade.create).not.toHaveBeenCalled();
    });

    it('creates a trade and emits notification on success', async () => {
      prismaMock.wallet.findUnique.mockResolvedValue({
        soft: 100,
        hard: 50,
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'r1' });
      prismaMock.trade.create.mockResolvedValue({
        id: 't1',
        sender: { username: 'alice' },
      });

      const result = await service.createTrade('s1', {
        receiverId: 'r1',
        offerAmount: 10.9,
        offerCurrency: 'SOFT',
        requestAmount: 2.1,
        requestCurrency: 'HARD',
      });

      expect(result).toMatchObject({ id: 't1' });

      // Amounts are coerced to integers inside service
      expect(prismaMock.trade.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            senderId: 's1',
            receiverId: 'r1',
            offerAmount: 10,
            offerCurrency: 'SOFT',
            requestAmount: 2,
            requestCurrency: 'HARD',
          },
        }),
      );

      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'info',
          title: 'Нова пропозиція обміну',
          message: 'Гравець alice пропонує вам обмін.',
        }),
      );
    });
  });

  describe('acceptTrade', () => {
    it('throws NotFoundException if trade does not exist', async () => {
      prismaMock.trade.findUnique.mockResolvedValue(null);

      await expect(service.acceptTrade('r1', 't1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException if receiver tries to accept someone else trade', async () => {
      prismaMock.trade.findUnique.mockResolvedValue({
        id: 't1',
        senderId: 's1',
        receiverId: 'r2',
        offerAmount: 10,
        offerCurrency: 'SOFT',
        requestAmount: 5,
        requestCurrency: 'HARD',
        status: 'PENDING',
      });

      await expect(service.acceptTrade('r1', 't1')).rejects.toThrow(
        'Ви не можете прийняти чужий обмін.',
      );
    });

    it('accepts trade: updates wallets in transaction and emits notification', async () => {
      const trade = {
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        offerAmount: 10,
        offerCurrency: 'SOFT',
        requestAmount: 5,
        requestCurrency: 'HARD',
        status: 'PENDING',
      };

      prismaMock.trade.findUnique.mockResolvedValue(trade);

      const txMock = {
        wallet: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
        trade: {
          update: jest.fn(),
        },
      };

      txMock.wallet.findUnique.mockImplementation(({ where }: any) => {
        if (where.userId === trade.senderId) return { soft: 100, hard: 0 };
        if (where.userId === trade.receiverId) return { soft: 0, hard: 10 };
        return null;
      });

      const finalized = { ...trade, status: 'ACCEPTED' };
      txMock.trade.update.mockResolvedValue(finalized);

      prismaMock.$transaction.mockImplementation(async (cb: any) =>
        cb(txMock),
      );

      const result = await service.acceptTrade('r1', 't1');
      expect(result).toEqual(finalized);

      // 4 wallet updates: offer debit/credit + request debit/credit
      expect(txMock.wallet.update).toHaveBeenCalledTimes(4);
      const walletUpdateCalls = txMock.wallet.update.mock.calls;
      expect(walletUpdateCalls[0][0]).toEqual(
        expect.objectContaining({
          where: { userId: trade.senderId },
          data: { soft: { decrement: trade.offerAmount } },
        }),
      );
      expect(walletUpdateCalls[1][0]).toEqual(
        expect.objectContaining({
          where: { userId: trade.receiverId },
          data: { soft: { increment: trade.offerAmount } },
        }),
      );
      expect(walletUpdateCalls[2][0]).toEqual(
        expect.objectContaining({
          where: { userId: trade.receiverId },
          data: { hard: { decrement: trade.requestAmount } },
        }),
      );
      expect(walletUpdateCalls[3][0]).toEqual(
        expect.objectContaining({
          where: { userId: trade.senderId },
          data: { hard: { increment: trade.requestAmount } },
        }),
      );

      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'success',
          title: 'Обмін прийнято',
          message: 'Ваша пропозиція обміну була прийнята.',
        }),
      );
    });

    it('throws BadRequestException when trade is not PENDING', async () => {
      prismaMock.trade.findUnique.mockResolvedValue({
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        offerAmount: 10,
        offerCurrency: 'SOFT',
        requestAmount: 5,
        requestCurrency: 'HARD',
        status: 'ACCEPTED',
      });

      await expect(service.acceptTrade('r1', 't1')).rejects.toThrow(
        'Обмін вже має статус: ACCEPTED.',
      );
    });

    it('throws BadRequestException if sender lacks offer funds during transaction', async () => {
      const trade = {
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        offerAmount: 10,
        offerCurrency: 'SOFT',
        requestAmount: 5,
        requestCurrency: 'HARD',
        status: 'PENDING',
      };

      prismaMock.trade.findUnique.mockResolvedValue(trade);

      const txMock = {
        wallet: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        trade: { update: jest.fn() },
      };

      txMock.wallet.findUnique.mockImplementation(({ where }: any) => {
        if (where.userId === trade.senderId) return { soft: 0, hard: 0 };
        if (where.userId === trade.receiverId) return { soft: 0, hard: 10 };
        return null;
      });

      prismaMock.$transaction.mockImplementation(async (cb: any) =>
        cb(txMock),
      );

      await expect(service.acceptTrade('r1', 't1')).rejects.toThrow(
        'У відправника недостатньо коштів.',
      );
    });

    it('throws BadRequestException if receiver lacks request funds during transaction', async () => {
      const trade = {
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        offerAmount: 10,
        offerCurrency: 'SOFT',
        requestAmount: 5,
        requestCurrency: 'HARD',
        status: 'PENDING',
      };

      prismaMock.trade.findUnique.mockResolvedValue(trade);

      const txMock = {
        wallet: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        trade: { update: jest.fn() },
      };

      txMock.wallet.findUnique.mockImplementation(({ where }: any) => {
        if (where.userId === trade.senderId) return { soft: 100, hard: 0 };
        if (where.userId === trade.receiverId)
          return { soft: 0, hard: 0 };
        return null;
      });

      prismaMock.$transaction.mockImplementation(async (cb: any) =>
        cb(txMock),
      );

      await expect(service.acceptTrade('r1', 't1')).rejects.toThrow(
        'У вас недостатньо хард-валюти.',
      );
    });
  });

  describe('rejectTrade', () => {
    it('throws NotFoundException if trade does not exist', async () => {
      prismaMock.trade.findUnique.mockResolvedValue(null);

      await expect(service.rejectTrade('u1', 't1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException if user has no access to trade', async () => {
      prismaMock.trade.findUnique.mockResolvedValue({
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        status: 'PENDING',
      });

      await expect(service.rejectTrade('u2', 't1')).rejects.toThrow(
        'Ви не маєте доступу до цього обміну.',
      );
    });

    it('cancels trade: sender cancels and receiver is notified', async () => {
      prismaMock.trade.findUnique.mockResolvedValue({
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        status: 'PENDING',
      });
      prismaMock.trade.update.mockResolvedValue({
        id: 't1',
        status: 'CANCELLED',
      });

      const result = await service.rejectTrade('s1', 't1');
      expect(result).toMatchObject({ id: 't1', status: 'CANCELLED' });

      expect(prismaMock.trade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: { status: 'CANCELLED' },
        }),
      );

      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'error',
          title: 'Обмін скасовано',
          message: 'Відправник скасував пропозицію обміну.',
        }),
      );
    });

    it('rejects trade: receiver rejects and sender is notified', async () => {
      prismaMock.trade.findUnique.mockResolvedValue({
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        status: 'PENDING',
      });
      prismaMock.trade.update.mockResolvedValue({
        id: 't1',
        status: 'REJECTED',
      });

      const result = await service.rejectTrade('r1', 't1');
      expect(result).toMatchObject({ id: 't1', status: 'REJECTED' });

      expect(prismaMock.trade.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: { status: 'REJECTED' },
        }),
      );

      expect(emitMock).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({
          type: 'error',
          title: 'Обмін скасовано',
          message: 'Одержувач відхилив вашу пропозицію обміну.',
        }),
      );
    });

    it('throws BadRequestException when trade is not PENDING', async () => {
      prismaMock.trade.findUnique.mockResolvedValue({
        id: 't1',
        senderId: 's1',
        receiverId: 'r1',
        status: 'ACCEPTED',
      });

      await expect(service.rejectTrade('r1', 't1')).rejects.toThrow(
        'Обмін вже має статус: ACCEPTED.',
      );
    });
  });
});
