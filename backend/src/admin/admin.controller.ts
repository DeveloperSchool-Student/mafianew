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

  /* ── Rooms ── */

  @Get('rooms')
  getActiveRooms(@Request() req: any) {
    return this.adminService.getActiveRooms(req.user);
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

  @Get('my-reports')
  getMyReports(@Request() req: any) {
    return this.adminService.getMyReports(req.user.sub);
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

  /* ── Appeals ── */

  @Post('appeals/submit')
  submitAppeal(
    @Request() req: any,
    @Body() body: { type: 'UNBAN' | 'UNMUTE'; reason: string },
  ) {
    return this.adminService.submitAppeal(req.user.sub, body);
  }

  @Get('appeals')
  listAppeals(@Request() req: any, @Query('status') status?: string) {
    return this.adminService.listAppeals(req.user, status);
  }

  @Post('appeals/:id/resolve')
  resolveAppeal(
    @Request() req: any,
    @Param('id') appealId: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' },
  ) {
    return this.adminService.resolveAppeal(req.user, {
      appealId,
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

  /* ── Delete User ── */

  @Post('delete-user')
  deleteUser(
    @Request() req: any,
    @Body() body: { targetUsername: string },
  ) {
    return this.adminService.deleteUser(req.user, body);
  }

  /* ── Titles (Leaders) ── */

  @Post('set-title')
  setPlayerTitle(
    @Request() req: any,
    @Body() body: { targetUsername: string; title: string | null },
  ) {
    // Controller just passes to service, service handles auth/logic
    return this.adminService.setPlayerTitle(req.user, body);
  }

  /* ── Clan Wars ── */

  @Get('clan-wars')
  listClanWars(@Request() req: any, @Query('status') status?: string) {
    return this.adminService.listClanWars(req.user, status);
  }

  @Post('clan-wars/:id/resolve')
  resolveClanWar(
    @Request() req: any,
    @Param('id') warId: string,
    @Body() body: { winnerId: string | null },
  ) {
    return this.adminService.resolveClanWar(req.user, { warId, winnerId: body.winnerId });
  }
}
