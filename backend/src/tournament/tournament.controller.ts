import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TournamentService } from './tournament.service';
import {
  CreateTournamentDto,
  MatchResultDto,
  EliminatePlayerDto,
  EndTournamentDto,
} from './dto/tournament.dto';

@Controller('tournaments')
@UseGuards(AuthGuard('jwt'))
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.tournamentService.listTournaments(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tournamentService.getTournament(id);
  }

  @Post()
  create(@Request() req: any, @Body() body: CreateTournamentDto) {
    return this.tournamentService.createTournament(req.user, body);
  }

  @Post(':id/join')
  join(@Request() req: any, @Param('id') id: string) {
    return this.tournamentService.joinTournament(
      req.user.id,
      req.user.username,
      id,
    );
  }

  @Post(':id/leave')
  leave(@Request() req: any, @Param('id') id: string) {
    return this.tournamentService.leaveTournament(req.user.id, id);
  }

  @Post(':id/start')
  start(@Request() req: any, @Param('id') id: string) {
    return this.tournamentService.startTournament(req.user, id);
  }

  @Post(':id/match-result')
  recordMatch(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: MatchResultDto,
  ) {
    return this.tournamentService.recordMatchResult(req.user, {
      tournamentId: id,
      winnerId: body.winnerId,
      loserId: body.loserId,
    });
  }

  @Post(':id/eliminate')
  eliminate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: EliminatePlayerDto,
  ) {
    return this.tournamentService.eliminatePlayer(req.user, {
      tournamentId: id,
      userId: body.userId,
    });
  }

  @Post(':id/end')
  end(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: EndTournamentDto,
  ) {
    return this.tournamentService.endTournament(req.user, id, body.winnerId);
  }

  @Post(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.tournamentService.cancelTournament(req.user, id);
  }
}
