import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) { }

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
    const power = this.ensureMinPower(requestUser, PERMISSION.PUNISH, 'Покарання');

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

    // Enforce max duration
    const maxSec = getMaxPunishSeconds(power);
    if (
      params.durationSeconds &&
      params.durationSeconds > 0 &&
      params.durationSeconds > maxSec
    ) {
      throw new ForbiddenException(
        `Ваш максимальний термін покарання: ${maxSec} сек.`,
      );
    }

    const now = new Date();
    let expiresAt: Date | null = null;
    if (params.durationSeconds && params.durationSeconds > 0) {
      expiresAt = new Date(now.getTime() + params.durationSeconds * 1000);
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

    return { success: true };
  }

  /* ═══════════════════  ACTION LOGS  ═══════════════════ */

  async getActionLogs(requestUser: { id: string; staffRoleKey?: string | null }) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_LOGS, 'Логи дій');
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
}
