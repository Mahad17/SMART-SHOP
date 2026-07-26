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
  async buyProduct(dto: BuyProductDto) {
    const CASHBACK_RATE = 0.5; // 10% Cashback on total checkout
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. User find karein
      const user = await queryRunner.manager.findOne(User, { where: { id: dto.userId } });
      if (!user) throw new NotFoundException('User not found');

      // 2. Saare product IDs extract karein
      const productIds = dto.products.map(p => p.productId);

      // 3. Database se matching products fetch karein
      const dbProducts = await queryRunner.manager.find(Product, {
        where: { id: In(productIds) }
      });

      if (dbProducts.length !== dbProducts.filter(p => productIds.includes(p.id)).length) {
        throw new NotFoundException('One or more products from your cart were not found');
      }

      // 4. Total calculation lagayein (price * quantity)
      let totalCartAmount = 0;
      const itemsBreakdown: { name: string; quantity: number; price: number; total: number }[] = [];

      for (const item of dto.products) {
        const product = dbProducts.find(p => p.id === item.productId);
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        const productPrice = parseFloat(product.price as any);
        const itemTotal = productPrice * item.quantity;

        totalCartAmount += itemTotal;

        itemsBreakdown.push({
          name: product.name,
          quantity: item.quantity,
          price: productPrice,
          total: itemTotal
        });
      }

      // Balance parsing logic for safety
      const userBalance = parseFloat(user.balance as any);

      // 5. Balance Check karein
      if (userBalance < totalCartAmount) {
        throw new BadRequestException('Insufficient wallet balance to checkout these products');
      }

      const cashbackAmount = totalCartAmount * CASHBACK_RATE;

      // 6. User Balance Update
      user.balance = userBalance - totalCartAmount + cashbackAmount;
      const updatedUser = await queryRunner.manager.save(User, user);

      // 7. Log Transaction Ledger Row
      const productNamesList = itemsBreakdown.map(i => `${i.name} (x${i.quantity})`).join(', ');
      const newTransaction = queryRunner.manager.create(Transaction, {
        user: updatedUser,
        type: TransactionType.PRODUCT_PURCHASE,
        amount: totalCartAmount,
        cashbackAmount: cashbackAmount,
        details: `Purchased: ${productNamesList}`,
      });
      await queryRunner.manager.save(Transaction, newTransaction);

      // Commit DB changes
      await queryRunner.commitTransaction();

      // 8. Dynamic Email Template Rows Mapping
      const emailRowsHtml = itemsBreakdown.map(item => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; text-align: left;">${item.name} <strong>(x${item.quantity})</strong></td>
          <td style="padding: 8px; text-align: right;">PKR ${item.total.toFixed(2)}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 600px;">
          <h2 style="color: #29388D;">Purchase & Cashback Invoice</h2>
          <p>Hi ${user.firstName},</p>
          <p>Thank you for shopping with us! Here is your bundle transaction breakdown:</p>
          
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
                <td style="padding: 8px; text-align: right; border-top: 2px solid #e5e7eb; color: #111827;">PKR ${totalCartAmount.toFixed(2)}</td>
              </tr>
              <tr style="background-color: #ecfdf5; font-weight: bold; color: #047857;">
                <td style="padding: 8px; text-align: left;">Cashback Credited (05%)</td>
                <td style="padding: 8px; text-align: right;">+PKR ${cashbackAmount.toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold; background-color: #f9fafb;">
                <td style="padding: 8px; text-align: left; border-top: 1px solid #d1d5db;">Updated Wallet Balance</td>
                <td style="padding: 8px; text-align: right; border-top: 1px solid #d1d5db;">PKR ${parseFloat(updatedUser.balance as any).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      this.emailService.sendWalletTransactionEmail(user.email, 'Batch Product Purchase Invoice', emailHtml);

      return { message: 'All products processed successfully in one go!', balance: updatedUser.balance };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with identity ID ${userId} not found.`);
    }
    return Number(user.balance) || 0;
  }

  // 2. DONATION LOGIC
  async processDonation(dto: DonateDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: dto.userId } });
      if (!user) throw new NotFoundException('User not found');

      const userBalance = parseFloat(user.balance as any);
      if (userBalance < dto.amount) {
        throw new BadRequestException('Insufficient wallet balance for this donation');
      }

      user.balance = userBalance - dto.amount;
      const updatedUser = await queryRunner.manager.save(User, user);
if(dto.type==='DONATION'){
      const newTransaction = queryRunner.manager.create(Transaction, {
        user: updatedUser,
        type: TransactionType.DONATION,
        amount: dto.amount,
        cashbackAmount: 0.00,
        details: `Donation: ${dto.causeDetails}`,
      });
      await queryRunner.manager.save(Transaction, newTransaction);

      await queryRunner.commitTransaction();

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
          <h2 style="color: #16a34a;">Thank You For Your Contribution!</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your generous donation of <b>PKR ${dto.amount.toFixed(2)}</b> for "${dto.causeDetails}" has been processed successfully.</p>
          <p>Remaining Wallet Balance: <b>PKR ${parseFloat(updatedUser.balance as any).toFixed(2)}</b></p>
        </div>
      `;
      this.emailService.sendWalletTransactionEmail(user.email, 'Donation Receipt', emailHtml);

      return { message: 'Donation processed successfully', balance: updatedUser.balance };
    }else
      {
      const newTransaction = queryRunner.manager.create(Transaction, {
        user: updatedUser,
        type: TransactionType.ZAKAT,
        amount: dto.amount,
        cashbackAmount: 0.00,
        details: `Zakat: ${dto.causeDetails}`,
      });
      await queryRunner.manager.save(Transaction, newTransaction);

      await queryRunner.commitTransaction();

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0fdf4; border-radius: 8px;">
          <h2 style="color: #16a34a;">Thank You For Your Contribution!</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your generous zakat of <b>PKR ${dto.amount.toFixed(2)}</b> for "${dto.causeDetails}" has been processed successfully.</p>
          <p>Remaining Wallet Balance: <b>PKR ${parseFloat(updatedUser.balance as any).toFixed(2)}</b></p>
        </div>
      `;
      this.emailService.sendWalletTransactionEmail(user.email, 'Donation Receipt', emailHtml);

      return { message: 'Donation processed successfully', balance: updatedUser.balance };
    }
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