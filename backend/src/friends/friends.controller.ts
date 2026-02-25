import { Controller, Get, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
    constructor(private readonly friendsService: FriendsService) { }

    @Get()
    getFriends(@Request() req: { user: { id: string } }) {
        return this.friendsService.getFriends(req.user.id);
    }

    @Post('request')
    sendRequest(
        @Request() req: { user: { id: string } },
        @Body() body: { friendUsername: string }
    ) {
        return this.friendsService.sendRequest(req.user.id, body.friendUsername);
    }

    @Post('accept/:id')
    acceptRequest(
        @Request() req: { user: { id: string } },
        @Param('id') friendshipId: string
    ) {
        return this.friendsService.acceptRequest(req.user.id, friendshipId);
    }

    @Post('reject/:id')
    rejectRequest(
        @Request() req: { user: { id: string } },
        @Param('id') friendshipId: string
    ) {
        return this.friendsService.rejectRequest(req.user.id, friendshipId);
    }

    @Post('remove/:id')
    removeFriend(
        @Request() req: { user: { id: string } },
        @Param('id') friendshipId: string
    ) {
        return this.friendsService.removeFriend(req.user.id, friendshipId);
    }
}
