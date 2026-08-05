// src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException, Param, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgetpassword.dto';
import { ResetPasswordDto } from './dto/resetpassword-dto';
import { UserRole } from './entities/user.entity';
import { GetReportsQueryDto } from './dto/get-reports-query.dto';
import { JwtAuthGuard } from './strategies/jwt-auth-guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService

  ) { }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() signupDto: SignupDto) {
    const role = signupDto.role?.toLowerCase();

    if (role === UserRole.ADMIN.toLowerCase()) {
      return this.authService.signupAdmin(signupDto);
    }

    if (!role || role === UserRole.USER.toLowerCase()) {
      return this.authService.signup(signupDto);
    }

    throw new BadRequestException('Invalid role provided'); // ✅ else case handle
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    console.log('login hit', loginDto);
    const role = loginDto.role?.toLowerCase();

    if (role === UserRole.ADMIN.toLowerCase()) {
      return this.authService.loginADMIN(loginDto);
    }

    if (!role || role === UserRole.USER.toLowerCase()) {
      return this.authService.login(loginDto);
    }

    // return this.authService.login(loginDto);
  }


  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyResetOtp(verifyOtpDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

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
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.authService.getDashboardStats();
  }
  @Get('users/all')
  getAllUsersByRole(@Query('role') role?: string) {
    // console.log('hit on all users');
    
    return this.authService.getAll(role);
  }
  @Get('transaction/all/:id')
  getAllTransByType(@Param('id') id:string, @Query('type') type?: string) {
    // console.log('hit on all users');
    return this.authService.getAllTransactions(type,id);
  }
  @Get('transaction/history')
  async getTransactionHistory(@Query() query: GetReportsQueryDto) {
    // console.log('hit');
    
    return this.authService.getTransactionHistory(query);
  }

  // Route: GET /transactions/summary
  @Get('transaction/summary')
  async getReportsSummary() {
    return this.authService.getReportsSummary();
  }
  @Get('export')
  async exportTransactions(@Query() query: GetReportsQueryDto, @Res() res: any) {
    const csvData = await this.authService.exportFilteredTransactions(query);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=ledger-report-${Date.now()}.csv`);
    return res.status(200).send(csvData);
  }
}