import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { JwtAuthGuard } from 'src/auth/strategies/jwt-auth-guard';
import { Product } from './product.entity';
import { CreateProductDto } from './product-dto';


@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @UseGuards(JwtAuthGuard) // <-- Sirf logged-in users access kar sakein ge
  async getProducts(): Promise<Product[]> {
    return this.productService.findAll();
  }
  @Post()
  @UseGuards(JwtAuthGuard) // <-- Sirf logged-in users access kar sakein ge
  async postProducts( @Body() body:CreateProductDto) {
    console.log('body',body);
    
    return this.productService.save(body);
  }
}