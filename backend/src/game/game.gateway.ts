import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, forwardRef, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType } from './game.types';
import { SkipThrottle } from '@nestjs/throttler';
import { sanitize } from '../utils/sanitize';
import {
  getStaffPower,
  STAFF_ROLE_MAP,
  PERMISSION,
} from '../admin/admin.roles';
import { AdminService } from '../admin/admin.service';
import {
  CreateRoomDto,
  RoomIdDto,
  InviteToRoomDto,
  ReplyInviteDto,
  ReadyDto,
  UpdateRoomSettingsDto,
  NightActionDto,
  VoteDto,
  SaveLastWillDto,
  PlaceBetDto,
  WhisperDto,
  AdminActionDto,
  ChatMessageDto,
} from './dto/gateway.dto';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@SkipThrottle()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN || '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Track one active socket per userId to prevent multi-tab conflicts
  private userSockets: Map<string, string> = new Map();

  // Rate limiting for room creation: userId -> timestamps[]
  private roomCreationTimestamps: Map<string, number[]> = new Map();

  // Rate limiting for chat: userId -> timestamps[]
  private chatMessageTimestamps: Map<string, number[]> = new Map();

  // Debouncing for actions/votes: userId -> lastActionTimestamp
  private actionDebounceTimestamps: Map<string, number> = new Map();

  // Global Chat History in RAM
  private globalChatHistory: any[] = [];

  // Online Staff tracking
  private staffOnline: Map<
    string,
    {
      userId: string;
      username: string;
      staffRoleKey: string;
      staffRoleTitle: string;
      staffRoleColor: string;
    }
  > = new Map();

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AdminService))
    private readonly adminService: AdminService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-me',
      });

      // Fetch staffRoleKey from DB and attach to socket data
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { staffRoleKey: true, staffRole: true },
      });
      payload.staffRoleKey = dbUser?.staffRoleKey || null;
      payload.staffRoleTitle = dbUser?.staffRole?.title || null;
      payload.staffRoleColor = dbUser?.staffRole?.color || null;
      client.data.user = payload;

      // Evict previous socket for same user from all rooms
      const existingSocketId = this.userSockets.get(payload.sub);
      if (existingSocketId) {
        const allSockets = await this.server.fetchSockets();
        const oldSocket = allSockets.find((s) => s.id === existingSocketId);
        if (oldSocket) {
          oldSocket.rooms.forEach((room) => {
            if (room !== oldSocket.id) oldSocket.leave(room);
          });
          oldSocket.emit('session_replaced', {
            message: 'Ваша сесія замінена новою вкладкою.',
          });
          oldSocket.disconnect(true);
        }
      }
      this.userSockets.set(payload.sub, client.id);

      // Track online staff
      if (dbUser?.staffRoleKey && dbUser?.staffRole) {
        this.staffOnline.set(payload.sub, {
          userId: payload.sub,
          username: payload.username,
          staffRoleKey: dbUser.staffRoleKey,
          staffRoleTitle: dbUser.staffRole.title,
          staffRoleColor: dbUser.staffRole.color,
        });
        this.server.emit(
          'staff_online_update',
          Array.from(this.staffOnline.values()),
        );
      }
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub;
    // Only remove mapping if this is still the active socket for this user
    if (userId && this.userSockets.get(userId) === client.id) {
      this.userSockets.delete(userId);

      // Remove from online staff tracking
      if (this.staffOnline.has(userId)) {
        this.staffOnline.delete(userId);
        this.server.emit(
          'staff_online_update',
          Array.from(this.staffOnline.values()),
        );
      }

      this.gameService.handlePlayerDisconnect(
        userId,
        (roomId, event, payload) => {
          if (event === 'tick' || event === 'phase_changed') {
            this.server.to(roomId).emit(event, payload);
            this.broadcastGameState(roomId);
          } else if (event === 'game_ended') {
            this.server.to(roomId).emit('game_ended', payload);
          } else {
            this.server.to(roomId).emit(event, payload);
          }
        },
      );
    }
  }

  @SubscribeMessage('check_active_game')
  async handleCheckActiveGame(@ConnectedSocket() client: Socket) {
    const userId = client.data.user.sub;
    client.emit('global_chat_history', this.globalChatHistory);
    const activeGameRoomId =
      await this.gameService.findActiveGameForUser(userId);

    if (activeGameRoomId) {
      // Clear any disconnect timer since user is back
      await this.gameService.handlePlayerReconnect(
        activeGameRoomId,
        userId,
        (roomId, event, payload) => {
          if (event === 'game_state_update') {
            this.broadcastGameState(roomId);
          } else {
            this.server.to(roomId).emit(event, payload);
          }
        },
      );

      client.join(activeGameRoomId);
      const filteredState = await this.gameService.getFilteredStateForUser(
        activeGameRoomId,
        userId,
      );
      client.emit('game_state_update', filteredState);
      client.emit('active_game_found', { roomId: activeGameRoomId });
      return;
    }

    const activeLobbyRoomId =
      await this.gameService.findActiveLobbyForUser(userId);
    if (activeLobbyRoomId) {
      client.join(activeLobbyRoomId);
      const room = await this.gameService.getRoom(activeLobbyRoomId);
      client.emit('room_updated', room);
      client.emit('active_lobby_found', { roomId: activeLobbyRoomId });
      return;
    }

    client.emit('no_active_game', {});
  }

  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateRoomDto,
  ) {
    const type = data?.type || 'CASUAL';
    const user = client.data.user;

    // Rate limit: max 3 rooms per minute per user
    const now = Date.now();
    const timestamps = this.roomCreationTimestamps.get(user.sub) || [];
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length >= 3) {
      client.emit('error', 'Занадто багато кімнат. Спробуйте через хвилину.');
      return;
    }
    recent.push(now);
    this.roomCreationTimestamps.set(user.sub, recent);

    try {
      const roomId = await this.gameService.createRoom(
        user.sub,
        user.username,
        type,
      );
      client.join(roomId);
      const room = await this.gameService.getRoom(roomId);
      this.server.to(roomId).emit('room_updated', room);
      client.emit('room_created', { roomId });
    } catch (e: any) {
      client.emit('error', e.message || 'Error creating room');
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: RoomIdDto,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.roomId;
    const user = client.data.user;
    try {
      const result = await this.gameService.joinRoom(
        roomId,
        user.sub,
        user.username,
      );
      if (!result) {
        client.emit('error', 'Цієї кімнати не існує або гра вже завершилась.');
        return;
      }
      const { room, warnings } = result;

      if (warnings && warnings.length > 0) {
        // Notify admins
        warnings.forEach((warn) => {
          for (const [
            socketId,
            socket,
          ] of this.server.sockets.sockets.entries()) {
            const socketUser = socket.data.user;
            if (
              socketUser &&
              socketUser.staffRoleKey &&
              getStaffPower(socketUser.staffRoleKey) > 0
            ) {
              socket.emit('system_chat', `[АНТИЧІТ] ${warn}`);
            }
          }
        });
      }

      client.join(roomId);
      this.server.to(roomId).emit('room_updated', room);
      client.emit('room_joined', room);
    } catch (e: any) {
      client.emit('error', e.message || 'Помилка приєднання до кімнати.');
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: RoomIdDto,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.roomId;
    const userId = client.data.user.sub;
    const room = await this.gameService.leaveRoom(roomId, userId);
    client.leave(roomId);
    if (room) {
      this.server.to(roomId).emit('room_updated', room);
    }
  }

  @SubscribeMessage('invite_to_room')
  async handleInviteToRoom(
    @MessageBody() data: InviteToRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const inviterUsername = client.data.user.username;
    const targetSocketId = this.userSockets.get(data.targetUserId);
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('room_invite', {
        roomId: data.roomId,
        inviterUsername,
      });
      client.emit('system_chat', 'Запрошення надіслано.');
    } else {
      client.emit('error', 'Гравець наразі не в мережі.');
    }
  }

  @SubscribeMessage('ready')
  async handleReady(
    @MessageBody() data: ReadyDto,
    @ConnectedSocket() client: Socket,
  ) {
    const root = await this.gameService.setPlayerReady(
      data.roomId,
      client.data.user.sub,
      data.isReady,
    );
    if (root) {
      this.server.to(data.roomId).emit('room_updated', root);
    }
  }

  @SubscribeMessage('update_room_settings')
  async handleUpdateRoomSettings(
    @MessageBody() data: UpdateRoomSettingsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const success = await this.gameService.updateRoomSettings(
      data.roomId,
      client.data.user.sub,
      data.settings,
    );
    if (success) {
      const room = await this.gameService.getRoom(data.roomId);
      this.server.to(data.roomId).emit('room_updated', room);
    }
  }

  private broadcastGameState(roomId: string) {
    this.server
      .in(roomId)
      .fetchSockets()
      .then((sockets) => {
        sockets.forEach((s) => {
          const userId = s.data.user.sub;
          const filteredState = this.gameService.getFilteredStateForUser(
            roomId,
            userId,
          );
          s.emit('game_state_update', filteredState);
        });
      });
  }

  @SubscribeMessage('start_game')
  async handleStartGame(
    @MessageBody() data: RoomIdDto,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.roomId;
    try {
      const emitCb = (rId: string, event: string, payload?: any) => {
        if (event === 'private_action_result') {
          // Send to specific user
          this.server
            .in(rId)
            .fetchSockets()
            .then((sockets) => {
              const s = sockets.find(
                (sock) => sock.data.user.sub === payload.userId,
              );
              if (s) s.emit('system_chat', payload.message);
            });
        } else if (event === 'tick' || event === 'phase_changed') {
          // For tick/phase changes, broadcast the filtered state
          this.server.to(rId).emit(event, payload);
          this.broadcastGameState(rId);
        } else if (event === 'game_ended') {
          // Signal all clients to return to lobby
          this.server.to(rId).emit('game_ended', payload);
        } else {
          this.server.to(rId).emit(event, payload);
        }
      };

      const state = await this.gameService.startGame(
        roomId,
        client.data.user.sub,
        emitCb,
      );
      if (state) {
        const room = await this.gameService.getRoom(roomId);
        this.server.to(roomId).emit('room_updated', room);
        this.broadcastGameState(roomId);
      }
    } catch (e: any) {
      return { event: 'error', data: e.message };
    }
  }

  @SubscribeMessage('night_action')
  async handleNightAction(
    @MessageBody() data: NightActionDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.user?.sub;
    if (!userId) return;

    const now = Date.now();
    const lastAction = this.actionDebounceTimestamps.get(userId) || 0;
    if (now - lastAction < 1000) return;
    this.actionDebounceTimestamps.set(userId, now);

    const success = await this.gameService.handleNightAction(
      data.roomId,
      userId,
      data.targetId,
      data.actionType,
    );
    if (success) {
      client.emit('system_chat', 'Дію прийнято.');
    } else {
      client.emit('error', 'Дія недоступна.');
    }
  }

  @SubscribeMessage('vote')
  async handleVote(
    @MessageBody() data: VoteDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.user?.sub;
    if (!userId) return;

    const now = Date.now();
    const lastVote = this.actionDebounceTimestamps.get(userId) || 0;
    if (now - lastVote < 1000) return;
    this.actionDebounceTimestamps.set(userId, now);

    const success = await this.gameService.handleVote(
      data.roomId,
      userId,
      data.targetId,
    );
    if (success) {
      this.server
        .to(data.roomId)
        .emit(
          'system_chat',
          `Гравець ${client.data.user.username} проголосував.`,
        );
      this.broadcastGameState(data.roomId);
    }
  }

  @SubscribeMessage('save_last_will')
  async handleSaveLastWill(
    @MessageBody() data: SaveLastWillDto,
    @ConnectedSocket() client: Socket,
  ) {
    const state = await this.gameService.getGameState(data.roomId);
    if (!state) return;
    const player = state.players.find((p) => p.userId === client.data.user.sub);
    if (player && player.isAlive) {
      player.lastWill = sanitize(data.lastWill, 150);
      await this.gameService.saveGameState(state);
      client.emit('system_chat', 'Заповіт збережено.');
    }
  }

  @SubscribeMessage('place_bet')
  async handlePlaceBet(
    @MessageBody() data: PlaceBetDto,
    @ConnectedSocket() client: Socket,
  ) {
    const result = await this.gameService.placeBet(
      data.roomId,
      client.data.user.sub,
      data.faction,
      data.amount,
    );
    if (!result.success) {
      client.emit('error', result.error);
    } else {
      client.emit(
        'system_chat',
        `Ставку ${data.amount} монет на фракцію "${data.faction}" прийнято.`,
      );
      this.broadcastGameState(data.roomId);
    }
  }

  @SubscribeMessage('whisper')
  async handleWhisper(
    @MessageBody() data: WhisperDto,
    @ConnectedSocket() client: Socket,
  ) {
    data.message = sanitize(data.message, 200);
    if (!data.message) return;
    const success = await this.gameService.handleWhisper(
      data.roomId,
      client.data.user.sub,
      data.targetId,
      data.message,
      (userId, event, payload) => {
        this.server
          .in(data.roomId)
          .fetchSockets()
          .then((sockets) => {
            const s = sockets.find((sock) => sock.data.user.sub === userId);
            if (s) s.emit(event, payload);
          });
      },
    );
    if (!success) {
      client.emit(
        'error',
        'Не вдалося надіслати шепіт (перевірте баланс або ціль).',
      );
    }
  }

  @SubscribeMessage('use_veto')
  async handleUseVeto(
    @MessageBody() data: RoomIdDto,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId = data.roomId;
    const success = await this.gameService.handleMayorVeto(
      roomId,
      client.data.user.sub,
      (rId: string, ev: string, payload?: any) => {
        this.server.to(rId).emit(ev, payload);
      },
    );
    if (!success) {
      client.emit('error', 'Ви не можете використати Вето зараз.');
    } else {
      this.broadcastGameState(roomId);
    }
  }

  @SubscribeMessage('admin_action')
  async handleAdminAction(
    @MessageBody() data: AdminActionDto,
    @ConnectedSocket() client: Socket,
  ) {
    if (client.data.user.username !== 'ADMIN') return;

    const success = await this.gameService.handleAdminAction(
      client.data.user.username,
      data.targetUsername,
      data.action,
      (userId, event, payload) => {
        this.server.fetchSockets().then((sockets) => {
          const s = sockets.find((sock) => sock.data.user.sub === userId);
          if (s) s.emit(event, payload);
        });
      },
      (userId) => {
        this.server.fetchSockets().then((sockets) => {
          const s = sockets.find((sock) => sock.data.user.sub === userId);
          if (s) {
            s.rooms.forEach((room) => {
              if (room !== s.id) s.leave(room);
            });
            s.disconnect(true);
          }
        });
      },
    );

    if (success) {
      client.emit(
        'system_chat',
        `Команду ${data.action} успішно застосовано до ${data.targetUsername}.`,
      );
    } else {
      client.emit('error', 'Не вдалося виконати дію адміністратора.');
    }
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @MessageBody() data: ChatMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data || !data.roomId || !data.message) return;
    data.message = sanitize(data.message, 500);
    const state = await this.gameService.getGameState(data.roomId);
    const username = client.data?.user?.username || 'Unknown';
    const sub = client.data?.user?.sub;

    if (!sub) return;

    const now = Date.now();
    const timestamps = this.chatMessageTimestamps.get(sub) || [];
    const recent = timestamps.filter((t) => now - t < 10000);
    if (recent.length >= 5) {
      client.emit(
        'error',
        'Ви відправляєте повідомлення занадто часто (макс 5 на 10 сек).',
      );
      return;
    }
    recent.push(now);
    this.chatMessageTimestamps.set(sub, recent);

    // Перевірка на mute (глобальний)
    const profile = await this.prisma.profile.findUnique({
      where: { userId: sub },
    });
    if (profile?.mutedUntil && new Date(profile.mutedUntil) > new Date()) {
      client.emit('error', 'Вам тимчасово заборонено писати в чат.');
      return;
    }

    if (!state) {
      // Lobby Chat

      // ── Admin commands in lobby chat ──
      if (data.message.startsWith('/')) {
        const handled = await this.handleAdminCommand(
          client,
          data.message,
          null,
        );
        if (handled) return;
      }

      const userRoleKey = client.data?.user?.staffRoleKey;
      const staffRole = userRoleKey ? STAFF_ROLE_MAP.get(userRoleKey) : null;

      const msgObj = {
        id: Date.now().toString() + Math.random().toString().substring(2, 6),
        sender: username,
        text: data.message,
        timestamp: new Date().toISOString(),
        staffRoleKey: userRoleKey || null,
        staffRoleTitle: staffRole?.title || null,
        staffRoleColor: staffRole?.color || null,
      };

      this.globalChatHistory.push(msgObj);
      if (this.globalChatHistory.length > 100) {
        this.globalChatHistory.shift();
      }

      this.server.emit('global_chat_message', msgObj);
      return;
    }

    const player = state.players.find((p) => p.userId === sub);
    if (!player) return;

    if (player.isSilenced && state.phase !== 'NIGHT') {
      client.emit('error', 'Вас змусили мовчати цього дня!');
      return;
    }

    if (!player.isAlive) {
      // Dead Chat — only send to other dead players
      this.server
        .in(data.roomId)
        .fetchSockets()
        .then((sockets) => {
          sockets.forEach((s) => {
            const targetPlayer = state.players.find(
              (p) => p.userId === s.data.user.sub,
            );
            if (targetPlayer && !targetPlayer.isAlive) {
              s.emit('chat_message', {
                sender: username,
                text: data.message,
                type: 'dead',
              });
            }
          });
        });
      return;
    }

    // ── Admin commands in game chat ──
    if (data.message.startsWith('/')) {
      const handled = await this.handleAdminCommand(
        client,
        data.message,
        data.roomId,
      );
      if (handled) return;
    }

    const userRoleKey = client.data?.user?.staffRoleKey;
    const staffRole = userRoleKey ? STAFF_ROLE_MAP.get(userRoleKey) : null;

    if (state.phase === 'NIGHT') {
      // Night chat is only for Mafias
      if (player.role === RoleType.MAFIA || player.role === RoleType.DON) {
        this.server
          .in(data.roomId)
          .fetchSockets()
          .then((sockets) => {
            sockets.forEach((s) => {
              const targetState = state.players.find(
                (p) => p.userId === s.data.user.sub,
              );
              if (
                targetState &&
                targetState.isAlive &&
                (targetState.role === RoleType.MAFIA ||
                  targetState.role === RoleType.DON)
              ) {
                s.emit('chat_message', {
                  sender: username,
                  text: data.message,
                  type: 'mafia',
                  staffRoleKey: userRoleKey || null,
                  staffRoleTitle: staffRole?.title || null,
                  staffRoleColor: staffRole?.color || null,
                });
              }
            });
          });
      } else {
        client.emit('error', 'Вночі мирні сплять (чат вимкнено).');
      }
    } else {
      // General Chat Day
      this.server.to(data.roomId).emit('chat_message', {
        sender: username,
        text: data.message,
        type: 'general',
        staffRoleKey: userRoleKey || null,
        staffRoleTitle: staffRole?.title || null,
        staffRoleColor: staffRole?.color || null,
      });
    }
  }

  @SubscribeMessage('host_kick')
  async handleHostKick(
    @MessageBody() data: { roomId: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const hostId = client.data?.user?.sub;
    if (!hostId || !data?.roomId || !data?.targetId) return;

    const room = await this.gameService.kickPlayerFromRoom(
      data.roomId,
      hostId,
      data.targetId,
    );
    if (!room) return;

    // Оновити кімнату для всіх
    this.server.to(data.roomId).emit('room_updated', room);

    // Викинути гравця з кімнати й повідомити його
    const sockets = await this.server.in(data.roomId).fetchSockets();
    const targetSocket = sockets.find(
      (s) => s.data?.user?.sub === data.targetId,
    );
    if (targetSocket) {
      targetSocket.leave(data.roomId);
      targetSocket.emit('kicked_from_room', {
        roomId: data.roomId,
        reason: 'Хост кімнати викинув вас з лоббі.',
      });
    }
  }

  @SubscribeMessage('spectate_room')
  async handleSpectateRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    // Check that user has a staff role
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { staffRoleKey: true },
    });
    if (!dbUser?.staffRoleKey) {
      client.emit('error', 'Тільки адміністратори можуть спостерігати.');
      return;
    }

    const room = await this.gameService.getRoom(roomId);
    if (!room) {
      client.emit('error', 'Кімнату не знайдено.');
      return;
    }

    // Cannot spectate before the game starts
    if (room.status !== 'IN_PROGRESS') {
      client.emit('error', 'Неможливо переглядати кімнату до початку гри.');
      return;
    }

    // Join as spectator using existing joinRoom logic (handles IN_PROGRESS spectator join)
    await this.gameService.joinRoom(roomId, user.sub, user.username);
    client.join(roomId);

    // Send game state
    const filteredState = await this.gameService.getFilteredStateForUser(
      roomId,
      user.sub,
    );
    client.emit('game_state_update', filteredState);
    client.emit('room_joined', room);
  }

  /* ═══════════════════  ADMIN COMMANDS IN CHAT  ═══════════════════ */

  /**
   * Parse and handle admin commands: /mute, /kick, /ban, /warn, /clear
   * Returns true if the message was a valid admin command (handled), false otherwise.
   */
  private async handleAdminCommand(
    client: Socket,
    message: string,
    roomId: string | null,
  ): Promise<boolean> {
    const staffRoleKey = client.data?.user?.staffRoleKey;
    const power = getStaffPower(staffRoleKey);
    const parts = message.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // /addbot <count> — додати ботів для тестування (Lv.9 Owner)
    if (cmd === '/addbot') {
      if (power < 9) {
        client.emit('error', 'Тільки Власник (Lv.9) може додавати ботів.');
        return true;
      }
      if (!roomId) {
        client.emit(
          'error',
          'Цю команду можна використовувати тільки в кімнаті.',
        );
        return true;
      }
      const count = parseInt(parts[1], 10) || 1;
      try {
        const room = await this.gameService.addBots(roomId, count);
        if (room) {
          this.server.to(roomId).emit('room_updated', room);
          this.server
            .to(roomId)
            .emit(
              'system_chat',
              `🤖 Адміністратор додав ${count} бот(ів) для тестування.`,
            );
        } else {
          client.emit('error', 'Кімнату не знайдено або гра вже почалася.');
        }
      } catch (e: any) {
        client.emit('error', e.message || 'Помилка виконання /addbot.');
      }
      return true;
    }

    // /clear — clear global chat (Lv.4+)
    if (cmd === '/clear') {
      if (power >= 4) {
        this.globalChatHistory = [];
        this.server.emit('chat_cleared');
        client.emit('system_chat', '✅ Чат очищено.');
      } else {
        client.emit('error', 'Вам недоступна ця команда.');
      }
      return true;
    }

    // /warn <ім'я> <причина> — попередити (Lv.1+)
    if (cmd === '/warn') {
      if (power < PERMISSION.PUNISH_WARN) {
        client.emit('error', 'Недостатньо прав для /warn (Lv.1+).');
        return true;
      }
      const targetName = parts[1];
      const reason = parts.slice(2).join(' ') || 'Порушення правил';
      if (!targetName) {
        client.emit('error', "Формат: /warn <ім'я> <причина>");
        return true;
      }
      try {
        await this.adminService.punishUser(
          { id: client.data.user.sub, staffRoleKey },
          { targetUsername: targetName, type: 'WARN', reason },
        );
        client.emit(
          'system_chat',
          `✅ Попередження видано гравцю ${targetName}.`,
        );
        if (roomId) {
          this.server
            .to(roomId)
            .emit(
              'system_chat',
              `⚠️ Гравець ${targetName} отримав попередження від адміністратора.`,
            );
        }
      } catch (e: any) {
        client.emit('error', e.message || 'Помилка виконання /warn.');
      }
      return true;
    }

    // /mute <ім'я> <хвилини> — замутити (Lv.2+)
    if (cmd === '/mute') {
      if (power < PERMISSION.PUNISH_MUTE) {
        client.emit('error', 'Недостатньо прав для /mute (Lv.2+).');
        return true;
      }
      const targetName = parts[1];
      const minutes = parseInt(parts[2], 10) || 30;
      if (!targetName) {
        client.emit('error', "Формат: /mute <ім'я> <хвилини>");
        return true;
      }
      try {
        await this.adminService.punishUser(
          { id: client.data.user.sub, staffRoleKey },
          {
            targetUsername: targetName,
            type: 'MUTE',
            durationSeconds: minutes * 60,
            reason: `Мут через чат-команду (${minutes} хв)`,
          },
        );
        client.emit(
          'system_chat',
          `✅ Гравця ${targetName} замучено на ${minutes} хв.`,
        );
        if (roomId) {
          this.server
            .to(roomId)
            .emit(
              'system_chat',
              `🔇 Гравець ${targetName} замучений на ${minutes} хв адміністратором.`,
            );
        }
      } catch (e: any) {
        client.emit('error', e.message || 'Помилка виконання /mute.');
      }
      return true;
    }

    // /kick <ім'я> — кікнути (Lv.3+)
    if (cmd === '/kick') {
      if (power < PERMISSION.PUNISH_KICK) {
        client.emit('error', 'Недостатньо прав для /kick (Lv.3+).');
        return true;
      }
      const targetName = parts[1];
      if (!targetName) {
        client.emit('error', "Формат: /kick <ім'я>");
        return true;
      }
      try {
        await this.adminService.punishUser(
          { id: client.data.user.sub, staffRoleKey },
          {
            targetUsername: targetName,
            type: 'KICK',
            reason: 'Кік через чат-команду',
          },
        );
        // If in a room, find and kick from socket room
        if (roomId) {
          const target = await this.prisma.user.findUnique({
            where: { username: targetName },
            select: { id: true },
          });
          if (target) {
            const sockets = await this.server.in(roomId).fetchSockets();
            const targetSock = sockets.find(
              (s) => s.data?.user?.sub === target.id,
            );
            if (targetSock) {
              targetSock.leave(roomId);
              targetSock.emit('kicked_from_room', {
                roomId,
                reason: 'Вас кікнуто адміністратором.',
              });
            }
          }
          this.server
            .to(roomId)
            .emit(
              'system_chat',
              `🚪 Гравець ${targetName} кікнутий адміністратором.`,
            );
        }
        client.emit('system_chat', `✅ Гравця ${targetName} кікнуто.`);
      } catch (e: any) {
        client.emit('error', e.message || 'Помилка виконання /kick.');
      }
      return true;
    }

    // /ban <ім'я> <години> — забанити (Lv.4+)
    if (cmd === '/ban') {
      if (power < PERMISSION.PUNISH_BAN) {
        client.emit('error', 'Недостатньо прав для /ban (Lv.4+).');
        return true;
      }
      const targetName = parts[1];
      const hours = parseInt(parts[2], 10) || 24;
      if (!targetName) {
        client.emit('error', "Формат: /ban <ім'я> <години>");
        return true;
      }
      try {
        await this.adminService.punishUser(
          { id: client.data.user.sub, staffRoleKey },
          {
            targetUsername: targetName,
            type: 'BAN',
            durationSeconds: hours * 3600,
            reason: `Бан через чат-команду (${hours} год)`,
          },
        );
        client.emit(
          'system_chat',
          `✅ Гравця ${targetName} забанено на ${hours} год.`,
        );
        if (roomId) {
          this.server
            .to(roomId)
            .emit(
              'system_chat',
              `🚫 Гравець ${targetName} забанений на ${hours} год адміністратором.`,
            );
        }
      } catch (e: any) {
        client.emit('error', e.message || 'Помилка виконання /ban.');
      }
      return true;
    }

    return false;
  }

  /* ═══════════════════  GET ONLINE STAFF (public) ═══════════════════ */

  getOnlineStaff() {
    return Array.from(this.staffOnline.values());
  }

  /* ═══════════════════  ONLINE MATCHMAKING  ═══════════════════ */
  private onlineQueue: Map<
    string,
    { userId: string; username: string; socketId: string }
  > = new Map();
  private readonly MIN_PLAYERS_ONLINE = 5;
  private readonly MAX_PLAYERS_ONLINE = 20;
  private onlineMatchTimer: NodeJS.Timeout | null = null;
  private matchTimerCountdown = 0;

  @SubscribeMessage('join_online_queue')
  async handleJoinOnlineQueue(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub;
    const username = client.data?.user?.username;
    if (!userId || !username) return;

    // Add to queue
    this.onlineQueue.set(userId, { userId, username, socketId: client.id });

    this.broadcastQueueUpdate();

    // Check if we reached the required minimum
    if (this.onlineQueue.size >= this.MIN_PLAYERS_ONLINE) {
      if (!this.onlineMatchTimer) {
        this.startOnlineMatchTimer();
      }

      // If we miraculously hit max players right away, force start
      if (this.onlineQueue.size >= this.MAX_PLAYERS_ONLINE) {
        if (this.onlineMatchTimer) {
          clearInterval(this.onlineMatchTimer);
          this.onlineMatchTimer = null;
        }
        await this.startOnlineMatch();
      }
    }
  }

  @SubscribeMessage('leave_online_queue')
  handleLeaveOnlineQueue(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub;
    if (userId) {
      this.onlineQueue.delete(userId);

      // If we dip below minimum players, stop the timer
      if (
        this.onlineQueue.size < this.MIN_PLAYERS_ONLINE &&
        this.onlineMatchTimer
      ) {
        clearInterval(this.onlineMatchTimer);
        this.onlineMatchTimer = null;
        this.matchTimerCountdown = 0;
      }

      this.broadcastQueueUpdate();
      client.emit('online_queue_update', {
        inQueue: this.onlineQueue.size,
        left: true,
      });
    }
  }

  private startOnlineMatchTimer() {
    this.matchTimerCountdown = 15; // 15 seconds timer
    this.broadcastQueueUpdate();

    this.onlineMatchTimer = setInterval(async () => {
      this.matchTimerCountdown--;
      this.broadcastQueueUpdate();

      if (this.matchTimerCountdown <= 0) {
        clearInterval(this.onlineMatchTimer!);
        this.onlineMatchTimer = null;

        // Final sanity check
        if (this.onlineQueue.size >= this.MIN_PLAYERS_ONLINE) {
          await this.startOnlineMatch();
        }
      }
    }, 1000);
  }

  private async startOnlineMatch() {
    const players = Array.from(this.onlineQueue.values()).slice(
      0,
      this.MAX_PLAYERS_ONLINE,
    );

    // Create room with the first player as host
    const host = players[0];
    const roomId = await this.gameService.createRoom(
      host.userId,
      host.username,
    );

    // Join all other players
    for (let i = 1; i < players.length; i++) {
      await this.gameService.joinRoom(
        roomId,
        players[i].userId,
        players[i].username,
      );
    }

    // Remove from queue and notify
    for (const p of players) {
      this.onlineQueue.delete(p.userId);
      const sock = this.server.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.join(roomId);
        sock.emit('online_match_found', { roomId });
      }
    }

    // Broadcast room update
    const room = await this.gameService.getRoom(roomId);
    if (room) {
      this.server.to(roomId).emit('room_updated', room);
    }

    // Resume timer for remaining players if any
    if (this.onlineQueue.size >= this.MIN_PLAYERS_ONLINE) {
      this.startOnlineMatchTimer();
    } else {
      this.broadcastQueueUpdate();
    }
  }

  private broadcastQueueUpdate() {
    const updatePayload = {
      inQueue: this.onlineQueue.size,
      timer: this.onlineMatchTimer ? this.matchTimerCountdown : null,
      minPlayers: this.MIN_PLAYERS_ONLINE,
      maxPlayers: this.MAX_PLAYERS_ONLINE,
    };

    // Send only to users in queue
    for (const p of this.onlineQueue.values()) {
      const sock = this.server.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.emit('online_queue_update', updatePayload);
      }
    }
  }
}
