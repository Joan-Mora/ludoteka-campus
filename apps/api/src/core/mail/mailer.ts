import { Injectable } from '@nestjs/common';
import { Env } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class Mailer {
  constructor(
    private readonly env: Env,
    private readonly database: DatabaseService,
  ) {}

  async send(to: string, subject: string, body: string) {
    const key = this.env.values.RESEND_API_KEY;
    let status: 'sent' | 'logged' = 'logged';
    if (key) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.env.values.MAIL_FROM,
          to: [to],
          subject,
          text: body,
        }),
      });
      status = response.ok ? 'sent' : 'logged';
      if (!response.ok) {
        console.error(`correo no enviado (${response.status})`);
      }
    } else {
      console.log(`correo (sin Resend) para ${to}: ${subject}\n${body}`);
    }
    await this.database.db
      .insertInto('email_outbox')
      .values({
        to_email: to,
        subject,
        body,
        status,
        sent_at: status === 'sent' ? new Date() : null,
      })
      .execute();
  }
}
