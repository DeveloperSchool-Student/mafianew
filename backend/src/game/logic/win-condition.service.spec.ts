import { WinConditionService } from './win-condition.service';
import { GameState, RoleType } from '../game.types';

describe('WinConditionService.determineWinner', () => {
  const service = new WinConditionService();

  const state = (players: any[]): GameState =>
    ({
      roomId: 'room1',
      phase: 'END_GAME' as any,
      players,
      timerMs: 0,
      dayCount: 1,
      nightActions: new Map(),
      votes: new Map(),
      bets: new Map(),
      logs: [],
    }) as any;

  it('returns DRAW when there are no alive players', () => {
    const result = service.determineWinner(
      state([
        { userId: 'u1', isAlive: false, role: RoleType.MAFIA },
        { userId: 'u2', isAlive: false, role: RoleType.CITIZEN },
      ]),
    );
    expect(result).toBe('DRAW');
  });

  it('returns MIRNІ (civilians win) when there are alive civilians only', () => {
    const result = service.determineWinner(
      state([{ userId: 'u1', isAlive: true, role: RoleType.CITIZEN }]),
    );
    expect(result).toBe('МИРНІ');
  });

  it('returns MAFIA when mafias are at least civilians + maniacs', () => {
    const result = service.determineWinner(
      state([
        { userId: 'm1', isAlive: true, role: RoleType.MAFIA },
        { userId: 'm2', isAlive: true, role: RoleType.DON },
        { userId: 'c1', isAlive: true, role: RoleType.CITIZEN },
      ]),
    );
    // alive=3, mafias=2, maniacs=0, civilians=1 => mafias >= civilians + maniacs
    expect(result).toBe('МАФІЯ');
  });

  it('returns MANIAC when maniacs > 0, alive.length <= 2 and mafias === 0', () => {
    const result = service.determineWinner(
      state([
        { userId: 'j1', isAlive: true, role: RoleType.SERIAL_KILLER },
        { userId: 'c1', isAlive: true, role: RoleType.CITIZEN },
      ]),
    );
    expect(result).toBe('МАНІЯК');
  });

  it('returns null when no win condition matches', () => {
    const result = service.determineWinner(
      state([
        { userId: 'm1', isAlive: true, role: RoleType.MAFIA },
        { userId: 'c1', isAlive: true, role: RoleType.CITIZEN },
        { userId: 'c2', isAlive: true, role: RoleType.CITIZEN },
      ]),
    );
    expect(result).toBe(null);
  });
});

