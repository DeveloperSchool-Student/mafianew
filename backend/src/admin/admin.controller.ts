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
import {
  SetStaffRoleDto,
  TargetUsernameDto,
  PunishDto,
  UnpunishDto,
  AdjustEconomyDto,
  ChangeNicknameDto,
  CreateReportDto,
  ResolveReportDto,
  SubmitAppealDto,
  ResolveAppealDto,
  ClearLogsDto,
  DeleteUserDto,
  SetTitleDto,
  ResolveClanWarDto,
  LaunchEventDto,
  StartSeasonDto,
} from './dto/admin.dto';

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
  setStaffRole(@Request() req: any, @Body() body: SetStaffRoleDto) {
    return this.adminService.setStaffRole(req.user, body);
  }

  @Post('staff/remove-role')
  removeStaffRole(@Request() req: any, @Body() body: TargetUsernameDto) {
    return this.adminService.removeStaffRole(req.user, body);
  }

  /* ── Rooms ── */

  @Get('rooms')
  getActiveRooms(@Request() req: any) {
    return this.adminService.getActiveRooms(req.user);
  }

  @Post('rooms/:id/close')
  closeRoom(@Request() req: any, @Param('id') roomId: string) {
    return this.adminService.closeRoom(req.user, { roomId });
  }

  /* ── Users ── */

  @Get('users')
  listUsers(
    @Request() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.adminService.listUsers(req.user, cursor, limit);
  }

  @Get('user/:id/punishments')
  getUserPunishments(@Request() req: any, @Param('id') userId: string) {
    return this.adminService.getUserPunishments(req.user, userId);
  }

  /* ── Punishments ── */

  @Post('punish')
  punish(@Request() req: any, @Body() body: PunishDto) {
    return this.adminService.punishUser(req.user, body);
  }

  @Post('unpunish')
  unpunish(@Request() req: any, @Body() body: UnpunishDto) {
    return this.adminService.unpunishUser(req.user, body);
  }

  /* ── Gold / EXP ── */

  @Post('adjust-gold')
  adjustGold(@Request() req: any, @Body() body: AdjustEconomyDto) {
    return this.adminService.adjustGold(req.user, body);
  }

  @Post('adjust-exp')
  adjustExp(@Request() req: any, @Body() body: AdjustEconomyDto) {
    return this.adminService.adjustExp(req.user, body);
  }

  /* ── Nickname ── */

  @Post('change-nickname')
  changeNickname(@Request() req: any, @Body() body: ChangeNicknameDto) {
    return this.adminService.changeNickname(req.user, body);
  }

  /* ── Reports ── */

  @Post('reports')
  createReport(@Request() req: any, @Body() body: CreateReportDto) {
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
    @Body() body: ResolveReportDto,
  ) {
    return this.adminService.resolveReport(req.user, {
      reportId,
      ...body,
    });
  }

  /* ── Appeals ── */

  @Post('appeals/submit')
  submitAppeal(@Request() req: any, @Body() body: SubmitAppealDto) {
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
    @Body() body: ResolveAppealDto,
  ) {
    return this.adminService.resolveAppeal(req.user, {
      appealId,
      ...body,
    });
  }

  /* ── Logs ── */

  @Get('logs')
  getActionLogs(
    @Request() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.adminService.getActionLogs(req.user, cursor, limit);
  }

  @Post('logs/clear')
  clearLogs(@Request() req: any, @Body() body: ClearLogsDto) {
    return this.adminService.clearLogs(req.user, body);
  }

  /* ── Staff Roles seed (call once on setup) ── */

  @Post('seed-roles')
  seedRoles(@Request() req: any) {
    return this.adminService.seedStaffRoles();
  }

  /* ── Delete User ── */

  @Post('delete-user')
  deleteUser(@Request() req: any, @Body() body: DeleteUserDto) {
    return this.adminService.deleteUser(req.user, body);
  }

  /* ── Titles (Leaders) ── */

  @Post('set-title')
  setPlayerTitle(@Request() req: any, @Body() body: SetTitleDto) {
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
    @Body() body: ResolveClanWarDto,
  ) {
    return this.adminService.resolveClanWar(req.user, {
      warId,
      winnerId: body.winnerId,
    });
  }

  /* ── Events ── */

  @Post('events/launch')
  launchEvent(@Request() req: any, @Body() body: LaunchEventDto) {
    return this.adminService.launchEvent(req.user, body);
  }

  /* ── Stats ── */

  @Get('stats')
  getGlobalStats(@Request() req: any) {
    return this.adminService.getGlobalStats(req.user);
  }

  /* ── Seasons ── */

  @Get('seasons')
  getSeasons(@Request() req: any) {
    return this.adminService.getSeasons(req.user);
  }

  @Post('seasons/start')
  startSeason(@Request() req: any, @Body() body: StartSeasonDto) {
    return this.adminService.startSeason(req.user, body);
  }

  @Post('seasons/end')
  endSeason(@Request() req: any) {
    return this.adminService.endSeason(req.user);
  }
}
