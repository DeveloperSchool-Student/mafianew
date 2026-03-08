import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AdminModule } from '../admin/admin.module';

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
  providers: [GameGateway, GameService],
  exports: [GameGateway],
})
export class GameModule {}
