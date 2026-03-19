import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameState } from '../game.types';

@Injectable()
export class SpectatorBetService {
  private readonly logger = new Logger(SpectatorBetService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveBets(state: GameState, winner: string, gatewayEmitCb: Function) {
    if (!state.bets || state.bets.size === 0) return;

    for (const [userId, bet] of state.bets.entries()) {
      try {
        if (bet.faction === winner) {
          const winnings = bet.amount * 2;
          await this.prisma.wallet.update({
            where: { userId },
            data: { soft: { increment: winnings } },
          });
          gatewayEmitCb(state.roomId, 'private_action_result', {
            userId,
            message: `Ваша ставка виграла! Ви отримали ${winnings} монет.`,
          });
        } else {
          gatewayEmitCb(state.roomId, 'private_action_result', {
            userId,
            message: `Ваша ставка програла (${bet.amount} монет).`,
          });
        }
      } catch (e: any) {
        this.logger.error(`[resolveBets] Помилка обробки ставки гравця ${userId}: ${e.message}`, e);
      }
    }
  }
}
