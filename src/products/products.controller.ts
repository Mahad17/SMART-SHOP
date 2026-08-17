import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ProductService } from './product.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth-guard';
import { Product } from './product.entity';
import { CreateProductDto, UpdateProductDto } from './product-dto';
import { productImageUploadOptions } from './upload.config';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getProducts(): Promise<Product[]> {
    return this.productService.findAll();
  }

  // Admin uploads a file from their device -> stored under /uploads/products,
  // served statically (see main.ts). Frontend then creates/updates the product
  // with the returned url + imageType: 'local'.
  @Post('upload-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', productImageUploadOptions))
  async uploadImage(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('No image file was uploaded');
    }
    // Absolute URL so mobile app / admin portal can render it without knowing the API host.
    // PUBLIC_BASE_URL (set in .env) wins when present — this matters for local dev,
    // where the admin panel and the phone reach the backend through different hosts
    // (e.g. admin via http://localhost:3000, phone via http://<lan-ip>:3000). Using
    // req.protocol/host directly would bake in whichever host the uploader happened
    // to use, which the phone often can't resolve. Falls back to the request's own
    // host when unset, which is correct behind Render/Vercel in production.
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl.replace(/\/$/, '')}/uploads/products/${file.filename}` };
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