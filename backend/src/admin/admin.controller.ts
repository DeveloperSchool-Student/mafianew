import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  /* ── Staff Management ── */

  @Get('staff')
  listStaff(@Request() req: any) {
    return this.adminService.listStaff(req.user);
  }

  @Post('staff/set-role')
  setStaffRole(
    @Request() req: any,
    @Body() body: { targetUsername: string; roleKey: string },
  ) {
    return this.adminService.setStaffRole(req.user, body);
  }

  @Post('staff/remove-role')
  removeStaffRole(
    @Request() req: any,
    @Body() body: { targetUsername: string },
  ) {
    return this.adminService.removeStaffRole(req.user, body);
  }

  /* ── Users ── */

  @Get('users')
  listUsers(@Request() req: any) {
    return this.adminService.listUsers(req.user);
  }

  @Get('user/:id/punishments')
  getUserPunishments(@Request() req: any, @Param('id') userId: string) {
    return this.adminService.getUserPunishments(req.user, userId);
  }

  /* ── Punishments ── */

  @Post('punish')
  punish(
    @Request() req: any,
    @Body()
    body: {
      targetUsername: string;
      type: 'BAN' | 'MUTE' | 'KICK';
      durationSeconds?: number;
      scope?: string;
      reason?: string;
    },
  ) {
    return this.adminService.punishUser(req.user, body);
  }

  @Post('unpunish')
  unpunish(
    @Request() req: any,
    @Body() body: { targetUsername: string; type: 'BAN' | 'MUTE' | 'KICK' },
  ) {
    return this.adminService.unpunishUser(req.user, body);
  }

  /* ── Gold / EXP ── */

  @Post('adjust-gold')
  adjustGold(
    @Request() req: any,
    @Body() body: { targetUsername: string; delta: number },
  ) {
    return this.adminService.adjustGold(req.user, body);
  }

  @Post('adjust-exp')
  adjustExp(
    @Request() req: any,
    @Body() body: { targetUsername: string; delta: number },
  ) {
    return this.adminService.adjustExp(req.user, body);
  }

  /* ── Nickname ── */

  @Post('change-nickname')
  changeNickname(
    @Request() req: any,
    @Body() body: { targetUsername: string; newUsername: string },
  ) {
    return this.adminService.changeNickname(req.user, body);
  }

  /* ── Reports ── */

  @Post('reports')
  createReport(
    @Request() req: any,
    @Body() body: { targetUsername: string; reason: string; screenshotUrl?: string },
  ) {
    return this.adminService.createReport(req.user.sub, body);
  }

  @Get('reports')
  listReports(@Request() req: any, @Query('status') status?: string) {
    return this.adminService.listReports(req.user, status);
  }

  @Post('reports/:id/resolve')
  resolveReport(
    @Request() req: any,
    @Param('id') reportId: string,
    @Body() body: { status: 'RESOLVED' | 'REJECTED'; note?: string },
  ) {
    return this.adminService.resolveReport(req.user, {
      reportId,
      ...body,
    });
  }

  /* ── Logs ── */

  @Get('logs')
  getActionLogs(@Request() req: any) {
    return this.adminService.getActionLogs(req.user);
  }

  /* ── Staff Roles seed (call once on setup) ── */

  @Post('seed-roles')
  seedRoles(@Request() req: any) {
    // Only owner-level power can seed
    return this.adminService.seedStaffRoles();
  }
}
