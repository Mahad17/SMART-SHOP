import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { BuyProductDto, DonateDto, ClaimCashbackDto } from './wallet-operation.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) { }

  @Post('buy')
  @HttpCode(HttpStatus.OK)
  async buyProduct(@Body() buyProductDto: BuyProductDto) {
    return this.walletService.buyProduct(buyProductDto);
  }

  @Post('zakat')
  @HttpCode(HttpStatus.OK)
  async processZakat(@Body() donateDto: DonateDto) {
    return this.walletService.processDonation(donateDto);
  }

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: string) {
    console.log('checking balance of ', userId);
    
    const balance = await this.walletService.getBalance(userId);
    return { success: true, balance };
  }

  @Post('donate')
  @HttpCode(HttpStatus.OK)
  async donate(@Body() donateDto: DonateDto) {
    return this.walletService.processDonation(donateDto);
  }

  @Post('claim-cashback')
  @HttpCode(HttpStatus.OK)
  async claimCashback(@Body() dto: ClaimCashbackDto) {
    return this.walletService.claimAnnualDonationCashback(dto.userId);
  }

  @Get('history/:userId')
  async getHistory(@Param('userId') userId: string) {
        console.log('checking history of ', userId);

    return this.walletService.getHistoryLogs(userId);
  }
}