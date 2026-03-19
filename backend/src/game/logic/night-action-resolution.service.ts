import { Injectable } from '@nestjs/common';
import { GameState, RoleType, PlayerState } from '../game.types';

@Injectable()
export class NightActionResolutionService {
  resolveNightActions(state: GameState, gatewayEmitCb: Function) {
    let blockedUserId: string | null = null;
    let trappedUserId: string | null = null;
    let silencedUserId: string | null = null;
    let lawyerTargetId: string | null = null;
    let bodyguardTargetId: string | null = null;
    let bombTargetId: string | null = null;

    // Reset silence from previous day
    state.players.forEach((p) => (p.isSilenced = false));

    // 1. Process blocks and traps first
    for (const [userId, action] of state.nightActions.entries()) {
      if (action.type === 'BLOCK') blockedUserId = action.targetId;
      if (action.type === 'TRAP') trappedUserId = action.targetId;
      if (action.type === 'SILENCE') silencedUserId = action.targetId;
      if (action.type === 'DEFEND') lawyerTargetId = action.targetId;
      if (action.type === 'GUARD') bodyguardTargetId = action.targetId;
      if (action.type === 'BOMB') bombTargetId = action.targetId;

      const actorUsername = state.players.find((p) => p.userId === userId)?.username;
      const targetUsername = state.players.find((p) => p.userId === action.targetId)?.username;
      if (actorUsername && targetUsername) {
        this.pushMatchLog(state, `${actorUsername} застосував дію ${action.type} до ${targetUsername}.`);
      }
    }

    if (silencedUserId) {
      const sp = state.players.find((p) => p.userId === silencedUserId);
      if (sp) sp.isSilenced = true;
    }

    let killedByMafia: string | null = null;
    let killedByManiac: string | null = null;
    let healedByDoctor: string | null = null;

    const victims = new Set<string>();

    // 2. Collect other actions
    for (const [userId, action] of state.nightActions.entries()) {
      let isBlocked = userId === blockedUserId;
      // Or did they visit a trapped user?
      if (action.targetId === trappedUserId && action.type !== 'TRAP') {
        isBlocked = true;
      }

      if (isBlocked) {
        gatewayEmitCb(state.roomId, 'private_action_result', {
          userId,
          message: 'Ваша дія була заблокована!',
        });
        continue; // Action blocked
      }

      // Bomber logic: anyone who visits the bomb target dies.
      if (action.targetId === bombTargetId && action.type !== 'BOMB') {
        victims.add(userId);
      }

      if (action.type === 'KILL') killedByMafia = action.targetId;
      if (action.type === 'BOMB') victims.add(action.targetId); // bomb kills target directly
      if (action.type === 'KILL_SERIAL') killedByManiac = action.targetId;
      if (action.type === 'HEAL') healedByDoctor = action.targetId;

      if (action.type === 'CHECK' || action.type === 'CHECK_DON') {
        const target = state.players.find((p) => p.userId === action.targetId);
        const isMaf = (target?.role === RoleType.MAFIA || target?.role === RoleType.DON) && action.targetId !== lawyerTargetId;

        let message = '';
        if (action.type === 'CHECK') {
          message = `Перевірка Комісара: Гравець ${target?.username} - ${isMaf ? 'МАФІЯ' : 'НЕ МАФІЯ'}.`;
          gatewayEmitCb(state.roomId, 'private_action_result', { userId, message });
        } else {
          const isSheriff = target?.role === RoleType.SHERIFF;
          message = `Перевірка Дона: Гравець ${target?.username} - ${isSheriff ? 'ШЕРИФ' : 'НЕ ШЕРИФ'}.`;
          const don = state.players.find((p) => p.role === RoleType.DON && p.isAlive);
          if (don) {
            gatewayEmitCb(state.roomId, 'private_action_result', { userId: don.userId, message });
          }
        }
      }
      if (action.type === 'TRACK') {
        const targetAction = state.nightActions.get(action.targetId);
        const targetName = state.players.find((p) => p.userId === action.targetId)?.username;
        if (targetAction) {
          const visitedName = state.players.find((p) => p.userId === targetAction.targetId)?.username;
          gatewayEmitCb(state.roomId, 'private_action_result', {
            userId,
            message: `${targetName} відвідав гравця ${visitedName}.`,
          });
        } else {
          gatewayEmitCb(state.roomId, 'private_action_result', {
            userId,
            message: `${targetName} нікого не відвідував.`,
          });
        }
      }
      if (action.type === 'INFORM') {
        const target = state.players.find((p) => p.userId === action.targetId);
        gatewayEmitCb(state.roomId, 'private_action_result', {
          userId,
          message: `Роль ${target?.username}: ${target?.role}.`,
        });
      }
      if (action.type === 'COMPARE') {
        const ids = action.targetId.split(',');
        if (ids.length === 2) {
          const p1 = state.players.find((p) => p.userId === ids[0]);
          const p2 = state.players.find((p) => p.userId === ids[1]);

          if (p1 && p2) {
            const getFaction = (role: RoleType | null) => {
              if (role === RoleType.MAFIA || role === RoleType.DON) return 'MAFIA';
              if (role === RoleType.SERIAL_KILLER) return 'MANIAC';
              if (role === RoleType.JESTER) return 'JESTER';
              return 'CITIZEN';
            };
            const result = getFaction(p1.role) === getFaction(p2.role) ? 'ОДНАКОВІ' : 'РІЗНІ';
            gatewayEmitCb(state.roomId, 'private_action_result', {
              userId,
              message: `Журналіст: Гравці ${p1.username} та ${p2.username} - ${result} сторони.`,
            });
          }
        }
      }
      if (action.type === 'SHERIFF_KILL') {
        const target = state.players.find((p) => p.userId === action.targetId);
        const isGuilty = target?.role === RoleType.MAFIA || target?.role === RoleType.DON || target?.role === RoleType.SERIAL_KILLER;
        if (!isGuilty) {
          victims.add(userId);
          gatewayEmitCb(state.roomId, 'private_action_result', {
            userId,
            message: `Ви застрелили невинного гравця і поплатились за це життям!`,
          });
        } else {
          victims.add(action.targetId);
        }
      }
    }

    if (killedByMafia && killedByMafia !== healedByDoctor) {
      if (killedByMafia === bodyguardTargetId) {
        gatewayEmitCb(state.roomId, 'system_chat', `Мафія намагалась вбити, але Охоронець захистив ціль!`);
      } else {
        victims.add(killedByMafia);
      }
    } else if (killedByMafia && killedByMafia === healedByDoctor) {
      gatewayEmitCb(state.roomId, 'system_chat', `Мафія намагалась вбити, але Лікар врятував жертву!`);
    }

    if (killedByManiac && killedByManiac !== healedByDoctor) {
      if (killedByManiac === bodyguardTargetId) {
        gatewayEmitCb(state.roomId, 'system_chat', `Маніяк намагався вбити, але Охоронець захистив ціль!`);
      } else {
        victims.add(killedByManiac);
      }
    }

    // Lovers
    let loversDied = false;
    victims.forEach((vId) => {
      const p = state.players.find((pl) => pl.userId === vId);
      if (p?.role === RoleType.LOVERS) loversDied = true;
    });
    if (loversDied) {
      state.players.forEach((p) => {
        if (p.role === RoleType.LOVERS) victims.add(p.userId);
      });
    }

    if (victims.size > 0) {
      victims.forEach((vId) => {
        const victim = state.players.find((p) => p.userId === vId);
        if (victim) {
          victim.isAlive = false;
          gatewayEmitCb(state.roomId, 'system_chat', `Вночі було вбито гравця ${victim.username}.`);
          this.pushMatchLog(state, `Гравець ${victim.username} помер вночі.`);
          if (victim.lastWill) {
            gatewayEmitCb(state.roomId, 'system_chat', `Заповіт гравця ${victim.username}:\n"${victim.lastWill}"`);
          }
        }
      });
    } else {
      if (!killedByMafia && !killedByManiac) {
        gatewayEmitCb(state.roomId, 'system_chat', `Ця ніч була спокійною. Ніхто не вбивав.`);
        this.pushMatchLog(state, `Вночі ніхто не загинув.`);
      }
    }

    state.nightActions.clear();
  }

  private pushMatchLog(state: GameState, text: string) {
    state.logs.push({
      day: state.dayCount,
      phase: state.phase,
      text,
    });
  }
}
