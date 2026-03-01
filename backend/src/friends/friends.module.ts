import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GameModule } from '../game/game.module';

@Module({
    imports: [PrismaModule, GameModule],
    providers: [FriendsService],
    controllers: [FriendsController],
})
export class FriendsModule { }
