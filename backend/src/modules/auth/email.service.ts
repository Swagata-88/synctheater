import nodemailer, { Transporter } from 'nodemailer';
import { config, isSmtpConfigured, maskEmail } from '../../config';

export interface SendPasswordResetEmailParams {
  to: string;
  username: string;
  resetUrl: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  constructor() {
    this.initTransporter();
  }

  public initTransporter(): void {
    if (isSmtpConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    } else {
      this.transporter = null;
    }
  }

  public async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<{ sent: boolean; reason?: string }> {
    if (!isSmtpConfigured() || !this.transporter) {
      console.error(
        `[EmailService:AdminAlert] SMTP is not configured on this server (Missing SMTP_HOST, SMTP_USER, or SMTP_PASS). Password reset email for ${maskEmail(params.to)} could not be delivered via SMTP.`
      );
      return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
    }

    try {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your SYNCTHEATER Password</title>
</head>
<body style="background-color: #090909; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 16px; margin: 0;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #171717; border: 1px solid #353535; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.6);">
    <tr>
      <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 2px solid #D6B56D; background-color: #111111;">
        <h1 style="color: #D6B56D; margin: 0; font-size: 24px; letter-spacing: 3px; font-weight: 800;">SYNCTHEATER</h1>
        <p style="color: #B9B9B9; margin: 6px 0 0 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">Watch Together. Anywhere.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 36px 32px;">
        <h2 style="color: #FFFFFF; margin: 0 0 16px 0; font-size: 18px; font-weight: 700;">Password Reset Request</h2>
        <p style="color: #B9B9B9; line-height: 1.6; font-size: 14px; margin: 0 0 24px 0;">
          Hello <strong style="color: #FFFFFF;">${params.username || 'there'}</strong>,<br><br>
          We received a request to reset the password for your SYNCTHEATER account. Click the button below to choose a new password. This link is single-use and will expire in 1 hour.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.resetUrl}" style="background-color: #D6B56D; color: #090909; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; display: inline-block; letter-spacing: 0.5px;">
            Reset Password
          </a>
        </div>
        <p style="color: #777777; font-size: 12px; line-height: 1.5; margin: 24px 0 0 0;">
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="${params.resetUrl}" style="color: #D6B56D; word-break: break-all;">${params.resetUrl}</a>
        </p>
        <p style="color: #777777; font-size: 12px; line-height: 1.5; margin: 16px 0 0 0;">
          If you did not request a password reset, you can safely ignore this email. Your password will not change until you access the link above and create a new one.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px; background-color: #111111; border-top: 1px solid #202020; text-align: center;">
        <p style="color: #555555; font-size: 11px; margin: 0;">
          &copy; ${new Date().getFullYear()} SYNCTHEATER. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await this.transporter.sendMail({
        from: config.smtp.from,
        to: params.to,
        subject: 'Reset your SYNCTHEATER password',
        text: `Hello ${params.username},\n\nWe received a request to reset your SYNCTHEATER password.\nClick the link below to set a new password:\n${params.resetUrl}\n\nThis link is single-use and valid for 1 hour. If you did not request this, please ignore this email.\n`,
        html: htmlContent,
      });

      console.log(`[EmailService] Password reset email successfully dispatched to ${maskEmail(params.to)}`);
      return { sent: true };
    } catch (error: any) {
      console.error(`[EmailService:Error] Failed to send password reset email to ${maskEmail(params.to)}:`, error.message);
      return { sent: false, reason: error.message };
    }
  }
}

export const emailService = EmailService.getInstance();
