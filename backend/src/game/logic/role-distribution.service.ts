import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { GameState, RoleType, PlayerState, GamePhase } from '../game.types';

@Injectable()
export class RoleDistributionService {
  distributeRoles(
    roomId: string,
    playersConfig: any[],
    settings: any,
    staffMap: Map<string, any>,
  ): GameState {
    const players: PlayerState[] = playersConfig.map((p) => {
      const staffInfo = staffMap.get(p.userId);
      return {
        userId: p.userId,
        username: p.username,
        role: null,
        isAlive: true,
        canUseAction: true,
        isBot: p.isBot || false,
        staffRoleKey: staffInfo?.staffRoleKey || null,
        staffRoleTitle: (staffInfo?.staffRole as any)?.title || null,
        staffRoleColor: (staffInfo?.staffRole as any)?.color || null,
      };
    });

    const roles: RoleType[] = [];
    const mafiaCount = Math.floor(players.length / 3) || 1;

    let addedMafia = 0;
    if (players.length >= 7 && mafiaCount > 0) {
      roles.push(RoleType.DON);
      addedMafia++;
    }
    while (addedMafia < mafiaCount) {
      roles.push(RoleType.MAFIA);
      addedMafia++;
    }

    roles.push(RoleType.SHERIFF);
    roles.push(RoleType.DOCTOR);

    if (players.length >= 6) roles.push(RoleType.DOCTOR);
    if (players.length >= 7 && settings?.enableJester !== false)
      roles.push(RoleType.JESTER);
    if (players.length >= 8 && settings?.enableEscort !== false)
      roles.push(RoleType.ESCORT);
    if (players.length >= 9 && settings?.enableSerialKiller !== false)
      roles.push(RoleType.SERIAL_KILLER);

    if (settings?.enableLawyer) roles.push(RoleType.LAWYER);
    if (settings?.enableBodyguard) roles.push(RoleType.BODYGUARD);
    if (settings?.enableTracker) roles.push(RoleType.TRACKER);
    if (settings?.enableInformer) roles.push(RoleType.INFORMER);
    if (settings?.enableMayor) roles.push(RoleType.MAYOR);
    if (settings?.enableJudge) roles.push(RoleType.JUDGE);
    if (settings?.enableBomber) roles.push(RoleType.BOMBER);
    if (settings?.enableTrapper) roles.push(RoleType.TRAPPER);
    if (settings?.enableSilencer) roles.push(RoleType.SILENCER);
    if (settings?.enableWhore) roles.push(RoleType.WHORE);
    if (settings?.enableJournalist) roles.push(RoleType.JOURNALIST);
    if (settings?.enableLovers) {
      roles.push(RoleType.LOVERS);
      roles.push(RoleType.LOVERS);
    }

    if (roles.length > players.length) {
      throw new Error(
        `Увімкнено забагато ролей (${roles.length}) для цієї кількості гравців (${players.length}).`,
      );
    }

    while (roles.length < players.length) roles.push(RoleType.CITIZEN);

    for (let i = roles.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach((p, i) => (p.role = roles[i]));

    const state: GameState = {
      roomId,
      phase: GamePhase.ROLE_DISTRIBUTION,
      players,
      timerMs: 10000,
      dayCount: 0,
      nightActions: new Map(),
      votes: new Map(),
      bets: new Map(),
      logs: [],
    };

    return state;
  }
}
