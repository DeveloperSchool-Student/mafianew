import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
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

// Prisma models that reference User — used for cascade delete
const USER_RELATIONS = [
  'punishments', 'sentMessages', 'receivedMessages',
  'friendships', 'friendRelations', 'collections',
  'actionLogsAsActor', 'actionLogsAsTarget',
  'reportsAsReporter', 'reportsAsTarget',
] as const;

type PunishmentType = 'BAN' | 'MUTE' | 'KICK';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly gameGateway: GameGateway,
  ) { }

  /* ─── helpers ─── */

  private ensureMinPower(
    user: { id: string; role?: string; staffRoleKey?: string | null },
    minPower: number,
    label?: string,
  ) {
    const power = getStaffPower(user.staffRoleKey);
    if (power < minPower) {
      throw new ForbiddenException(
        `Недостатньо прав${label ? ` для дії «${label}»` : ''}. Потрібен мін. рівень ${minPower}.`,
      );
    }
    return power;
  }

  private async logAction(
    actorId: string,
    action: string,
    targetId?: string | null,
    details?: string | null,
  ) {
    await this.prisma.adminActionLog.create({
      data: { actorId, action, targetId, details },
    });
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
    this.ensureMinPower(requestUser, PERMISSION.MANAGE_STAFF, 'Персонал');
    return this.prisma.user.findMany({
      where: { staffRoleKey: { not: null } },
      select: {
        id: true,
        username: true,
        staffRoleKey: true,
        staffRole: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { staffRole: { power: 'desc' } },
    });
  }

  async setStaffRole(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; roleKey: string },
  ) {
    const actorPower = this.ensureMinPower(requestUser, PERMISSION.MANAGE_STAFF, 'Зміна ролі');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const targetRole = STAFF_ROLES.find((r) => r.key === params.roleKey);
    if (!targetRole) throw new BadRequestException('Невідома роль');

    // Cannot assign a role with power >= your own (except OWNER can do anything)
    if (targetRole.power >= actorPower && actorPower < 9) {
      throw new ForbiddenException('Не можна призначити роль рівну або вищу за свою.');
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { staffRoleKey: params.roleKey, role: params.roleKey },
    });

    await this.logAction(
      requestUser.id,
      'SET_STAFF_ROLE',
      target.id,
      `Призначено роль ${params.roleKey} (${targetRole.title})`,
    );

    return { success: true };
  }

  async removeStaffRole(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string },
  ) {
    const actorPower = this.ensureMinPower(requestUser, PERMISSION.MANAGE_STAFF, 'Зняття ролі');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { staffRole: true },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= actorPower && actorPower < 9) {
      throw new ForbiddenException('Не можна зняти роль з адміна рівного або вищого за вас.');
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { staffRoleKey: null, role: 'USER' },
    });

    await this.logAction(
      requestUser.id,
      'REMOVE_STAFF_ROLE',
      target.id,
      `Знято роль ${target.staffRoleKey}`,
    );

    return { success: true };
  }

  /* ═══════════════════  USERS LIST  ═══════════════════ */

  async listUsers(requestUser: { id: string; staffRoleKey?: string | null }) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_USERS, 'Список користувачів');
    return this.prisma.user.findMany({
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
      take: 200,
    });
  }

  /* ═══════════════════  PUNISHMENTS  ═══════════════════ */

  async getUserPunishments(
    requestUser: { id: string; staffRoleKey?: string | null },
    userId: string,
  ) {
    this.ensureMinPower(requestUser, PERMISSION.PUNISH, 'Покарання');
    return this.prisma.punishment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
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
    // Base permission required just to open the punishment panel / access the endpoint
    const power = this.ensureMinPower(requestUser, PERMISSION.PUNISH, 'Покарання');

    // MUTE requires Lv.2 (Helper)
    if (params.type === 'MUTE') {
      this.ensureMinPower(requestUser, PERMISSION.PUNISH_MUTE, 'Видача Муту');
    }
    // KICK requires Lv.3 (Moderator)
    if (params.type === 'KICK') {
      this.ensureMinPower(requestUser, PERMISSION.PUNISH_KICK, 'Викидання з кімнати (Кік)');
    }
    // BAN requires Lv.4 (Senior Moderator)
    if (params.type === 'BAN') {
      this.ensureMinPower(requestUser, PERMISSION.PUNISH_BAN, 'Видача Бану');
    }

    // Permanent (durationSeconds null or 0 means infinite) requires Administrator (Lv.6)
    const isPermanent = !params.durationSeconds || params.durationSeconds <= 0;
    if (isPermanent && params.type !== 'KICK') {
      this.ensureMinPower(requestUser, 6, 'Перманентне покарання (назавжди)');
    }

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { profile: true },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    // Hierarchy check: cannot punish staff of equal or higher rank
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException(
        'Не можна карати адміна рівного або вищого за вас.',
      );
    }

    // Enforce max duration limits based on staff level
    if (!isPermanent) {
      const maxSec = getMaxPunishSeconds(power);
      if (params.durationSeconds! > maxSec) {
        throw new ForbiddenException(
          `Ваш максимальний термін покарання: ${maxSec} сек.`,
        );
      }
    }

    const now = new Date();
    let expiresAt: Date | null = null;
    if (!isPermanent) {
      expiresAt = new Date(now.getTime() + params.durationSeconds! * 1000);
    }

    const scope = params.scope || 'GLOBAL';

    await this.prisma.punishment.create({
      data: {
        userId: target.id,
        type: params.type,
        scope,
        reason: params.reason,
        createdBy: requestUser.id,
        expiresAt: expiresAt ?? undefined,
      },
    });

    if (params.type === 'BAN') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { bannedUntil: expiresAt },
      });
    }
    if (params.type === 'MUTE') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { mutedUntil: expiresAt },
      });
    }

    await this.logAction(
      requestUser.id,
      'PUNISH',
      target.id,
      `${params.type} ${params.durationSeconds || 'permanent'}s scope=${scope} reason=${params.reason || '—'}`,
    );

    return { success: true };
  }

  async unpunishUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; type: PunishmentType },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.PUNISH, 'Зняття покарання');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { profile: true },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException('Не можна знімати покарання з адміна рівного або вищого за вас.');
    }

    if (params.type === 'BAN') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { bannedUntil: null },
      });
    }
    if (params.type === 'MUTE') {
      await this.prisma.profile.update({
        where: { userId: target.id },
        data: { mutedUntil: null },
      });
    }

    await this.prisma.punishment.updateMany({
      where: { userId: target.id, type: params.type, expiresAt: null },
      data: { expiresAt: new Date() },
    });

    await this.logAction(requestUser.id, 'UNPUNISH', target.id, params.type);

    return { success: true };
  }

  /* ═══════════════════  GOLD / EXP  ═══════════════════ */

  async adjustGold(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; delta: number },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.ADJUST_GOLD, 'Зміна золота');
    if (!params.delta || params.delta === 0) {
      throw new BadRequestException('Сума зміни повинна бути ненульовою');
    }
    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException('Не можна змінювати золото адміну рівному або вищому за вас.');
    }
    await this.prisma.wallet.update({
      where: { userId: target.id },
      data: { soft: { increment: params.delta } },
    });
    await this.logAction(
      requestUser.id,
      'ADJUST_GOLD',
      target.id,
      `${params.delta > 0 ? '+' : ''}${params.delta}`,
    );
    return { success: true };
  }

  async adjustExp(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; delta: number },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.ADJUST_EXP, 'Зміна досвіду');

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException('Не можна змінювати досвід адміну рівному або вищому за вас.');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: target.id },
    });
    if (!profile) throw new NotFoundException('Профіль не знайдено');

    let newXp = profile.xp + params.delta;
    let newLevel = profile.level;

    while (newXp >= newLevel * 500) {
      newXp -= newLevel * 500;
      newLevel++;
    }
    while (newLevel > 1 && newXp < 0) {
      newLevel--;
      newXp += newLevel * 500;
    }
    if (newLevel === 1 && newXp < 0) newXp = 0;

    await this.prisma.profile.update({
      where: { userId: target.id },
      data: { xp: newXp, level: newLevel },
    });

    await this.logAction(
      requestUser.id,
      'ADJUST_EXP',
      target.id,
      `${params.delta > 0 ? '+' : ''}${params.delta} → level ${newLevel}, xp ${newXp}`,
    );

    return { success: true };
  }

  /* ═══════════════════  CHANGE NICKNAME  ═══════════════════ */

  async changeNickname(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; newUsername: string },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.CHANGE_NICKNAME, 'Зміна нікнейму');
    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException('Не можна змінювати нікнейм адміну рівному або вищому за вас.');
    }

    const username = params.newUsername.trim();
    if (username.length < 3 || username.length > 20) {
      throw new BadRequestException('Нікнейм має бути від 3 до 20 символів.');
    }
    const bannedWords = [
      'fuck', 'shit', 'сука', 'бляд', 'хуй', 'пизд', 'еба', 'нахуй',
    ];
    const lower = username.toLowerCase();
    if (bannedWords.some((w) => lower.includes(w))) {
      throw new BadRequestException('Нікнейм містить заборонені слова.');
    }

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== target.id) {
      throw new BadRequestException('Такий нікнейм уже зайнятий.');
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { username },
    });

    await this.logAction(
      requestUser.id,
      'CHANGE_NICKNAME',
      target.id,
      `${params.targetUsername} → ${username}`,
    );

    return { success: true };
  }

  /* ═══════════════════  REPORTS  ═══════════════════ */

  async createReport(
    reporterId: string,
    params: { targetUsername: string; reason: string; screenshotUrl?: string },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    if (target.id === reporterId) {
      throw new BadRequestException('Не можна скаржитися на самого себе.');
    }

    return this.prisma.report.create({
      data: {
        reporterId,
        targetId: target.id,
        reason: params.reason,
        screenshotUrl: params.screenshotUrl,
      },
    });
  }

  async listReports(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_REPORTS, 'Перегляд скарг');
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: { select: { username: true } },
        target: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveReport(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { reportId: string; status: 'RESOLVED' | 'REJECTED'; note?: string },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.RESOLVE_REPORTS, 'Розгляд скарги');

    const report = await this.prisma.report.findUnique({
      where: { id: params.reportId },
    });
    if (!report) throw new NotFoundException('Скаргу не знайдено');

    await this.prisma.report.update({
      where: { id: params.reportId },
      data: {
        status: params.status,
        resolvedBy: requestUser.id,
        resolvedNote: params.note,
      },
    });

    await this.logAction(
      requestUser.id,
      'RESOLVE_REPORT',
      report.targetId,
      `Report ${params.reportId} → ${params.status}: ${params.note || '—'}`,
    );

    // Emit notification to reporter
    this.gameGateway.server.to(report.reporterId).emit('notification', {
      type: params.status === 'RESOLVED' ? 'success' : 'info',
      title: 'Скаргу розглянуто',
      message: `Ваша скарга на користувача була розглянута адміністратором. Статус: ${params.status}.`
    });

    return { success: true };
  }

  /* ═══════════════════  ACTION LOGS  ═══════════════════ */

  async getActionLogs(requestUser: { id: string; staffRoleKey?: string | null }) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_ADMIN_LOGS, 'Логи дій');
    return this.prisma.adminActionLog.findMany({
      include: {
        actor: { select: { username: true } },
        target: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /* ═══════════════════  MY REPORTS  ═══════════════════ */

  async getMyReports(userId: string) {
    return this.prisma.report.findMany({
      where: { reporterId: userId },
      include: {
        target: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /* ═══════════════════  DELETE USER  ═══════════════════ */

  async deleteUser(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string },
  ) {
    const actorPower = this.ensureMinPower(
      requestUser,
      PERMISSION.DELETE_USER,
      'Видалення акаунту',
    );

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    if (target.id === requestUser.id) {
      throw new BadRequestException('Не можна видалити свій акаунт.');
    }

    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= actorPower && actorPower < 9) {
      throw new ForbiddenException(
        'Не можна видалити акаунт адміна рівного або вищого за вас.',
      );
    }

    // Cascade delete: remove all related records first
    const userId = target.id;

    await this.prisma.$transaction(async (tx) => {
      // Delete quests
      const profile = await tx.profile.findUnique({ where: { userId } });
      if (profile) {
        await tx.userQuest.deleteMany({ where: { profileId: profile.id } });
        await tx.achievement.deleteMany({ where: { profileId: profile.id } });
        await tx.matchParticipant.deleteMany({ where: { profileId: profile.id } });
      }

      await tx.punishment.deleteMany({ where: { userId } });
      await tx.privateMessage.deleteMany({ where: { OR: [{ fromId: userId }, { toId: userId }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } });
      await tx.userCollection.deleteMany({ where: { userId } });
      await tx.adminActionLog.deleteMany({ where: { OR: [{ actorId: userId }, { targetId: userId }] } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: userId }, { targetId: userId }] } });
      await tx.wallet.deleteMany({ where: { userId } });
      if (profile) {
        await tx.profile.delete({ where: { userId } });
      }
      await tx.user.delete({ where: { id: userId } });
    });

    await this.logAction(
      requestUser.id,
      'DELETE_USER',
      null,
      `Видалено акаунт ${params.targetUsername} (ID: ${userId})`,
    );

    return { success: true };
  }

  /* ═══════════════════  ACTIVE ROOMS  ═══════════════════ */

  async getActiveRooms(requestUser: { id: string; staffRoleKey?: string | null }) {
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

  /* ═══════════════════  TITLES (LEADERS)  ═══════════════════ */

  async setPlayerTitle(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; title: string | null },
  ) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.SET_TITLE,
      'Видача титулу',
    );

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { profile: true },
    });

    if (!target) throw new NotFoundException('Користувача не знайдено');
    if (!target.profile) throw new NotFoundException('Профіль не знайдено');

    // Update the player's title in their profile
    await this.prisma.profile.update({
      where: { id: target.profile.id },
      data: { title: params.title },
    });

    // Log the action
    const displayTitle = params.title ? `«${params.title}»` : 'Знято';
    await this.logAction(
      requestUser.id,
      'SET_TITLE',
      target.id,
      `Встановлено титул: ${displayTitle}`,
    );

    return { success: true };
  }

  /* ═══════════════════  APPEALS  ═══════════════════ */

  async submitAppeal(
    userId: string,
    params: { type: 'UNBAN' | 'UNMUTE'; reason: string },
  ) {
    if (!params.reason || params.reason.trim().length < 10) {
      throw new BadRequestException('Причина має бути детальною (мінімум 10 символів).');
    }

    // Check if there is already a pending appeal for this user
    const existing = await this.prisma.appeal.findFirst({
      where: { userId, status: 'PENDING' },
    });

    if (existing) {
      throw new BadRequestException('У вас вже є нерозглянута апеляція.');
    }

    return this.prisma.appeal.create({
      data: {
        userId,
        type: params.type,
        reason: params.reason,
      },
    });
  }

  async listAppeals(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_APPEALS, 'Перегляд апеляцій');
    return this.prisma.appeal.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveAppeal(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { appealId: string; status: 'APPROVED' | 'REJECTED' },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.RESOLVE_APPEALS, 'Розгляд апеляції');

    const appeal = await this.prisma.appeal.findUnique({
      where: { id: params.appealId },
      include: { user: true },
    });

    if (!appeal) throw new NotFoundException('Апеляцію не знайдено');
    if (appeal.status !== 'PENDING') {
      throw new BadRequestException('Ця апеляція вже розглянута.');
    }

    await this.prisma.appeal.update({
      where: { id: params.appealId },
      data: {
        status: params.status,
        resolvedBy: requestUser.id,
      },
    });

    // If approved, lift the punishment immediately
    if (params.status === 'APPROVED') {
      if (appeal.type === 'UNBAN') {
        await this.prisma.profile.update({
          where: { userId: appeal.userId },
          data: { bannedUntil: null },
        });
        await this.prisma.punishment.updateMany({
          where: { userId: appeal.userId, type: 'BAN', expiresAt: null },
          data: { expiresAt: new Date() },
        });
      } else if (appeal.type === 'UNMUTE') {
        await this.prisma.profile.update({
          where: { userId: appeal.userId },
          data: { mutedUntil: null },
        });
        await this.prisma.punishment.updateMany({
          where: { userId: appeal.userId, type: 'MUTE', expiresAt: null },
          data: { expiresAt: new Date() },
        });
      }
    }

    await this.logAction(
      requestUser.id,
      'RESOLVE_APPEAL',
      appeal.userId,
      `Appeal ${params.appealId} (${appeal.type}) → ${params.status}`,
    );

    // Emit notification to user
    const actionText = appeal.type === 'UNBAN' ? 'Блокування' : 'Мут';
    const statusText = params.status === 'APPROVED' ? 'СХВАЛЕНО' : 'ВІДХИЛЕНО';

    this.gameGateway.server.to(appeal.userId).emit('notification', {
      type: params.status === 'APPROVED' ? 'success' : 'error',
      title: 'Апеляцію розглянуто',
      message: `Ваша апеляція на ${actionText} була розглянута. Статус: ${statusText}.`
    });

    return { success: true };
  }

  /* ═══════════════════  EVENTS  ═══════════════════ */

  async launchEvent(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { eventName: string; rewardCoins?: number; eventRoles?: string[] },
  ) {
    const power = this.ensureMinPower(requestUser, PERMISSION.EVENTS, 'Запуск Івенту'); // Only owner

    if (!params.eventName || params.eventName.trim().length < 3) {
      throw new BadRequestException('Назва івенту занадто коротка');
    }

    // 1. Give reward to all users
    let targetCount = 0;
    if (params.rewardCoins && params.rewardCoins > 0) {
      const result = await this.prisma.wallet.updateMany({
        data: { soft: { increment: params.rewardCoins } },
      });
      targetCount = result.count;
    }

    // 2. Store event roles in Redis global config
    const activatedRoles: string[] = [];
    const redis = this.redisService.getClient();
    if (params.eventRoles && params.eventRoles.length > 0) {
      const validRoles = ['KRAMPUS', 'CUPID', 'SNOWMAN', 'WITCH', 'SANTA', 'GHOST'];
      const filtered = params.eventRoles.filter(r => validRoles.includes(r));
      if (filtered.length > 0) {
        await redis.set('global:eventRoles', JSON.stringify(filtered));
        await redis.set('global:eventName', params.eventName);
        activatedRoles.push(...filtered);
      }
    }

    // 3. Broadcast global notification
    const rolesText = activatedRoles.length > 0
      ? ` Увімкнені спеціальні ролі: ${activatedRoles.join(', ')}!`
      : '';

    this.gameGateway.server.emit('notification', {
      type: 'success',
      title: '🌟 ГЛОБАЛЬНИЙ ІВЕНТ!',
      message: `Стартував івент «${params.eventName}»! ${params.rewardCoins ? `Усі гравці отримали ${params.rewardCoins} монет!` : ''}${rolesText}`,
      duration: 10000
    });

    await this.logAction(
      requestUser.id,
      'LAUNCH_EVENT',
      null,
      `Launched event: ${params.eventName} with ${params.rewardCoins || 0} coins to ${targetCount} users. Event roles: ${activatedRoles.join(', ') || 'none'}`,
    );

    return {
      success: true,
      message: 'Івент успішно запущено.',
      rewardedUsers: targetCount,
      activatedRoles,
    };
  }

  /* ═══════════════════  CLAN WARS  ═══════════════════ */

  async listClanWars(requestUser: { id: string; staffRoleKey?: string | null }, status?: string) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_CLAN_WARS, 'Перегляд Війн Кланів');
    return this.prisma.clanWar.findMany({
      where: status ? { status } : undefined,
      include: {
        challenger: { select: { id: true, name: true, rating: true } },
        target: { select: { id: true, name: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolveClanWar(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { warId: string; winnerId: string | null },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.RESOLVE_CLAN_WARS, 'Вирішення Війн Кланів');

    const war = await this.prisma.clanWar.findUnique({
      where: { id: params.warId },
    });

    if (!war) throw new NotFoundException('Війну не знайдено');
    if (war.status !== 'ACTIVE') {
      throw new BadRequestException('Ця війна не є активною (або вже завершена).');
    }

    const bet = war.customBet > 0 ? war.customBet : 25; // default rating change

    if (params.winnerId) {
      if (params.winnerId !== war.challengerId && params.winnerId !== war.targetId) {
        throw new BadRequestException('Переможець має бути одним із кланів у війні.');
      }
      const loserId = params.winnerId === war.challengerId ? war.targetId : war.challengerId;

      const winnerClan = await this.prisma.clan.findUnique({ where: { id: params.winnerId } });
      const loserClan = await this.prisma.clan.findUnique({ where: { id: loserId } });

      await this.prisma.$transaction([
        this.prisma.clan.update({
          where: { id: params.winnerId },
          data: { rating: (winnerClan?.rating || 0) + bet },
        }),
        this.prisma.clan.update({
          where: { id: loserId },
          data: { rating: Math.max(0, (loserClan?.rating || 0) - bet) },
        }),
        this.prisma.clanWar.update({
          where: { id: params.warId },
          data: {
            status: 'FINISHED',
            winnerId: params.winnerId,
            ratingChange: bet,
            endedAt: new Date(),
          },
        }),
      ]);
    } else {
      // Draw
      await this.prisma.clanWar.update({
        where: { id: params.warId },
        data: {
          status: 'FINISHED',
          winnerId: null,
          ratingChange: 0,
          endedAt: new Date(),
        },
      });
    }

    await this.logAction(
      requestUser.id,
      'RESOLVE_CLAN_WAR',
      null,
      `ClanWar ${params.warId} resolved. WinnerId: ${params.winnerId || 'DRAW'}`,
    );

    return { success: true };
  }
}
