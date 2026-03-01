import { Module } from '@nestjs/common';
import { PmService } from './pm.service';
import { PmController } from './pm.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GameModule } from '../game/game.module';

@Module({
    imports: [PrismaModule, GameModule],
    providers: [PmService],
    controllers: [PmController],
})
export class PmModule { }
