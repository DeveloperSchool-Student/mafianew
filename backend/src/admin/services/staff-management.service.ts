import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameGateway } from '../../game/game.gateway';
import { PERMISSION, STAFF_ROLES, getStaffPower } from '../admin.roles';
import { ensureMinPower, logAdminAction } from '../admin.helpers';

@Injectable()
export class StaffManagementService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  async listStaff(requestUser: { id: string; staffRoleKey?: string | null }) {
    ensureMinPower(requestUser, PERMISSION.MANAGE_STAFF, 'Персонал');
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
    const actorPower = ensureMinPower(
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

    if (targetRole.power >= actorPower && actorPower < 9) {
      throw new ForbiddenException(
        'Не можна призначити роль рівну або вищу за свою.',
      );
    }

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

    const actor = await this.prisma.user.findUnique({
      where: { id: requestUser.id },
      select: { username: true },
    });

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'SET_STAFF_ROLE',
      target.id,
      `Призначено роль ${params.roleKey} (${targetRole.title}) | Попередня: ${oldRoleKey || 'USER'} (${oldRole?.title || 'Гравець'}) | Актор: ${actor?.username || requestUser.id} | Час: ${new Date().toISOString()}`,
    );

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
    const actorPower = ensureMinPower(
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

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'REMOVE_STAFF_ROLE',
      target.id,
      `Знято роль ${target.staffRoleKey}`,
    );

    return { success: true };
  }

  async changeNickname(
    requestUser: { id: string; staffRoleKey?: string | null },
    params: { targetUsername: string; newUsername: string },
  ) {
    ensureMinPower(
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

    await logAdminAction(
      this.prisma,
      requestUser.id,
      'CHANGE_NICKNAME',
      target.id,
      `${params.targetUsername} → ${username}`,
    );

    return { success: true };
  }
}
