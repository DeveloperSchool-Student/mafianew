import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GameModule } from '../game/game.module';
import { StaffManagementService } from './services/staff-management.service';
import { PunishmentsService } from './services/punishments.service';
import { EconomyService } from './services/economy.service';
import { ReportsService } from './services/reports.service';
import { AdminLogsService } from './services/admin-logs.service';
import { AppealsService } from './services/appeals.service';
import { UserModerationService } from './services/user-moderation.service';
import { EventsService } from './services/events.service';
import { SeasonsService } from './services/seasons.service';

@Module({
  imports: [PrismaModule, RedisModule, forwardRef(() => GameModule)],
  controllers: [AdminController],
  providers: [
    StaffManagementService,
    PunishmentsService,
    EconomyService,
    ReportsService,
    AdminLogsService,
    AppealsService,
    UserModerationService,
    EventsService,
    SeasonsService,
    AdminService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
