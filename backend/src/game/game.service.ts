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

@Injectable()
export class GameService implements OnModuleInit {
    private intervals: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private prisma: PrismaService,
        private redis: RedisService
    ) { }

    onModuleInit() {
        // We could restore intervals here if we wanted robust server restarts,
        // but for now we'll just rely on the in-memory intervals map.
    }

    async getRoom(roomId: string): Promise<Room | null> {
        return this.redis.get<Room>(`room:${roomId}`);
    }

    async saveRoom(room: Room): Promise<void> {
        await this.redis.set(`room:${room.id}`, room, 60 * 60 * 12); // 12 hours TTL
    }

    async deleteRoom(roomId: string): Promise<void> {
        await this.redis.delete(`room:${roomId}`);
    }

    async getGameState(roomId: string): Promise<GameState | null> {
        const stateStr = await this.redis.getClient().hget(`game:${roomId}`, 'state');
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
        await this.redis.getClient().hset(`game:${state.roomId}`, 'state', JSON.stringify(stateToSave));
        await this.redis.getClient().expire(`game:${state.roomId}`, 60 * 60 * 2); // 2 hours TTL
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



    async createRoom(hostId: string, username: string): Promise<string> {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

        const profile = await this.prisma.profile.findUnique({ where: { userId: hostId } });
        const level = profile?.level || 1;
        const avatarUrl = profile?.avatarUrl || undefined;

        const room: Room = {
            id: roomId,
            hostId,
            players: [{ userId: hostId, username, isReady: false, level, avatarUrl }],
            status: 'WAITING_LOBBY',
            settings: {
                dayTimerMs: 60000,
                nightTimerMs: 30000,
                enableSerialKiller: true,
                enableEscort: true,
                enableJester: true,
            }
        };
        await this.saveRoom(room);
        return roomId;
    }

    async updateRoomSettings(roomId: string, userId: string, settings: Partial<Room['settings']>): Promise<boolean> {
        const room = await this.getRoom(roomId);
        if (!room || room.hostId !== userId || room.status !== 'WAITING_LOBBY') return false;
        room.settings = { ...room.settings, ...settings } as Room['settings'];
        await this.saveRoom(room);
        return true;
    }

    async joinRoom(roomId: string, userId: string, username: string): Promise<Room | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;

        if (room.status === 'IN_PROGRESS') {
            const state = await this.getGameState(roomId);
            if (state && !state.players.find((p) => p.userId === userId)) {
                state.players.push({
                    userId,
                    username,
                    role: null,
                    isAlive: false,
                    canUseAction: false,
                    isSpectator: true,
                });
                await this.saveGameState(state);
            }
            return room;
        }

        if (!room.players.find((p) => p.userId === userId)) {
            const profile = await this.prisma.profile.findUnique({ where: { userId } });
            const level = profile?.level || 1;
            const avatarUrl = profile?.avatarUrl || undefined;
            room.players.push({ userId, username, isReady: false, level, avatarUrl });
            await this.saveRoom(room);
        }
        return room;
    }

    async leaveRoom(roomId: string, userId: string): Promise<Room | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;
        room.players = room.players.filter((p) => p.userId !== userId);
        if (room.players.length === 0) {
            await this.deleteRoom(roomId);
            await this.deleteGameState(roomId);
            this.clearGameInterval(roomId);
            return null;
        }
        if (room.hostId === userId) {
            const randomPlayer = room.players[Math.floor(Math.random() * room.players.length)];
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

    async setPlayerReady(roomId: string, userId: string, isReady: boolean): Promise<Room | null> {
        const room = await this.getRoom(roomId);
        if (!room) return null;
        const p = room.players.find((p) => p.userId === userId);
        if (p) p.isReady = isReady;
        await this.saveRoom(room);
        return room;
    }

    async handlePlayerDisconnect(
        userId: string,
        gatewayEmitCb: (roomId: string, event: string, payload?: any) => void
    ) {
        const roomId = await this.findActiveGameForUser(userId);
        if (!roomId) return;

        const state = await this.getGameState(roomId);
        if (!state || state.phase === GamePhase.END_GAME) return;

        const player = state.players.find((p) => p.userId === userId);
        if (!player || !player.isAlive) return;

        // Note: setTimeout inside a scalable service is anti-pattern if servers restart,
        // but since we only have one node mostly, it's fine for now. Proper way is Redis delayed queues.
        if (this.intervals.has(`disconnect_${userId}`)) clearTimeout(this.intervals.get(`disconnect_${userId}`)!);

        const timer = setTimeout(async () => {
            const freshState = await this.getGameState(roomId);
            if (!freshState) return;
            const freshPlayer = freshState.players.find((p) => p.userId === userId);

            if (freshPlayer && freshPlayer.isAlive) {
                freshPlayer.isAlive = false;
                gatewayEmitCb(
                    roomId,
                    'system_chat',
                    `Гравець ${freshPlayer.username} не повернувся до гри і помер.`
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

    async handlePlayerReconnect(roomId: string, userId: string) {
        if (this.intervals.has(`disconnect_${userId}`)) {
            clearTimeout(this.intervals.get(`disconnect_${userId}`)!);
            this.intervals.delete(`disconnect_${userId}`);
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

        const players: PlayerState[] = room.players.map((p) => ({
            userId: p.userId,
            username: p.username,
            role: null,
            isAlive: true,
            canUseAction: true,
        }));

        // Assign roles
        const roles: RoleType[] = [];
        const mafiaCount = Math.floor(players.length / 3) || 1;

        // Add Mafia / Don
        let addedMafia = 0;
        if (players.length >= 7 && mafiaCount > 0) {
            roles.push(RoleType.DON);
            addedMafia++;
        }
        while (addedMafia < mafiaCount) {
            roles.push(RoleType.MAFIA);
            addedMafia++;
        }

        // Add essential roles
        roles.push(RoleType.SHERIFF);
        roles.push(RoleType.DOCTOR);

        // Add extra roles for large games if enabled
        if (players.length >= 6) roles.push(RoleType.DOCTOR);
        if (players.length >= 7 && room.settings?.enableJester !== false) roles.push(RoleType.JESTER);
        if (players.length >= 8 && room.settings?.enableEscort !== false) roles.push(RoleType.ESCORT);
        if (players.length >= 9 && room.settings?.enableSerialKiller !== false) roles.push(RoleType.SERIAL_KILLER);

        if (room.settings?.enableLawyer) roles.push(RoleType.LAWYER);
        if (room.settings?.enableBodyguard) roles.push(RoleType.BODYGUARD);
        if (room.settings?.enableTracker) roles.push(RoleType.TRACKER);
        if (room.settings?.enableInformer) roles.push(RoleType.INFORMER);
        if (room.settings?.enableMayor) roles.push(RoleType.MAYOR);
        if (room.settings?.enableJudge) roles.push(RoleType.JUDGE);
        if (room.settings?.enableBomber) roles.push(RoleType.BOMBER);
        if (room.settings?.enableTrapper) roles.push(RoleType.TRAPPER);
        if (room.settings?.enableSilencer) roles.push(RoleType.SILENCER);
        if (room.settings?.enableWhore) roles.push(RoleType.WHORE);
        if (room.settings?.enableJournalist) roles.push(RoleType.JOURNALIST);
        if (room.settings?.enableLovers) {
            roles.push(RoleType.LOVERS);
            roles.push(RoleType.LOVERS);
        }

        if (roles.length > players.length) {
            throw new Error(`Увімкнено забагато ролей (${roles.length}) для цієї кількості гравців (${players.length}).`);
        }

        // Fill remaining with Citizens
        while (roles.length < players.length) roles.push(RoleType.CITIZEN);

        // Fisher-Yates shuffle for true randomness
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

        this.pushMatchLog(state, `Гра почалася. Кількість учасників: ${players.length}.`);

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

                state.phase = GamePhase.NIGHT;
                state.dayCount += 1;
                state.timerMs = room?.settings?.nightTimerMs || 30000;
                gatewayEmitCb(
                    state.roomId,
                    'system_chat',
                    `День завершено. Настає Ніч ${state.dayCount}.`,
                );
                break;
        }

        gatewayEmitCb(state.roomId, 'phase_changed', state.phase);
    }

    private pushMatchLog(state: GameState, text: string) {
        state.logs.push({
            day: state.dayCount,
            phase: state.phase,
            text,
        });
    }

    private async resolveNightActions(state: GameState, gatewayEmitCb: Function) {
        let blockedUserId: string | null = null;
        let trappedUserId: string | null = null;
        let silencedUserId: string | null = null;
        let lawyerTargetId: string | null = null;
        let bodyguardTargetId: string | null = null;
        let bombTargetId: string | null = null;

        // Reset silence from previous day
        state.players.forEach(p => p.isSilenced = false);

        // 1. Process blocks and traps first
        for (const [userId, action] of state.nightActions.entries()) {
            if (action.type === 'BLOCK') blockedUserId = action.targetId;
            if (action.type === 'TRAP') trappedUserId = action.targetId;
            if (action.type === 'SILENCE') silencedUserId = action.targetId;
            if (action.type === 'DEFEND') lawyerTargetId = action.targetId;
            if (action.type === 'GUARD') bodyguardTargetId = action.targetId;
            if (action.type === 'BOMB') bombTargetId = action.targetId;

            const actorUsername = state.players.find(p => p.userId === userId)?.username;
            const targetUsername = state.players.find(p => p.userId === action.targetId)?.username;
            if (actorUsername && targetUsername) {
                this.pushMatchLog(state, `${actorUsername} застосував дію ${action.type} до ${targetUsername}.`);
            }
        }

        if (silencedUserId) {
            const sp = state.players.find(p => p.userId === silencedUserId);
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
                    // Send directly to the commissar since CHECK keys under userId
                    gatewayEmitCb(state.roomId, 'private_action_result', {
                        userId,
                        message,
                    });
                } else {
                    const isSheriff = target?.role === RoleType.SHERIFF;
                    message = `Перевірка Дона: Гравець ${target?.username} - ${isSheriff ? 'ШЕРИФ' : 'НЕ ШЕРИФ'}.`;
                    // Don check is shared under __don_check__, so we need to find the Don to notify
                    const don = state.players.find(p => p.role === RoleType.DON && p.isAlive);
                    if (don) {
                        gatewayEmitCb(state.roomId, 'private_action_result', {
                            userId: don.userId,
                            message,
                        });
                    }
                }
            }
            if (action.type === 'TRACK') {
                const targetAction = state.nightActions.get(action.targetId);
                const targetName = state.players.find(p => p.userId === action.targetId)?.username;
                if (targetAction) {
                    const visitedName = state.players.find(p => p.userId === targetAction.targetId)?.username;
                    gatewayEmitCb(state.roomId, 'private_action_result', { userId, message: `${targetName} відвідав гравця ${visitedName}.` });
                } else {
                    gatewayEmitCb(state.roomId, 'private_action_result', { userId, message: `${targetName} нікого не відвідував.` });
                }
            }
            if (action.type === 'INFORM') {
                const target = state.players.find(p => p.userId === action.targetId);
                gatewayEmitCb(state.roomId, 'private_action_result', { userId, message: `Роль ${target?.username}: ${target?.role}.` });
            }
            if (action.type === 'COMPARE') {
                const ids = action.targetId.split(',');
                if (ids.length === 2) {
                    const p1 = state.players.find(p => p.userId === ids[0]);
                    const p2 = state.players.find(p => p.userId === ids[1]);

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
                            message: `Журналіст: Гравці ${p1.username} та ${p2.username} - ${result} сторони.`
                        });
                    }
                }
            }
            if (action.type === 'SHERIFF_KILL') {
                const target = state.players.find((p) => p.userId === action.targetId);
                const isGuilty = target?.role === RoleType.MAFIA || target?.role === RoleType.DON || target?.role === RoleType.SERIAL_KILLER;
                if (!isGuilty) {
                    // Sheriff shot an innocent person, so the sheriff dies
                    victims.add(userId);
                    gatewayEmitCb(state.roomId, 'private_action_result', {
                        userId,
                        message: `Ви застрелили невинного гравця і поплатились за це життям!`,
                    });
                } else {
                    // Sheriff shot a guilty person
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
            gatewayEmitCb(
                state.roomId,
                'system_chat',
                `Мафія намагалась вбити, але Лікар врятував жертву!`,
            );
        }

        if (killedByManiac && killedByManiac !== healedByDoctor) {
            if (killedByManiac === bodyguardTargetId) {
                gatewayEmitCb(state.roomId, 'system_chat', `Маніяк намагався вбити, але Охоронець захистив ціль!`);
            } else {
                victims.add(killedByManiac);
            }
        }

        // Deal with Lovers - if one lover dies, the other commits suicide
        let loversDied = false;
        victims.forEach(vId => {
            const p = state.players.find(pl => pl.userId === vId);
            if (p?.role === RoleType.LOVERS) loversDied = true;
        });
        if (loversDied) {
            state.players.forEach(p => {
                if (p.role === RoleType.LOVERS) victims.add(p.userId);
            });
        }

        if (victims.size > 0) {
            victims.forEach((vId) => {
                const victim = state.players.find((p) => p.userId === vId);
                if (victim) {
                    victim.isAlive = false;
                    gatewayEmitCb(
                        state.roomId,
                        'system_chat',
                        `Вночі було вбито гравця ${victim.username}.`,
                    );
                    this.pushMatchLog(state, `Гравець ${victim.username} помер вночі.`);
                    if (victim.lastWill) {
                        gatewayEmitCb(
                            state.roomId,
                            'system_chat',
                            `Заповіт гравця ${victim.username}:\n"${victim.lastWill}"`,
                        );
                    }
                }
            });
        } else {
            if (!killedByMafia && !killedByManiac) {
                gatewayEmitCb(
                    state.roomId,
                    'system_chat',
                    `Ця ніч була спокійною. Ніхто не вбивав.`,
                );
                this.pushMatchLog(state, `Вночі ніхто не загинув.`);
            }
        }

        state.nightActions.clear();
    }

    private async resolveVoting(state: GameState, gatewayEmitCb: Function) {
        // Anti-AFK Check
        state.players.filter(p => p.isAlive).forEach(p => {
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
                    `Гравець ${p.username} вчинив самогубство через відсутність активності (AFK).`
                );
            }
        });

        // If everyone died from AFK, or win condition met, stop voting resolution
        if (state.players.filter(p => p.isAlive).length <= 0) {
            return;
        }

        if (state.votes.size === 0) {
            gatewayEmitCb(
                state.roomId,
                'system_chat',
                `Ніхто не проголосував. Нікого не страчено.`,
            );
            return;
        }

        const voteCounts: Record<string, number> = {};
        for (const [voterId, targetId] of state.votes.entries()) {
            const voter = state.players.find(p => p.userId === voterId);
            const target = targetId === 'SKIP' ? 'пропуск' : state.players.find(p => p.userId === targetId)?.username || targetId;
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

        if (!tie && executedId) {
            const victim = state.players.find((p) => p.userId === executedId);
            if (victim) {
                victim.isAlive = false;

                if (victim.role === RoleType.JESTER) {
                    gatewayEmitCb(
                        state.roomId,
                        'system_chat',
                        `Гравець ${victim.username} виявився Блазнем! Він здобув одноосібну ПЕРЕМОГУ!`,
                    );
                    this.pushMatchLog(state, `Страчено гравця ${victim.username}. Він виявився Блазнем і переміг!`);
                    state.phase = GamePhase.END_GAME;
                    gatewayEmitCb(state.roomId, 'phase_changed', GamePhase.END_GAME);
                    await this.awardStats(state.roomId, state.players, 'БЛАЗЕНЬ', state.logs, victim.userId, state.dayCount);
                    this.scheduleReturnToLobby(state, gatewayEmitCb);
                    return;
                }

                gatewayEmitCb(
                    state.roomId,
                    'system_chat',
                    `За результатами голосування убито ${victim.username}. Його роль: ${victim.role}.`,
                );
                this.pushMatchLog(state, `За результатами голосування страчено ${victim.username} (${victim.role}).`);

                if (victim.lastWill) {
                    gatewayEmitCb(
                        state.roomId,
                        'system_chat',
                        `Заповіт гравця ${victim.username}:\n"${victim.lastWill}"`,
                    );
                }

                // Check lovers
                if (victim.role === RoleType.LOVERS) {
                    let otherLoverDied = false;
                    state.players.forEach(p => {
                        if (p.role === RoleType.LOVERS && p.isAlive) {
                            p.isAlive = false;
                            otherLoverDied = true;
                            gatewayEmitCb(
                                state.roomId,
                                'system_chat',
                                `Гравець ${p.username} не витримав втрати кохання і вчинив самогубство!`,
                            );
                        }
                    });
                }
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
    }

    private async checkWinCondition(
        state: GameState,
        gatewayEmitCb: Function,
    ): Promise<boolean> {
        const alive = state.players.filter((p) => p.isAlive);
        const mafias = alive.filter(
            (p) => p.role === RoleType.MAFIA || p.role === RoleType.DON,
        ).length;
        const maniacs = alive.filter((p) => p.role === RoleType.SERIAL_KILLER).length;
        const civilians = alive.length - mafias - maniacs;

        if (alive.length === 0) {
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

        let winner: string | null = null;

        if (mafias === 0 && maniacs === 0) winner = 'МИРНІ';
        else if (mafias > 0 && mafias >= civilians + maniacs) winner = 'МАФІЯ';
        else if (maniacs > 0 && alive.length <= 2 && mafias === 0)
            winner = 'МАНІЯК';

        if (winner) {
            state.phase = GamePhase.END_GAME;
            gatewayEmitCb(
                state.roomId,
                'system_chat',
                `ГРА ЗАКІНЧЕНА! ПЕРЕМОГА: ${winner}. Меню лоббі буде відкрито через 10 секунд.`,
            );
            gatewayEmitCb(state.roomId, 'phase_changed', GamePhase.END_GAME);

            // Await stats update here
            await this.awardStats(state.roomId, state.players, winner, state.logs, undefined, state.dayCount);

            // Process user bets
            for (const [userId, bet] of state.bets.entries()) {
                if (bet.faction === winner) {
                    const winnings = bet.amount * 2;
                    await this.prisma.wallet.update({
                        where: { userId },
                        data: { soft: { increment: winnings } }
                    });
                    gatewayEmitCb(state.roomId, 'private_action_result', {
                        userId,
                        message: `Ваша ставка виграла! Ви отримали ${winnings} монет.`,
                    });
                } else {
                    gatewayEmitCb(state.roomId, 'private_action_result', {
                        userId,
                        message: `Ваша ставка програла (${bet.amount} монет).`,
                    });
                }
            }

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

    private async awardStats(roomId: string, players: PlayerState[], winner: string, logs: MatchLog[], jesterId?: string, dayCount?: number) {
        try {
            const matchData = await this.prisma.match.create({
                data: {
                    winner,
                    duration: dayCount || 1,
                    logs: logs ? JSON.stringify(logs) : '[]',
                    participants: {
                        create: await Promise.all(
                            players.filter(p => !p.isSpectator).map(async p => {
                                const isMafia = p.role === RoleType.MAFIA || p.role === RoleType.DON;
                                let won = false;
                                if (winner === 'МАФІЯ' && isMafia) won = true;
                                if (winner === 'МИРНІ' && !isMafia && p.role !== RoleType.SERIAL_KILLER && p.role !== RoleType.JESTER) won = true;
                                if (winner === 'МАНІЯК' && p.role === RoleType.SERIAL_KILLER) won = true;
                                if (winner === 'БЛАЗЕНЬ' && p.userId === jesterId) won = true;

                                const profile = await this.prisma.profile.findUnique({ where: { userId: p.userId } });
                                return {
                                    profileId: profile?.id || '',
                                    role: p.role?.toString() || 'ГЛЯДАЧ',
                                    won
                                };
                            })
                        ).then(results => results.filter(r => r.profileId !== ''))
                    }
                }
            });

            for (const p of players) {
                const isMafia = p.role === RoleType.MAFIA || p.role === RoleType.DON;
                let won = false;

                if (winner === 'МАФІЯ' && isMafia) won = true;
                if (winner === 'МИРНІ' && !isMafia && p.role !== RoleType.SERIAL_KILLER && p.role !== RoleType.JESTER)
                    won = true;
                if (winner === 'МАНІЯК' && p.role === RoleType.SERIAL_KILLER) won = true;
                if (winner === 'БЛАЗЕНЬ' && p.userId === jesterId) won = true;

                try {
                    if (p.isSpectator) continue;

                    const profile = await this.prisma.profile.findUnique({ where: { userId: p.userId } });
                    if (profile) {
                        const xpEarned = won ? 100 : 25;
                        let newXp = profile.xp + xpEarned;
                        let newLevel = profile.level;

                        while (newXp >= newLevel * 500) {
                            newXp -= newLevel * 500;
                            newLevel++;
                        }
                        const now = new Date();
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                        const activeQuests = await this.prisma.userQuest.findMany({
                            where: {
                                profileId: profile.id,
                                completed: false
                            },
                        });

                        const nowTime = new Date();
                        const todayStart2 = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate());

                        // Fallback: Date filtering in memory if createdAt does not exist on UserQuest schema
                        let filteredQuests = activeQuests.filter((uq: any) => {
                            if (!uq.createdAt) return true;
                            return new Date(uq.createdAt) >= todayStart2;
                        });

                        for (const uq of filteredQuests) {
                            const quest = await this.prisma.quest.findUnique({ where: { id: uq.questId } });
                            if (!quest) continue;
                            if (uq.progress >= quest.requirement) continue;

                            let progressed = false;
                            const qCode = quest.code;

                            if (qCode === 'PLAY_3_MATCHES') {
                                progressed = true;
                            }
                            if (qCode === 'WIN_1_MATCH' && won) {
                                progressed = true;
                            }
                            if (qCode === 'WIN_AS_MAFIA_1' && won && isMafia) {
                                progressed = true;
                            }
                            if (qCode === 'PLAY_AS_CITIZEN_2' && p.role === RoleType.CITIZEN) {
                                progressed = true;
                            }

                            if (progressed) {
                                await this.prisma.userQuest.update({
                                    where: { id: uq.id },
                                    data: { progress: { increment: 1 } }
                                });
                            }
                        }

                        const updateData: any = {
                            matches: { increment: 1 },
                            wins: { increment: won ? 1 : 0 },
                            losses: { increment: won ? 0 : 1 },
                            mmr: { increment: won ? 25 : -25 },
                            xp: newXp,
                            level: newLevel,
                        };

                        await this.prisma.profile.update({
                            where: { userId: p.userId },
                            data: updateData,
                        });

                        const coinsEarned = won ? 50 : 10;
                        await this.prisma.wallet.update({
                            where: { userId: p.userId },
                            data: { soft: { increment: coinsEarned } }
                        });

                        const newAchievements = [];
                        if (won && (p.role === RoleType.MAFIA || p.role === RoleType.DON)) {
                            newAchievements.push({ profileId: profile.id, type: 'MAFIA_WINNER' });
                        }
                        if (won && p.role === RoleType.JESTER) {
                            newAchievements.push({ profileId: profile.id, type: 'JESTER_JOKE' });
                        }
                        if (profile.wins + (won ? 1 : 0) === 10) {
                            newAchievements.push({ profileId: profile.id, type: 'VETERAN' });
                        }
                        if (profile.matches + 1 === 1) {
                            newAchievements.push({ profileId: profile.id, type: 'FIRST_BLOOD' });
                        }

                        if (newAchievements.length > 0) {
                            for (const ach of newAchievements) {
                                const exists = await this.prisma.achievement.findFirst({
                                    where: { profileId: profile.id, type: ach.type }
                                });
                                if (!exists) {
                                    await this.prisma.achievement.create({ data: ach });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to update stats', e);
                }
            }
        } catch (e) {
            console.error('Failed to create match record', e);
        }
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
        emitToUser: (userId: string, event: string, payload: any) => void
    ): Promise<boolean> {
        const state = await this.getGameState(roomId);
        if (!state) return false;
        if (state.phase !== GamePhase.DAY_DISCUSSION && state.phase !== GamePhase.DAY_VOTING) return false;

        const sender = state.players.find(p => p.userId === senderId);
        const target = state.players.find(p => p.userId === targetId);

        if (!sender || !target || !sender.isAlive || !target.isAlive) return false;

        try {
            const profile = await this.prisma.profile.findUnique({ where: { userId: senderId } });
            if (profile?.mutedUntil && new Date(profile.mutedUntil) > new Date()) {
                return false;
            }

            const wallet = await this.prisma.wallet.findUnique({ where: { userId: senderId } });
            if (!wallet || wallet.soft < 10) return false;

            await this.prisma.wallet.update({
                where: { userId: senderId },
                data: { soft: { decrement: 10 } }
            });

            // Send to target
            emitToUser(targetId, 'chat_message', {
                sender: `Шепіт від ${sender.username}`,
                text: message,
                type: 'system'
            });
            // Send to sender
            emitToUser(senderId, 'system_chat', `Ви шепнули гравцю ${target.username}: "${message}" (списано 10 монет)`);

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
        forceDisconnect: (userId: string) => void
    ) {
        if (adminUsername !== 'ADMIN') return false;

        try {
            const targetUser = await this.prisma.user.findUnique({ where: { username: targetUsername } });
            if (!targetUser) return false;

            if (action === 'BAN' || action === 'MUTE') {
                const until = new Date();
                until.setDate(until.getDate() + 7);
                await this.prisma.profile.update({
                    where: { userId: targetUser.id },
                    data: action === 'BAN' ? { bannedUntil: until } : { mutedUntil: until }
                });
            }

            if (action === 'KICK' || action === 'BAN') {
                emitToUser(targetUser.id, 'error', action === 'BAN' ? 'Ви отримали БАН від адміністратора (7 днів).' : 'Вас кікнуто адміністратором.');
                const roomId1 = await this.findActiveGameForUser(targetUser.id);
                if (roomId1) await this.leaveRoom(roomId1, targetUser.id);

                const roomId2 = await this.findActiveLobbyForUser(targetUser.id);
                if (roomId2) await this.leaveRoom(roomId2, targetUser.id);

                forceDisconnect(targetUser.id);
            } else if (action === 'MUTE') {
                emitToUser(targetUser.id, 'error', 'Вам заборонено писати в чат на 7 днів.');
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
            RoleType.DOCTOR, RoleType.SHERIFF, RoleType.ESCORT, RoleType.SERIAL_KILLER,
            RoleType.LAWYER, RoleType.BODYGUARD, RoleType.TRACKER, RoleType.INFORMER,
            RoleType.BOMBER, RoleType.TRAPPER, RoleType.SILENCER,
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
            const target = state.players.find((p: PlayerState) => p.userId === targetId);
            if (!target || !target.isAlive) return false;
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

    async placeBet(roomId: string, userId: string, faction: string, amount: number): Promise<{ success: boolean; error?: string }> {
        const state = await this.getGameState(roomId);
        if (!state) return { success: false, error: 'Гра не знайдена.' };

        const player = state.players.find(p => p.userId === userId);
        if (player && player.isAlive) {
            return { success: false, error: 'Живі гравці не можуть робити ставки.' };
        }

        if (state.bets.has(userId)) {
            return { success: false, error: 'Ви вже зробили ставку.' };
        }

        if (amount < 10 || amount > 1000) {
            return { success: false, error: 'Некоректна сума ставки (від 10 до 1000).' };
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
            data: { soft: { decrement: amount } }
        });

        state.bets.set(userId, { faction, amount });
        await this.saveGameState(state);
        return { success: true };
    }
}
