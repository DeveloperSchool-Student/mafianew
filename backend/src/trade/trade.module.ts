import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { GameModule } from '../game/game.module';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';

@Module({
    imports: [PrismaModule, GameModule],
    controllers: [TradeController],
    providers: [TradeService],
    exports: [TradeService],
})
export class TradeModule { }
