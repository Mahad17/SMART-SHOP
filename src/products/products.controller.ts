import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth-guard'; 
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './product-dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getProducts(): Promise<Product[]> {
    return this.productService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async postProducts(@Body() body: CreateProductDto) {
    return this.productService.save(body);
  }

  // ParseIntPipe REMOVED -> UUID string accept karne ke liye
  @Patch('update/:id')
  @UseGuards(JwtAuthGuard)
  async updateProduct(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    console.log('Update hit for UUID:', id);
    return this.productService.update(id, body);
  }

  // ParseIntPipe REMOVED -> UUID string accept karne ke liye
  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard)
  async deleteProduct(@Param('id') id: string) {
    console.log('Deleting product with UUID:', id);
    return this.productService.remove(id);
  }
}