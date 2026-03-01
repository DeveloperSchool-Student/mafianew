import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameGateway } from '../game/game.gateway';

@Injectable()
export class FriendsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gameGateway: GameGateway
    ) { }

    async sendRequest(userId: string, friendUsername: string) {
        if (!friendUsername) throw new BadRequestException('Нікнейм не може бути порожнім');

        const friend = await this.prisma.user.findUnique({ where: { username: friendUsername } });
        if (!friend) throw new NotFoundException('Користувача не знайдено');
        if (friend.id === userId) throw new BadRequestException('Ви не можете додати себе в друзі');

        const existing = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId, friendId: friend.id },
                    { userId: friend.id, friendId: userId },
                ],
            },
        });

        if (existing) {
            if (existing.status === 'pending') throw new ConflictException('Запит вже надіслано');
            if (existing.status === 'accepted') throw new ConflictException('Ви вже друзі');
            if (existing.status === 'blocked') throw new ConflictException('Користувач заблокований');
        }

        const request = await this.prisma.friendship.create({
            data: {
                userId,
                friendId: friend.id,
                status: 'pending',
            },
            include: {
                friend: { select: { id: true, username: true, profile: { select: { avatarUrl: true, level: true } } } },
                user: { select: { username: true } } // needed for notification below
            }
        });

        // Notify friend
        this.gameGateway.server.to(friend.id).emit('notification', {
            type: 'info',
            title: 'Новий запит у друзі',
            message: `Користувач ${request.user.username} хоче додати вас у друзі.`
        });

        return request;
    }

    async acceptRequest(userId: string, friendshipId: string) {
        const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
        if (!friendship || friendship.friendId !== userId || friendship.status !== 'pending') {
            throw new NotFoundException('Запит не знайдено або він вже оброблений');
        }

        const updated = await this.prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: 'accepted' },
            include: {
                user: { select: { id: true, username: true, profile: { select: { avatarUrl: true, level: true } } } },
                friend: { select: { username: true } }
            }
        });

        // Notify original sender
        this.gameGateway.server.to(updated.userId).emit('notification', {
            type: 'success',
            title: 'Запит у друзі прийнято',
            message: `${updated.friend.username} прийняв(ла) ваш запит.`
        });

        return updated;
    }

    async rejectRequest(userId: string, friendshipId: string) {
        const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
        if (!friendship || friendship.friendId !== userId || friendship.status !== 'pending') {
            throw new NotFoundException('Запит не знайдено');
        }

        return this.prisma.friendship.delete({
            where: { id: friendshipId },
        });
    }

    async removeFriend(userId: string, friendshipId: string) {
        const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
        if (!friendship) throw new NotFoundException('Дружбу не знайдено');
        if (friendship.userId !== userId && friendship.friendId !== userId) {
            throw new ForbiddenException('Недостатньо прав');
        }

        return this.prisma.friendship.delete({
            where: { id: friendshipId },
        });
    }

    async getFriends(userId: string) {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                OR: [{ userId }, { friendId: userId }],
            },
            include: {
                user: { select: { id: true, username: true, profile: { select: { avatarUrl: true, level: true } } } },
                friend: { select: { id: true, username: true, profile: { select: { avatarUrl: true, level: true } } } },
            },
            orderBy: { createdAt: 'desc' }
        });

        return friendships.map(f => {
            const isSender = f.userId === userId;
            const otherUser = isSender ? f.friend : f.user;
            return {
                id: f.id,
                status: f.status,
                isSender,
                friend: otherUser,
                createdAt: f.createdAt,
            };
        });
    }
}
