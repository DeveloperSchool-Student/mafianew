import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PmService } from './pm.service';
import { SendMessageDto } from './dto/pm.dto';

@Controller('pm')
@UseGuards(AuthGuard('jwt'))
export class PmController {
  constructor(private readonly pmService: PmService) {}

  @Get('conversations')
  getConversations(@Request() req: { user: { id: string } }) {
    return this.pmService.getConversations(req.user.id);
  }

  @Get('chat/:userId')
  getMessages(
    @Request() req: { user: { id: string } },
    @Param('userId') targetId: string,
  ) {
    return this.pmService.getMessages(req.user.id, targetId);
  }

  @Post('send')
  sendMessage(
    @Request() req: { user: { id: string } },
    @Body() body: SendMessageDto,
  ) {
    return this.pmService.sendMessage(req.user.id, body.targetId, body.content);
  }
}
