// src/auth/auth.service.ts
import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from './email.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private emailService: EmailService,
        private jwtService: JwtService, // Inject JWT Service
    ) { }

    // 1. SIGNUP API
    async signup(signupDto: SignupDto) {
        const { firstName, lastName, email, phoneNumber, password } = signupDto;

        // Check existing
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new BadRequestException('Email already registered');
        }

        // Hash Password
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);

        // Create User
        const newUser = this.userRepository.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            phoneNumber,
            passwordHash,
            role: UserRole.USER, // Default signup via mobile app is normal user
        });

        await this.userRepository.save(newUser);
        return { message: 'User registered successfully. You can now login.' };
    }

    // 2. LOGIN API (Triggers OTP)
    async login(loginDto: LoginDto) {
        const { email, password, role } = loginDto;

        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // STRICT ROLE VALIDATION: User mobile app par login kare aur Admin web portal par
        if (user.role !== role) {
            throw new UnauthorizedException(`Access denied. Accessing with invalid role privileges.`);
        }

        // Check Password
        const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate 4-digit secure OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10); // OTP expires in 10 minutes

        user.otpCode = otp;
        user.otpExpiresAt = expiry;
        await this.userRepository.save(user);

        // Simulate OTP Email / SMS
        const emailSent = await this.emailService.sendOtpEmail(user.email, otp);

        if (!emailSent) {
            // Agar email dispatch fail ho jaye to alert trigger karein
            throw new BadRequestException('Failed to send verification OTP email. Please try again.');
        }

        return {
            message: 'Secure OTP sent successfully to your email.',
            email: user.email,
        }

    }

    // src/auth/auth.service.ts mein baqi functions ke sath ye add karein:

    async resendOtp(email: string) {
        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Naya 4-digit OTP code generate karein
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10); // 10 mins validity

        user.otpCode = otp;
        user.otpExpiresAt = expiry;
        await this.userRepository.save(user);

        // Real Email send karein
        const emailSent = await this.emailService.sendOtpEmail(user.email, otp);
        if (!emailSent) {
            throw new BadRequestException('Failed to send OTP email.');
        }

        return { message: 'A new verification code has been sent to your email.' };
    }

    // 3. VERIFY OTP API
    async verifyOtp(verifyOtpDto: VerifyOtpDto) {
        const { email, otpCode } = verifyOtpDto;

        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Validation checks
        if (!user.otpCode || user.otpCode !== otpCode) {
            throw new BadRequestException('Invalid OTP code');
        }

        if (new Date() > user.otpExpiresAt) {
            throw new BadRequestException('OTP code has expired');
        }

        // Clear OTP fields upon success
        user.otpCode;
        user.otpExpiresAt;
        user.isVerified = true;
        await this.userRepository.save(user);
        const payload = { sub: user.id, email: user.email };
        const token = this.jwtService.sign(payload, {
            secret: 'SUPER_SECRET_KEY_123', // <--- Yeh key dhyan se wahi rakhni hai jo auth.module aur jwt.strategy mein hai
            expiresIn: '7d',
        });        // Return authentication pass token (JWT token production mein build kar sakte hain)
        return {
            message: 'OTP Verified successfully!',
            userId: user.id,
            firstName: user.firstName + ' '+user.lastName,
            role: user.role,
            token: token
        };
    }
}