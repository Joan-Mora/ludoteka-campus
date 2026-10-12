import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { ROLE_LABELS, type Role } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type StaffMessageEvent } from '../../core/events/domain-events';

export const STAFF_ROLES = ['teacher', 'coordinator', 'rector', 'admin'] as const satisfies readonly Role[];
const STAFF = sql.join(STAFF_ROLES.map((role) => sql.lit(role)));

/** Messages between school staff: every contact shows name, role and (for teachers) what they teach. */
@Injectable()
export class StaffMessagesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  private async colleague(user: AuthUser, id: string) {
    if (id === user.id) throw new ApiError(400, 'VALIDATION', 'No puedes escribirte a ti mismo');
    const row = await sql<{ id: string; full_name: string; role: string }>`
      SELECT u.id, u.full_name, r.role FROM users u JOIN user_roles r ON r.user_id = u.id
      WHERE u.id = ${id} AND u.status = 'active' AND r.role IN (${STAFF}) LIMIT 1`.execute(this.database.db);
    const found = row.rows[0];
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'Esa persona no hace parte del personal del colegio');
    return found;
  }

  async contacts(user: AuthUser) {
    const rows = await sql<{ id: string; full_name: string; role: string; subjects: string | null }>`
      SELECT u.id, u.full_name, r.role,
        (SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM (SELECT DISTINCT s.name FROM courses c JOIN subjects s ON s.id = c.subject_id WHERE c.teacher_id = u.id) t) AS subjects
      FROM users u JOIN user_roles r ON r.user_id = u.id
      WHERE u.status = 'active' AND u.id <> ${user.id} AND r.role IN (${STAFF})
      ORDER BY CASE r.role WHEN 'rector' THEN 0 WHEN 'coordinator' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, u.full_name
      LIMIT 500`.execute(this.database.db);
    return rows.rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      role: r.role,
      roleLabel: ROLE_LABELS[r.role as Role] ?? r.role,
      detail: r.role === 'teacher' ? r.subjects ?? 'Sin asignaturas este año' : null,
    }));
  }

  async threads(user: AuthUser) {
    const rows = await sql<{ other_id: string; full_name: string; role: string; last_at: Date; last_body: string; unread: number }>`
      WITH mine AS (
        SELECT CASE WHEN sender_id = ${user.id} THEN recipient_id ELSE sender_id END AS other_id, sender_id, body, read_at, created_at
        FROM staff_messages WHERE sender_id = ${user.id} OR recipient_id = ${user.id}
      ),
      latest AS (
        SELECT DISTINCT ON (other_id) other_id, body AS last_body, created_at AS last_at FROM mine ORDER BY other_id, created_at DESC
      )
      SELECT l.other_id, u.full_name, (SELECT role FROM user_roles WHERE user_id = u.id ORDER BY created_at LIMIT 1) AS role,
        l.last_at, l.last_body,
        (SELECT count(*)::INT FROM mine m WHERE m.other_id = l.other_id AND m.sender_id <> ${user.id} AND m.read_at IS NULL) AS unread
      FROM latest l JOIN users u ON u.id = l.other_id
      ORDER BY l.last_at DESC LIMIT 100`.execute(this.database.db);
    return rows.rows.map((r) => ({
      counterpart: { id: r.other_id, fullName: r.full_name, role: r.role, roleLabel: ROLE_LABELS[r.role as Role] ?? r.role },
      lastAt: r.last_at,
      lastBody: r.last_body,
      unread: Number(r.unread),
    }));
  }

  async messages(user: AuthUser, otherId: string) {
    await this.colleague(user, otherId);
    await this.database.db
      .updateTable('staff_messages')
      .set({ read_at: new Date() })
      .where('sender_id', '=', otherId)
      .where('recipient_id', '=', user.id)
      .where('read_at', 'is', null)
      .execute();
    const rows = await this.database.db
      .selectFrom('staff_messages')
      .innerJoin('users', 'users.id', 'staff_messages.sender_id')
      .select(['staff_messages.id', 'staff_messages.body', 'staff_messages.sender_id', 'staff_messages.read_at', 'staff_messages.created_at', 'users.full_name as author'])
      .where((eb) => eb.or([
        eb.and([eb('staff_messages.sender_id', '=', user.id), eb('staff_messages.recipient_id', '=', otherId)]),
        eb.and([eb('staff_messages.sender_id', '=', otherId), eb('staff_messages.recipient_id', '=', user.id)]),
      ]))
      .orderBy('staff_messages.created_at')
      .limit(300)
      .execute();
    return rows.map((m) => ({ id: m.id, body: m.body, author: m.author, mine: m.sender_id === user.id, readAt: m.read_at, createdAt: m.created_at }));
  }

  async post(user: AuthUser, input: { recipientId: string; body: string }) {
    await this.colleague(user, input.recipientId);
    await this.database.db.insertInto('staff_messages').values({ sender_id: user.id, recipient_id: input.recipientId, body: input.body }).execute();
    this.events.emit(DomainEvents.StaffMessage, {
      recipientId: input.recipientId,
      senderId: user.id,
      senderName: user.fullName,
      senderRole: ROLE_LABELS[user.role] ?? user.role,
      body: input.body,
    } satisfies StaffMessageEvent);
    return this.messages(user, input.recipientId);
  }

  async unreadCount(user: AuthUser) {
    const r = await sql<{ n: number }>`SELECT count(*)::INT AS n FROM staff_messages WHERE recipient_id = ${user.id} AND read_at IS NULL`.execute(this.database.db);
    return Number(r.rows[0]?.n ?? 0);
  }
}
