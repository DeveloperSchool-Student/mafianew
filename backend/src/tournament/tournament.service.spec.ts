import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TournamentService } from './tournament.service';

describe('TournamentService', () => {
  let service: TournamentService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      tournament: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      tournamentParticipant: { create: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
      wallet: { findUnique: jest.fn(), update: jest.fn() },
    };

    service = new TournamentService(prismaMock as any);
  });

  describe('joinTournament', () => {
    it('throws BadRequestException when registration is closed', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'ACTIVE',
        participants: [],
        maxParticipants: 16,
        entryFee: 0,
      });

      await expect(
        service.joinTournament('u1', 'alice', 't1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when tournament is cancelled', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'CANCELLED',
        participants: [],
        maxParticipants: 16,
        entryFee: 0,
      });

      await expect(
        service.joinTournament('u1', 'alice', 't1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when tournament is full', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'REGISTRATION',
        participants: new Array(16).fill(null).map((_, i) => ({ userId: `u${i}` })),
        maxParticipants: 16,
        entryFee: 0,
      });

      await expect(
        service.joinTournament('u1', 'alice', 't1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates participant on success during registration', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'REGISTRATION',
        participants: [{ userId: 'other' }],
        maxParticipants: 16,
        entryFee: 0,
      });

      prismaMock.tournamentParticipant.create.mockResolvedValue({ id: 'p1' });

      const result = await service.joinTournament('u1', 'alice', 't1');
      expect(prismaMock.tournamentParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tournamentId: 't1', userId: 'u1', username: 'alice' },
        }),
      );
      expect(result).toMatchObject({ id: 'p1' });
    });
  });

  describe('startTournament', () => {
    it('throws ForbiddenException when staff power is insufficient', async () => {
      await expect(
        service.startTournament(
          { id: 'staff1', staffRoleKey: 'MOD' },
          't1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('transitions tournament to ACTIVE and activates participants', async () => {
      const startedAt = new Date('2026-01-01T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(startedAt);

      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'REGISTRATION',
        participants: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u4' }],
      });

      prismaMock.tournamentParticipant.updateMany.mockResolvedValue({ count: 4 });
      prismaMock.tournament.update.mockResolvedValue({ id: 't1', status: 'ACTIVE' });

      const result = await service.startTournament(
        { id: 'owner1', staffRoleKey: 'OWNER' },
        't1',
      );

      expect(prismaMock.tournamentParticipant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: 't1' },
          data: { status: 'ACTIVE' },
        }),
      );

      expect(prismaMock.tournament.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: { status: 'ACTIVE', startedAt: expect.any(Date) },
        }),
      );

      expect(result).toMatchObject({ id: 't1', status: 'ACTIVE' });
    });
  });
});

