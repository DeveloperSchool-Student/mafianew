import { GamePhase } from './game.types';
import { GameService } from './game.service';

describe('GameService.handlePhaseTransition', () => {
  let service: GameService;
  let emitCb: jest.Mock;

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

    emitCb = jest.fn();

    jest.spyOn(service, 'getRoom').mockResolvedValue({
      id: 'room1',
      type: 'CASUAL',
      status: 'IN_PROGRESS',
      hostId: 'host1',
      players: [],
      settings: { dayTimerMs: 222, nightTimerMs: 111 },
    } as any);

    jest
      .spyOn(service as any, 'resolveNightActions')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'resolveVoting')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'checkWinCondition')
      .mockResolvedValue(false);

    jest
      .spyOn(service as any, 'triggerBotActions')
      .mockImplementation(() => {});
  });

  const baseState = (partial: Partial<any> = {}) =>
    ({
      roomId: 'room1',
      phase: GamePhase.ROLE_DISTRIBUTION,
      players: [],
      timerMs: 0,
      dayCount: 1,
      nightActions: new Map(),
      votes: new Map(),
      bets: new Map(),
      logs: [],
      ...partial,
    }) as any;

  it('transitions ROLE_DISTRIBUTION -> NIGHT and sets night timer', async () => {
    const state = baseState({ phase: GamePhase.ROLE_DISTRIBUTION });

    await (service as any).handlePhaseTransition(state, emitCb);

    expect(state.phase).toBe(GamePhase.NIGHT);
    expect(state.dayCount).toBe(2);
    expect(state.timerMs).toBe(111);
    expect(emitCb).toHaveBeenCalledWith('room1', 'phase_changed', GamePhase.NIGHT);
  });

  it('transitions NIGHT -> DAY_DISCUSSION and sets day timer', async () => {
    const state = baseState({ phase: GamePhase.NIGHT });

    await (service as any).handlePhaseTransition(state, emitCb);

    expect(state.phase).toBe(GamePhase.DAY_DISCUSSION);
    expect(state.dayCount).toBe(1);
    expect(state.timerMs).toBe(222);
    expect(emitCb).toHaveBeenCalledWith(
      'room1',
      'phase_changed',
      GamePhase.DAY_DISCUSSION,
    );
  });

  it('transitions DAY_DISCUSSION -> DAY_VOTING with fixed 30s timer', async () => {
    const state = baseState({ phase: GamePhase.DAY_DISCUSSION });

    await (service as any).handlePhaseTransition(state, emitCb);

    expect(state.phase).toBe(GamePhase.DAY_VOTING);
    expect(state.dayCount).toBe(1);
    expect(state.timerMs).toBe(30000);
    expect(emitCb).toHaveBeenCalledWith(
      'room1',
      'phase_changed',
      GamePhase.DAY_VOTING,
    );
  });

  it('transitions DAY_VOTING -> NIGHT and increments dayCount', async () => {
    const state = baseState({ phase: GamePhase.DAY_VOTING });

    await (service as any).handlePhaseTransition(state, emitCb);

    expect(state.phase).toBe(GamePhase.NIGHT);
    expect(state.dayCount).toBe(2);
    expect(state.timerMs).toBe(111);
    expect(emitCb).toHaveBeenCalledWith('room1', 'phase_changed', GamePhase.NIGHT);
  });
});

