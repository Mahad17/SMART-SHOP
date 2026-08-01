import { Type } from 'class-transformer';
import { IsUUID, IsNumber, IsPositive, IsString, IsNotEmpty, IsArray, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export class ProductItemDto {
  @IsUUID('4', { message: 'productId must be a valid UUID v4' })
  productId: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;
}

export class BuyProductDto {
  @IsUUID('4', { message: 'userId must be a valid UUID v4' })
  userId: string;

  @IsString()
  paymentMethod: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  @IsOptional()
  cashbackAmount?: number;

  @IsString()
  @IsOptional()
  details?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductItemDto)
  products: ProductItemDto[];
}

export class DonateDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  causeDetails: string;

  @IsString()
  @IsNotEmpty()
  type: string;
  
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}

export class ClaimCashbackDto {
  @IsUUID()
  userId: string;
}