import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getStaffPower, PERMISSION } from '../admin/admin.roles';

@Injectable()
export class TournamentService {
    constructor(private readonly prisma: PrismaService) { }

    /* ═══════════════════  CREATE TOURNAMENT  ═══════════════════ */

    async createTournament(
        requestUser: { id: string; staffRoleKey?: string | null },
        params: {
            name: string;
            maxParticipants?: number;
            prizePool?: number;
            entryFee?: number;
            rules?: string;
        },
    ) {
        const power = getStaffPower(requestUser.staffRoleKey);
        if (power < PERMISSION.ADJUST_GOLD) {
            throw new ForbiddenException('Недостатньо прав для створення турніру. Потрібен мін. рівень 6.');
        }

        if (!params.name || params.name.trim().length < 3) {
            throw new BadRequestException('Назва турніру має бути мін. 3 символи.');
        }

        return this.prisma.tournament.create({
            data: {
                name: params.name.trim(),
                maxParticipants: params.maxParticipants || 16,
                prizePool: params.prizePool || 0,
                entryFee: params.entryFee || 0,
                rules: params.rules || null,
                createdById: requestUser.id,
            },
        });
    }

    /* ═══════════════════  LIST TOURNAMENTS  ═══════════════════ */

    async listTournaments(status?: string) {
        return this.prisma.tournament.findMany({
            where: status ? { status } : undefined,
            include: {
                participants: {
                    select: { id: true, userId: true, username: true, status: true, wins: true, losses: true, placement: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    /* ═══════════════════  GET TOURNAMENT  ═══════════════════ */

    async getTournament(tournamentId: string) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                participants: {
                    orderBy: [{ wins: 'desc' }, { losses: 'asc' }],
                },
            },
        });
        if (!tournament) throw new NotFoundException('Турнір не знайдено');
        return tournament;
    }

    /* ═══════════════════  JOIN TOURNAMENT  ═══════════════════ */

    async joinTournament(userId: string, username: string, tournamentId: string) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { participants: true },
        });
        if (!tournament) throw new NotFoundException('Турнір не знайдено');

        if (tournament.status !== 'REGISTRATION') {
            throw new BadRequestException('Реєстрація на турнір закрита.');
        }

        if (tournament.participants.length >= tournament.maxParticipants) {
            throw new BadRequestException('Турнір вже заповнений.');
        }

        if (tournament.participants.find(p => p.userId === userId)) {
            throw new BadRequestException('Ви вже зареєстровані на цей турнір.');
        }

        // Charge entry fee
        if (tournament.entryFee > 0) {
            const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
            if (!wallet || wallet.soft < tournament.entryFee) {
                throw new BadRequestException(`Недостатньо монет. Потрібно: ${tournament.entryFee}.`);
            }
            await this.prisma.wallet.update({
                where: { userId },
                data: { soft: { decrement: tournament.entryFee } },
            });
        }

        return this.prisma.tournamentParticipant.create({
            data: {
                tournamentId,
                userId,
                username,
            },
        });
    }

    /* ═══════════════════  LEAVE TOURNAMENT  ═══════════════════ */

    async leaveTournament(userId: string, tournamentId: string) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
        });
        if (!tournament) throw new NotFoundException('Турнір не знайдено');

        if (tournament.status !== 'REGISTRATION') {
            throw new BadRequestException('Покинути турнір можна лише під час реєстрації.');
        }

        const participant = await this.prisma.tournamentParticipant.findFirst({
            where: { tournamentId, userId },
        });
        if (!participant) {
            throw new BadRequestException('Ви не зареєстровані на цей турнір.');
        }

        // Refund entry fee
        if (tournament.entryFee > 0) {
            await this.prisma.wallet.update({
                where: { userId },
                data: { soft: { increment: tournament.entryFee } },
            });
        }

        return this.prisma.tournamentParticipant.delete({
            where: { id: participant.id },
        });
    }

    /* ═══════════════════  START TOURNAMENT  ═══════════════════ */

    async startTournament(
        requestUser: { id: string; staffRoleKey?: string | null },
        tournamentId: string,
    ) {
        const power = getStaffPower(requestUser.staffRoleKey);
        if (power < PERMISSION.ADJUST_GOLD) {
            throw new ForbiddenException('Недостатньо прав для старту турніру.');
        }

        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { participants: true },
        });
        if (!tournament) throw new NotFoundException('Турнір не знайдено');
        if (tournament.status !== 'REGISTRATION') {
            throw new BadRequestException('Турнір вже розпочато або завершено.');
        }
        if (tournament.participants.length < 4) {
            throw new BadRequestException('Мінімум 4 учасники для початку турніру.');
        }

        await this.prisma.tournamentParticipant.updateMany({
            where: { tournamentId },
            data: { status: 'ACTIVE' },
        });

        return this.prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: 'ACTIVE', startedAt: new Date() },
        });
    }

    /* ═══════════════════  RECORD MATCH RESULT  ═══════════════════ */

    async recordMatchResult(
        requestUser: { id: string; staffRoleKey?: string | null },
        params: {
            tournamentId: string;
            winnerId: string;
            loserId: string;
        },
    ) {
        const power = getStaffPower(requestUser.staffRoleKey);
        if (power < PERMISSION.VIEW_ROOMS) {
            throw new ForbiddenException('Недостатньо прав.');
        }

        const tournament = await this.prisma.tournament.findUnique({
            where: { id: params.tournamentId },
        });
        if (!tournament || tournament.status !== 'ACTIVE') {
            throw new BadRequestException('Турнір не активний.');
        }

        // Update winner
        await this.prisma.tournamentParticipant.updateMany({
            where: { tournamentId: params.tournamentId, userId: params.winnerId },
            data: { wins: { increment: 1 } },
        });

        // Update loser
        await this.prisma.tournamentParticipant.updateMany({
            where: { tournamentId: params.tournamentId, userId: params.loserId },
            data: { losses: { increment: 1 } },
        });

        return { success: true };
    }

    /* ═══════════════════  ELIMINATE PLAYER  ═══════════════════ */

    async eliminatePlayer(
        requestUser: { id: string; staffRoleKey?: string | null },
        params: { tournamentId: string; userId: string },
    ) {
        const power = getStaffPower(requestUser.staffRoleKey);
        if (power < PERMISSION.ADJUST_GOLD) {
            throw new ForbiddenException('Недостатньо прав.');
        }

        return this.prisma.tournamentParticipant.updateMany({
            where: { tournamentId: params.tournamentId, userId: params.userId },
            data: { status: 'ELIMINATED' },
        });
    }

    /* ═══════════════════  END TOURNAMENT  ═══════════════════ */

    async endTournament(
        requestUser: { id: string; staffRoleKey?: string | null },
        tournamentId: string,
        winnerId?: string,
    ) {
        const power = getStaffPower(requestUser.staffRoleKey);
        if (power < PERMISSION.ADJUST_GOLD) {
            throw new ForbiddenException('Недостатньо прав для завершення турніру.');
        }

        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { participants: true },
        });
        if (!tournament) throw new NotFoundException('Турнір не знайдено');
        if (tournament.status === 'FINISHED') {
            throw new BadRequestException('Турнір вже завершений.');
        }

        // Mark all active players as eliminated, winner as WINNER
        if (winnerId) {
            await this.prisma.tournamentParticipant.updateMany({
                where: { tournamentId, userId: winnerId },
                data: { status: 'WINNER', placement: 1 },
            });

            await this.prisma.tournamentParticipant.updateMany({
                where: { tournamentId, userId: { not: winnerId }, status: 'ACTIVE' },
                data: { status: 'ELIMINATED' },
            });

            // Award prize
            if (tournament.prizePool > 0) {
                const winnerWallet = await this.prisma.wallet.findUnique({ where: { userId: winnerId } });
                if (winnerWallet) {
                    await this.prisma.wallet.update({
                        where: { userId: winnerId },
                        data: { soft: { increment: tournament.prizePool } },
                    });
                }
            }
        }

        return this.prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: 'FINISHED', endedAt: new Date() },
        });
    }

    /* ═══════════════════  CANCEL TOURNAMENT  ═══════════════════ */

    async cancelTournament(
        requestUser: { id: string; staffRoleKey?: string | null },
        tournamentId: string,
    ) {
        const power = getStaffPower(requestUser.staffRoleKey);
        if (power < PERMISSION.ADJUST_GOLD) {
            throw new ForbiddenException('Недостатньо прав для скасування турніру.');
        }

        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { participants: true },
        });
        if (!tournament) throw new NotFoundException('Турнір не знайдено');
        if (tournament.status === 'FINISHED') {
            throw new BadRequestException('Неможливо скасувати завершений турнір.');
        }

        // Refund all participants
        if (tournament.entryFee > 0) {
            for (const p of tournament.participants) {
                await this.prisma.wallet.update({
                    where: { userId: p.userId },
                    data: { soft: { increment: tournament.entryFee } },
                });
            }
        }

        return this.prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: 'CANCELLED', endedAt: new Date() },
        });
    }
}
