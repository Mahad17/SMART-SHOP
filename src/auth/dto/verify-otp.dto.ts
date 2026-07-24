import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits' })
  otpCode: string;
}