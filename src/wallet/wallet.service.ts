import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm'; // 🔥 'In' import fixed here
import { User } from '../auth/entities/user.entity';
import { EmailService } from '../auth/email.service';
import { BuyProductDto, DonateDto } from './wallet-operation.dto';
import { Product } from 'src/products/product.entity';
import { Transaction, TransactionType } from 'src/transaction/transaction.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class WalletService {
  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  // 1. PRODUCT BUY + BATCH CASHBACK LOGIC
  

  async getBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with identity ID ${userId} not found.`);
    }
    return Number(user.balance) || 0;
  }

 async processDonation(dto: DonateDto) {
  console.log('hit on processDonation', dto);

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  let userEmail = '';
  let userFirstName = '';
  let updatedBalance = 0;

  try {
    const user = await queryRunner.manager.findOne(User, {
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    userEmail = user.email;
    userFirstName = user.firstName;

    // Check payment method (defaulting to 'wallet' for backward compatibility)
    const isWalletPayment = !dto.paymentMethod || dto.paymentMethod === 'wallet';

    const currentBalance = parseFloat(user.balance as any);

    if (isWalletPayment) {
      // 1. Sirf tab balance check karein jab Wallet Payment selected ho
      if (currentBalance < dto.amount) {
        throw new BadRequestException(
          'Insufficient wallet balance for this contribution',
        );
      }

      // 2. Sirf Wallet Payment par balance deduct karein
      user.balance = currentBalance - dto.amount;
      const updatedUser = await queryRunner.manager.save(User, user);
      updatedBalance = parseFloat(updatedUser.balance as any);
    } else {
      // Card Payment ke case mein wallet balance change nahi hoga
      updatedBalance = currentBalance;
    }

    // Dynamic Type handle karein (DONATION vs ZAKAT)
    const isDonation = dto.type === 'DONATION';
    const txnType = isDonation
      ? TransactionType.DONATION
      : TransactionType.ZAKAT;
    const typeLabel = isDonation ? 'Donation' : 'Zakat';

    const newTransaction = queryRunner.manager.create(Transaction, {
      user: user,
      type: txnType,
      amount: dto.amount,
      cashbackAmount: 0.0,
      details: `${typeLabel}: ${dto.causeDetails}`,
    });
    await queryRunner.manager.save(Transaction, newTransaction);

    // Commit DB changes first
    await queryRunner.commitTransaction();

    // Email HTML Generation
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
        <h2 style="color: #16a34a;">Thank You For Your Contribution!</h2>
        <p>Dear ${userFirstName},</p>
        <p>Your generous ${typeLabel.toLowerCase()} of <b>PKR ${dto.amount.toFixed(
      2,
    )}</b> for "${dto.causeDetails}" has been processed successfully.</p>
        <p>Payment Method: <b>${isWalletPayment ? 'Smart Wallet' : 'Credit / Debit Card'}</b></p>
        <p>Remaining Wallet Balance: <b>PKR ${updatedBalance.toFixed(
          2,
        )}</b></p>
      </div>
    `;

    // Send email post-commit
    this.emailService.sendWalletTransactionEmail(
      userEmail,
      `${typeLabel} Receipt`,
      emailHtml,
    );

    return {
      message: `${typeLabel} processed successfully`,
      balance: updatedBalance,
    };
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}

  // 2. Buy Product (Payment Method Conditional Logic Fixed)
  async buyProduct(dto: BuyProductDto) {
    console.log('hit on buyProduct');
    
    const CASHBACK_RATE = 0.05; // 5% Cashback
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    let userEmail = '';
    let userFirstName = '';

    try {
      // 1. User find karein
      const user = await queryRunner.manager.findOne(User, {
        where: { id: dto.userId },
      });
      if (!user) throw new NotFoundException('User not found');

      userEmail = user.email;
      userFirstName = user.firstName;

      // 2. Saare product IDs extract aur fetch karein
      const productIds = dto.products.map((p) => p.productId);
      const dbProducts = await queryRunner.manager.find(Product, {
        where: { id: In(productIds) },
      });

      if (dbProducts.length !== productIds.length) {
        throw new NotFoundException(
          'One or more products from your cart were not found',
        );
      }

      // 3. Total calculation
      let totalCartAmount = 0;
      const itemsBreakdown: {
        name: string;
        quantity: number;
        price: number;
        total: number;
      }[] = [];

      for (const item of dto.products) {
        const product = dbProducts.find((p) => p.id === item.productId);
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found`);

        const productPrice = parseFloat(product.price as any);
        const itemTotal = productPrice * item.quantity;
        totalCartAmount += itemTotal;

        itemsBreakdown.push({
          name: product.name,
          quantity: item.quantity,
          price: productPrice,
          total: itemTotal,
        });
      }

      const userBalance = parseFloat(user.balance as any);
      let cashbackAmount = 0;

      // 🟢 FIX: Check Payment Method
      const isWalletPayment =
        !dto.paymentMethod ||
        dto.paymentMethod === 'wallet' ||
        dto.paymentMethod === 'cash';

      if (isWalletPayment) {
        // Sirf Wallet Payment hone par balance validation chalegi
        if (userBalance < totalCartAmount) {
          throw new BadRequestException(
            'Insufficient wallet balance to checkout these products',
          );
        }

        cashbackAmount = totalCartAmount * CASHBACK_RATE;
        // Balance deduct karein + Cashback add karein
        user.balance = userBalance - totalCartAmount + cashbackAmount;
      } else if (dto.paymentMethod === 'card') {
        // Card Payment par wallet balance deduct NAHI hoga, lekin cashback reward wallet mein Credit hoga
        cashbackAmount = totalCartAmount * CASHBACK_RATE;
        user.balance = userBalance + cashbackAmount;
      }

      const updatedUser = await queryRunner.manager.save(User, user);

      // 4. Ledger Log
      const productNamesList = itemsBreakdown
        .map((i) => `${i.name} (x${i.quantity})`)
        .join(', ');
      const newTransaction = queryRunner.manager.create(Transaction, {
        user: updatedUser,
        type: TransactionType.PRODUCT_PURCHASE,
        amount: totalCartAmount,
        cashbackAmount: cashbackAmount,
        details: `Purchased via ${dto.paymentMethod || 'wallet'}: ${productNamesList}`,
      });
      await queryRunner.manager.save(Transaction, newTransaction);

      // Commit DB Transaction
      await queryRunner.commitTransaction();

      // 5. Dynamic Email Generation
      const emailRowsHtml = itemsBreakdown
        .map(
          (item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; text-align: left;">${item.name} <strong>(x${item.quantity})</strong></td>
          <td style="padding: 8px; text-align: right;">PKR ${item.total.toFixed(2)}</td>
        </tr>
      `,
        )
        .join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 600px;">
          <h2 style="color: #29388D;">Purchase & Cashback Invoice</h2>
          <p>Hi ${userFirstName},</p>
          <p>Thank you for shopping with us! Here is your transaction breakdown (Paid via <strong>${(
            dto.paymentMethod || 'Wallet'
          ).toUpperCase()}</strong>):</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="text-align: left; padding: 8px;">Item Description</th>
                <th style="text-align: right; padding: 8px;">Total Price</th>
              </tr>
            </thead>
            <tbody>
              ${emailRowsHtml}
              <tr style="background-color: #fafafa; font-weight: bold;">
                <td style="padding: 8px; text-align: left; border-top: 2px solid #e5e7eb;">Subtotal Paid</td>
                <td style="padding: 8px; text-align: right; border-top: 2px solid #e5e7eb; color: #111827;">PKR ${totalCartAmount.toFixed(
                  2,
                )}</td>
              </tr>
              <tr style="background-color: #ecfdf5; font-weight: bold; color: #047857;">
                <td style="padding: 8px; text-align: left;">Cashback Credited (05%)</td>
                <td style="padding: 8px; text-align: right;">+PKR ${cashbackAmount.toFixed(
                  2,
                )}</td>
              </tr>
              <tr style="font-weight: bold; background-color: #f9fafb;">
                <td style="padding: 8px; text-align: left; border-top: 1px solid #d1d5db;">Updated Wallet Balance</td>
                <td style="padding: 8px; text-align: right; border-top: 1px solid #d1d5db;">PKR ${parseFloat(
                  updatedUser.balance as any,
                ).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      this.emailService.sendWalletTransactionEmail(
        userEmail,
        'Batch Product Purchase Invoice',
        emailHtml,
      );

      return {
        message: 'All products processed successfully!',
        balance: updatedUser.balance,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 3. CLAIM 50% ANNUAL DONATION CASHBACK
  async claimAnnualDonationCashback(userId: string) {
    const currentYear = new Date().getFullYear();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      if (user.hasClaimedDonationCashback) {
        throw new BadRequestException('You have already claimed your 50% donation cashback for this year.');
      }

      const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

      const logs = await queryRunner.manager.createQueryBuilder(Transaction, 'tx')
        .where('tx.user_id = :userId', { userId })
        .andWhere('tx.type = :type', { type: TransactionType.DONATION })
        .andWhere('tx.created_at BETWEEN :start AND :end', { start: startOfYear, end: endOfYear })
        .getMany();

      const totalDonated = logs.reduce((sum, item) => sum + parseFloat(item.amount as any), 0);

      if (totalDonated === 0) {
        throw new BadRequestException('No donation logs found for the current calendar year to process cashback.');
      }

      const bulkCashback = totalDonated * 0.50;
      const userBalance = parseFloat(user.balance as any);

      user.balance = userBalance + bulkCashback;
      user.hasClaimedDonationCashback = true;
      const updatedUser = await queryRunner.manager.save(User, user);

      const newTransaction = queryRunner.manager.create(Transaction, {
        user: updatedUser,
        type: TransactionType.CASHBACK_CLAIM,
        amount: bulkCashback,
        cashbackAmount: 0,
        details: `Claimed 50% Annual Donation Bulk Cashback for Year ${currentYear}`,
      });
      await queryRunner.manager.save(Transaction, newTransaction);

      await queryRunner.commitTransaction();

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #eff6ff; border-radius: 8px;">
          <h2 style="color: #1d4ed8;">Annual Bulk Cashback Approved!</h2>
          <p>Hi ${user.firstName},</p>
          <p>Your annual compilation rewards are here! Since your total donation this year was PKR ${totalDonated.toFixed(2)}, we have credited a 50% reward back into your system wallet.</p>
          <p style="font-size: 18px; color: #1e40af;"><b>Amount Credited: +PKR ${bulkCashback.toFixed(2)}</b></p>
          <p>Current Total Balance: <b>PKR ${parseFloat(updatedUser.balance as any).toFixed(2)}</b></p>
        </div>
      `;
      this.emailService.sendWalletTransactionEmail(user.email, 'Annual Donation Cashback Claimed', emailHtml);

      return { message: 'Annual cashback successfully credited', balance: updatedUser.balance };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 4. GET HISTORY LOGS
  async getHistoryLogs(userId: string) {
    return this.dataSource.getRepository(Transaction).find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }
}