import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Price, PriceStatus } from './prices.entity';
import { CreatePriceDto } from './prices-dto';

@Injectable()
export class PriceService {
  constructor(
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,
    private readonly dataSource: DataSource,
  ) {}

  // 1. Admin Update / Create Price (Transaction approach)
  async updatePrice(dto: CreatePriceDto): Promise<Price> {
    const formattedName = dto.name.toUpperCase().trim();

    return await this.dataSource.transaction(async (manager) => {
      // Step A: Existing active row status change to INACTIVE
      await manager.update(
        Price,
        { name: formattedName, status: PriceStatus.ACTIVE },
        { status: PriceStatus.INACTIVE },
      );

      // Step B: New Active row create karein
      const newPrice = manager.create(Price, {
        name: formattedName,
        price: dto.price,
        description: dto.description,
        status: PriceStatus.ACTIVE,
      });

      return await manager.save(Price, newPrice);
    });
  }

  // 2. Mobile App / Client GET Active Prices
  async getActivePrices(): Promise<Record<string, number>> {
    const activePrices = await this.priceRepository.find({
      where: { status: PriceStatus.ACTIVE },
    });

    // Object format Return -> { GOLD: 24500, SILVER: 320 }
    const priceMap: Record<string, number> = {};
    activePrices.forEach((item) => {
      priceMap[item.name] = parseFloat(item.price as any);
    });

    return priceMap;
  }

  // 3. Admin History GET (All rows)
  async getAllPricesHistory(): Promise<Price[]> {
    return await this.priceRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}