import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
        JwtModule.register({
          secret: 'SUPER_SECRET_KEY_123', // Real app mein isey .env file mein rakhein
          signOptions: { expiresIn: '7d' }, // Token 7 din tak valid rahega
        }),
    // .env variables load karne ke liye
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // TypeORM Configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USERNAME'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        schema: configService.get<string>('DATABASE_SCHEMA'),
        autoLoadEntities: true, // Entities automatic load ho jayengi
        synchronize: false,
        ssl: {
          rejectUnauthorized: false,
        },

        entities:[
          User,Product,Transaction
        ] // Active development ke liye true (migrations khud handle karega)
      }),
    }),
        TypeOrmModule.forFeature([
          User,Product,Transaction
        ]),
    AuthModule,
  ],
  controllers: [AuthController,ProductController,WalletController],
  providers: [AuthService,EmailService,ProductService,JwtService,WalletService],
})
export class AppModule {}