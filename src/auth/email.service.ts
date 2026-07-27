import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private configService: ConfigService) {}

  // Brevo API Request Sender Helper
  private async sendViaBrevo(to: string, subject: string, htmlContent: string): Promise<boolean> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    const senderEmail = this.configService.get<string>('SENDER_EMAIL') || 'smartshop.alert@gmail.com';
    const senderName = this.configService.get<string>('SENDER_NAME') || 'Smart Shop';

    try {
      const response = await axios.post(
        this.brevoApiUrl,
        {
          sender: {
            name: senderName,
            email: senderEmail,
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: htmlContent,
        },
        {
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        },
      );

      this.logger.log(`[Email Service] Email sent to ${to} (MessageId: ${response.data?.messageId})`);
      return true;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      this.logger.error(`[Email Service] Brevo error sending to ${to}: ${errorMsg}`);
      return false;
    }
  }

  // 1. Generic OTP Email Function
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

    return this.sendViaBrevo(to, 'Smart Shop - Secure OTP Verification Code', htmlContent);
  }

  // 2. Transactional Invoice / Notification email function
  async sendWalletTransactionEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    return this.sendViaBrevo(to, `Smart Shop - ${subject}`, htmlBody);
  }
}