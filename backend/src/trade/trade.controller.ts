import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TradeService } from './trade.service';

@Controller('trade')
@UseGuards(AuthGuard('jwt'))
export class TradeController {
    constructor(private readonly tradeService: TradeService) { }

    @Post('create')
    createTrade(
        @Request() req: any,
        @Body() body: {
            receiverId: string;
            offerAmount: number;
            offerCurrency: 'SOFT' | 'HARD';
            requestAmount: number;
            requestCurrency: 'SOFT' | 'HARD';
        },
    ) {
        return this.tradeService.createTrade(req.user.id, body);
    }

    @Get('list')
    listTrades(@Request() req: any) {
        return this.tradeService.listTrades(req.user.id);
    }

    @Post(':id/accept')
    acceptTrade(@Request() req: any, @Param('id') tradeId: string) {
        return this.tradeService.acceptTrade(req.user.id, tradeId);
    }

    @Post(':id/reject')
    rejectTrade(@Request() req: any, @Param('id') tradeId: string) {
        return this.tradeService.rejectTrade(req.user.id, tradeId);
    }
}
