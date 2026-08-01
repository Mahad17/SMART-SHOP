import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePriceDto {
  @IsString()
  @IsNotEmpty()
  name: string; // e.g., 'GOLD' or 'SILVER'

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsOptional()
  description?: string;
}