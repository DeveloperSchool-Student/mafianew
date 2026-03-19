import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Room, GameState, GamePhase, RoleType, PlayerState, MatchLog } from '../game.types';

@Injectable()
export class MatchRecordingService {
  private readonly logger = new Logger(MatchRecordingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async awardStats(
    roomType: 'CASUAL' | 'RANKED' | 'TOURNAMENT' | undefined,
    players: PlayerState[],
    winner: string,
    logs: MatchLog[],
    jesterId?: string,
    dayCount?: number,
  ) {
    try {
      const isRanked = roomType === 'RANKED';

      const matchData = await this.prisma.match.create({
        data: {
          winner,
          duration: dayCount || 1,
          logs: logs ? JSON.stringify(logs) : '[]',
          participants: {
            create: await Promise.all(
              players
                .filter((p) => !p.isSpectator && !p.isBot)
                .map(async (p) => {
                  const isMafia = p.role === RoleType.MAFIA || p.role === RoleType.DON;
                  let won = false;
                  if (winner === 'МАФІЯ' && isMafia) won = true;
                  if (winner === 'МИРНІ' && !isMafia && p.role !== RoleType.SERIAL_KILLER && p.role !== RoleType.JESTER) won = true;
                  if (winner === 'МАНІЯК' && p.role === RoleType.SERIAL_KILLER) won = true;
                  if (winner === 'БЛАЗЕНЬ' && p.userId === jesterId) won = true;

                  const profile = await this.prisma.profile.findUnique({
                    where: { userId: p.userId },
                  });
                  return {
                    profileId: profile?.id || '',
                    role: p.role?.toString() || 'ГЛЯДАЧ',
                    won,
                  };
                }),
            ).then((results) => results.filter((r) => r.profileId !== '')),
          },
        },
      });

      for (const p of players) {
        const isMafia = p.role === RoleType.MAFIA || p.role === RoleType.DON;
        let won = false;

        if (winner === 'МАФІЯ' && isMafia) won = true;
        if (winner === 'МИРНІ' && !isMafia && p.role !== RoleType.SERIAL_KILLER && p.role !== RoleType.JESTER) won = true;
        if (winner === 'МАНІЯК' && p.role === RoleType.SERIAL_KILLER) won = true;
        if (winner === 'БЛАЗЕНЬ' && p.userId === jesterId) won = true;

        try {
          if (p.isSpectator || p.isBot) continue;

          const profile = await this.prisma.profile.findUnique({
            where: { userId: p.userId },
          });
          if (profile) {
            const xpEarned = won ? 100 : 25;
            let newXp = profile.xp + xpEarned;
            let newLevel = profile.level;

            while (newXp >= newLevel * 500) {
              newXp -= newLevel * 500;
              newLevel++;
            }
            const activeQuests = await this.prisma.userQuest.findMany({
              where: { profileId: profile.id, completed: false },
            });

            for (const uq of activeQuests) {
              const quest = await this.prisma.quest.findUnique({ where: { id: uq.questId } });
              if (!quest) continue;
              if (uq.progress >= quest.requirement) continue;

              let progressed = false;
              const qCode = quest.code;

              if (qCode === 'PLAY_3_MATCHES') progressed = true;
              if (qCode === 'WIN_1_MATCH' && won) progressed = true;
              if (qCode === 'WIN_AS_MAFIA_1' && won && isMafia) progressed = true;
              if (qCode === 'PLAY_AS_CITIZEN_2' && p.role === RoleType.CITIZEN) progressed = true;

              if (progressed) {
                await this.prisma.userQuest.update({
                  where: { id: uq.id },
                  data: { progress: { increment: 1 } },
                });
              }
            }

            const newWinStreak = won ? profile.winStreak + 1 : 0;
            const newMaxWinStreak = Math.max(profile.maxWinStreak, newWinStreak);
            const newTotalDuration = profile.totalDuration + (dayCount || 1);
            const newSurvivedMatches = profile.survivedMatches + (p.isAlive ? 1 : 0);

            const updateData: any = {
              matches: { increment: 1 },
              wins: { increment: won ? 1 : 0 },
              losses: { increment: won ? 0 : 1 },
              xp: newXp,
              level: newLevel,
              winStreak: newWinStreak,
              maxWinStreak: newMaxWinStreak,
              totalDuration: newTotalDuration,
              survivedMatches: newSurvivedMatches,
            };

            if (isRanked) {
              updateData.mmr = { increment: won ? 25 : -25 };
            }

            await this.prisma.profile.update({
              where: { userId: p.userId },
              data: updateData,
            });

            const coinsEarned = won ? 50 : 10;
            await this.prisma.wallet.update({
              where: { userId: p.userId },
              data: { soft: { increment: coinsEarned } },
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
                  where: { profileId: profile.id, type: ach.type },
                });
                if (!exists) {
                  await this.prisma.achievement.create({ data: ach });
                }
              }
            }
          }
        } catch (e) {
          this.logger.error(`[awardStats] Не вдалося оновити статистику гравця ${p.userId}`, e);
        }
      }
    } catch (e: any) {
      this.logger.error(`[awardStats] Помилка: ${e.message}`, e);
    }
  }
}
