import { Injectable } from '@nestjs/common';
import { GameState, RoleType, GamePhase } from '../game.types';

@Injectable()
export class VotingResolutionService {
  async resolveVoting(
    state: GameState,
    gatewayEmitCb: Function,
  ): Promise<{ jesterWon: boolean; jesterId?: string }> {
    // Anti-AFK Check
    state.players
      .filter((p) => p.isAlive)
      .forEach((p) => {
        if (!state.votes.has(p.userId)) {
          p.afkPhasesCount = (p.afkPhasesCount || 0) + 1;
        } else {
          p.afkPhasesCount = 0;
        }

        if (p.afkPhasesCount >= 2) {
          p.isAlive = false;
          gatewayEmitCb(
            state.roomId,
            'system_chat',
            `Гравець ${p.username} вчинив самогубство через відсутність активності (AFK).`,
          );
        }
      });

    // If everyone died from AFK, or win condition met, stop voting resolution
    if (state.players.filter((p) => p.isAlive).length <= 0) {
      return { jesterWon: false };
    }

    if (state.votes.size === 0) {
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `Ніхто не проголосував. Нікого не страчено.`,
      );
      return { jesterWon: false };
    }

    const voteCounts: Record<string, number> = {};
    for (const [voterId, targetId] of state.votes.entries()) {
      const voter = state.players.find((p) => p.userId === voterId);
      const target =
        targetId === 'SKIP'
          ? 'пропуск'
          : state.players.find((p) => p.userId === targetId)?.username || targetId;
      if (voter) {
        this.pushMatchLog(state, `${voter.username} проголосував за ${target}.`);
      }
      let power = 1;
      if (voter?.role === RoleType.MAYOR) power = 2;
      if (voter?.role === RoleType.JUDGE) power = 3;
      voteCounts[targetId] = (voteCounts[targetId] || 0) + power;
    }

    let maxVotes = 0;
    let executedId: string | null = null;
    let tie = false;

    for (const [targetId, votes] of Object.entries(voteCounts)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        executedId = targetId;
        tie = false;
      } else if (votes === maxVotes) {
        tie = true;
      }
    }

    let result = { jesterWon: false };

    if (!tie && executedId && executedId !== 'SKIP') {
      const mayor = state.players.find(
        (p) => p.role === RoleType.MAYOR && p.isAlive,
      );
      if (mayor && !state.mayorVetoUsed) {
        state.pendingExecutionId = executedId;
        state.phase = GamePhase.MAYOR_VETO;
        gatewayEmitCb(state.roomId, 'veto_available', { targetId: executedId });
      } else {
        result = await this.executeVictim(state, gatewayEmitCb, executedId);
      }
    } else if (!tie && executedId === 'SKIP') {
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `Більшість проголосувала за пропуск голосування. Нікого не страчено.`,
      );
      this.pushMatchLog(state, `Більшість проголосувала за пропуск голосування.`);
    } else {
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `Голоси розділилися порівну. Нікого не страчено.`,
      );
      this.pushMatchLog(state, `Голоси розділилися порівну. Нікого не страчено.`);
    }

    state.votes.clear();
    return result;
  }

  async executeVictim(
    state: GameState,
    gatewayEmitCb: Function,
    executedId: string,
  ): Promise<{ jesterWon: boolean; jesterId?: string }> {
    const victim = state.players.find((p) => p.userId === executedId);
    if (!victim) return { jesterWon: false };

    victim.isAlive = false;

    if (victim.role === RoleType.JESTER) {
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `Гравець ${victim.username} виявився Блазнем! Він здобув одноосібну ПЕРЕМОГУ!`,
      );
      this.pushMatchLog(
        state,
        `Страчено гравця ${victim.username}. Він виявився Блазнем і переміг!`,
      );
      state.phase = GamePhase.END_GAME;
      gatewayEmitCb(state.roomId, 'phase_changed', GamePhase.END_GAME);
      return { jesterWon: true, jesterId: victim.userId };
    }

    gatewayEmitCb(
      state.roomId,
      'system_chat',
      `За результатами голосування убито ${victim.username}. Його роль: ${victim.role}.`,
    );
    this.pushMatchLog(
      state,
      `За результатами голосування страчено ${victim.username} (${victim.role}).`,
    );

    if (victim.lastWill) {
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `Заповіт гравця ${victim.username}:\n"${victim.lastWill}"`,
      );
    }

    // Check lovers
    if (victim.role === RoleType.LOVERS) {
      state.players.forEach((p) => {
        if (p.role === RoleType.LOVERS && p.isAlive) {
          p.isAlive = false;
          gatewayEmitCb(
            state.roomId,
            'system_chat',
            `Гравець ${p.username} не витримав втрати кохання і вчинив самогубство!`,
          );
        }
      });
    }

    return { jesterWon: false };
  }

  handleMayorVeto(
    state: GameState,
    userId: string,
    gatewayEmitCb: Function,
  ): boolean {
    if (state.phase !== GamePhase.MAYOR_VETO) return false;

    const player = state.players.find((p) => p.userId === userId);
    if (
      player?.role !== RoleType.MAYOR ||
      !player.isAlive ||
      state.mayorVetoUsed
    ) {
      return false;
    }

    state.mayorVetoUsed = true;
    const victim = state.players.find(
      (p) => p.userId === state.pendingExecutionId,
    );

    gatewayEmitCb(
      state.roomId,
      'system_chat',
      `Мер наклав ВЕТО на страту гравця ${victim?.username}! Його звільнено.`,
    );
    this.pushMatchLog(
      state,
      `Мер скасував страту гравця ${victim?.username}.`,
    );

    state.pendingExecutionId = null;
    return true;
  }

  private pushMatchLog(state: GameState, text: string) {
    state.logs.push({
      day: state.dayCount,
      phase: state.phase,
      text,
    });
  }
}
