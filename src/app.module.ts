import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as pg from 'pg';

import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { EmailService } from './auth/email.service';
import { ProductService } from './products/product.service';
import { ProductController } from './products/products.controller';
import { Product } from './products/product.entity';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Transaction } from './transaction/transaction.entity';
import { WalletController } from './wallet/wallet.controller';
import { WalletService } from './wallet/wallet.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'SUPER_SECRET_KEY_123'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // TypeORM Configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        driver: pg,
        url: configService.get<string>('DATABASE_URL'),
        schema: 'public',
        autoLoadEntities: true,
        synchronize: false,
        ssl: {
          rejectUnauthorized: false, // Forces connection to ignore SSL cert chain errors
        },
        extra: {
          ssl: {
            rejectUnauthorized: false,
          },
        },
        entities: [User, Product, Transaction],
      }),
    }),
    TypeOrmModule.forFeature([User, Product, Transaction]),
    AuthModule,
  ],
  controllers: [AuthController, ProductController, WalletController],
  providers: [AuthService, EmailService, ProductService, JwtService, WalletService],
})
export class AppModule {}