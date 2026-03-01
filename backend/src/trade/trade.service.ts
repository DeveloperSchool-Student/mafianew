import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameGateway } from '../game/game.gateway';

@Injectable()
export class TradeService {
    constructor(
        private prisma: PrismaService,
        private gameGateway: GameGateway,
    ) { }

    async createTrade(
        senderId: string,
        params: {
            receiverId: string;
            offerAmount: number;
            offerCurrency: 'SOFT' | 'HARD';
            requestAmount: number;
            requestCurrency: 'SOFT' | 'HARD';
        },
    ) {
        if (senderId === params.receiverId) {
            throw new BadRequestException('Ви не можете торгувати самі з собою.');
        }

        if (params.offerAmount < 0 || params.requestAmount < 0) {
            throw new BadRequestException('Сума обміну не може бути від\'ємною.');
        }
        if (params.offerAmount === 0 && params.requestAmount === 0) {
            throw new BadRequestException('Обмін не може бути порожнім.');
        }

        // Check if sender has enough currency for the offer
        const senderWallet = await this.prisma.wallet.findUnique({ where: { userId: senderId } });
        if (!senderWallet) throw new NotFoundException('Гаманець не знайдено.');

        if (params.offerCurrency === 'SOFT' && senderWallet.soft < params.offerAmount) {
            throw new BadRequestException('Недостатньо софт-валюти.');
        }
        if (params.offerCurrency === 'HARD' && senderWallet.hard < params.offerAmount) {
            throw new BadRequestException('Недостатньо хард-валюти.');
        }

        // Determine receiver
        const receiver = await this.prisma.user.findUnique({ where: { id: params.receiverId } });
        if (!receiver) throw new NotFoundException('Користувача не знайдено.');

        const trade = await this.prisma.trade.create({
            data: {
                senderId,
                receiverId: params.receiverId,
                offerAmount: params.offerAmount,
                offerCurrency: params.offerCurrency,
                requestAmount: params.requestAmount,
                requestCurrency: params.requestCurrency,
            },
            include: {
                sender: { select: { username: true } }
            }
        });

        // Notify receiver
        this.gameGateway.server.to(params.receiverId).emit('notification', {
            type: 'info',
            title: 'Нова пропозиція обміну',
            message: `Гравець ${trade.sender.username} пропонує вам обмін.`,
            duration: 5000,
        });

        return trade;
    }

    async listTrades(userId: string) {
        return this.prisma.trade.findMany({
            where: {
                OR: [{ senderId: userId }, { receiverId: userId }],
                status: 'PENDING'
            },
            include: {
                sender: { select: { username: true } },
                receiver: { select: { username: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async acceptTrade(userId: string, tradeId: string) {
        const trade = await this.prisma.trade.findUnique({ where: { id: tradeId } });
        if (!trade) throw new NotFoundException('Обмін не знайдено.');

        if (trade.receiverId !== userId) {
            throw new BadRequestException('Ви не можете прийняти чужий обмін.');
        }
        if (trade.status !== 'PENDING') {
            throw new BadRequestException(`Обмін вже має статус: ${trade.status}.`);
        }

        return this.prisma.$transaction(async (tx) => {
            // Re-fetch wallets in transaction with lock (implicit by updates) or just do safe updates
            const senderWallet = await tx.wallet.findUnique({ where: { userId: trade.senderId } });
            const receiverWallet = await tx.wallet.findUnique({ where: { userId: trade.receiverId } });

            if (!senderWallet || !receiverWallet) throw new NotFoundException('Гаманці не знайдені.');

            // 1. Check sender's offer AGAIN to ensure they still have it
            if (trade.offerCurrency === 'SOFT' && senderWallet.soft < trade.offerAmount) {
                throw new BadRequestException('У відправника недостатньо коштів.');
            }
            if (trade.offerCurrency === 'HARD' && senderWallet.hard < trade.offerAmount) {
                throw new BadRequestException('У відправника недостатньо коштів.');
            }

            // 2. Check receiver's request to ensure they have enough to pay
            if (trade.requestCurrency === 'SOFT' && receiverWallet.soft < trade.requestAmount) {
                throw new BadRequestException('У вас недостатньо софт-валюти.');
            }
            if (trade.requestCurrency === 'HARD' && receiverWallet.hard < trade.requestAmount) {
                throw new BadRequestException('У вас недостатньо хард-валюти.');
            }

            // 3. Deduct Offer from Sender
            await tx.wallet.update({
                where: { userId: trade.senderId },
                data: trade.offerCurrency === 'SOFT'
                    ? { soft: { decrement: trade.offerAmount } }
                    : { hard: { decrement: trade.offerAmount } }
            });

            // 4. Give Offer to Receiver
            await tx.wallet.update({
                where: { userId: trade.receiverId },
                data: trade.offerCurrency === 'SOFT'
                    ? { soft: { increment: trade.offerAmount } }
                    : { hard: { increment: trade.offerAmount } }
            });

            // 5. Deduct Request from Receiver
            await tx.wallet.update({
                where: { userId: trade.receiverId },
                data: trade.requestCurrency === 'SOFT'
                    ? { soft: { decrement: trade.requestAmount } }
                    : { hard: { decrement: trade.requestAmount } }
            });

            // 6. Give Request to Sender
            await tx.wallet.update({
                where: { userId: trade.senderId },
                data: trade.requestCurrency === 'SOFT'
                    ? { soft: { increment: trade.requestAmount } }
                    : { hard: { increment: trade.requestAmount } }
            });

            // 7. Update Trade Status
            const finalized = await tx.trade.update({
                where: { id: tradeId },
                data: { status: 'ACCEPTED' },
            });

            // Notify sender
            this.gameGateway.server.to(trade.senderId).emit('notification', {
                type: 'success',
                title: 'Обмін прийнято',
                message: 'Ваша пропозиція обміну була прийнята.',
                duration: 5000,
            });

            return finalized;
        });
    }

    async rejectTrade(userId: string, tradeId: string) {
        const trade = await this.prisma.trade.findUnique({ where: { id: tradeId } });
        if (!trade) throw new NotFoundException('Обмін не знайдено.');

        if (trade.receiverId !== userId && trade.senderId !== userId) {
            throw new BadRequestException('Ви не маєте доступу до цього обміну.');
        }
        if (trade.status !== 'PENDING') {
            throw new BadRequestException(`Обмін вже має статус: ${trade.status}.`);
        }

        const updated = await this.prisma.trade.update({
            where: { id: tradeId },
            data: { status: trade.senderId === userId ? 'CANCELLED' : 'REJECTED' },
        });

        const notifyId = trade.senderId === userId ? trade.receiverId : trade.senderId;
        this.gameGateway.server.to(notifyId).emit('notification', {
            type: 'error',
            title: 'Обмін скасовано',
            message: trade.senderId === userId ? 'Відправник скасував пропозицію обміну.' : 'Одержувач відхилив вашу пропозицію обміну.',
            duration: 5000,
        });

        return updated;
    }
}
