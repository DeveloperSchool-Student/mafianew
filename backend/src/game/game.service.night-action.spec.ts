import { GamePhase, RoleType } from './game.types';
import { GameService } from './game.service';

describe('GameService.handleNightAction', () => {
  const makeState = (partial: Partial<any> = {}) =>
    ({
      roomId: 'room1',
      phase: GamePhase.NIGHT,
      players: [],
      timerMs: 0,
      dayCount: 1,
      nightActions: new Map(),
      votes: new Map(),
      bets: new Map(),
      logs: [],
      ...partial,
    }) as any;

  let service: GameService;

  beforeEach(() => {
    const prismaMock = {} as any;
    const redisMock = { getClient: jest.fn() } as any;
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

  it('returns false for illegal role-action pair', async () => {
    const state = makeState({
      players: [
        {
          userId: 'p1',
          username: 'mafiaGuy',
          role: RoleType.MAFIA,
          isAlive: true,
        },
        {
          userId: 't1',
          username: 'target',
          role: RoleType.CITIZEN,
          isAlive: true,
        },
      ],
      nightActions: new Map(),
    });

    jest.spyOn(service, 'getGameState').mockResolvedValue(state);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);
    const checkSpy = jest
      .spyOn(service as any, 'checkEarlyNightEnd')
      .mockResolvedValue(undefined);

    // Doctor action is illegal for MAFIA
    const res = await service.handleNightAction('room1', 'p1', 't1', 'HEAL');
    expect(res).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it('returns false when actor is blocked by Escort (BLOCK targeting actor)', async () => {
    const state = makeState({
      players: [
        {
          userId: 'actor',
          username: 'mafiaGuy',
          role: RoleType.MAFIA,
          isAlive: true,
        },
        {
          userId: 'target',
          username: 'target',
          role: RoleType.CITIZEN,
          isAlive: true,
        },
      ],
      nightActions: new Map([
        [
          'escort',
          {
            type: 'BLOCK',
            targetId: 'actor', // escort blocks the actor
          },
        ],
      ]),
    });

    jest.spyOn(service, 'getGameState').mockResolvedValue(state);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);
    const checkSpy = jest
      .spyOn(service as any, 'checkEarlyNightEnd')
      .mockResolvedValue(undefined);

    const res = await service.handleNightAction(
      'room1',
      'actor',
      'target',
      'KILL',
    );
    expect(res).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it('accepts legal action and writes proper nightActions entry (KILL)', async () => {
    const state = makeState({
      players: [
        {
          userId: 'mafia1',
          username: 'mafiaGuy',
          role: RoleType.MAFIA,
          isAlive: true,
        },
        {
          userId: 'target1',
          username: 'target',
          role: RoleType.CITIZEN,
          isAlive: true,
        },
      ],
      nightActions: new Map(),
    });

    jest.spyOn(service, 'getGameState').mockResolvedValue(state);
    const saveSpy = jest
      .spyOn(service, 'saveGameState')
      .mockResolvedValue(undefined);
    const checkSpy = jest
      .spyOn(service as any, 'checkEarlyNightEnd')
      .mockResolvedValue(undefined);

    const res = await service.handleNightAction(
      'room1',
      'mafia1',
      'target1',
      'KILL',
    );
    expect(res).toBe(true);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(checkSpy).toHaveBeenCalledTimes(1);

    expect(state.nightActions.get('__mafia_kill__')).toEqual({
      type: 'KILL',
      targetId: 'target1',
    });
  });
});

