import { Controller, Post, UseGuards, Request, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RewardService } from './reward.service';

@Controller('reward')
@UseGuards(AuthGuard('jwt'))
export class RewardController {
    constructor(private rewardService: RewardService) { }

    @Get('status')
    async getRewardStatus(@Request() req: any) {
        return this.rewardService.getRewardStatus(req.user.id);
    }

    @Post('claim')
    async claimDailyReward(@Request() req: any) {
        return this.rewardService.claimDailyReward(req.user.id);
    }
}
