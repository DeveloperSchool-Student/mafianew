import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        profile: { create: {} },
        wallet: { create: {} },
      },
    });
  }

  async findByUsername(username: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { username },
      include: { profile: true }
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getLeaderboard() {
    return this.prisma.profile.findMany({
      take: 100,
      orderBy: { mmr: 'desc' },
      include: {
        user: {
          select: { username: true }
        }
      }
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  async buyFrame(userId: string, frameId: string, cost: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.soft < cost) throw new Error('Недостатньо монет');

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Профіль не знайдено');

    if (profile.unlockedFrames.includes(frameId)) throw new Error('Вже придбано');

    await this.prisma.wallet.update({
      where: { userId },
      data: { soft: { decrement: cost } }
    });

    return this.prisma.profile.update({
      where: { userId },
      data: { unlockedFrames: { push: frameId } }
    });
  }

  async equipFrame(userId: string, frameId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Профіль не знайдено');

    if (frameId !== '' && !profile.unlockedFrames.includes(frameId)) {
      throw new Error('Рамка не розблокована');
    }

    return this.prisma.profile.update({
      where: { userId },
      data: { activeFrame: frameId === '' ? null : frameId }
    });
  }

  async createClan(userId: string, name: string) {
    if (!name || name.length < 3 || name.length > 20) throw new Error('Некорректна назва клану');

    const existing = await this.prisma.clan.findUnique({ where: { name } });
    if (existing) throw new Error('Клан з такою назвою вже існує');

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (profile?.clanId) throw new Error('Ви вже є учасником клану');

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.soft < 1000) throw new Error('Створення клану коштує 1000 монет');

    await this.prisma.wallet.update({
      where: { userId },
      data: { soft: { decrement: 1000 } }
    });

    const clan = await this.prisma.clan.create({
      data: {
        name,
        ownerId: userId,
        members: {
          connect: { id: profile!.id }
        }
      }
    });

    await this.prisma.profile.update({
      where: { userId },
      data: { clanRole: 'OWNER', clanContribution: 0 }
    });

    return clan;
  }

  async joinClan(userId: string, clanName: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (profile?.clanId) throw new Error('Ви вже є учасником клану');

    const clan = await this.prisma.clan.findUnique({ where: { name: clanName } });
    if (!clan) throw new Error('Клан не знайдено');

    return this.prisma.profile.update({
      where: { userId },
      data: { clanId: clan.id, clanRole: 'MEMBER', clanContribution: 0 }
    });
  }

  async leaveClan(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile?.clanId) throw new Error('Ви не у клані');

    const clan = await this.prisma.clan.findUnique({ where: { id: profile.clanId }, include: { members: true } });
    if (clan?.ownerId === userId && clan.members.length > 1) {
      throw new Error('Ви лідер клану. Передайте лідерство або видаліть всіх учасників');
    }

    if (clan?.ownerId === userId && clan.members.length === 1) {
      await this.prisma.profile.update({ where: { userId }, data: { clanId: null, clanRole: 'MEMBER', clanContribution: 0 } });
      await this.prisma.clan.delete({ where: { id: clan.id } });
      return { message: 'Клан видалено' };
    }

    return this.prisma.profile.update({
      where: { userId },
      data: { clanId: null, clanRole: 'MEMBER', clanContribution: 0 }
    });
  }

  async kickFromClan(userId: string, targetUserId: string) {
    const actorProfile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!actorProfile?.clanId) throw new Error('Ви не у клані');
    if (actorProfile.clanRole !== 'OWNER' && actorProfile.clanRole !== 'OFFICER') {
      throw new Error('У вас немає прав для вигнання учасників');
    }

    const targetProfile = await this.prisma.profile.findUnique({ where: { userId: targetUserId } });
    if (!targetProfile || targetProfile.clanId !== actorProfile.clanId) {
      throw new Error('Гравця не знайдено в цьому клані');
    }

    if (targetProfile.clanRole === 'OWNER') throw new Error('Не можна вигнати лідера');
    if (actorProfile.clanRole === 'OFFICER' && targetProfile.clanRole === 'OFFICER') {
      throw new Error('Офіцер не може вигнати іншого офіцера');
    }

    return this.prisma.profile.update({
      where: { userId: targetUserId },
      data: { clanId: null, clanRole: 'MEMBER', clanContribution: 0 }
    });
  }

  async promoteInClan(userId: string, targetUserId: string, newRole: 'MEMBER' | 'OFFICER' | 'OWNER') {
    const actorProfile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!actorProfile?.clanId || actorProfile.clanRole !== 'OWNER') {
      throw new Error('Тільки лідер може змінювати ролі');
    }

    const targetProfile = await this.prisma.profile.findUnique({ where: { userId: targetUserId } });
    if (!targetProfile || targetProfile.clanId !== actorProfile.clanId) {
      throw new Error('Гравця не знайдено в цьому клані');
    }

    if (newRole === 'OWNER') {
      await this.prisma.$transaction([
        this.prisma.profile.update({ where: { userId }, data: { clanRole: 'OFFICER' } }),
        this.prisma.profile.update({ where: { userId: targetUserId }, data: { clanRole: 'OWNER' } }),
        this.prisma.clan.update({ where: { id: actorProfile.clanId }, data: { ownerId: targetUserId } })
      ]);
      return { message: 'Лідерство передано' };
    }

    return this.prisma.profile.update({
      where: { userId: targetUserId },
      data: { clanRole: newRole }
    });
  }

  async getClans() {
    return this.prisma.clan.findMany({
      include: {
        members: {
          include: {
            user: { select: { username: true } }
          }
        },
        owner: { select: { username: true } }
      },
      orderBy: { rating: 'desc' },
      take: 50
    });
  }

  async getOrCreateDailyQuests(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Профіль не знайдено');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Знайдемо активні квести користувача за сьогодні
    let existingQuests = await this.prisma.userQuest.findMany({
      where: {
        profileId: profile.id,
      },
      include: { quest: true }
    });

    // Fallback: Date filtering in memory if createdAt does not exist on UserQuest schema
    // In our schema UserQuest has a `createdAt` field added but maybe ts client is outdated.
    // If it's missing from the type, filter manually.
    existingQuests = existingQuests.filter((uq: any) => {
      if (!uq.createdAt) return true;
      return new Date(uq.createdAt) >= todayStart;
    });

    if (existingQuests.length > 0) {
      return existingQuests.map((uq: any) => ({
        id: uq.id,
        code: uq.quest.code,
        title: uq.quest.title,
        description: uq.quest.description,
        target: uq.quest.requirement,
        reward: uq.quest.rewardSoft,
        progress: uq.progress,
        claimed: uq.completed,
      }));
    }

    // Generate new quests if we have none today
    let allQuests = await this.prisma.quest.findMany();

    // Якщо квестів ще немає в базі, створимо дефолтні
    if (allQuests.length === 0) {
      await this.prisma.quest.createMany({
        data: [
          { code: 'PLAY_3_MATCHES', title: 'Зіграти 3 матчі', description: 'Зіграйте три гри до кінця.', requirement: 3, rewardSoft: 100 },
          { code: 'WIN_1_MATCH', title: 'Отримати 1 перемогу', description: 'Виграйте один матч.', requirement: 1, rewardSoft: 50 },
          { code: 'WIN_AS_MAFIA_1', title: 'Перемогти за Мафію', description: 'Виграйте один матч, граючи за роль Мафії або Дона.', requirement: 1, rewardSoft: 150 },
          { code: 'PLAY_AS_CITIZEN_2', title: 'Зіграти 2 рази за Мирного', description: 'Отримайте роль Мирного жителя та зіграйте двічі.', requirement: 2, rewardSoft: 80 },
        ]
      });
      allQuests = await this.prisma.quest.findMany();
    }

    // Pick 3 random
    const shuffled = allQuests.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    const createdQuests = await Promise.all(
      selected.map(quest => this.prisma.userQuest.create({
        data: {
          profileId: profile.id,
          questId: quest.id,
          progress: 0,
          completed: false,
        },
        include: { quest: true }
      }))
    );

    return createdQuests.map((uq: any) => ({
      id: uq.id,
      code: uq.quest.code,
      title: uq.quest.title,
      description: uq.quest.description,
      target: uq.quest.requirement,
      reward: uq.quest.rewardSoft,
      progress: uq.progress,
      claimed: uq.completed,
    }));
  }

  async claimQuestReward(userId: string, userQuestId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Профіль не знайдено');

    const uq = await this.prisma.userQuest.findUnique({
      where: { id: userQuestId },
      include: { quest: true }
    });

    if (!uq || uq.profileId !== profile.id) throw new Error('Квест не знайдено');
    if (uq.completed) throw new Error('Нагороду вже отримано');
    if (uq.progress < uq.quest.requirement) throw new Error('Квест ще не виконано');

    await this.prisma.$transaction([
      this.prisma.userQuest.update({
        where: { id: userQuestId },
        data: { completed: true, completedAt: new Date() }
      }),
      this.prisma.wallet.update({
        where: { userId },
        data: { soft: { increment: uq.quest.rewardSoft } }
      })
    ]);

    return { success: true, reward: uq.quest.rewardSoft };
  }
}
