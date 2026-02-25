import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PmService {
    constructor(private readonly prisma: PrismaService) { }

    async getConversations(userId: string) {
        const messages = await this.prisma.privateMessage.findMany({
            where: {
                OR: [{ fromId: userId }, { toId: userId }],
            },
            include: {
                from: { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } },
                to: { select: { id: true, username: true, profile: { select: { avatarUrl: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const conversations = new Map<string, any>();

        messages.forEach(msg => {
            const otherUser = msg.fromId === userId ? msg.to : msg.from;
            if (!conversations.has(otherUser.id)) {
                conversations.set(otherUser.id, {
                    user: otherUser,
                    lastMessage: msg,
                    unreadCount: (msg.toId === userId && !msg.readAt) ? 1 : 0
                });
            } else if (msg.toId === userId && !msg.readAt) {
                conversations.get(otherUser.id).unreadCount += 1;
            }
        });

        return Array.from(conversations.values());
    }

    async getMessages(userId: string, targetId: string) {
        await this.prisma.privateMessage.updateMany({
            where: {
                toId: userId,
                fromId: targetId,
                readAt: null
            },
            data: { readAt: new Date() }
        });

        return this.prisma.privateMessage.findMany({
            where: {
                OR: [
                    { fromId: userId, toId: targetId },
                    { fromId: targetId, toId: userId },
                ]
            },
            include: {
                from: { select: { id: true, username: true } },
                to: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 100
        });
    }

    async sendMessage(userId: string, targetId: string, content: string) {
        if (!content || !content.trim()) throw new BadRequestException('Повідомлення не може бути порожнім');

        // Check mute
        const profile = await this.prisma.profile.findUnique({ where: { userId } });
        if (profile?.mutedUntil && new Date(profile.mutedUntil) > new Date()) {
            throw new ForbiddenException('У вас мут, ви не можете надсилати повідомлення');
        }

        const target = await this.prisma.user.findUnique({ where: { id: targetId } });
        if (!target) throw new NotFoundException('Користувача не знайдено');

        // Optionally check if they are friends
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId, friendId: targetId, status: 'accepted' },
                    { userId: targetId, friendId: userId, status: 'accepted' }
                ]
            }
        });
        if (!friendship) throw new ForbiddenException('Ви можете писати лише друзям');

        return this.prisma.privateMessage.create({
            data: {
                fromId: userId,
                toId: targetId,
                content: content.trim()
            },
            include: {
                from: { select: { id: true, username: true } },
            }
        });
    }
}
