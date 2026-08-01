import { Controller, Get, Post, Body } from '@nestjs/common';
import { PriceService } from './prices.service';
import { CreatePriceDto } from './prices-dto';


@Controller('prices')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  // 🚀 Admin POST API: New active price add karega
  @Post()
  async updatePrice(@Body() dto: CreatePriceDto) {
    return await this.priceService.updatePrice(dto);
  }

  // 📱 Mobile App GET API: Active Gold & Silver Rates fetch karega
  @Get('active')
  async getActivePrices() {
    return await this.priceService.getActivePrices();
  }

  // 📜 Admin GET API: Audit History dekhne ke liye
  @Get('history')
  async getAllPricesHistory() {
    return await this.priceService.getAllPricesHistory();
  }
}