import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @Length(4, 4, { message: 'OTP must be exactly 4 digits.' })
  otpCode: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  newPassword: string;
}