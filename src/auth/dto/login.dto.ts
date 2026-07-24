import { IsEmail, IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsEnum(UserRole, { message: 'Role must be either user or admin' })
  role: UserRole; // App se 'user' aur admin portal se 'admin' pass hoga
}