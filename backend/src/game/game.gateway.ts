import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RoleType } from './game.types';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN || '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Track one active socket per userId to prevent multi-tab conflicts
  private userSockets: Map<string, string> = new Map();

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-me',
      });
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
          oldSocket.emit('session_replaced', { message: 'Ваша сесія замінена новою вкладкою.' });
          oldSocket.disconnect(true);
        }
      }
      this.userSockets.set(payload.sub, client.id);

    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub;
    // Only remove mapping if this is still the active socket for this user
    if (userId && this.userSockets.get(userId) === client.id) {
      this.userSockets.delete(userId);
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
        }
      );
    }
  }

  @SubscribeMessage('check_active_game')
  async handleCheckActiveGame(@ConnectedSocket() client: Socket) {
    const userId = client.data.user.sub;
    const activeGameRoomId = await this.gameService.findActiveGameForUser(userId);

    if (activeGameRoomId) {
      // Clear any disconnect timer since user is back
      await this.gameService.handlePlayerReconnect(activeGameRoomId, userId);

      client.join(activeGameRoomId);
      const filteredState = await this.gameService.getFilteredStateForUser(
        activeGameRoomId,
        userId,
      );
      client.emit('game_state_update', filteredState);
      client.emit('active_game_found', { roomId: activeGameRoomId });
      return;
    }

    const activeLobbyRoomId = await this.gameService.findActiveLobbyForUser(userId);
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
  async handleCreateRoom(@ConnectedSocket() client: Socket) {
    const user = client.data.user;
    const roomId = await this.gameService.createRoom(user.sub, user.username);
    client.join(roomId);
    const room = await this.gameService.getRoom(roomId);
    this.server.to(roomId).emit('room_updated', room);
    client.emit('room_created', { roomId });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    const room = await this.gameService.joinRoom(roomId, user.sub, user.username);
    if (!room) {
      client.emit('error', 'Room not found');
      return;
    }
    client.join(roomId);
    this.server.to(roomId).emit('room_updated', room);
    client.emit('room_joined', room);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.sub;
    const room = await this.gameService.leaveRoom(roomId, userId);
    client.leave(roomId);
    if (room) {
      this.server.to(roomId).emit('room_updated', room);
    }
  }

  @SubscribeMessage('invite_to_room')
  async handleInviteToRoom(
    @MessageBody() data: { targetUserId: string; roomId: string },
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
    @MessageBody() data: { roomId: string; isReady: boolean },
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
    @MessageBody() data: { roomId: string; settings: any },
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
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
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

      const state = await this.gameService.startGame(roomId, client.data.user.sub, emitCb);
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
    @MessageBody()
    data: { roomId: string; targetId: string; actionType: string },
    @ConnectedSocket() client: Socket,
  ) {
    const success = await this.gameService.handleNightAction(
      data.roomId,
      client.data.user.sub,
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
    @MessageBody() data: { roomId: string; targetId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const success = await this.gameService.handleVote(
      data.roomId,
      client.data.user.sub,
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
    @MessageBody() data: { roomId: string; lastWill: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = await this.gameService.getGameState(data.roomId);
    if (!state) return;
    const player = state.players.find((p) => p.userId === client.data.user.sub);
    if (player && player.isAlive) {
      player.lastWill = data.lastWill.substring(0, 150); // limit length
      await this.gameService.saveGameState(state);
      client.emit('system_chat', 'Заповіт збережено.');
    }
  }

  @SubscribeMessage('place_bet')
  async handlePlaceBet(
    @MessageBody() data: { roomId: string; faction: string; amount: number },
    @ConnectedSocket() client: Socket,
  ) {
    const result = await this.gameService.placeBet(data.roomId, client.data.user.sub, data.faction, data.amount);
    if (!result.success) {
      client.emit('error', result.error);
    } else {
      client.emit('system_chat', `Ставку ${data.amount} монет на фракцію "${data.faction}" прийнято.`);
      this.broadcastGameState(data.roomId);
    }
  }

  @SubscribeMessage('whisper')
  async handleWhisper(
    @MessageBody() data: { roomId: string; targetId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const success = await this.gameService.handleWhisper(
      data.roomId,
      client.data.user.sub,
      data.targetId,
      data.message,
      (userId, event, payload) => {
        this.server.in(data.roomId).fetchSockets().then((sockets) => {
          const s = sockets.find((sock) => sock.data.user.sub === userId);
          if (s) s.emit(event, payload);
        });
      }
    );
    if (!success) {
      client.emit('error', 'Не вдалося надіслати шепіт (перевірте баланс або ціль).');
    }
  }

  @SubscribeMessage('admin_action')
  async handleAdminAction(
    @MessageBody() data: { targetUsername: string; action: 'KICK' | 'BAN' | 'MUTE' },
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
      }
    );

    if (success) {
      client.emit('system_chat', `Команду ${data.action} успішно застосовано до ${data.targetUsername}.`);
    } else {
      client.emit('error', 'Не вдалося виконати дію адміністратора.');
    }
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @MessageBody() data: { roomId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data || !data.roomId || !data.message) return;
    const state = await this.gameService.getGameState(data.roomId);
    const username = client.data?.user?.username || 'Unknown';
    const sub = client.data?.user?.sub;

    if (!sub) return;

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
      this.server.to(data.roomId).emit('chat_message', {
        sender: username,
        text: data.message,
        type: 'lobby',
      });
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

  /* ═══════════════════  ONLINE MATCHMAKING  ═══════════════════ */

  private onlineQueue: Map<string, { userId: string; username: string; socketId: string }> = new Map();
  private readonly MIN_PLAYERS_ONLINE = 6;

  @SubscribeMessage('join_online_queue')
  async handleJoinOnlineQueue(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub;
    const username = client.data?.user?.username;
    if (!userId || !username) return;

    // Add to queue
    this.onlineQueue.set(userId, { userId, username, socketId: client.id });
    client.emit('online_queue_update', { inQueue: this.onlineQueue.size });

    // Try to match
    if (this.onlineQueue.size >= this.MIN_PLAYERS_ONLINE) {
      const players = Array.from(this.onlineQueue.values()).slice(0, this.MIN_PLAYERS_ONLINE);

      // Create room with the first player as host
      const host = players[0];
      const roomId = await this.gameService.createRoom(host.userId, host.username);

      // Join all other players
      for (let i = 1; i < players.length; i++) {
        await this.gameService.joinRoom(roomId, players[i].userId, players[i].username);
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
    }
  }

  @SubscribeMessage('leave_online_queue')
  handleLeaveOnlineQueue(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub;
    if (userId) {
      this.onlineQueue.delete(userId);
      client.emit('online_queue_update', { inQueue: this.onlineQueue.size, left: true });
    }
  }
}
