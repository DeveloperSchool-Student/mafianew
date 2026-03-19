import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import {
  ChangeAvatarDto,
  BuyFrameDto,
  EquipFrameDto,
  CreateClanDto,
  JoinClanDto,
  KickFromClanDto,
  PromoteInClanDto,
  DeclareClanWarDto,
  ClaimQuestDto,
} from './dto/users.dto';

@Controller('users')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Request() req: { user: { id: string } }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        role: true,
        staffRoleKey: true,
        staffRole: true,
        createdAt: true,
        profile: {
          include: {
            matchHistory: {
              include: { match: true },
              orderBy: { match: { createdAt: 'desc' } },
              take: 10,
            },
          },
        },
        wallet: true,
      },
    });

    if (!user || !user.profile) return user;

    const favRoleQuery = await this.prisma.matchParticipant.groupBy({
      by: ['role'],
      where: { profileId: user.profile.id },
      _count: { role: true },
      orderBy: { _count: { role: 'desc' } },
      take: 1,
    });
    (user.profile as any).favoriteRole =
      favRoleQuery.length > 0 ? favRoleQuery[0].role : 'НЕМАЄ';

    return user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile/:id')
  async getPublicProfile(@Param('id') userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        staffRoleKey: true,
        staffRole: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            matches: true,
            wins: true,
            losses: true,
            avatarUrl: true,
            xp: true,
            level: true,
            activeFrame: true,
            title: true,
            mmr: true,
            clanId: true,
            clanRole: true,
            winStreak: true,
            maxWinStreak: true,
            totalDuration: true,
            survivedMatches: true,
            clan: { select: { id: true, name: true } },
            matchHistory: {
              include: { match: true },
              orderBy: { match: { createdAt: 'desc' } },
              take: 10,
            },
          },
        },
      },
    });
    if (!target) throw new BadRequestException('Користувача не знайдено');

    if (target.profile) {
      const favRoleQuery = await this.prisma.matchParticipant.groupBy({
        by: ['role'],
        where: { profileId: target.profile.id },
        _count: { role: true },
        orderBy: { _count: { role: 'desc' } },
        take: 1,
      });
      (target.profile as any).favoriteRole =
        favRoleQuery.length > 0 ? favRoleQuery[0].role : 'НЕМАЄ';
    }

    return target;
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.usersService.getLeaderboard();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('find/:username')
  async findUserByUsername(@Param('username') username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });
    if (!user) throw new BadRequestException('Користувавача не знайдено');
    return user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  async changeAvatar(
    @Request() req: { user: { id: string } },
    @Body() body: ChangeAvatarDto,
  ) {
    const url = (body.avatarUrl || '').trim();

    if (!url) throw new BadRequestException('URL не може бути порожнім.');
    if (url.length > 500)
      throw new BadRequestException('URL занадто довгий (макс. 500 символів).');

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      throw new BadRequestException(
        'Невалідний URL. Використовуйте http:// або https://',
      );
    }

    const lower = url.toLowerCase();
    if (lower.endsWith('.svg') || lower.includes('.svg?')) {
      throw new BadRequestException(
        'SVG файли заборонені з міркувань безпеки.',
      );
    }

    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.avif',
      '.bmp',
    ];
    const hasValidExtension = allowedExtensions.some(
      (ext) =>
        lower.includes(ext + '?') ||
        lower.includes(ext + '#') ||
        lower.endsWith(ext),
    );
    const hasAnyExtension = /\.\w{2,5}(\?|#|$)/.test(
      lower.split('/').pop() || '',
    );
    if (hasAnyExtension && !hasValidExtension) {
      throw new BadRequestException(
        'Дозволені лише зображення (jpg, png, gif, webp).',
      );
    }

    return this.usersService.updateAvatar(req.user.id, url);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('store/buy')
  async buyFrame(
    @Request() req: { user: { id: string } },
    @Body() body: BuyFrameDto,
  ) {
    try {
      return await this.usersService.buyFrame(req.user.id, body.frameId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('store/equip')
  async equipFrame(
    @Request() req: { user: { id: string } },
    @Body() body: EquipFrameDto,
  ) {
    try {
      return await this.usersService.equipFrame(req.user.id, body.frameId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('clans')
  async getClans() {
    return this.usersService.getClans();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans')
  async createClan(
    @Request() req: { user: { id: string } },
    @Body() body: CreateClanDto,
  ) {
    try {
      return await this.usersService.createClan(req.user.id, body.name);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/join')
  async joinClan(
    @Request() req: { user: { id: string } },
    @Body() body: JoinClanDto,
  ) {
    try {
      return await this.usersService.joinClan(req.user.id, body.clanName);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/leave')
  async leaveClan(@Request() req: { user: { id: string } }) {
    try {
      return await this.usersService.leaveClan(req.user.id);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/kick')
  async kickFromClan(
    @Request() req: { user: { id: string } },
    @Body() body: KickFromClanDto,
  ) {
    try {
      return await this.usersService.kickFromClan(
        req.user.id,
        body.targetUserId,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/promote')
  async promoteInClan(
    @Request() req: { user: { id: string } },
    @Body() body: PromoteInClanDto,
  ) {
    try {
      return await this.usersService.promoteInClan(
        req.user.id,
        body.targetUserId,
        body.newRole,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/war/declare')
  async declareClanWar(
    @Request() req: { user: { id: string } },
    @Body() body: DeclareClanWarDto,
  ) {
    try {
      return await this.usersService.declareClanWar(
        req.user.id,
        body.targetClanId,
        body.customBet,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/war/:id/accept')
  async acceptClanWar(
    @Request() req: { user: { id: string } },
    @Param('id') warId: string,
  ) {
    try {
      return await this.usersService.acceptClanWar(req.user.id, warId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('clans/war/:id/reject')
  async rejectClanWar(
    @Request() req: { user: { id: string } },
    @Param('id') warId: string,
  ) {
    try {
      return await this.usersService.rejectClanWar(req.user.id, warId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('clans/wars')
  async getClanWars(@Request() req: { user: { id: string } }) {
    try {
      return await this.usersService.getClanWars(req.user.id);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('quests')
  async getQuests(@Request() req: { user: { id: string } }) {
    try {
      return await this.usersService.getOrCreateDailyQuests(req.user.id);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('quests/claim')
  async claimQuestReward(
    @Request() req: { user: { id: string } },
    @Body() body: ClaimQuestDto,
  ) {
    try {
      return await this.usersService.claimQuestReward(
        req.user.id,
        body.questId,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}
