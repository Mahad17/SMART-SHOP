import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './product-dto';

@Injectable()
export class ProductService implements OnModuleInit {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  // Yeh tab chalega jab module load hoga taake database khali ho to dummy products insert ho jayein
  async onModuleInit() {
    const count = await this.productRepository.count();
    if (count === 0) {
      const dummyProducts = [
        {
          name: 'Wireless Headphones',
          price: 99.99,
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
          category: 'Electronics',
          description: 'High quality noise cancelling wireless headphones.',
        },
        {
          name: 'Smart Watch Series 9',
          price: 299.99,
          image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
          category: 'Wearables',
          description: 'Stay connected with the latest fitness tracking tech.',
        },
        {
          name: 'Premium Leather Wallet',
          price: 45.00,
          image: 'https://images.unsplash.com/photo-1627124765135-56fc6529323d?w=500',
          category: 'Accessories',
          description: 'Handcrafted slim design leather wallet for men.',
        }
      ];
      await this.productRepository.save(dummyProducts);
      console.log('Seed: Dummy products inserted successfully!');
    }
  }

  async findAll(): Promise<Product[]> {
    return await this.productRepository.find();
  }
 async save(body: CreateProductDto) {
  // 1. Body se variables destructure karein
  const { name, price, category, image } = body;
  
  // 2. Repository instance create karein
  const create = this.productRepository.create({ name, price, category, image });
  
  // 3. Clean return statement binary comma error ke bina
  return await this.productRepository.save(create);
}
}