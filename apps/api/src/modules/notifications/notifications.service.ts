import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseService } from '../../core/database/database.service';
import { Mailer } from '../../core/mail/mailer';
import { guardianMessageEmail, meetingEmail, passwordResetEmail } from '../../core/mail/templates';
import {
  DomainEvents,
  type ForumReplyEvent,
  type GuardianMessageEvent,
  type IntegrityViolationEvent,
  type MeetingRespondedEvent,
  type MeetingScheduledEvent,
  type NewsPublishedEvent,
  type PasswordResetEvent,
  type RiskAlertRaisedEvent,
  type SignatureDecidedEvent,
  type SignatureRequestedEvent,
} from '../../core/events/domain-events';

const when = (value: Date) => value.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });

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

  private notify(rows: { user_id: string; title: string; body: string }[]) {
    if (!rows.length) return Promise.resolve();
    return this.database.db
      .insertInto('notifications')
      .values(rows.map((row) => ({ ...row, title: row.title.slice(0, 200), body: row.body.slice(0, 1000) })))
      .execute()
      .then(() => undefined);
  }

  @OnEvent(DomainEvents.MeetingScheduled)
  async onMeeting(event: MeetingScheduledEvent) {
    await this.notify([
      {
        user_id: event.guardianId,
        title: `Citación: ${event.studentName}`,
        body: `${event.organizer} te cita el ${when(event.scheduledAt)}. Confirma tu asistencia en Familia.`,
      },
    ]);
    const to = this.mailer.deliveryAddress(event.guardianEmail);
    await this.mailer.send(
      to,
      meetingEmail({
        baseUrl: this.mailer.baseUrl,
        fullName: event.guardianName,
        account: event.guardianEmail,
        studentName: event.studentName,
        scheduledAt: event.scheduledAt,
        mode: event.mode,
        place: event.place,
        reason: event.reason,
        organizer: event.organizer,
        forLab: to !== event.guardianEmail,
      }),
    );
  }

  @OnEvent(DomainEvents.MeetingResponded)
  async onMeetingResponse(event: MeetingRespondedEvent) {
    await this.notify([
      {
        user_id: event.organizerId,
        title: event.attending ? `Citación confirmada: ${event.studentName}` : `Citación declinada: ${event.studentName}`,
        body: `${event.guardianName} ${event.attending ? 'asistirá' : 'no puede asistir'}.${event.note ? ` Nota: ${event.note}` : ''}`,
      },
    ]);
  }

  @OnEvent(DomainEvents.GuardianMessage)
  async onGuardianMessage(event: GuardianMessageEvent) {
    await this.notify([{ user_id: event.recipientId, title: `Mensaje de ${event.authorName}`, body: `Sobre ${event.studentName}: ${event.body.slice(0, 160)}` }]);
    const to = this.mailer.deliveryAddress(event.recipientEmail);
    const path = event.recipientRole === 'guardian' ? '/app/acudiente' : '/app/mensajes';
    await this.mailer.send(
      to,
      guardianMessageEmail({
        baseUrl: this.mailer.baseUrl,
        fullName: event.recipientName,
        account: event.recipientEmail,
        authorName: event.authorName,
        studentName: event.studentName,
        preview: event.body,
        link: `${this.mailer.baseUrl}${path}?estudiante=${event.studentId}`,
        forLab: to !== event.recipientEmail,
      }),
    );
  }

  @OnEvent(DomainEvents.SignatureRequested)
  async onSignatureRequested(event: SignatureRequestedEvent) {
    const rectors = await this.database.db
      .selectFrom('user_roles')
      .innerJoin('users', 'users.id', 'user_roles.user_id')
      .select('users.id')
      .where('user_roles.role', '=', 'rector')
      .where('users.status', '=', 'active')
      .execute();
    const what = event.kind === 'certificate' ? 'Certificado' : 'Boletín';
    await this.notify(rectors.map((r) => ({ user_id: r.id, title: `${what} por firmar`, body: `${event.title} · ${event.studentName}` })));
  }

  @OnEvent(DomainEvents.SignatureDecided)
  async onSignatureDecided(event: SignatureDecidedEvent) {
    const what = event.kind === 'certificate' ? 'certificado' : 'boletín';
    const rows: { user_id: string; title: string; body: string }[] = [];
    if (event.requesterId) {
      rows.push({
        user_id: event.requesterId,
        title: event.approved ? `Rectoría firmó el ${what}` : `Rectoría devolvió el ${what}`,
        body: `${event.title} · ${event.studentName}.${event.note ? ` Nota: ${event.note}` : ''}`,
      });
    }
    if (event.approved) {
      rows.push({ user_id: event.studentId, title: event.kind === 'certificate' ? 'Tienes un certificado nuevo' : 'Tu boletín está firmado', body: event.title });
    }
    await this.notify(rows);
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
