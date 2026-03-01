import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RewardService {
    constructor(private prisma: PrismaService) { }

    async getRewardStatus(userId: string) {
        const profile = await this.prisma.profile.findUnique({ where: { userId } });
        if (!profile) throw new BadRequestException('Profile not found');

        const now = new Date();
        const lastClaimed = profile.lastClaimedRewardAt;

        let canClaim = false;
        if (!lastClaimed) {
            canClaim = true;
        } else {
            const msInDay = 24 * 60 * 60 * 1000;
            const hoursSinceLastClaim = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);

            // Can claim if it's been at least 20 hours since last claim
            canClaim = hoursSinceLastClaim >= 20;
        }

        return {
            canClaim,
            loginStreak: profile.loginStreak,
            lastClaimedRewardAt: profile.lastClaimedRewardAt
        };
    }

    async claimDailyReward(userId: string) {
        const status = await this.getRewardStatus(userId);

        if (!status.canClaim) {
            throw new BadRequestException('Daily reward already claimed');
        }

        const profile = await this.prisma.profile.findUnique({ where: { userId } });
        if (!profile) throw new BadRequestException('Profile not found');

        const now = new Date();
        const lastClaimed = profile.lastClaimedRewardAt;

        let newStreak = profile.loginStreak;
        if (!lastClaimed) {
            newStreak = 1;
        } else {
            const hoursSinceLastClaim = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);
            // Reset streak if more than 48 hours passed
            if (hoursSinceLastClaim > 48) {
                newStreak = 1;
            } else {
                newStreak += 1;
            }
        }

        // Base reward + streak bonus (up to day 7)
        const bonusDays = Math.min(newStreak, 7);
        const softReward = 100 + (bonusDays * 20); // 120, 140, 160... max 240
        let hardReward = 0;

        // Every 7 days give a hard currency bonus
        if (newStreak % 7 === 0) {
            hardReward = 10;
        }

        // Give rewards
        await this.prisma.$transaction([
            this.prisma.profile.update({
                where: { userId },
                data: {
                    lastClaimedRewardAt: now,
                    loginStreak: newStreak,
                }
            }),
            this.prisma.wallet.upsert({
                where: { userId },
                update: {
                    soft: { increment: softReward },
                    hard: { increment: hardReward },
                },
                create: {
                    userId,
                    soft: softReward,
                    hard: hardReward,
                }
            })
        ]);

        return {
            message: 'Daily reward claimed',
            softReward,
            hardReward,
            newStreak
        };
    }
}
