import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../../core/database/database.service';
import { Mailer } from '../../core/mail/mailer';
import { DomainEvents, type IntegrityViolationEvent, type PasswordResetEvent } from '../../core/events/domain-events';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly mailer: Mailer,
  ) {}

  @OnEvent(DomainEvents.PasswordReset)
  async onReset(event: PasswordResetEvent) {
    await this.mailer.send(
      event.email,
      'Recupera tu contraseña de Ludoteka Campus',
      `Hola ${event.fullName}.\n\nEste enlace vale una hora:\n${event.link}\n\nSi no fuiste tú, ignora este mensaje.`,
    );
  }

  @OnEvent(DomainEvents.IntegrityViolation)
  async onIntegrity(event: IntegrityViolationEvent) {
    await this.database.db
      .insertInto('notifications')
      .values({
        user_id: event.teacherId,
        title: event.suspended ? 'Evaluación suspendida' : 'Alerta de integridad',
        body: `Se registró «${event.type}» en un intento (${event.count}).`,
      })
      .execute();
  }

  list(userId: string) {
    return this.database.db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(30)
      .execute();
  }

  async read(userId: string, id: string) {
    await this.database.db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .execute();
    return { ok: true };
  }
}
