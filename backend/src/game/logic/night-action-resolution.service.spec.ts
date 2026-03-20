import { NightActionResolutionService } from './night-action-resolution.service';
import { GamePhase, RoleType } from '../game.types';

describe('NightActionResolutionService.resolveNightActions', () => {
  it('emits journalist compare result for same faction', () => {
    const service = new NightActionResolutionService();
    const emitCb = jest.fn();

    const state = {
      roomId: 'room1',
      phase: GamePhase.NIGHT,
      roomType: 'CASUAL',
      timerMs: 0,
      dayCount: 1,
      players: [
        {
          userId: 'journalist',
          username: 'Jill',
          role: RoleType.JOURNALIST,
          isAlive: true,
          canUseAction: false,
          isSilenced: false,
        },
        {
          userId: 'p1',
          username: 'Alice',
          role: RoleType.MAFIA,
          isAlive: true,
          canUseAction: false,
          isSilenced: false,
        },
        {
          userId: 'p2',
          username: 'Bob',
          role: RoleType.DON,
          isAlive: true,
          canUseAction: false,
          isSilenced: false,
        },
      ],
      nightActions: new Map([
        [
          'journalist',
          {
            type: 'COMPARE',
            targetId: 'p1,p2',
          },
        ],
      ]),
      votes: new Map(),
      bets: new Map(),
      logs: [],
    } as any;

    service.resolveNightActions(state, emitCb);

    expect(emitCb).toHaveBeenCalledWith(
      'room1',
      'private_action_result',
      expect.objectContaining({
        userId: 'journalist',
        message:
          'Журналіст: Гравці Alice та Bob - ОДНАКОВІ сторони.',
      }),
    );
    expect(state.nightActions.size).toBe(0);
  });

  it('emits journalist compare result for different factions', () => {
    const service = new NightActionResolutionService();
    const emitCb = jest.fn();

    const state = {
      roomId: 'room1',
      phase: GamePhase.NIGHT,
      timerMs: 0,
      dayCount: 1,
      players: [
        {
          userId: 'journalist',
          username: 'Jill',
          role: RoleType.JOURNALIST,
          isAlive: true,
          canUseAction: false,
          isSilenced: false,
        },
        {
          userId: 'p1',
          username: 'Alice',
          role: RoleType.MAFIA,
          isAlive: true,
          canUseAction: false,
          isSilenced: false,
        },
        {
          userId: 'p2',
          username: 'Bob',
          role: RoleType.CITIZEN,
          isAlive: true,
          canUseAction: false,
          isSilenced: false,
        },
      ],
      nightActions: new Map([
        [
          'journalist',
          {
            type: 'COMPARE',
            targetId: 'p1,p2',
          },
        ],
      ]),
      votes: new Map(),
      bets: new Map(),
      logs: [],
    } as any;

    service.resolveNightActions(state, emitCb);

    expect(emitCb).toHaveBeenCalledWith(
      'room1',
      'private_action_result',
      expect.objectContaining({
        userId: 'journalist',
        message:
          'Журналіст: Гравці Alice та Bob - РІЗНІ сторони.',
      }),
    );
    expect(state.nightActions.size).toBe(0);
  });
});

