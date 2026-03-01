import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchesController } from './matches.controller';

@Module({
    imports: [PrismaModule],
    controllers: [MatchesController],
})
export class MatchesModule { }
