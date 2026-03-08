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

// Prisma models that reference User — used for cascade delete
const USER_RELATIONS = [
  'punishments',
  'sentMessages',
  'receivedMessages',
  'friendships',
  'friendRelations',
  'collections',
  'actionLogsAsActor',
  'actionLogsAsTarget',
  'reportsAsReporter',
  'reportsAsTarget',
] as const;

type PunishmentType = 'BAN' | 'MUTE' | 'KICK' | 'WARN';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

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
    params: { targetUsername: string; roleKey: string; confirmPin?: string },
  ) {
    const actorPower = this.ensureMinPower(
      requestUser,
      PERMISSION.MANAGE_STAFF,
      'Зміна ролі',
    );

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const targetRole = STAFF_ROLES.find((r) => r.key === params.roleKey);
    if (!targetRole) throw new BadRequestException('Невідома роль');

    // Cannot assign a role with power >= your own (except OWNER can do anything)
    if (targetRole.power >= actorPower && actorPower < 9) {
      throw new ForbiddenException(
        'Не можна призначити роль рівну або вищу за свою.',
      );
    }

    // Confirmation for Curator (Lv.8) assigning roles Lv.7+
    if (targetRole.power >= 7 && actorPower === 8) {
      if (!params.confirmPin || params.confirmPin !== 'CONFIRM') {
        throw new ForbiddenException(
          'Для призначення ролі рівня 7+ потрібне підтвердження. Передайте confirmPin: "CONFIRM".',
        );
      }
    }

    const oldRoleKey = target.staffRoleKey;
    const oldRole = oldRoleKey
      ? STAFF_ROLES.find((r) => r.key === oldRoleKey)
      : null;

    await this.prisma.user.update({
      where: { id: target.id },
      data: { staffRoleKey: params.roleKey, role: params.roleKey },
    });

    // Detailed logging with actor info, old role, new role, and timestamp
    const actor = await this.prisma.user.findUnique({
      where: { id: requestUser.id },
      select: { username: true },
    });
    await this.logAction(
      requestUser.id,
      'SET_STAFF_ROLE',
      target.id,
      `Призначено роль ${params.roleKey} (${targetRole.title}) | Попередня: ${oldRoleKey || 'USER'} (${oldRole?.title || 'Гравець'}) | Актор: ${actor?.username || requestUser.id} | Час: ${new Date().toISOString()}`,
    );

    // WebSocket notification to the target user about role change
    try {
      const targetSocketId = (this.gameGateway as any).userSockets?.get(
        target.id,
      );
      if (targetSocketId) {
        this.gameGateway.server.to(targetSocketId).emit('staff_role_changed', {
          roleKey: params.roleKey,
          roleTitle: targetRole.title,
          roleColor: targetRole.color,
          rolePower: targetRole.power,
          message: `Вашу посаду змінено на: ${targetRole.title}`,
        });
      }
    } catch {}

    return { success: true };
  }

  async removeStaffRole(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string },
  ) {
    const actorPower = this.ensureMinPower(
      requestUser,
      PERMISSION.MANAGE_STAFF,
      'Зняття ролі',
    );

    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
      include: { staffRole: true },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= actorPower && actorPower < 9) {
      throw new ForbiddenException(
        'Не можна зняти роль з адміна рівного або вищого за вас.',
      );
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
    const power = this.ensureMinPower(
      requestUser,
      PERMISSION.PUNISH_WARN,
      'Покарання',
    );

    // WARN requires Lv.1 (Trainee)
    if (params.type === 'WARN') {
      this.ensureMinPower(requestUser, PERMISSION.PUNISH_WARN, 'Попередження');
    }
    // MUTE requires Lv.2 (Helper)
    if (params.type === 'MUTE') {
      this.ensureMinPower(requestUser, PERMISSION.PUNISH_MUTE, 'Видача Муту');
    }
    // KICK requires Lv.3 (Moderator)
    if (params.type === 'KICK') {
      this.ensureMinPower(
        requestUser,
        PERMISSION.PUNISH_KICK,
        'Викидання з кімнати (Кік)',
      );
    }
    // BAN requires Lv.4 (Senior Moderator)
    if (params.type === 'BAN') {
      this.ensureMinPower(requestUser, PERMISSION.PUNISH_BAN, 'Видача Бану');
    }

    // Permanent (durationSeconds null or 0 means infinite) requires Administrator (Lv.6)
    const isPermanent = !params.durationSeconds || params.durationSeconds <= 0;
    if (isPermanent && params.type !== 'KICK' && params.type !== 'WARN') {
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
    if (!isPermanent && params.type !== 'WARN') {
      const maxSec = getMaxPunishSeconds(power);
      if (params.durationSeconds! > maxSec) {
        throw new ForbiddenException(
          `Ваш максимальний термін покарання: ${maxSec} сек.`,
        );
      }
    }

    const now = new Date();
    let expiresAt: Date | null = null;
    if (!isPermanent && params.type !== 'WARN') {
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
        expiresAt:
          params.type === 'WARN' ? undefined : (expiresAt ?? undefined),
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
      `${params.type} ${params.type === 'WARN' ? '' : (params.durationSeconds || 'permanent') + 's '}scope=${scope} reason=${params.reason || '—'}`,
    );

    // ── WARN Auto-Escalation ──
    if (params.type === 'WARN') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentWarns = await this.prisma.punishment.count({
        where: {
          userId: target.id,
          type: 'WARN',
          createdAt: { gte: sevenDaysAgo },
        },
      });

      // 5 WARNs in 7 days → auto BAN 3 days
      if (recentWarns >= 5) {
        const banExpires = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        await this.prisma.punishment.create({
          data: {
            userId: target.id,
            type: 'BAN',
            scope: 'GLOBAL',
            reason: `Автоматичний бан: ${recentWarns} попереджень за 7 днів`,
            createdBy: 'SYSTEM',
            expiresAt: banExpires,
          },
        });
        await this.prisma.profile.update({
          where: { userId: target.id },
          data: { bannedUntil: banExpires },
        });
        await this.logAction(
          'SYSTEM',
          'AUTO_BAN',
          target.id,
          `Автобан 3 дні: ${recentWarns} попереджень за 7 днів`,
        );

        // Notify about auto-ban
        try {
          const targetSocketId = (this.gameGateway as any).userSockets?.get(
            target.id,
          );
          if (targetSocketId) {
            this.gameGateway.server
              .to(targetSocketId)
              .emit('punishment_notification', {
                type: 'BAN',
                reason: `Автоматичний бан: ${recentWarns} попереджень за 7 днів`,
                expiresAt: banExpires.toISOString(),
                message: `Ваш акаунт заблоковано на 3 дні через ${recentWarns} попереджень за останні 7 днів.`,
              });
          }
        } catch {}
      }
      // 3 WARNs in 7 days → auto MUTE 24h
      else if (recentWarns >= 3) {
        const muteExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await this.prisma.punishment.create({
          data: {
            userId: target.id,
            type: 'MUTE',
            scope: 'GLOBAL',
            reason: `Автоматичний мут: ${recentWarns} попереджень за 7 днів`,
            createdBy: 'SYSTEM',
            expiresAt: muteExpires,
          },
        });
        await this.prisma.profile.update({
          where: { userId: target.id },
          data: { mutedUntil: muteExpires },
        });
        await this.logAction(
          'SYSTEM',
          'AUTO_MUTE',
          target.id,
          `Автомут 24 год: ${recentWarns} попереджень за 7 днів`,
        );

        // Notify about auto-mute
        try {
          const targetSocketId = (this.gameGateway as any).userSockets?.get(
            target.id,
          );
          if (targetSocketId) {
            this.gameGateway.server
              .to(targetSocketId)
              .emit('punishment_notification', {
                type: 'MUTE',
                reason: `Автоматичний мут: ${recentWarns} попереджень за 7 днів`,
                expiresAt: muteExpires.toISOString(),
                message: `Вам заборонено писати в чат на 24 години через ${recentWarns} попереджень за останні 7 днів.`,
              });
          }
        } catch {}
      }
    }

    // Real-time notification to the punished player
    try {
      const targetSocketId = (this.gameGateway as any).userSockets?.get(
        target.id,
      );
      if (targetSocketId) {
        this.gameGateway.server
          .to(targetSocketId)
          .emit('punishment_notification', {
            type: params.type,
            reason: params.reason || 'Порушення правил',
            durationSeconds:
              params.type === 'WARN' ? null : params.durationSeconds || null,
            expiresAt: expiresAt?.toISOString() || null,
            message:
              params.type === 'BAN'
                ? `Ваш акаунт заблоковано${expiresAt ? ' до ' + expiresAt.toLocaleString('uk-UA') : ' назавжди'}. Причина: ${params.reason || '—'}. Ви можете подати апеляцію у профілі.`
                : params.type === 'MUTE'
                  ? `Вам заборонено писати в чат${expiresAt ? ' до ' + expiresAt.toLocaleString('uk-UA') : ' назавжди'}. Причина: ${params.reason || '—'}.`
                  : params.type === 'WARN'
                    ? `⚠️ Ви отримали попередження. Причина: ${params.reason || '—'}. Увага: 3 попередження за 7 днів = автомут, 5 = автобан.`
                    : `Вас викинуто з кімнати. Причина: ${params.reason || '—'}.`,
          });
      }
    } catch {}

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
      throw new ForbiddenException(
        'Не можна знімати покарання з адміна рівного або вищого за вас.',
      );
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
      throw new ForbiddenException(
        'Не можна змінювати золото адміну рівному або вищому за вас.',
      );
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
      throw new ForbiddenException(
        'Не можна змінювати досвід адміну рівному або вищому за вас.',
      );
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
    this.ensureMinPower(
      requestUser,
      PERMISSION.CHANGE_NICKNAME,
      'Зміна нікнейму',
    );
    const target = await this.prisma.user.findUnique({
      where: { username: params.targetUsername },
    });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    const power = getStaffPower(requestUser.staffRoleKey);
    const targetPower = getStaffPower(target.staffRoleKey);
    if (targetPower >= power && power < 9) {
      throw new ForbiddenException(
        'Не можна змінювати нікнейм адміну рівному або вищому за вас.',
      );
    }

    const username = params.newUsername.trim();
    if (username.length < 3 || username.length > 20) {
      throw new BadRequestException('Нікнейм має бути від 3 до 20 символів.');
    }
    const bannedWords = [
      'fuck',
      'shit',
      'сука',
      'бляд',
      'хуй',
      'пизд',
      'еба',
      'нахуй',
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
    params: {
      reportId: string;
      status: 'RESOLVED' | 'REJECTED';
      note?: string;
    },
  ) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.RESOLVE_REPORTS,
      'Розгляд скарги',
    );

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

    // Notify reporter and target about report resolution
    try {
      const reporterSocketId = (this.gameGateway as any).userSockets?.get(
        report.reporterId,
      );
      if (reporterSocketId) {
        this.gameGateway.server.to(reporterSocketId).emit('report_resolved', {
          type: params.status === 'RESOLVED' ? 'success' : 'info',
          message: `Вашу скаргу було ${params.status === 'RESOLVED' ? 'розглянуто та вирішено' : 'відхилено'} адміністратором.${params.note ? ' Коментар: ' + params.note : ''}`,
        });
      }
      if (params.status === 'RESOLVED' && report.targetId) {
        const targetSocketId = (this.gameGateway as any).userSockets?.get(
          report.targetId,
        );
        if (targetSocketId) {
          this.gameGateway.server.to(targetSocketId).emit('report_resolved', {
            type: 'warning',
            message: `На вас було подано скаргу, яку адміністратор визнав обґрунтованою. Будь ласка, дотримуйтесь правил.`,
          });
        }
      }
    } catch {}

    return { success: true };
  }

  /* ═══════════════════  ACTION LOGS  ═══════════════════ */

  async getActionLogs(
    requestUser: { id: string; staffRoleKey?: string | null },
    cursor?: string,
    limit: number = 50,
  ) {
    this.ensureMinPower(requestUser, PERMISSION.VIEW_ADMIN_LOGS, 'Логи дій');
    const items = await this.prisma.adminActionLog.findMany({
      include: {
        actor: { select: { username: true } },
        target: { select: { username: true } },
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

  async clearLogs(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { olderThanDays?: number },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.CONFIG, 'Очищення логів');

    const where: any = {};
    if (params.olderThanDays && params.olderThanDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - params.olderThanDays);
      where.createdAt = { lt: cutoff };
    }

    const result = await this.prisma.adminActionLog.deleteMany({ where });

    await this.logAction(
      requestUser.id,
      'CLEAR_LOGS',
      null,
      params.olderThanDays
        ? `Видалено ${result.count} логів старших за ${params.olderThanDays} днів`
        : `Видалено всі логи (${result.count} записів)`,
    );

    return { deleted: result.count };
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
        await tx.matchParticipant.deleteMany({
          where: { profileId: profile.id },
        });
      }

      await tx.punishment.deleteMany({ where: { userId } });
      await tx.privateMessage.deleteMany({
        where: { OR: [{ fromId: userId }, { toId: userId }] },
      });
      await tx.friendship.deleteMany({
        where: { OR: [{ userId }, { friendId: userId }] },
      });
      await tx.userCollection.deleteMany({ where: { userId } });
      await tx.adminActionLog.deleteMany({
        where: { OR: [{ actorId: userId }, { targetId: userId }] },
      });
      await tx.report.deleteMany({
        where: { OR: [{ reporterId: userId }, { targetId: userId }] },
      });
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
        } catch {}
      }
    }
    return rooms;
  }

  /* ═══════════════════  TITLES (LEADERS)  ═══════════════════ */

  async setPlayerTitle(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; title: string | null },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.SET_TITLE, 'Видача титулу');

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
      throw new BadRequestException(
        'Причина має бути детальною (мінімум 10 символів).',
      );
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
    this.ensureMinPower(
      requestUser,
      PERMISSION.VIEW_APPEALS,
      'Перегляд апеляцій',
    );
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
    this.ensureMinPower(
      requestUser,
      PERMISSION.RESOLVE_APPEALS,
      'Розгляд апеляції',
    );

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
      message: `Ваша апеляція на ${actionText} була розглянута. Статус: ${statusText}.`,
    });

    return { success: true };
  }

  /* ═══════════════════  EVENTS  ═══════════════════ */

  async launchEvent(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { eventName: string; rewardCoins?: number; eventRoles?: string[] },
  ) {
    const power = this.ensureMinPower(
      requestUser,
      PERMISSION.EVENTS,
      'Запуск Івенту',
    ); // Only owner

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
      const validRoles = [
        'KRAMPUS',
        'CUPID',
        'SNOWMAN',
        'WITCH',
        'SANTA',
        'GHOST',
      ];
      const filtered = params.eventRoles.filter((r) => validRoles.includes(r));
      if (filtered.length > 0) {
        await redis.set('global:eventRoles', JSON.stringify(filtered));
        await redis.set('global:eventName', params.eventName);
        activatedRoles.push(...filtered);
      }
    }

    // 3. Broadcast global notification
    const rolesText =
      activatedRoles.length > 0
        ? ` Увімкнені спеціальні ролі: ${activatedRoles.join(', ')}!`
        : '';

    this.gameGateway.server.emit('notification', {
      type: 'success',
      title: '🌟 ГЛОБАЛЬНИЙ ІВЕНТ!',
      message: `Стартував івент «${params.eventName}»! ${params.rewardCoins ? `Усі гравці отримали ${params.rewardCoins} монет!` : ''}${rolesText}`,
      duration: 10000,
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

  async listClanWars(
    requestUser: { id: string; staffRoleKey?: string | null },
    status?: string,
  ) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.VIEW_CLAN_WARS,
      'Перегляд Війн Кланів',
    );
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
    this.ensureMinPower(
      requestUser,
      PERMISSION.RESOLVE_CLAN_WARS,
      'Вирішення Війн Кланів',
    );

    const war = await this.prisma.clanWar.findUnique({
      where: { id: params.warId },
    });

    if (!war) throw new NotFoundException('Війну не знайдено');
    if (war.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Ця війна не є активною (або вже завершена).',
      );
    }

    const bet = war.customBet > 0 ? war.customBet : 25; // default rating change

    if (params.winnerId) {
      if (
        params.winnerId !== war.challengerId &&
        params.winnerId !== war.targetId
      ) {
        throw new BadRequestException(
          'Переможець має бути одним із кланів у війні.',
        );
      }
      const loserId =
        params.winnerId === war.challengerId ? war.targetId : war.challengerId;

      const winnerClan = await this.prisma.clan.findUnique({
        where: { id: params.winnerId },
      });
      const loserClan = await this.prisma.clan.findUnique({
        where: { id: loserId },
      });

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

  /* ── Stats ── */

  async getGlobalStats(requestUser: {
    id: string;
    staffRoleKey?: string | null;
  }) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.VIEW_GAME_LOGS,
      'Перегляд статистики',
    );

    const totalUsers = await this.prisma.user.count();

    // Calculate games played today, week, month
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const matchesToday = await this.prisma.match.count({
      where: { createdAt: { gte: today } },
    });
    const matchesWeek = await this.prisma.match.count({
      where: { createdAt: { gte: lastWeek } },
    });
    const matchesMonth = await this.prisma.match.count({
      where: { createdAt: { gte: lastMonth } },
    });

    // Most popular roles
    const rolesQuery = await this.prisma.matchParticipant.groupBy({
      by: ['role'],
      _count: { role: true },
      orderBy: { _count: { role: 'desc' } },
      take: 5,
    });

    // Online players
    // Getting from game gateway sockets length
    const sockets = await this.gameGateway.server.fetchSockets();
    const online = sockets.length;

    return {
      totalUsers,
      online,
      matches: {
        today: matchesToday,
        week: matchesWeek,
        month: matchesMonth,
      },
      popularRoles: rolesQuery.map((r) => ({
        role: r.role,
        count: r._count.role,
      })),
    };
  }

  /* ── Seasons ── */

  async getSeasons(requestUser: { id: string; staffRoleKey?: string | null }) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.MANAGE_SERVER,
      'Перегляд сезонів',
    );
    return this.prisma.season.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { rewards: true } },
      },
    });
  }

  async startSeason(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { name: string },
  ) {
    this.ensureMinPower(requestUser, PERMISSION.MANAGE_SERVER, 'Старт сезону');

    const active = await this.prisma.season.findFirst({
      where: { isActive: true },
    });
    if (active)
      throw new BadRequestException(
        'Вже є активний сезон. Спочатку завершіть його.',
      );

    if (!params.name) throw new BadRequestException("Назва сезону обов'язкова");

    const season = await this.prisma.season.create({
      data: { name: params.name, isActive: true },
    });

    await this.logAction(
      requestUser.id,
      'START_SEASON',
      null,
      `Started season ${params.name}`,
    );
    return season;
  }

  async endSeason(requestUser: { id: string; staffRoleKey?: string | null }) {
    this.ensureMinPower(
      requestUser,
      PERMISSION.MANAGE_SERVER,
      'Завершення сезону',
    );

    const activeSeason = await this.prisma.season.findFirst({
      where: { isActive: true },
    });
    if (!activeSeason) throw new BadRequestException('Немає активних сезонів.');

    // Відображаємо топ 100 гравців за MMR
    const topPlayers = await this.prisma.profile.findMany({
      orderBy: { mmr: 'desc' },
      take: 100,
      include: { user: true },
    });

    const rewardsData = [];
    let rank = 1;

    for (const p of topPlayers) {
      if (p.mmr <= 1000) continue; // Нагороди тільки для тих у кого хоч якийсь нормальний MMR, або хоч без мінусу

      let coins = 0;
      let frame = null;
      let desc = '';

      if (rank === 1) {
        coins = 10000;
        frame =
          'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-pulse'; // Рамка Чемпіона
        desc = `Топ ${rank} сезону: 10000 Монет + Рамка Чемпіона`;
      } else if (rank <= 3) {
        coins = 5000;
        frame =
          'border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.6)] animate-pulse'; // Платинова Рамка
        desc = `Топ ${rank} сезону: 5000 Монет + Платинова Рамка`;
      } else if (rank <= 10) {
        coins = 2500;
        frame = 'border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]'; // Епічна
        desc = `Топ ${rank} сезону: 2500 Монет + Епічна Рамка`;
      } else if (rank <= 50) {
        coins = 1000;
        desc = `Топ ${rank} сезону: 1000 Монет`;
      } else {
        coins = 500;
        desc = `Топ ${rank} сезону: 500 Монет`;
      }

      rewardsData.push({
        seasonId: activeSeason.id,
        userId: p.userId,
        rank,
        reward: desc,
      });

      // Update wallet + frame individually
      await this.prisma.wallet.update({
        where: { userId: p.userId },
        data: { soft: { increment: coins } },
      });

      if (frame) {
        await this.prisma.profile.update({
          where: { id: p.id },
          data: { activeFrame: frame },
        });
      }
      rank++;
    }

    if (rewardsData.length > 0) {
      await this.prisma.seasonReward.createMany({ data: rewardsData });
    }

    // Reset MMR to 1500 for ALL profiles
    await this.prisma.profile.updateMany({
      data: { mmr: 1500 },
    });

    // Close season
    const closed = await this.prisma.season.update({
      where: { id: activeSeason.id },
      data: { isActive: false, endDate: new Date() },
    });

    // Notify all online players via gateway
    this.gameGateway.server.emit('chat_message', {
      id: 'system-season-end',
      senderId: 'SYSTEM',
      senderName: 'Система',
      text: `🏆 Сезон "${activeSeason.name}" закінчився! Нагороди роздано топ-100 гравцям. Весь MMR скинуто до 1500.`,
      role: 'SERVER',
      isSystem: true,
      timestamp: Date.now(),
    });

    await this.logAction(
      requestUser.id,
      'END_SEASON',
      null,
      `Ended season ${activeSeason.name}`,
    );
    return { success: true, closed, rewardsGiven: rewardsData.length };
  }
}
