import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AdminModule } from '../admin/admin.module';
import { PhaseTransitionService } from './logic/phase-transition.service';
import { RoleDistributionService } from './logic/role-distribution.service';
import { VotingResolutionService } from './logic/voting-resolution.service';
import { NightActionResolutionService } from './logic/night-action-resolution.service';
import { WinConditionService } from './logic/win-condition.service';
import { MatchRecordingService } from './logic/match-recording.service';
import { SpectatorBetService } from './logic/spectator-bet.service';
import { GameHelpersService } from './logic/game-helpers.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    PrismaModule,
    RedisModule,
    forwardRef(() => AdminModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    GameGateway,
    GameService,
    PhaseTransitionService,
    RoleDistributionService,
    VotingResolutionService,
    NightActionResolutionService,
    WinConditionService,
    MatchRecordingService,
    SpectatorBetService,
    GameHelpersService,
  ],
  exports: [GameGateway],
})
export class GameModule {}
