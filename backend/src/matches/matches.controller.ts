import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('matches')
export class MatchesController {
    constructor(private prisma: PrismaService) { }

    @Get(':id')
    async getMatch(@Param('id') id: string) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            include: {
                participants: {
                    include: {
                        profile: {
                            include: {
                                user: {
                                    select: { username: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!match) {
            throw new NotFoundException('Match not found');
        }

        let parsedLogs = [];
        if (match.logs) {
            if (typeof match.logs === 'string') {
                try { parsedLogs = JSON.parse(match.logs); } catch (e) { }
            } else {
                parsedLogs = match.logs as any[];
            }
        }

        return {
            ...match,
            logs: parsedLogs
        };
    }
}
