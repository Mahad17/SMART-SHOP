import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  // Generic Email sending function
  async sendOtpEmail(to: string, otp: string): Promise<boolean> {
    const htmlContent = `
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
    `;

    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Smart Shop <onboarding@resend.dev>', // Custom domain ke bina Resend dev address testing ke liye use hota hai
        to: to,
        subject: 'Smart Shop - Secure OTP Verification Code',
        html: htmlContent,
      });

      if (error) {
        this.logger.error(`[Email Service] Resend error: ${error.message}`);
        return false;
      }

      this.logger.log(`[Email Service] Real OTP Email sent to ${to} (ID: ${data?.id})`);
      return true;
    } catch (error) {
      this.logger.error('[Email Service] Error sending email:', error);
      return false;
    }
  }

  // Transactional Invoice / Notification email function
  async sendWalletTransactionEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'Smart Shop Wallet <onboarding@resend.dev>',
        to: to,
        subject: `Smart Shop - ${subject}`,
        html: htmlBody,
      });

      if (error) {
        this.logger.error(`[Email Service] Resend error: ${error.message}`);
        return false;
      }

      this.logger.log(`[Email Service] Transaction Email sent to ${to} (ID: ${data?.id})`);
      return true;
    } catch (error) {
      this.logger.error('[Email Service] Error sending transaction email:', error);
      return false;
    }
  }
}