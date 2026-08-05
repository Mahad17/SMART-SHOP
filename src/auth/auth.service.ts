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
import { ResetPasswordDto } from './dto/resetpassword-dto';
import { ForgotPasswordDto } from './dto/forgetpassword.dto';
import { Transaction, TransactionType } from 'src/transaction/transaction.entity';
import { GetReportsQueryDto } from './dto/get-reports-query.dto';
import { Parser } from 'json2csv';
import { Product } from 'src/products/product.entity';
@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,

        @InjectRepository(Transaction)

        private transRepository: Repository<Transaction>,
        @InjectRepository(Product)

        private productRepository: Repository<Product>,
        private emailService: EmailService,
        private jwtService: JwtService, // Inject JWT Service
    ) { }

    async getDashboardStats() {
    // 1. Total Users Count
    const totalUsers = await this.userRepository.count();

    // 2. Total Products Count
    const totalProducts = await this.productRepository.count();

    // 3. Total Donations Sum
    
    return {
      totalUsers,
      totalProducts,
      
    };
  }
    async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
        const { email } = forgotPasswordDto;

        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new NotFoundException('User with this email address does not exist.');
        }

        // 4-digit OTP code generate karein (Existing login flow ki tarah)
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);

        user.otpCode = otp;
        user.otpExpiresAt = expiry;
        await this.userRepository.save(user);

        // Send Reset Email via Brevo
        this.emailService.sendResetPasswordOtpEmail(user.email, otp).catch((error) => {
            console.error(`[Email Failure] Failed to send Reset OTP to ${user.email}:`, error);
        });

        return {
            message: 'A 4-digit password reset OTP has been sent to your email.',
            email: user.email,
        };
    }

    // 2. VERIFY RESET OTP (Mobile App Screen Step 2 Validation)
    async verifyResetOtp(verifyOtpDto: VerifyOtpDto) {
        const { email, otpCode } = verifyOtpDto;

        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new NotFoundException('User not found.');
        }

        if (!user.otpCode || user.otpCode !== otpCode) {
            throw new BadRequestException('Invalid OTP code.');
        }

        if (new Date() > user.otpExpiresAt) {
            throw new BadRequestException('OTP code has expired.');
        }

        return {
            message: 'OTP verified successfully. You can now set a new password.',
            email: user.email,
        };
    }

    // 3. RESET PASSWORD (Update Password & Clear OTP)
    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        const { email, otpCode, newPassword } = resetPasswordDto;

        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new NotFoundException('User not found.');
        }

        // Double verification check
        if (!user.otpCode || user.otpCode !== otpCode) {
            throw new BadRequestException('Invalid or unauthorized OTP token.');
        }

        if (new Date() > user.otpExpiresAt) {
            throw new BadRequestException('OTP code has expired.');
        }

        // Hash new password using bcrypt
        const salt = await bcrypt.genSalt();
        user.passwordHash = await bcrypt.hash(newPassword, salt);

        // Clear OTP attributes
        user.otpCode;
        user.otpExpiresAt;

        await this.userRepository.save(user);

        return {
            message: 'Password reset successful. You can now login with your new password.',
        };
    }

    // 1. SIGNUP API
    async signup(signupDto: SignupDto) {
        const { firstName, lastName, email, phoneNumber, password } = signupDto;
        // 🔥 role destructure hata diya — client se trust nahi karna

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
            role: UserRole.USER,
        });

        await this.userRepository.save(newUser);
        return { message: 'User registered successfully. You can now login.' };
    }
    async signupAdmin(signupDto: SignupDto) {
        const { firstName, lastName, email, phoneNumber, password } = signupDto;
        // 🔥 role destructure hata diya — client se trust nahi karna

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
            role: UserRole.ADMIN,
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

        if (user.role !== role) {
            throw new UnauthorizedException(`Access denied. Accessing with invalid role privileges.`);
        }

        const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // 1. Generate 4-digit secure OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);

        user.otpCode = otp;
        user.otpExpiresAt = expiry;
        await this.userRepository.save(user);

        // 2. Fire-and-Forget (Background Processing)
        // Await mat karein, taaki API hit hotay hi immediately 200 OK mil jaye (~50ms)
        this.emailService.sendOtpEmail(user.email, otp).catch((error) => {
            // Agar background me mail fail ho, toh logs me track kar lein
            console.error(`[Email Failure] Failed to dispatch OTP to ${user.email}:`, error);
        });

        // 3. Immediate Response to Client
        return {
            message: 'Secure OTP sent successfully to your email.',
            email: user.email,
        };
    }
    async loginADMIN(loginDto: LoginDto) {
        const { email, password, role } = loginDto;

        const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (user.role !== role) {
            throw new UnauthorizedException(`Access denied. Accessing with invalid role privileges.`);
        }

        const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // 1. Generate 4-digit secure OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);

        user.otpCode = otp;
        user.otpExpiresAt = expiry;
        await this.userRepository.save(user);

        // 2. Fire-and-Forget (Background Processing)
        // Await mat karein, taaki API hit hotay hi immediately 200 OK mil jaye (~50ms)
        // this.emailService.sendOtpEmail(user.email, otp).catch((error) => {
        //     // Agar background me mail fail ho, toh logs me track kar lein
        //     console.error(`[Email Failure] Failed to dispatch OTP to ${user.email}:`, error);
        // });
        const payload = { sub: user.id, email: user.email };

        const token = this.jwtService.sign(payload, {
            secret: 'SUPER_SECRET_KEY_123', // <--- Yeh key dhyan se wahi rakhni hai jo auth.module aur jwt.strategy mein hai
            expiresIn: '7d',
        });
        // 3. Immediate Response to Client
        return {
            message: 'Secure OTP sent successfully to your email.',
            email: user.email,
            token: token
        };
    }

    async getAll(role?: string) {
        // Agar role param pass hua ho aur valid UserRole value ho
        if (role && role !== 'all') {
            return this.userRepository.find({
                where: {
                    role: role as UserRole,
                },
                relations: {
                    transactions: true,
                },
            });
        }

        // Pure records return karne ke liye
        return this.userRepository.find({
            relations: {
                transactions: true,
            },
        });
    }
    async getAllTransactions(type?: string, id?: string) {
        // Agar role param pass hua ho aur valid UserRole value ho
        if (type && type !== 'all') {
            return this.transRepository.find({
                where: {
                    type: type as TransactionType,
                    user: { id: id }
                },

            });
        }

        // Pure records return karne ke liye
        return this.transRepository.find({
            where: {
                user: { id: id }
            },
        });
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
            firstName: user.firstName + ' ' + user.lastName,
            role: user.role,
            token: token
        };
    }
    async getTransactionHistory(query: GetReportsQueryDto) {
        const { page = 1, limit = 20, type, search, startDate, endDate } = query;
        const skip = (page - 1) * limit;

        const queryBuilder = this.transRepository
            .createQueryBuilder('tx')
            .leftJoinAndSelect('tx.user', 'user') // Join with user entity to get user details
            .orderBy('tx.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        // Filter by Type
        if (type && type !== 'all') {
            queryBuilder.andWhere('tx.type = :type', { type: type.toLowerCase() });
        }

        // Filter by Search Term (User Name, Email, or TX Details)
        if (search) {
            queryBuilder.andWhere(
                '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search OR tx.details LIKE :search)',
                { search: `%${search}%` },
            );
        }

        // Filter by Date Range
        if (startDate && endDate) {
            queryBuilder.andWhere('tx.createdAt BETWEEN :startDate AND :endDate', {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            });
        }

        const [transactions, total] = await queryBuilder.getManyAndCount();

        // Map response to match Frontend expectations
        const formattedData = transactions.map((tx) => ({
            id: tx.id,
            userName: tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() : 'Anonymous',
            userEmail: tx.user?.email || 'N/A',
            type: tx.type,
            details: tx.details,
            amount: tx.amount,
            createdAt: tx.createdAt,
        }));

        return {
            success: true,
            totalCount: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: formattedData,
        };
    }

    async exportFilteredTransactions(query: GetReportsQueryDto): Promise<string> {
    const { type, search } = query;

    const queryBuilder = this.transRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.user', 'user')
      .orderBy('tx.createdAt', 'DESC');

    if (type && type !== 'all') {
      queryBuilder.andWhere('tx.type = :type', { type: type.toUpperCase() });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search OR tx.details LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const transactions = await queryBuilder.getMany();

    const formattedData = transactions.map((tx) => ({
      'TX ID': tx.id,
      'User Name': tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() : 'Anonymous',
      'User Email': tx.user?.email || 'N/A',
      'Type': tx.type,
      'Details': tx.details || 'N/A',
      'Amount (PKR)': tx.amount,
      'Date': tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A',
    }));

    const parser = new Parser();
    return parser.parse(formattedData);
  }
    // 2. Fetch Summary Statistics for Admin Cards
    async getReportsSummary() {
        const totalVolume = await this.transRepository
            .createQueryBuilder('tx')
            .select('SUM(tx.amount)', 'sum')
            .getRawOne();

        const totalDonations = await this.transRepository
            .createQueryBuilder('tx')
            .select('SUM(tx.amount)', 'sum')
            .where('tx.type = :type', { type: 'donation' })
            .getRawOne();

        const totalZakat = await this.transRepository
            .createQueryBuilder('tx')
            .select('SUM(tx.amount)', 'sum')
            .where('tx.type = :type', { type: 'zakat' })
            .getRawOne();

        //   console.log('don',totalDonations);

        const totalTransactions = await this.transRepository.count();
        //   console.log('trans',totalTransactions);

        return {
            totalVolume: Number(totalVolume?.sum || 0),
            totalDonations: Number(totalDonations?.sum || 0),
            totalZakat: Number(totalZakat?.sum || 0),
            totalTransactions,
        };
    }
}