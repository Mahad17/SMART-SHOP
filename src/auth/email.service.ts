// src/auth/email.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // SMTP Transporter configure karein (is ki values hum .env se uthayenge)
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<number>('EMAIL_PORT') === 465, // true for port 465, false for others
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  // Generic Email sending function
  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const mailOptions = {
      from: `"Smart Shop" <${this.configService.get<string>('EMAIL_USER')}>`, // Sender details
      to: to,
      subject: 'Smart Shop - Secure OTP Verification Code', // Email Subject
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <h2 style="color: #29388D; text-align: center;">Smart Shop Security</h2>
          <p>Hello,</p>
          <p>You are trying to log into your Smart Shop account. Your secure 4-digit verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2692D3; background: #fff; padding: 10px 20px; border-radius: 5px; border: 1px solid #e5e7eb;">
              ${otp}
            </span>
          </div>
          <p style="color: #6b7280; font-size: 12px;">This OTP is confidential and valid for 10 minutes only. Please do not share it with anyone.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[Email Service] Real OTP Email sent to ${to}`);
      return true;
    } catch (error) {
      console.error('[Email Service] Error sending email:', error);
      return false;
    }
  }

  // Transactional Invoice / Notification email function
  async sendWalletTransactionEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    const mailOptions = {
      from: `"Smart Shop Wallet" <${this.configService.get<string>('EMAIL_USER')}>`,
      to: to,
      subject: `Smart Shop - ${subject}`,
      html: htmlBody,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[Email Service] Transaction Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error('[Email Service] Error sending transaction email:', error);
      return false;
    }
  }
}