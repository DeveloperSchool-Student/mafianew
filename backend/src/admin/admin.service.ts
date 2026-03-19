import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameGateway } from '../game/game.gateway';
import {
  getStaffPower,
  getMaxPunishSeconds,
  PERMISSION,
  STAFF_ROLES,
} from './admin.roles';
import { ensureMinPower, logAdminAction, PunishmentType } from './admin.helpers';
import { StaffManagementService } from './services/staff-management.service';
import { PunishmentsService } from './services/punishments.service';
import { EconomyService } from './services/economy.service';
import { ReportsService } from './services/reports.service';
import { AdminLogsService } from './services/admin-logs.service';
import { AppealsService } from './services/appeals.service';
import { UserModerationService } from './services/user-moderation.service';
import { EventsService } from './services/events.service';
import { SeasonsService } from './services/seasons.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
    private readonly staffManagement: StaffManagementService,
    private readonly punishments: PunishmentsService,
    private readonly economy: EconomyService,
    private readonly reports: ReportsService,
    private readonly adminLogs: AdminLogsService,
    private readonly appeals: AppealsService,
    private readonly userModeration: UserModerationService,
    private readonly events: EventsService,
    private readonly seasons: SeasonsService,
  ) { }

  /* ─── helpers ─── */

  private ensureMinPower(
    user: { id: string; role?: string; staffRoleKey?: string | null },
    minPower: number,
    label?: string,
  ) {
    return ensureMinPower(user, minPower, label);
  }

  private async logAction(
    actorId: string,
    action: string,
    targetId?: string | null,
    details?: string | null,
  ) {
    await logAdminAction(this.prisma, actorId, action, targetId, details);
  }

  /* ─── seed staff roles (idempotent) ─── */

  async seedStaffRoles() {
    for (const r of STAFF_ROLES) {
      await this.prisma.staffRole.upsert({
        where: { key: r.key },
        update: { title: r.title, power: r.power, color: r.color },
        create: { key: r.key, title: r.title, power: r.power, color: r.color },
      });
    }
  }

  /* ═══════════════════  STAFF MANAGEMENT  ═══════════════════ */

  async listStaff(requestUser: { id: string; staffRoleKey?: string | null }) {
    return this.staffManagement.listStaff(requestUser);
  }

  async setStaffRole(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; roleKey: string; confirmPin?: string },
  ) {
    return this.staffManagement.setStaffRole(requestUser, params);
  }

  async removeStaffRole(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string },
  ) {
    return this.staffManagement.removeStaffRole(requestUser, params);
  }

  /* ═══════════════════  USERS LIST  ═══════════════════ */

  async listUsers(
    requestUser: { id: string; staffRoleKey?: string | null },
    cursor?: string,
    limit: number = 50,
  ) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.VIEW_USERS,
      'Список користувачів',
    );
    const items = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        staffRoleKey: true,
        staffRole: true,
        createdAt: true,
        lastLoginAt: true,
        profile: {
          select: {
            mmr: true,
            matches: true,
            wins: true,
            losses: true,
            bannedUntil: true,
            mutedUntil: true,
            level: true,
            xp: true,
          },
        },
        wallet: {
          select: { soft: true, hard: true },
        },
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem!.id;
    }

    return { data: items, nextCursor };
  }

  /* ═══════════════════  PUNISHMENTS  ═══════════════════ */

  async getUserPunishments(
    requestUser: { id: string; staffRoleKey?: string | null },
    userId: string,
  ) {
    return this.punishments.getUserPunishments(requestUser, userId);
  }

  async punishUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: {
      targetUsername: string;
      type: PunishmentType;
      durationSeconds?: number | null;
      scope?: string;
      reason?: string;
    },
  ) {
    return this.punishments.punishUser(requestUser, params);
  }

  async unpunishUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; type: PunishmentType },
  ) {
    return this.punishments.unpunishUser(requestUser, params);
  }

  /* ═══════════════════  GOLD / EXP  ═══════════════════ */

  async adjustGold(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; delta: number },
  ) {
    return this.economy.adjustGold(requestUser, params);
  }

  async adjustExp(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; delta: number },
  ) {
    return this.economy.adjustExp(requestUser, params);
  }

  /* ═══════════════════  CHANGE NICKNAME  ═══════════════════ */

  async changeNickname(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; newUsername: string },
  ) {
    return this.staffManagement.changeNickname(requestUser, params);
  }

  /* ═══════════════════  REPORTS  ═══════════════════ */

  async createReport(
    reporterId: string,
    params: { targetUsername: string; reason: string; screenshotUrl?: string },
  ) {
    return this.reports.createReport(reporterId, params);
  }

  async listReports(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    return this.reports.listReports(requestUser, status);
  }

  async resolveReport(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: {
      reportId: string;
      status: 'RESOLVED' | 'REJECTED';
      note?: string;
    },
  ) {
    return this.reports.resolveReport(requestUser, params);
  }

  /* ═══════════════════  ACTION LOGS  ═══════════════════ */

  async getActionLogs(
    requestUser: { id: string; staffRoleKey?: string | null },
    cursor?: string,
    limit: number = 50,
  ) {
    return this.adminLogs.getActionLogs(requestUser, cursor, limit);
  }

  async clearLogs(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { olderThanDays?: number },
  ) {
    return this.adminLogs.clearLogs(requestUser, params);
  }

  /* ═══════════════════  MY REPORTS  ═══════════════════ */

  async getMyReports(userId: string) {
    return this.reports.getMyReports(userId);
  }

  /* ═══════════════════  DELETE USER  ═══════════════════ */

  async deleteUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string },
  ) {
    return this.userModeration.deleteUser(requestUser, params);
  }

  /* ═══════════════════  ACTIVE ROOMS  ═══════════════════ */

  async getActiveRooms(requestUser: {
    id: string;
    staffRoleKey?: string | null;
  }) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_ROOMS, 'Перегляд кімнат');
    const redis = this.redisService.getClient();
    const keys = await redis.keys('room:*');
    const rooms = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        try {
          const room = JSON.parse(data);
          let phase = 'WAITING';
          let dayCount = 0;
          if (room.status === 'IN_PROGRESS') {
            const stateData = await redis.get(`state:${room.id}`);
            if (stateData) {
              const state = JSON.parse(stateData);
              phase = state.phase || 'IN_PROGRESS';
              dayCount = state.dayCount || 0;
            }
          }
          rooms.push({
            id: room.id,
            status: room.status,
            playersCount: Array.isArray(room.players) ? room.players.length : 0,
            hostId: room.hostId,
            phase,
            dayCount,
          });
        } catch { }
      }
    }
    return rooms;
  }

  async closeRoom(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { roomId: string },
  ) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.VIEW_ROOMS,
      'Закриття кімнати',
    );

    const redis = this.redisService.getClient();
    const roomData = await redis.get(`room:${params.roomId}`);
    if (!roomData) throw new NotFoundException('Кімнату не знайдено');

    this.gameGateway.server.to(params.roomId).emit('system_chat', 'Кімнату було закрито адміністратором.');
    this.gameGateway.server.to(params.roomId).emit('kicked_from_room', {
      roomId: params.roomId,
      reason: 'Кімнату закрив адміністратор.',
    });

    const sockets = await this.gameGateway.server.in(params.roomId).fetchSockets();
    for (const s of sockets) {
      s.leave(params.roomId);
    }

    await redis.del(`room:${params.roomId}`);
    await redis.del(`game:${params.roomId}`);
    await redis.del(`state:${params.roomId}`);

    await this.logAction(
      requestUser.id,
      'CLOSE_ROOM',
      null,
      `Адміністратор закрив кімнату ${params.roomId}`,
    );

    return { success: true };
  }

  /* ═══════════════════  TITLES (LEADERS)  ═══════════════════ */

  async setPlayerTitle(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; title: string | null },
  ) {
    return this.userModeration.setPlayerTitle(requestUser, params);
  }

  /* ═══════════════════  APPEALS  ═══════════════════ */

  async submitAppeal(
    userId: string,
    params: { type: 'UNBAN' | 'UNMUTE'; reason: string },
  ) {
    return this.appeals.submitAppeal(userId, params);
  }

  async listAppeals(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    return this.appeals.listAppeals(requestUser, status);
  }

  async resolveAppeal(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { appealId: string; status: 'APPROVED' | 'REJECTED' },
  ) {
    return this.appeals.resolveAppeal(requestUser, params);
  }

  /* ═══════════════════  EVENTS  ═══════════════════ */

  async launchEvent(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { eventName: string; rewardCoins?: number; eventRoles?: string[] },
  ) {
    return this.events.launchEvent(requestUser, params);
  }

  /* ═══════════════════  CLAN WARS  ═══════════════════ */

  async listClanWars(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    return this.events.listClanWars(requestUser, status);
  }

  async resolveClanWar(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { warId: string; winnerId: string | null },
  ) {
    return this.events.resolveClanWar(requestUser, params);
  }

  /* ── Stats ── */

  async getGlobalStats(requestUser: {
    id: string;
    staffRoleKey?: string | null;
  }) {
    return this.events.getGlobalStats(requestUser);
  }

  /* ── Seasons ── */

  async getSeasons(requestUser: { id: string; staffRoleKey?: string | null }) {
    return this.seasons.getSeasons(requestUser);
  }

  async startSeason(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { name: string },
  ) {
    return this.seasons.startSeason(requestUser, params);
  }

  async endSeason(requestUser: { id: string; staffRoleKey?: string | null }) {
    return this.seasons.endSeason(requestUser);
  }
}
