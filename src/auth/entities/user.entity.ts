// src/auth/entities/user.entity.ts
import { Transaction } from 'src/transaction/transaction.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'phone_number' })
  phoneNumber: string;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  // OTP Validation fields
  @Column({ name: 'otp_code', nullable: true })
  otpCode: string;

  @Column({ name: 'otp_expires_at', type: 'timestamp', nullable: true })
  otpExpiresAt: Date;

  @Column({
    type: 'decimal', precision: 12, scale: 2, default: 0.00, transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) // Postgres/MySQL decimal ko string laata hai, usko float banaye ga
    }
  })
  balance: number;

  @Column({ name: 'has_claimed_donation_cashback', type: 'boolean', default: false })
  hasClaimedDonationCashback: boolean;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions: Transaction[];

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  // Last payment card details (CVV is NEVER saved for compliance/security!)
  @Column({ name: 'card_holder_name', nullable: true })
  cardHolderName: string;

  @Column({ name: 'card_number', nullable: true })
  cardNumber: string;

  @Column({ name: 'card_expiry', nullable: true })
  cardExpiry: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}