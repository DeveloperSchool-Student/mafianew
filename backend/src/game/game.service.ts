import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Room,
  GameState,
  GamePhase,
  RoleType,
  PlayerState,
  MatchLog,
} from './game.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

import { MatchRecordingService } from './logic/match-recording.service';
import { WinConditionService } from './logic/win-condition.service';
import { SpectatorBetService } from './logic/spectator-bet.service';
import { NightActionResolutionService } from './logic/night-action-resolution.service';
import { VotingResolutionService } from './logic/voting-resolution.service';
import { RoleDistributionService } from './logic/role-distribution.service';

@Injectable()
export class GameService implements OnModuleInit {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private matchRecording: MatchRecordingService,
    private winCondition: WinConditionService,
    private spectatorBet: SpectatorBetService,
    private nightActionResolution: NightActionResolutionService,
    private votingResolution: VotingResolutionService,
    private roleDistribution: RoleDistributionService,
  ) {}

  onModuleInit() {
    // We could restore intervals here if we wanted robust server restarts,
    // but for now we'll just rely on the in-memory intervals map.
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.redis.get<Room>(`room:${roomId}`);
  }

  async saveRoom(room: Room): Promise<void> {
    await this.redis.set(`room:${room.id}`, room, 60 * 60 * 2); // 2 hours TTL
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.redis.delete(`room:${roomId}`);
  }

  async getGameState(roomId: string): Promise<GameState | null> {
    const stateStr = await this.redis
      .getClient()
      .hget(`game:${roomId}`, 'state');
    if (!stateStr) return null;

    try {
      const state = JSON.parse(stateStr) as GameState;

      // Map serialization workaround
      if (state.nightActions && Array.isArray(state.nightActions)) {
        state.nightActions = new Map(state.nightActions);
      } else {
        state.nightActions = new Map();
      }
      if (state.votes && Array.isArray(state.votes)) {
        state.votes = new Map(state.votes);
      } else {
        state.votes = new Map();
      }
      if (state.bets && Array.isArray(state.bets)) {
        state.bets = new Map(state.bets);
      } else {
        state.bets = new Map();
      }
      return state;
    } catch {
      return null;
    }
  }

  async saveGameState(state: GameState): Promise<void> {
    // Map serialization workaround
    const stateToSave = {
      ...state,
      nightActions: Array.from((state.nightActions || new Map()).entries()),
      votes: Array.from((state.votes || new Map()).entries()),
      bets: Array.from((state.bets || new Map()).entries()),
    };
    await this.redis
      .getClient()
      .hset(`game:${state.roomId}`, 'state', JSON.stringify(stateToSave));
    await this.redis.getClient().expire(`game:${state.roomId}`, 60 * 60 * 3); // 3 hours TTL
  }

  async deleteGameState(roomId: string): Promise<void> {
    await this.redis.delete(`game:${roomId}`);
  }

  async findActiveGameForUser(userId: string): Promise<string | null> {
    // In a real large-scale app, we'd maintain a user -> roomId mapping in Redis
    // For now, we scan all active game keys, which is okay for moderate scale
    const keys = await this.redis.getClient().keys('game:*');
    for (const key of keys) {
      const roomId = key.replace('game:', '');
      const state = await this.getGameState(roomId);
      if (state && state.phase !== GamePhase.END_GAME) {
        if (state.players.find((p) => p.userId === userId)) {
          return roomId;
        }
      }
    }
    return null;
  }

  async findActiveLobbyForUser(userId: string): Promise<string | null> {
    const keys = await this.redis.getClient().keys('room:*');
    for (const key of keys) {
      const roomId = key.replace('room:', '');
      const room = await this.getRoom(roomId);
      if (
        room &&
        room.status === 'WAITING_LOBBY' &&
        room.players.find((p) => p.userId === userId)
      ) {
        return room.id;
      }
    }
    return null;
  }

  async createRoom(
    hostId: string,
    username: string,
    type: 'CASUAL' | 'RANKED' | 'TOURNAMENT' = 'CASUAL',
  ): Promise<string> {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const profile = await this.prisma.profile.findUnique({
      where: { userId: hostId },
    });
    const level = profile?.level || 1;
    const avatarUrl = profile?.avatarUrl || undefined;

    if (type === 'RANKED' && level < 5) {
      throw new Error('Для RANKED кімнати потрібен мінімум 5-й рівень.');
    }

    const room: Room = {
      id: roomId,
      hostId,
      type,
      players: [{ userId: hostId, username, isReady: false, level, avatarUrl }],
      status: 'WAITING_LOBBY',
      settings: {
        dayTimerMs: 60000,
        nightTimerMs: 30000,
        enableSerialKiller: true,
        enableEscort: true,
        enableJester: true,
      },
    };
    await this.saveRoom(room);
    return roomId;
  }

  async updateRoomSettings(
    roomId: string,
    userId: string,
    settings: Partial<Room['settings']>,
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room || room.hostId !== userId || room.status !== 'WAITING_LOBBY')
      return false;
    room.settings = { ...room.settings, ...settings } as Room['settings'];
    await this.saveRoom(room);
    return true;
  }

  async joinRoom(
    roomId: string,
    userId: string,
    username: string,
  ): Promise<{ room: Room; warnings: string[] } | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const level = profile?.level || 1;
    const avatarUrl = profile?.avatarUrl || undefined;

    if (room.type === 'RANKED' && level < 5) {
      throw new Error('Для RANKED кімнати потрібен мінімум 5-й рівень.');
    }

    const warnings: string[] = [];
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fingerprint: true },
    });
    if (currentUser?.fingerprint) {
      const otherPlayerIds = room.players
        .map((p) => p.userId)
        .filter((id) => id !== userId);
      if (otherPlayerIds.length > 0) {
        const matchedUsers = await this.prisma.user.findMany({
          where: {
            id: { in: otherPlayerIds },
            fingerprint: currentUser.fingerprint,
          },
          select: { username: true },
        });
        if (matchedUsers.length > 0) {
          warnings.push(
            `Гравець ${username} та ${matchedUsers.map((u) => u.username).join(', ')} мають однаковий fingerprint у кімнаті ${roomId}!`,
          );
        }
      }
    }

    if (room.status === 'IN_PROGRESS') {
      const state = await this.getGameState(roomId);
      if (state && !state.players.find((p) => p.userId === userId)) {
        const spectatorUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { staffRoleKey: true, staffRole: true },
        });
        state.players.push({
          userId,
          username,
          role: null,
          isAlive: false,
          canUseAction: false,
          isSpectator: true,
          staffRoleKey: spectatorUser?.staffRoleKey || null,
          staffRoleTitle: (spectatorUser?.staffRole as any)?.title || null,
          staffRoleColor: (spectatorUser?.staffRole as any)?.color || null,
        });
        await this.saveGameState(state);
      }
      return { room, warnings };
    }

    if (!room.players.find((p) => p.userId === userId)) {
      room.players.push({ userId, username, isReady: false, level, avatarUrl });
      await this.saveRoom(room);
    }
    return { room, warnings };
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    room.players = room.players.filter((p) => p.userId !== userId);

    const state = await this.getGameState(roomId);
    if (state) {
      const playerIndex = state.players.findIndex((p) => p.userId === userId);
      if (playerIndex !== -1) {
        const p = state.players[playerIndex];
        if (p.isSpectator) {
          state.players.splice(playerIndex, 1);
        } else if (p.isAlive) {
          p.isAlive = false;
          p.isOnline = false;
          this.pushMatchLog(state, `Гравець ${p.username} покинув гру.`);
        }
        await this.saveGameState(state);
      }
    }

    if (room.players.length === 0) {
      await this.deleteRoom(roomId);
      await this.deleteGameState(roomId);
      this.clearGameInterval(roomId);
      return null;
    }
    if (room.hostId === userId) {
      const randomPlayer =
        room.players[Math.floor(Math.random() * room.players.length)];
      room.hostId = randomPlayer.userId;
    }
    await this.saveRoom(room);
    return room;
  }

  async kickPlayerFromRoom(
    roomId: string,
    hostId: string,
    targetUserId: string,
  ): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (room.hostId !== hostId) return null;
    if (room.status !== 'WAITING_LOBBY') return null;
    if (targetUserId === hostId) return room;

    room.players = room.players.filter((p) => p.userId !== targetUserId);

    if (room.players.length === 0) {
      await this.deleteRoom(roomId);
      await this.deleteGameState(roomId);
      this.clearGameInterval(roomId);
      return null;
    }

    await this.saveRoom(room);
    return room;
  }

  async setPlayerReady(
    roomId: string,
    userId: string,
    isReady: boolean,
  ): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    const p = room.players.find((p) => p.userId === userId);
    if (p) p.isReady = isReady;
    await this.saveRoom(room);
    return room;
  }

  async handlePlayerDisconnect(
    userId: string,
    gatewayEmitCb: (roomId: string, event: string, payload?: any) => void,
  ) {
    const roomId = await this.findActiveGameForUser(userId);
    if (!roomId) return;

    const state = await this.getGameState(roomId);
    if (!state || state.phase === GamePhase.END_GAME) return;

    const player = state.players.find((p) => p.userId === userId);
    if (!player || !player.isAlive) return;

    player.isOnline = false;
    await this.saveGameState(state);
    gatewayEmitCb(
      roomId,
      'game_state_update',
      await this.getFilteredStateForUser(roomId, userId),
    );

    // Note: setTimeout inside a scalable service is anti-pattern if servers restart,
    // but since we only have one node mostly, it's fine for now. Proper way is Redis delayed queues.
    if (this.intervals.has(`disconnect_${userId}`))
      clearTimeout(this.intervals.get(`disconnect_${userId}`));

    const timer = setTimeout(async () => {
      const freshState = await this.getGameState(roomId);
      if (!freshState) return;
      const freshPlayer = freshState.players.find((p) => p.userId === userId);

      if (freshPlayer && freshPlayer.isAlive) {
        freshPlayer.isAlive = false;
        gatewayEmitCb(
          roomId,
          'system_chat',
          `Гравець ${freshPlayer.username} не повернувся до гри і помер.`,
        );

        if (await this.checkWinCondition(freshState, gatewayEmitCb)) {
          await this.saveGameState(freshState);
          return;
        }

        gatewayEmitCb(roomId, 'phase_changed', freshState.phase);
        await this.saveGameState(freshState);
      }
      this.intervals.delete(`disconnect_${userId}`);
    }, 60000);

    this.intervals.set(`disconnect_${userId}`, timer);
  }

  async handlePlayerReconnect(
    roomId: string,
    userId: string,
    gatewayEmitCb?: (roomId: string, event: string, payload?: any) => void,
  ) {
    if (this.intervals.has(`disconnect_${userId}`)) {
      clearTimeout(this.intervals.get(`disconnect_${userId}`));
      this.intervals.delete(`disconnect_${userId}`);
    }

    const state = await this.getGameState(roomId);
    if (state) {
      const player = state.players.find((p) => p.userId === userId);
      if (player && player.isAlive) {
        player.isOnline = true;
        await this.saveGameState(state);
        if (gatewayEmitCb) {
          gatewayEmitCb(
            roomId,
            'game_state_update',
            await this.getFilteredStateForUser(roomId, userId),
          );
        }
      }
    }
  }

  async startGame(
    roomId: string,
    userId: string,
    gatewayEmitCb: (roomId: string, event: string, payload?: any) => void,
  ): Promise<GameState | null> {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'WAITING_LOBBY') return null;
    if (room.hostId !== userId) {
      throw new Error('Тільки хост може запустити гру');
    }
    if (room.players.length < 4) {
      throw new Error('Потрібно мінімум 4 гравці');
    }
    if (!room.players.every((p) => p.isReady)) {
      throw new Error('Не всі гравці готові');
    }

    room.status = 'IN_PROGRESS';
    await this.saveRoom(room);

    // Fetch staff roles for all players
    const playerIds = room.players.map((p) => p.userId);
    const usersWithStaff = await this.prisma.user.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, staffRoleKey: true, staffRole: true },
    });
    const staffMap = new Map(usersWithStaff.map((u) => [u.id, u]));

    // Assign roles
    const state = this.roleDistribution.distributeRoles(
      roomId,
      room.players,
      room.settings,
      staffMap,
    );

    this.pushMatchLog(
      state,
      `Гра почалася. Кількість учасників: ${state.players.length}.`,
    );

    await this.saveGameState(state);

    // Start game loop ticker
    this.startGameLoop(roomId, gatewayEmitCb);

    return state;
  }

  private clearGameInterval(roomId: string) {
    const interval = this.intervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(roomId);
    }
  }

  private startGameLoop(
    roomId: string,
    gatewayEmitCb: (roomId: string, event: string, payload?: any) => void,
  ) {
    // Clear any existing interval for this room
    this.clearGameInterval(roomId);

    // To prevent race conditions in intervals reading/writing to redis,
    // we use a distributed lock or ensure a single ticking instance per room.
    // For simplicity, we keep the interval local to the master node of the room.
    const TICK_RATE = 1000;
    const interval = setInterval(async () => {
      const state = await this.getGameState(roomId);
      if (!state || state.phase === GamePhase.END_GAME) {
        this.clearGameInterval(roomId);
        return;
      }

      state.timerMs -= TICK_RATE;

      if (state.timerMs <= 0) {
        await this.handlePhaseTransition(state, gatewayEmitCb);
      }

      await this.saveGameState(state);

      // Broadcast tick
      gatewayEmitCb(roomId, 'tick', {
        timerMs: state.timerMs,
        phase: state.phase,
      });
    }, TICK_RATE);

    this.intervals.set(roomId, interval);
  }

  private async handlePhaseTransition(
    state: GameState,
    gatewayEmitCb: (roomId: string, event: string, payload?: any) => void,
  ) {
    const room = await this.getRoom(state.roomId);

    switch (state.phase) {
      case GamePhase.ROLE_DISTRIBUTION:
        state.phase = GamePhase.NIGHT;
        state.dayCount += 1;
        state.timerMs = room?.settings?.nightTimerMs || 30000;
        gatewayEmitCb(
          state.roomId,
          'system_chat',
          `Настає ніч ${state.dayCount}. Місто засинає...`,
        );
        this.pushMatchLog(state, `Настає ніч ${state.dayCount}.`);
        break;
      case GamePhase.NIGHT:
        await this.resolveNightActions(state, gatewayEmitCb);
        if (await this.checkWinCondition(state, gatewayEmitCb)) return;

        state.phase = GamePhase.DAY_DISCUSSION;
        state.timerMs = room?.settings?.dayTimerMs || 60000;
        gatewayEmitCb(
          state.roomId,
          'system_chat',
          `Настає ранок. Місто прокидається. Обговорення почалося.`,
        );
        this.pushMatchLog(state, `Настає ранок. Почалося обговорення.`);
        break;
      case GamePhase.DAY_DISCUSSION:
        state.phase = GamePhase.DAY_VOTING;
        state.timerMs = 30000;
        gatewayEmitCb(
          state.roomId,
          'system_chat',
          `Час голосування! Оберіть підозрілого гравця.`,
        );
        this.pushMatchLog(state, `Розпочалося денне голосування.`);
        break;
      case GamePhase.DAY_VOTING:
        await this.resolveVoting(state, gatewayEmitCb);
        if (await this.checkWinCondition(state, gatewayEmitCb)) return;

        if ((state.phase as any) === GamePhase.MAYOR_VETO) {
          // Start veto timer
          state.timerMs = 10000;
          gatewayEmitCb(
            state.roomId,
            'system_chat',
            `Мер має право накласти Вето на страту гравця ${state.players.find((p) => p.userId === state.pendingExecutionId)?.username}. Очікування рішення (10 сек)...`,
          );
        } else if ((state.phase as any) !== GamePhase.END_GAME) {
          state.phase = GamePhase.NIGHT;
          state.dayCount += 1;
          state.timerMs = room?.settings?.nightTimerMs || 30000;
          gatewayEmitCb(
            state.roomId,
            'system_chat',
            `День завершено. Настає Ніч ${state.dayCount}.`,
          );
        }
        break;
      case GamePhase.MAYOR_VETO:
        if (state.pendingExecutionId) {
          gatewayEmitCb(
            state.roomId,
            'system_chat',
            `Мер не використав право Вето. Рішення залишається в силі.`,
          );
          this.pushMatchLog(state, `Мер не використав Вето.`);
          const result = await this.votingResolution.executeVictim(
            state,
            gatewayEmitCb,
            state.pendingExecutionId,
          );
          state.pendingExecutionId = null;

          if (result.jesterWon && result.jesterId) {
            const room = await this.getRoom(state.roomId);
            await this.matchRecording.awardStats(
              room?.type,
              state.players,
              'БЛАЗЕНЬ',
              state.logs,
              result.jesterId,
              state.dayCount,
            );
            this.scheduleReturnToLobby(state, gatewayEmitCb);
            return;
          }
        }
        if (await this.checkWinCondition(state, gatewayEmitCb)) return;

        if ((state.phase as any) !== GamePhase.END_GAME) {
          state.phase = GamePhase.NIGHT;
          state.dayCount += 1;
          state.timerMs = room?.settings?.nightTimerMs || 30000;
          gatewayEmitCb(
            state.roomId,
            'system_chat',
            `День завершено. Настає Ніч ${state.dayCount}.`,
          );
        }
        break;
    }

    // Start bot actions with a tiny delay so they vote/act reasonably
    this.triggerBotActions(state.roomId, state.phase, gatewayEmitCb);

    gatewayEmitCb(state.roomId, 'phase_changed', state.phase);
  }

  private triggerBotActions(
    roomId: string,
    phase: GamePhase,
    gatewayEmitCb: Function,
  ) {
    setTimeout(async () => {
      const state = await this.getGameState(roomId);
      if (!state || state.phase !== phase || state.phase === GamePhase.END_GAME)
        return;

      const bots = state.players.filter((p) => p.isBot && p.isAlive);
      if (bots.length === 0) return;

      // Introduce slight staggered delay
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        setTimeout(
          async () => {
            const currentState = await this.getGameState(roomId);
            if (!currentState || currentState.phase !== phase) return;

            const alivePlayers = currentState.players.filter((p) => p.isAlive);
            const others = alivePlayers.filter((p) => p.userId !== bot.userId);
            const randomTarget =
              others.length > 0
                ? others[Math.floor(Math.random() * others.length)]
                : null;

            if (
              currentState.phase === GamePhase.NIGHT &&
              bot.canUseAction &&
              randomTarget
            ) {
              const rolesThatAct = [
                RoleType.MAFIA,
                RoleType.DON,
                RoleType.SERIAL_KILLER,
                RoleType.SHERIFF,
                RoleType.DOCTOR,
                RoleType.LAWYER,
                RoleType.ESCORT,
                RoleType.BODYGUARD,
                RoleType.TRACKER,
                RoleType.INFORMER,
              ];
              if (bot.role && rolesThatAct.includes(bot.role)) {
                await this.handleNightAction(
                  roomId,
                  bot.userId,
                  randomTarget.userId,
                  bot.role as any,
                );
              }
            } else if (
              currentState.phase === GamePhase.DAY_VOTING &&
              randomTarget
            ) {
              await this.handleVote(roomId, bot.userId, randomTarget.userId);
            }
          },
          1500 * (i + 1) + Math.random() * 2000,
        );
      }
    }, 3000);
  }

  async addBots(roomId: string, count: number): Promise<Room | null> {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'WAITING_LOBBY') return null;

    for (let i = 0; i < count; i++) {
      if (room.players.length >= 15) break;
      const botId = `bot-${Date.now()}-${i}`;
      const botName = `Бот ${Math.floor(Math.random() * 1000)}`;
      room.players.push({
        userId: botId,
        username: botName,
        isReady: true,
        level: 5,
        isBot: true,
        avatarUrl: `https://ui-avatars.com/api/?name=BOT&background=random`,
      });
    }

    await this.saveRoom(room);
    return room;
  }

  private pushMatchLog(state: GameState, text: string) {
    state.logs.push({
      day: state.dayCount,
      phase: state.phase,
      text,
    });
  }

  private async resolveNightActions(state: GameState, gatewayEmitCb: Function) {
    this.nightActionResolution.resolveNightActions(state, gatewayEmitCb);
  }

  private async resolveVoting(state: GameState, gatewayEmitCb: Function) {
    const result = await this.votingResolution.resolveVoting(
      state,
      gatewayEmitCb,
    );

    if (result.jesterWon && result.jesterId) {
      const room = await this.getRoom(state.roomId);
      await this.matchRecording.awardStats(
        room?.type,
        state.players,
        'БЛАЗЕНЬ',
        state.logs,
        result.jesterId,
        state.dayCount,
      );
      this.scheduleReturnToLobby(state, gatewayEmitCb);
    }
  }

  async handleMayorVeto(
    roomId: string,
    userId: string,
    gatewayEmitCb: Function,
  ): Promise<boolean> {
    const state = await this.getGameState(roomId);
    if (!state) return false;

    const success = this.votingResolution.handleMayorVeto(
      state,
      userId,
      gatewayEmitCb,
    );

    if (success) {
      // Skip to next phase (Night) by fast-forwarding the timer
      state.timerMs = 1000;
      await this.saveGameState(state);
    }
    return success;
  }

  private async checkWinCondition(
    state: GameState,
    gatewayEmitCb: Function,
  ): Promise<boolean> {
    const winner = this.winCondition.determineWinner(state);

    if (winner === 'DRAW') {
      state.phase = GamePhase.END_GAME;
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `ГРА ЗАКІНЧЕНА! НІЧИЯ. Усі мертві.`,
      );
      gatewayEmitCb(state.roomId, 'phase_changed', GamePhase.END_GAME);
      this.scheduleReturnToLobby(state, gatewayEmitCb);
      return true;
    }

    if (winner) {
      state.phase = GamePhase.END_GAME;
      gatewayEmitCb(
        state.roomId,
        'system_chat',
        `ГРА ЗАКІНЧЕНА! ПЕРЕМОГА: ${winner}. Меню лоббі буде відкрито через 10 секунд.`,
      );
      gatewayEmitCb(state.roomId, 'phase_changed', GamePhase.END_GAME);

      const room = await this.getRoom(state.roomId);
      await this.matchRecording.awardStats(
        room?.type,
        state.players,
        winner,
        state.logs,
        undefined,
        state.dayCount,
      );

      await this.spectatorBet.resolveBets(state, winner, gatewayEmitCb);

      this.scheduleReturnToLobby(state, gatewayEmitCb);
      return true;
    }
    return false;
  }

  private scheduleReturnToLobby(state: GameState, gatewayEmitCb: Function) {
    this.clearGameInterval(state.roomId);
    setTimeout(async () => {
      const room = await this.getRoom(state.roomId);
      if (room) {
        room.status = 'WAITING_LOBBY';
        room.players.forEach((p) => (p.isReady = false));
        await this.saveRoom(room);
        gatewayEmitCb(state.roomId, 'game_ended', { roomId: state.roomId });
        gatewayEmitCb(state.roomId, 'room_updated', room);
      }
      await this.deleteGameState(state.roomId);
    }, 10000);
  }

  private async awardStats(
    roomId: string,
    players: PlayerState[],
    winner: string,
    logs: MatchLog[],
    jesterId?: string,
    dayCount?: number,
  ) {
    const room = await this.getRoom(roomId);
    await this.matchRecording.awardStats(
      room?.type,
      players,
      winner,
      logs,
      jesterId,
      dayCount,
    );
  }

  async handleNightAction(
    roomId: string,
    userId: string,
    targetId: string,
    actionType: string,
  ): Promise<boolean> {
    const state = await this.getGameState(roomId);
    if (!state || state.phase !== GamePhase.NIGHT) return false;

    const player = state.players.find((p) => p.userId === userId);
    const target = state.players.find((p) => p.userId === targetId);
    if (!player || !target || !player.isAlive || !target.isAlive) return false;

    // Prevent self-targeting
    if (userId === targetId) return false;

    // Validate role-action pairs
    const allowedActions: Record<string, string[]> = {
      [RoleType.MAFIA]: ['KILL'],
      [RoleType.DON]: ['KILL', 'CHECK_DON'],
      [RoleType.DOCTOR]: ['HEAL'],
      [RoleType.SHERIFF]: ['CHECK', 'SHERIFF_KILL'],
      [RoleType.ESCORT]: ['BLOCK'],
      [RoleType.SERIAL_KILLER]: ['KILL_SERIAL'],
      [RoleType.LAWYER]: ['DEFEND'],
      [RoleType.BODYGUARD]: ['GUARD'],
      [RoleType.TRACKER]: ['TRACK'],
      [RoleType.INFORMER]: ['INFORM'],
      [RoleType.BOMBER]: ['BOMB'],
      [RoleType.TRAPPER]: ['TRAP'],
      [RoleType.SILENCER]: ['SILENCE'],
    };
    const allowed = allowedActions[player.role || ''];
    if (!allowed || !allowed.includes(actionType)) return false;

    // Check if player is already blocked by Escort this night
    for (const [, action] of state.nightActions.entries()) {
      if (action.type === 'BLOCK' && action.targetId === userId) {
        return false; // Blocked by Escort — action rejected
      }
    }

    // For KILL actions by MAFIA/DON, use a shared "mafia_kill" slot
    // so multiple mafia members agree on a single target
    if (actionType === 'KILL') {
      state.nightActions.set('__mafia_kill__', { type: 'KILL', targetId });
    } else if (actionType === 'CHECK_DON') {
      state.nightActions.set('__don_check__', { type: 'CHECK_DON', targetId });
    } else {
      state.nightActions.set(userId, { type: actionType, targetId });
    }

    await this.saveGameState(state);

    // Check if all expected actions are received (reads fresh state from Redis)
    await this.checkEarlyNightEnd(roomId);

    return true;
  }

  async handleWhisper(
    roomId: string,
    senderId: string,
    targetId: string,
    message: string,
    emitToUser: (userId: string, event: string, payload: any) => void,
  ): Promise<boolean> {
    const state = await this.getGameState(roomId);
    if (!state) return false;
    if (
      state.phase !== GamePhase.DAY_DISCUSSION &&
      state.phase !== GamePhase.DAY_VOTING
    )
      return false;

    const sender = state.players.find((p) => p.userId === senderId);
    const target = state.players.find((p) => p.userId === targetId);

    if (!sender || !target || !sender.isAlive || !target.isAlive) return false;

    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId: senderId },
      });
      if (profile?.mutedUntil && new Date(profile.mutedUntil) > new Date()) {
        return false;
      }

      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: senderId },
      });
      if (!wallet || wallet.soft < 10) return false;

      await this.prisma.wallet.update({
        where: { userId: senderId },
        data: { soft: { decrement: 10 } },
      });

      // Send to target
      emitToUser(targetId, 'chat_message', {
        sender: `Шепіт від ${sender.username}`,
        text: message,
        type: 'system',
      });
      // Send to sender
      emitToUser(
        senderId,
        'system_chat',
        `Ви шепнули гравцю ${target.username}: "${message}" (списано 10 монет)`,
      );

      return true;
    } catch (e) {
      console.error('Whisper failed', e);
      return false;
    }
  }

  async handleAdminAction(
    adminUsername: string,
    targetUsername: string,
    action: 'KICK' | 'BAN' | 'MUTE',
    emitToUser: (userId: string, event: string, payload: any) => void,
    forceDisconnect: (userId: string) => void,
  ) {
    if (adminUsername !== 'ADMIN') return false;

    try {
      const targetUser = await this.prisma.user.findUnique({
        where: { username: targetUsername },
      });
      if (!targetUser) return false;

      if (action === 'BAN' || action === 'MUTE') {
        const until = new Date();
        until.setDate(until.getDate() + 7);
        await this.prisma.profile.update({
          where: { userId: targetUser.id },
          data:
            action === 'BAN' ? { bannedUntil: until } : { mutedUntil: until },
        });
      }

      if (action === 'KICK' || action === 'BAN') {
        emitToUser(
          targetUser.id,
          'error',
          action === 'BAN'
            ? 'Ви отримали БАН від адміністратора (7 днів).'
            : 'Вас кікнуто адміністратором.',
        );
        const roomId1 = await this.findActiveGameForUser(targetUser.id);
        if (roomId1) await this.leaveRoom(roomId1, targetUser.id);

        const roomId2 = await this.findActiveLobbyForUser(targetUser.id);
        if (roomId2) await this.leaveRoom(roomId2, targetUser.id);

        forceDisconnect(targetUser.id);
      } else if (action === 'MUTE') {
        emitToUser(
          targetUser.id,
          'error',
          'Вам заборонено писати в чат на 7 днів.',
        );
      }

      return true;
    } catch (e) {
      console.error('Admin action failed', e);
      return false;
    }
  }

  private async checkEarlyNightEnd(roomId: string) {
    const state = await this.getGameState(roomId);
    if (!state || state.phase !== GamePhase.NIGHT) return;

    let expectedActions = 0;
    let receivedActions = 0;

    const alive = state.players.filter((p: PlayerState) => p.isAlive);

    let hasActiveMafia = false;
    let hasActiveDon = false;

    const nightActingRoles = new Set([
      RoleType.DOCTOR,
      RoleType.SHERIFF,
      RoleType.ESCORT,
      RoleType.SERIAL_KILLER,
      RoleType.LAWYER,
      RoleType.BODYGUARD,
      RoleType.TRACKER,
      RoleType.INFORMER,
      RoleType.BOMBER,
      RoleType.TRAPPER,
      RoleType.SILENCER,
    ]);

    alive.forEach((p: PlayerState) => {
      if (p.role === RoleType.MAFIA || p.role === RoleType.DON) {
        hasActiveMafia = true;
        if (p.role === RoleType.DON) hasActiveDon = true;
      } else if (p.role && nightActingRoles.has(p.role)) {
        expectedActions++;
        if (state.nightActions.has(p.userId)) receivedActions++;
      }
    });

    if (hasActiveMafia) {
      expectedActions++;
      if (state.nightActions.has('__mafia_kill__')) receivedActions++;
    }

    if (hasActiveDon) {
      expectedActions++;
      if (state.nightActions.has('__don_check__')) receivedActions++;
    }

    if (receivedActions >= expectedActions) {
      // Everyone acted! Fast forward the timer.
      state.timerMs = 0; // The ticker will pick this up on the next second and advance the phase
    }
  }

  async handleVote(roomId: string, userId: string, targetId: string) {
    const state = await this.getGameState(roomId);
    if (!state || state.phase !== GamePhase.DAY_VOTING) return false;

    if (userId === targetId && targetId !== 'SKIP') return false; // Prevent self-voting

    const player = state.players.find((p: PlayerState) => p.userId === userId);
    if (!player || !player.isAlive) return false;

    if (player.isSilenced) {
      return false; // Can't vote if silenced
    }

    // Skip logic vs Player target
    if (targetId !== 'SKIP') {
      const target = state.players.find(
        (p: PlayerState) => p.userId === targetId,
      );
      if (!target || !target.isAlive) return false;
    }

    // Prevent duplicate voting - once voted, cannot change
    if (state.votes.has(userId)) {
      return false;
    }

    state.votes.set(userId, targetId);
    await this.saveGameState(state);
    return true;
  }

  async getFilteredStateForUser(roomId: string, userId: string) {
    const state = await this.getGameState(roomId);
    if (!state) return null;

    const me = state.players.find((p) => p.userId === userId);
    const isMafia = me?.role === RoleType.MAFIA || me?.role === RoleType.DON;
    const isGameOver = state.phase === GamePhase.END_GAME;
    const isDeadOrSpectator = me && !me.isAlive;

    return {
      phase: state.phase,
      timerMs: state.timerMs,
      dayCount: state.dayCount,
      bets: Array.from(state.bets.entries()).map(([k, v]) => ({
        userId: k,
        faction: v.faction,
        amount: v.amount,
      })),
      votes: Array.from(state.votes.entries()).map(([k, v]) => ({
        voterId: k,
        targetId: v,
      })), // Expose votes publicly during day
      players: state.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        isAlive: p.isAlive,
        isSpectator: p.isSpectator,
        staffRoleKey: p.staffRoleKey || null,
        staffRoleTitle: p.staffRoleTitle || null,
        staffRoleColor: p.staffRoleColor || null,
        role:
          isGameOver || // Reveal all roles when game is over
          isDeadOrSpectator || // Dead or spectators see everything
          !p.isAlive || // Dead players' roles are revealed to everyone
          p.userId === userId || // See your own role
          (isMafia && (p.role === RoleType.MAFIA || p.role === RoleType.DON)) // Mafia see each other
            ? p.role
            : null,
      })),
    };
  }

  async placeBet(
    roomId: string,
    userId: string,
    faction: string,
    amount: number,
  ): Promise<{ success: boolean; error?: string }> {
    const state = await this.getGameState(roomId);
    if (!state) return { success: false, error: 'Гра не знайдена.' };

    const player = state.players.find((p) => p.userId === userId);
    if (player && player.isAlive) {
      return { success: false, error: 'Живі гравці не можуть робити ставки.' };
    }

    if (state.bets.has(userId)) {
      return { success: false, error: 'Ви вже зробили ставку.' };
    }

    if (amount < 10 || amount > 1000) {
      return {
        success: false,
        error: 'Некоректна сума ставки (від 10 до 1000).',
      };
    }

    const validFactions = ['МИРНІ', 'МАФІЯ', 'МАНІЯК'];
    if (!validFactions.includes(faction)) {
      return { success: false, error: 'Невідома фракція.' };
    }

    // Check and deduct wallet
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.soft < amount) {
      return { success: false, error: 'Недостатньо монет.' };
    }

    await this.prisma.wallet.update({
      where: { userId },
      data: { soft: { decrement: amount } },
    });

    state.bets.set(userId, { faction, amount });
    await this.saveGameState(state);
    return { success: true };
  }
}
