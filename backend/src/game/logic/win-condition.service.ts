import { Injectable } from '@nestjs/common';
import { GameState, RoleType } from '../game.types';

@Injectable()
export class WinConditionService {
  determineWinner(state: GameState): string | null {
    const alive = state.players.filter((p) => p.isAlive);
    const mafias = alive.filter(
      (p) => p.role === RoleType.MAFIA || p.role === RoleType.DON,
    ).length;
    const maniacs = alive.filter(
      (p) => p.role === RoleType.SERIAL_KILLER,
    ).length;
    const civilians = alive.length - mafias - maniacs;

    if (alive.length === 0) {
      return 'DRAW';
    }

    if (mafias === 0 && maniacs === 0) return 'МИРНІ';
    if (mafias > 0 && mafias >= civilians + maniacs) return 'МАФІЯ';
    if (maniacs > 0 && alive.length <= 2 && mafias === 0) return 'МАНІЯК';

    return null;
  }
}
