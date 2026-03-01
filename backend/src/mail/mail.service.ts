import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailService.name);

    constructor() {
        // For development, we use Ethereal Email (a fake SMTP service)
        // In production, you would use a real provider (SendGrid, Mailgun, Amazon SES, or Gmail)
        this.initEthereal();
    }

    private async initEthereal() {
        try {
            const testAccount = await nodemailer.createTestAccount();
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user, // generated ethereal user
                    pass: testAccount.pass, // generated ethereal password
                },
            });
            this.logger.log(`Ethereal Email initialized. User: ${testAccount.user}`);
        } catch (err) {
            this.logger.error('Failed to initialize Ethereal Email', err);
        }
    }

    async sendPasswordResetMail(to: string, resetLink: string) {
        if (!this.transporter) return;

        try {
            const info = await this.transporter.sendMail({
                from: '"Mafia Online" <noreply@mafia.online.test>',
                to,
                subject: 'Відновлення паролю - Mafia Online',
                text: `Для відновлення паролю перейдіть за посиланням: ${resetLink} \nЯкщо ви не робили цей запит, просто проігноруйте цей лист.`,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #111; color: #fff; border: 1px solid #333; border-radius: 8px;">
            <h2 style="color: #cc0000; text-align: center;">Відновлення паролю</h2>
            <p>Ви отримали цей лист, тому що надійшов запит на відновлення паролю до вашого акаунту Mafia Online.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #cc0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Змінити пароль</a>
            </div>
            <p style="color: #888; font-size: 12px;">Посилання дійсне протягом 15 хвилин.</p>
            <p style="color: #888; font-size: 12px;">Якщо ви не робили цей запит, будь ласка, проігноруйте цей лист.</p>
          </div>
        `,
            });

            this.logger.log(`Password reset email sent to ${to}. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        } catch (err) {
            this.logger.error(`Failed to send password reset email to ${to}`, err);
            throw new Error('Не вдалося надіслати лист. Спробуйте пізніше.');
        }
    }
}
