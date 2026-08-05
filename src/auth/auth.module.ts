import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EmailService } from './email.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/auth.strategy';
import { Transaction } from 'src/transaction/transaction.entity';
import { Product } from 'src/products/product.entity';

@Module({
  imports:[

    TypeOrmModule.forFeature([User,Transaction,Product]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: 'SUPER_SECRET_KEY_123', // Real app mein isey .env file mein rakhein
      signOptions: { expiresIn: '7d' }, // Token 7 din tak valid rahega
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService,EmailService,JwtStrategy],
  exports:[JwtStrategy]
})
export class AuthModule {}
