import { Injectable } from '@nestjs/common';
import { Env } from '../config/config.module';
import { DatabaseService } from '../database/database.service';

const REDACTED = '[Contenido con código, enlace o clave de acceso: no se guarda en la base de datos]';

@Injectable()
export class Mailer {
  constructor(
    private readonly env: Env,
    private readonly database: DatabaseService,
  ) {}

  /** `sensitive` mails (codes, reset links, temporary passwords) are delivered but stored redacted in the outbox. */
  async send(to: string, subject: string, body: string, options: { sensitive?: boolean } = {}) {
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
      }).catch(() => null);
      status = response?.ok ? 'sent' : 'logged';
      if (!response?.ok) {
        console.error(`correo no enviado (${response?.status ?? 'sin conexión'})`);
      }
    } else if (this.env.values.NODE_ENV !== 'production') {
      console.log(`correo (sin Resend) para ${to}: ${subject}\n${body}`);
    }
    await this.database.db
      .insertInto('email_outbox')
      .values({
        to_email: to,
        subject: options.sensitive ? subject.replace(/\d{6}/g, '••••••') : subject,
        body: options.sensitive ? REDACTED : body,
        status,
        sent_at: status === 'sent' ? new Date() : null,
      })
      .execute();
  }
}
