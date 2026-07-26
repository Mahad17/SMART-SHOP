// src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() signupDto: SignupDto) {
        console.log('signup hit');

    return this.authService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    console.log('login hit');
    
    return this.authService.login(loginDto);
  }
  // src/auth/auth.controller.ts mein post mapping add karein:

@Post('resend-otp')
@HttpCode(HttpStatus.OK)
resendOtp(@Body('email') email: string) {
          console.log('resend otp hit');

  return this.authService.resendOtp(email);
}

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
        console.log('verify otp hit');

    return this.authService.verifyOtp(verifyOtpDto);
  }
}