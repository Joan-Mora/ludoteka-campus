import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { Mailer } from '../../core/mail/mailer';
import { guardianMessageEmail, meetingEmail, passwordResetEmail } from '../../core/mail/templates';
import {
  DomainEvents,
  type BadgeEarnedEvent,
  type BadgesSeenEvent,
  type ForumBestAnswerEvent,
  type ForumMentionEvent,
  type ForumReplyEvent,
  type GuardianMessageEvent,
  type IntegrityViolationEvent,
  type MeetingRespondedEvent,
  type MeetingScheduledEvent,
  type NewsPublishedEvent,
  type NewsReadEvent,
  type PasswordResetEvent,
  type RiskAlertRaisedEvent,
  type SignatureDecidedEvent,
  type SignatureRequestedEvent,
  type StaffMessageEvent,
} from '../../core/events/domain-events';

const when = (value: Date) => value.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
const TIERS = ['', 'bronce', 'plata', 'oro'];

export const NOTIFICATION_KINDS = ['aviso', 'cartelera', 'foro', 'logro', 'integridad', 'seguimiento', 'citacion', 'mensaje', 'firma', 'certificado'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

interface Note {
  user_id: string;
  title: string;
  body: string;
  kind: NotificationKind;
  link?: string | null;
  building?: string | null;
  entity_id?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly mailer: Mailer,
  ) {}

  private notify(rows: Note[]) {
    if (!rows.length) return Promise.resolve();
    return this.database.db
      .insertInto('notifications')
      .values(rows.map((row) => ({
        user_id: row.user_id,
        title: row.title.slice(0, 200),
        body: row.body.slice(0, 1000),
        kind: row.kind,
        link: row.link ?? null,
        building: row.building ?? null,
        entity_id: row.entity_id ?? null,
      })))
      .execute()
      .then(() => undefined);
  }

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
    await this.notify([{
      user_id: event.teacherId,
      title: event.suspended ? 'Evaluación suspendida' : 'Alerta de integridad',
      body: `Se registró «${event.type}» en un intento (${event.count}).`,
      kind: 'integridad',
      link: `/app/integridad/${event.courseId}`,
      building: 'aula',
      entity_id: event.attemptId,
    }]);
  }

  @OnEvent(DomainEvents.NewsPublished)
  async onNews(event: NewsPublishedEvent) {
    if (!event.recipientIds.length) return;
    const prefix = event.category === 'urgente' ? 'Urgente: ' : 'Novedad: ';
    const body = event.requiresAck ? 'Abre la cartelera y confirma que la leíste.' : 'Hay una novedad nueva en la cartelera.';
    for (let i = 0; i < event.recipientIds.length; i += 200) {
      await this.notify(event.recipientIds.slice(i, i + 200).map((user_id) => ({
        user_id,
        title: `${prefix}${event.title}`,
        body,
        kind: 'cartelera' as const,
        link: `/app/novedades?aviso=${event.newsId}`,
        building: 'cartelera',
        entity_id: event.newsId,
      })));
    }
  }

  /** Leer la novedad en la cartelera también apaga su aviso, para no contarla dos veces. */
  @OnEvent(DomainEvents.NewsRead)
  async onNewsRead(event: NewsReadEvent) {
    await this.database.db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('user_id', '=', event.userId)
      .where('entity_id', '=', event.newsId)
      .where('read_at', 'is', null)
      .execute();
  }

  @OnEvent(DomainEvents.ForumReply)
  async onForumReply(event: ForumReplyEvent) {
    await this.notify([{
      user_id: event.userId,
      title: 'Nueva respuesta en el foro',
      body: `${event.authorName} respondió en «${event.title}».`,
      kind: 'foro',
      link: `/app/novedades?hilo=${event.threadId}`,
      building: 'cartelera',
      entity_id: event.threadId,
    }]);
  }

  @OnEvent(DomainEvents.ForumMention)
  async onForumMention(event: ForumMentionEvent) {
    await this.notify(event.userIds.map((user_id) => ({
      user_id,
      title: 'Te mencionaron en el foro',
      body: `${event.authorName} te nombró en «${event.title}».`,
      kind: 'foro' as const,
      link: `/app/novedades?hilo=${event.threadId}`,
      building: 'cartelera',
      entity_id: event.threadId,
    })));
  }

  @OnEvent(DomainEvents.ForumBestAnswer)
  async onBestAnswer(event: ForumBestAnswerEvent) {
    await this.notify([{
      user_id: event.userId,
      title: 'Tu respuesta fue la mejor',
      body: `La eligieron como respuesta en «${event.title}». Ganaste 20 XP.`,
      kind: 'logro',
      link: `/app/novedades?hilo=${event.threadId}`,
      building: 'cartelera',
      entity_id: event.postId,
    }]);
  }

  @OnEvent(DomainEvents.BadgeEarned)
  async onBadge(event: BadgeEarnedEvent) {
    const [first] = event.badges;
    if (!first) return;
    const label = (b: BadgeEarnedEvent['badges'][number]) => (b.maxTier > 1 ? `${b.name} (${TIERS[b.tier] ?? 'oro'})` : b.name);
    const many = event.badges.length > 1;
    await this.notify([{
      user_id: event.userId,
      title: many ? `Ganaste ${event.badges.length} insignias` : first.tier > 1 ? `Subiste a ${TIERS[first.tier]}: ${first.name}` : `Nueva insignia: ${first.name}`,
      body: many ? `${event.badges.slice(0, 4).map(label).join(', ')}${event.badges.length > 4 ? ' y más' : ''}. Míralas en la Sala de trofeos.` : `Ya está en tu Sala de trofeos: ${label(first)}.`,
      kind: 'logro',
      link: '/app/logros',
      building: 'trofeos',
    }]);
  }

  @OnEvent(DomainEvents.BadgesSeen)
  async onBadgesSeen(event: BadgesSeenEvent) {
    await this.database.db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('user_id', '=', event.userId)
      .where('kind', '=', 'logro')
      .where('read_at', 'is', null)
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
    await this.notify([
      {
        user_id: event.teacherId,
        title: `Alerta ${level}: ${event.kind}`,
        body: `${event.studentName} · ${event.courseTitle}. ${event.detail}.`,
        kind: 'seguimiento',
        link: '/app/calificaciones',
        building: 'aula',
        entity_id: event.alertId,
      },
      ...guardians.map((g) => ({
        user_id: g.guardian_id,
        title: `Seguimiento académico: ${event.courseTitle}`,
        body: `El colegio registró una alerta (${event.kind.toLowerCase()}) para ${event.studentName}: ${event.detail}. Comunícate con el docente si tienes dudas.`,
        kind: 'seguimiento' as const,
        link: `/app/acudiente?estudiante=${event.studentId}`,
        building: 'aula',
        entity_id: event.alertId,
      })),
    ]);
  }

  @OnEvent(DomainEvents.MeetingScheduled)
  async onMeeting(event: MeetingScheduledEvent) {
    await this.notify([{
      user_id: event.guardianId,
      title: `Citación: ${event.studentName}`,
      body: `${event.organizer} te cita el ${when(event.scheduledAt)}. Confirma tu asistencia en Familia.`,
      kind: 'citacion',
      link: '/app/acudiente',
      building: 'aula',
      entity_id: event.meetingId,
    }]);
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
    await this.notify([{
      user_id: event.organizerId,
      title: event.attending ? `Citación confirmada: ${event.studentName}` : `Citación declinada: ${event.studentName}`,
      body: `${event.guardianName} ${event.attending ? 'asistirá' : 'no puede asistir'}.${event.note ? ` Nota: ${event.note}` : ''}`,
      kind: 'citacion',
      link: '/app/coordinacion/citaciones',
      building: null,
      entity_id: event.meetingId,
    }]);
  }

  @OnEvent(DomainEvents.StaffMessage)
  async onStaffMessage(event: StaffMessageEvent) {
    await this.notify([{
      user_id: event.recipientId,
      title: `Mensaje de ${event.senderName} (${event.senderRole})`,
      body: event.body.slice(0, 160),
      kind: 'mensaje',
      link: `/app/mensajes?colega=${event.senderId}`,
      building: null,
    }]);
  }

  @OnEvent(DomainEvents.GuardianMessage)
  async onGuardianMessage(event: GuardianMessageEvent) {
    const path = event.recipientRole === 'guardian' ? '/app/acudiente' : '/app/mensajes';
    await this.notify([{
      user_id: event.recipientId,
      title: `Mensaje de ${event.authorName}`,
      body: `Sobre ${event.studentName}: ${event.body.slice(0, 160)}`,
      kind: 'mensaje',
      link: `${path}?estudiante=${event.studentId}`,
      building: event.recipientRole === 'guardian' ? 'aula' : null,
    }]);
    const to = this.mailer.deliveryAddress(event.recipientEmail);
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
    await this.notify(rectors.map((r) => ({
      user_id: r.id,
      title: `${what} por firmar`,
      body: `${event.title} · ${event.studentName}`,
      kind: 'firma' as const,
      link: '/app/rectoria',
      building: 'cuaderno',
    })));
  }

  @OnEvent(DomainEvents.SignatureDecided)
  async onSignatureDecided(event: SignatureDecidedEvent) {
    const what = event.kind === 'certificate' ? 'certificado' : 'boletín';
    const rows: Note[] = [];
    if (event.requesterId) {
      rows.push({
        user_id: event.requesterId,
        title: event.approved ? `Rectoría firmó el ${what}` : `Rectoría devolvió el ${what}`,
        body: `${event.title} · ${event.studentName}.${event.note ? ` Nota: ${event.note}` : ''}`,
        kind: 'firma',
      });
    }
    if (event.approved) {
      rows.push({
        user_id: event.studentId,
        title: event.kind === 'certificate' ? 'Tienes un certificado nuevo' : 'Tu boletín está firmado',
        body: event.title,
        kind: 'certificado',
        link: event.kind === 'certificate' ? '/app/logros' : null,
        building: event.kind === 'certificate' ? 'trofeos' : null,
      });
    }
    await this.notify(rows);
  }

  async list(userId: string, filters: { unread?: boolean; kind?: string; limit?: number }) {
    const limit = Math.min(100, Math.max(1, filters.limit ?? 40));
    const db = this.database.db;
    let query = db
      .selectFrom('notifications')
      .select(['id', 'title', 'body', 'kind', 'link', 'building', 'read_at', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit);
    if (filters.unread) query = query.where('read_at', 'is', null);
    if (filters.kind && (NOTIFICATION_KINDS as readonly string[]).includes(filters.kind)) query = query.where('kind', '=', filters.kind);
    const [items, kinds] = await Promise.all([
      query.execute(),
      sql<{ kind: string; total: number; unread: number }>`
        SELECT kind, count(*)::INT AS total, count(*) FILTER (WHERE read_at IS NULL)::INT AS unread
        FROM notifications WHERE user_id = ${userId} GROUP BY kind`.execute(db),
    ]);
    return {
      items,
      unread: kinds.rows.reduce((sum, k) => sum + Number(k.unread), 0),
      kinds: kinds.rows.map((k) => ({ kind: k.kind, total: Number(k.total), unread: Number(k.unread) })),
    };
  }

  async read(userId: string, id: string) {
    await this.database.db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .execute();
    return { ok: true };
  }

  async readAll(userId: string, kind?: string) {
    let query = this.database.db.updateTable('notifications').set({ read_at: new Date() }).where('user_id', '=', userId).where('read_at', 'is', null);
    if (kind && (NOTIFICATION_KINDS as readonly string[]).includes(kind)) query = query.where('kind', '=', kind);
    const result = await query.executeTakeFirst();
    return { read: Number(result.numUpdatedRows) };
  }
}
