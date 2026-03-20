import { GamePhase } from './game.types';
import { GameService } from './game.service';

describe('GameService.handleVote', () => {
  const buildState = (partial: Partial<any> = {}) =>
    ({
      roomId: 'room1',
      phase: GamePhase.DAY_VOTING,
      timerMs: 1000,
      dayCount: 1,
      players: [],
      nightActions: new Map(),
      votes: new Map(),
      bets: new Map(),
      logs: [],
      ...partial,
    }) as any;

  let service: GameService;
  let prismaMock: any;
  let redisMock: any;

  beforeEach(() => {
    prismaMock = {};
    redisMock = {
      getClient: jest.fn(),
    };

    // Dependencies are not used by handleVote in these tests
    const dummy = {} as any;

    service = new GameService(
      prismaMock,
      redisMock,
      dummy,
      dummy,
      dummy,
      dummy,
      dummy,
      dummy,
    );
  });

  it('returns false when phase is not DAY_VOTING', async () => {
    const state = buildState({
      phase: GamePhase.NIGHT,
      players: [
        { userId: 'u1', username: 'a', role: null, isAlive: true, canUseAction: false },
        { userId: 'u2', username: 'b', role: null, isAlive: true, canUseAction: false },
      ],
    });

    jest
      .spyOn(service, 'getGameState')
      .mockResolvedValue(state as any);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);

    const res = await service.handleVote('room1', 'u1', 'u2');
    expect(res).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(state.votes.size).toBe(0);
  });

  it('returns false for self-voting (except SKIP)', async () => {
    const state = buildState({
      players: [
        { userId: 'u1', username: 'a', role: null, isAlive: true, canUseAction: false },
      ],
    });

    jest
      .spyOn(service, 'getGameState')
      .mockResolvedValue(state as any);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);

    const res = await service.handleVote('room1', 'u1', 'u1');
    expect(res).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(state.votes.size).toBe(0);
  });

  it('prevents duplicate voting by same user', async () => {
    const state = buildState({
      players: [
        { userId: 'u1', username: 'a', role: null, isAlive: true, canUseAction: false },
        { userId: 'u2', username: 'b', role: null, isAlive: true, canUseAction: false },
      ],
      votes: new Map([['u1', 'u2']]),
    });

    jest
      .spyOn(service, 'getGameState')
      .mockResolvedValue(state as any);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);

    const res = await service.handleVote('room1', 'u1', 'u2');
    expect(res).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(state.votes.size).toBe(1);
  });

  it('accepts first vote and persists game state', async () => {
    const state = buildState({
      players: [
        { userId: 'u1', username: 'a', role: null, isAlive: true, canUseAction: false },
        { userId: 'u2', username: 'b', role: null, isAlive: true, canUseAction: false },
      ],
      votes: new Map(),
    });

    jest
      .spyOn(service, 'getGameState')
      .mockResolvedValue(state as any);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);

    const res = await service.handleVote('room1', 'u1', 'u2');
    expect(res).toBe(true);
    expect(state.votes.get('u1')).toBe('u2');
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});

