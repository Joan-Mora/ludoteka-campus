import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../../core/database/database.service';
import { Mailer } from '../../core/mail/mailer';
import { passwordResetEmail } from '../../core/mail/templates';
import {
  DomainEvents,
  type ForumReplyEvent,
  type IntegrityViolationEvent,
  type NewsPublishedEvent,
  type PasswordResetEvent,
  type RiskAlertRaisedEvent,
} from '../../core/events/domain-events';

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
      passwordResetEmail({ baseUrl: new URL(event.link).origin, fullName: event.fullName, link: event.link }),
      { sensitive: true },
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

  @OnEvent(DomainEvents.NewsPublished)
  async onNews(event: NewsPublishedEvent) {
    if (!event.recipientIds.length) return;
    const prefix = event.category === 'urgente' ? 'Urgente: ' : 'Novedad: ';
    const body = event.requiresAck ? 'Abre la cartelera y confirma que la leíste.' : 'Hay una novedad nueva en la cartelera.';
    for (let i = 0; i < event.recipientIds.length; i += 200) {
      await this.database.db
        .insertInto('notifications')
        .values(event.recipientIds.slice(i, i + 200).map((user_id) => ({ user_id, title: `${prefix}${event.title}`.slice(0, 200), body })))
        .execute();
    }
  }

  @OnEvent(DomainEvents.ForumReply)
  async onForumReply(event: ForumReplyEvent) {
    await this.database.db
      .insertInto('notifications')
      .values({ user_id: event.userId, title: 'Nueva respuesta en el foro', body: `${event.authorName} respondió en «${event.title}».` })
      .execute();
  }

  /** Docente y acudientes activos; al estudiante no se le notifica para no exponer la etiqueta de riesgo. */
  @OnEvent(DomainEvents.RiskAlertRaised)
  async onRisk(event: RiskAlertRaisedEvent) {
    const guardians = await this.database.db
      .selectFrom('guardian_links')
      .select('guardian_id')
      .where('student_id', '=', event.studentId)
      .where('status', '=', 'active')
      .execute();
    const level = event.level === 'alta' ? 'alta' : 'media';
    await this.database.db
      .insertInto('notifications')
      .values([
        { user_id: event.teacherId, title: `Alerta ${level}: ${event.kind}`.slice(0, 200), body: `${event.studentName} · ${event.courseTitle}. ${event.detail}.` },
        ...guardians.map((g) => ({
          user_id: g.guardian_id,
          title: `Seguimiento académico: ${event.courseTitle}`.slice(0, 200),
          body: `El colegio registró una alerta (${event.kind.toLowerCase()}) para ${event.studentName}: ${event.detail}. Comunícate con el docente si tienes dudas.`,
        })),
      ])
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
