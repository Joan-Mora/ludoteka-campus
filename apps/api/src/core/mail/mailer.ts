import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { Env } from '../config/config.module';
import { repoRoot } from '../config/env';
import { DatabaseService } from '../database/database.service';
import type { RenderedEmail } from './templates';

const REDACTED = '[Contenido con código, enlace o clave de acceso: no se guarda en la base de datos]';

interface InlineAttachment {
  filename: string;
  content: string;
  content_id: string;
  content_type: string;
}

@Injectable()
export class Mailer {
  private readonly assets = new Map<string, InlineAttachment | null>();

  constructor(
    private readonly env: Env,
    private readonly database: DatabaseService,
  ) {}

  /** Artwork travels as inline CID attachments so clients that block remote images (Outlook) still show it. */
  private attachment(file: string): InlineAttachment | null {
    if (!this.assets.has(file)) {
      const full = path.join(repoRoot(), 'apps', 'web', 'public', 'email', file);
      this.assets.set(
        file,
        existsSync(full)
          ? { filename: file, content: readFileSync(full).toString('base64'), content_id: file, content_type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' }
          : null,
      );
    }
    return this.assets.get(file) ?? null;
  }

  /** `sensitive` mails (codes, reset links, temporary passwords) are delivered but stored redacted in the outbox. */
  async send(to: string, email: RenderedEmail, options: { sensitive?: boolean } = {}) {
    const { subject, text: body, html } = email;
    const key = this.env.values.RESEND_API_KEY;
    let status: 'sent' | 'logged' = 'logged';
    if (key) {
      const attachments = email.inline.map((file) => this.attachment(file)).filter((a): a is InlineAttachment => a !== null);
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
          html,
          attachments,
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
