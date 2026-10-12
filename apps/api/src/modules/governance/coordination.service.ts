import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { z } from 'zod';
import type { alertNoteSchema, meetingCloseSchema, meetingSchema } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type MeetingScheduledEvent } from '../../core/events/domain-events';
import { bogotaToday, shiftDate } from '../../core/time';

export const ALERT_KIND_LABEL: Record<string, string> = {
  low_grade: 'Nota baja',
  absences: 'Inasistencias',
  integrity: 'Integridad',
  inactivity: 'Inactividad',
};

/** Umbral institucional de inasistencia: 3 faltas o el 15 % de las clases registradas. */
export const ABSENCE_THRESHOLD = { count: 3, rate: 0.15 };

type AlertStatus = 'open' | 'acknowledged' | 'resolved';

@Injectable()
export class CoordinationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  /* ---------- Mesa de seguimiento ---------- */

  async alerts(status?: string) {
    const filter = status === 'open' || status === 'acknowledged' || status === 'resolved' ? sql`ra.status = ${status}` : sql`ra.status <> 'resolved'`;
    const rows = await sql<{
      id: string;
      kind: string;
      level: string;
      detail: string;
      status: string;
      created_at: Date;
      resolved_at: Date | null;
      student_id: string;
      student_name: string;
      course_id: string;
      course_title: string;
      group_name: string;
      grade_name: string;
      teacher_name: string;
      notes: number;
      last_note: string | null;
      last_note_at: Date | null;
      meetings: number;
      guardians: number;
    }>`
      SELECT ra.id, ra.kind, ra.level, ra.detail, ra.status, ra.created_at, ra.resolved_at,
        ra.student_id, u.full_name AS student_name, c.id AS course_id, c.title AS course_title,
        g.name AS group_name, gr.name AS grade_name, t.full_name AS teacher_name,
        (SELECT count(*) FROM risk_alert_notes n WHERE n.alert_id = ra.id)::INT AS notes,
        (SELECT n.body FROM risk_alert_notes n WHERE n.alert_id = ra.id ORDER BY n.created_at DESC LIMIT 1) AS last_note,
        (SELECT max(n.created_at) FROM risk_alert_notes n WHERE n.alert_id = ra.id) AS last_note_at,
        (SELECT count(*) FROM meetings m WHERE m.student_id = ra.student_id AND m.status IN ('scheduled', 'confirmed') AND m.scheduled_at > now())::INT AS meetings,
        (SELECT count(*) FROM guardian_links l WHERE l.student_id = ra.student_id AND l.status = 'active')::INT AS guardians
      FROM risk_alerts ra
      JOIN users u ON u.id = ra.student_id
      JOIN courses c ON c.id = ra.course_id
      JOIN groups_class g ON g.id = c.group_id
      JOIN grades gr ON gr.id = g.grade_id
      JOIN users t ON t.id = c.teacher_id
      WHERE ${filter}
      ORDER BY CASE ra.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
        CASE ra.level WHEN 'alta' THEN 0 ELSE 1 END, ra.created_at DESC
      LIMIT 300`.execute(this.database.db);
    const counts = await sql<{ status: string; n: number }>`SELECT status, count(*)::INT AS n FROM risk_alerts GROUP BY status`.execute(this.database.db);
    const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.n)]));
    return {
      summary: { open: byStatus.open ?? 0, acknowledged: byStatus.acknowledged ?? 0, resolved: byStatus.resolved ?? 0 },
      alerts: rows.rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        kindLabel: ALERT_KIND_LABEL[r.kind] ?? r.kind,
        level: r.level,
        detail: r.detail,
        status: r.status,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        student: { id: r.student_id, fullName: r.student_name },
        course: { id: r.course_id, title: r.course_title, group: `${r.grade_name} · ${r.group_name}`, teacher: r.teacher_name },
        notes: Number(r.notes),
        lastNote: r.last_note,
        lastNoteAt: r.last_note_at,
        upcomingMeetings: Number(r.meetings),
        guardians: Number(r.guardians),
      })),
    };
  }

  async alert(id: string) {
    const alert = await this.database.db
      .selectFrom('risk_alerts')
      .innerJoin('users', 'users.id', 'risk_alerts.student_id')
      .innerJoin('courses', 'courses.id', 'risk_alerts.course_id')
      .select([
        'risk_alerts.id',
        'risk_alerts.kind',
        'risk_alerts.level',
        'risk_alerts.detail',
        'risk_alerts.status',
        'risk_alerts.created_at',
        'risk_alerts.student_id',
        'users.full_name as student_name',
        'courses.id as course_id',
        'courses.title as course_title',
      ])
      .where('risk_alerts.id', '=', id)
      .executeTakeFirst();
    if (!alert) throw new ApiError(404, 'NOT_FOUND', 'La alerta no existe');
    const [notes, guardians, meetings] = await Promise.all([
      this.database.db
        .selectFrom('risk_alert_notes')
        .innerJoin('users', 'users.id', 'risk_alert_notes.author_id')
        .select(['risk_alert_notes.id', 'risk_alert_notes.body', 'risk_alert_notes.created_at', 'users.full_name as author'])
        .where('risk_alert_notes.alert_id', '=', id)
        .orderBy('risk_alert_notes.created_at', 'desc')
        .execute(),
      this.guardiansOf(alert.student_id),
      this.meetingRows(sql`m.student_id = ${alert.student_id}`, 20),
    ]);
    return {
      id: alert.id,
      kind: alert.kind,
      kindLabel: ALERT_KIND_LABEL[alert.kind] ?? alert.kind,
      level: alert.level,
      detail: alert.detail,
      status: alert.status,
      createdAt: alert.created_at,
      student: { id: alert.student_id, fullName: alert.student_name },
      course: { id: alert.course_id, title: alert.course_title },
      notes: notes.map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.created_at })),
      guardians,
      meetings,
    };
  }

  /** Anotar en una alerta abierta la pasa a «en seguimiento» salvo que se indique otro estado. */
  async addNote(user: AuthUser, id: string, input: z.infer<typeof alertNoteSchema>) {
    const alert = await this.database.db.selectFrom('risk_alerts').select(['status']).where('id', '=', id).executeTakeFirst();
    if (!alert) throw new ApiError(404, 'NOT_FOUND', 'La alerta no existe');
    const next: AlertStatus | undefined = input.status ?? (alert.status === 'open' ? 'acknowledged' : undefined);
    if (alert.status === 'resolved' && next) throw new ApiError(409, 'ALREADY_RESOLVED', 'La alerta ya está cerrada');
    await this.database.withTx(async (trx) => {
      await trx.insertInto('risk_alert_notes').values({ alert_id: id, author_id: user.id, body: input.body }).execute();
      if (next && next !== alert.status) {
        await trx
          .updateTable('risk_alerts')
          .set(next === 'resolved' ? { status: next, resolved_at: new Date(), resolved_by: user.id } : { status: next })
          .where('id', '=', id)
          .execute();
      }
    });
    return this.alert(id);
  }

  /* ---------- Asistencia consolidada ---------- */

  async attendance(days: number) {
    const span = Math.min(180, Math.max(7, Math.round(days) || 30));
    const since = shiftDate(bogotaToday(), -span);
    const [groups, students, trend] = await Promise.all([
      sql<{ id: string; level: number; grade_name: string; group_name: string; students: number; total: number; present: number; late: number; absent: number; excused: number; sessions: number }>`
        SELECT g.id, gr.level, gr.name AS grade_name, g.name AS group_name,
          count(DISTINCT a.student_id)::INT AS students, count(*)::INT AS total,
          sum(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::INT AS present,
          sum(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END)::INT AS late,
          sum(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END)::INT AS absent,
          sum(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END)::INT AS excused,
          count(DISTINCT a.course_id::STRING || a.session_on::STRING)::INT AS sessions
        FROM attendance a
        JOIN courses c ON c.id = a.course_id
        JOIN groups_class g ON g.id = c.group_id
        JOIN grades gr ON gr.id = g.grade_id
        WHERE a.session_on >= ${since}::DATE
        GROUP BY g.id, gr.level, gr.name, g.name
        ORDER BY gr.level, g.name`.execute(this.database.db),
      sql<{ student_id: string; full_name: string; group_name: string; grade_name: string; total: number; absent: number; late: number; last_absent: string | null }>`
        SELECT a.student_id, u.full_name, g.name AS group_name, gr.name AS grade_name,
          count(*)::INT AS total,
          sum(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END)::INT AS absent,
          sum(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END)::INT AS late,
          max(CASE WHEN a.status = 'absent' THEN a.session_on END)::STRING AS last_absent
        FROM attendance a
        JOIN users u ON u.id = a.student_id
        JOIN courses c ON c.id = a.course_id
        JOIN groups_class g ON g.id = c.group_id
        JOIN grades gr ON gr.id = g.grade_id
        WHERE a.session_on >= ${since}::DATE
        GROUP BY a.student_id, u.full_name, g.name, gr.name
        HAVING sum(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) >= ${ABSENCE_THRESHOLD.count}
          OR sum(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END)::FLOAT / count(*)::FLOAT >= ${ABSENCE_THRESHOLD.rate}
        ORDER BY absent DESC, u.full_name
        LIMIT 100`.execute(this.database.db),
      sql<{ day: string; total: number; absent: number }>`
        SELECT session_on::STRING AS day, count(*)::INT AS total, sum(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::INT AS absent
        FROM attendance WHERE session_on >= ${since}::DATE
        GROUP BY session_on ORDER BY session_on`.execute(this.database.db),
    ]);
    const rate = (present: number, late: number, total: number, excused: number) => {
      const counted = total - excused;
      return counted > 0 ? Math.round(((present + 0.5 * late) * 1000) / counted) / 10 : null;
    };
    return {
      days: span,
      since,
      threshold: ABSENCE_THRESHOLD,
      groups: groups.rows.map((g) => ({
        id: g.id,
        name: `${g.grade_name} · ${g.group_name}`,
        students: Number(g.students),
        sessions: Number(g.sessions),
        absent: Number(g.absent),
        late: Number(g.late),
        excused: Number(g.excused),
        rate: rate(Number(g.present), Number(g.late), Number(g.total), Number(g.excused)),
      })),
      students: students.rows.map((s) => ({
        id: s.student_id,
        fullName: s.full_name,
        group: `${s.grade_name} · ${s.group_name}`,
        total: Number(s.total),
        absent: Number(s.absent),
        late: Number(s.late),
        absentRate: Math.round((Number(s.absent) * 1000) / Math.max(1, Number(s.total))) / 10,
        lastAbsent: s.last_absent?.slice(0, 10) ?? null,
      })),
      trend: trend.rows.map((t) => ({ day: t.day.slice(0, 10), total: Number(t.total), absent: Number(t.absent) })),
    };
  }

  /* ---------- Citaciones ---------- */

  private guardiansOf(studentId: string) {
    return this.database.db
      .selectFrom('guardian_links')
      .innerJoin('users', 'users.id', 'guardian_links.guardian_id')
      .select(['users.id', 'users.full_name as fullName', 'users.email', 'guardian_links.relationship'])
      .where('guardian_links.student_id', '=', studentId)
      .where('guardian_links.status', '=', 'active')
      .orderBy('users.full_name')
      .execute();
  }

  private async meetingRows(where: ReturnType<typeof sql>, limit: number) {
    const rows = await sql<{
      id: string;
      scheduled_at: Date;
      mode: string;
      place: string;
      reason: string;
      status: string;
      response_note: string | null;
      responded_at: Date | null;
      outcome: string | null;
      student_id: string;
      student_name: string;
      guardian_id: string;
      guardian_name: string;
      organizer: string;
      alert_id: string | null;
    }>`
      SELECT m.id, m.scheduled_at, m.mode, m.place, m.reason, m.status, m.response_note, m.responded_at, m.outcome,
        m.student_id, s.full_name AS student_name, m.guardian_id, gu.full_name AS guardian_name, o.full_name AS organizer, m.alert_id
      FROM meetings m
      JOIN users s ON s.id = m.student_id
      JOIN users gu ON gu.id = m.guardian_id
      JOIN users o ON o.id = m.created_by
      WHERE ${where}
      ORDER BY m.scheduled_at DESC
      LIMIT ${limit}`.execute(this.database.db);
    return rows.rows.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduled_at,
      mode: m.mode,
      place: m.place,
      reason: m.reason,
      status: m.status,
      responseNote: m.response_note,
      respondedAt: m.responded_at,
      outcome: m.outcome,
      student: { id: m.student_id, fullName: m.student_name },
      guardian: { id: m.guardian_id, fullName: m.guardian_name },
      organizer: m.organizer,
      alertId: m.alert_id,
    }));
  }

  meetings(scope: string | undefined) {
    if (scope === 'past') return this.meetingRows(sql`(m.scheduled_at <= now() OR m.status IN ('held', 'cancelled'))`, 100);
    return this.meetingRows(sql`m.scheduled_at > now() - INTERVAL '1 day' AND m.status IN ('scheduled', 'confirmed', 'declined')`, 100);
  }

  /** Una citación por cada acudiente activo del estudiante; cada uno confirma por su cuenta. */
  async createMeeting(user: AuthUser, input: z.infer<typeof meetingSchema>) {
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt.getTime() < Date.now() + 30 * 60_000) throw new ApiError(400, 'TOO_SOON', 'La citación debe ser al menos 30 minutos en el futuro');
    const student = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.id', 'users.full_name'])
      .where('users.id', '=', input.studentId)
      .where('user_roles.role', '=', 'student')
      .executeTakeFirst();
    if (!student) throw new ApiError(404, 'NOT_FOUND', 'El estudiante no existe');
    const guardians = await this.guardiansOf(student.id);
    if (!guardians.length) throw new ApiError(409, 'NO_GUARDIAN', 'El estudiante no tiene acudientes vinculados');
    const created = await this.database.db
      .insertInto('meetings')
      .values(
        guardians.map((g) => ({
          student_id: student.id,
          guardian_id: g.id,
          course_id: input.courseId ?? null,
          alert_id: input.alertId ?? null,
          created_by: user.id,
          scheduled_at: scheduledAt,
          mode: input.mode,
          place: input.place,
          reason: input.reason,
        })),
      )
      .returning(['id', 'guardian_id'])
      .execute();
    if (input.alertId) {
      await this.database.db.updateTable('risk_alerts').set({ status: 'acknowledged' }).where('id', '=', input.alertId).where('status', '=', 'open').execute();
      await this.database.db
        .insertInto('risk_alert_notes')
        .values({ alert_id: input.alertId, author_id: user.id, body: `Citación a acudientes para el ${scheduledAt.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })}: ${input.reason}`.slice(0, 1000) })
        .execute();
    }
    const organizer = `${user.fullName} (${user.role === 'admin' ? 'Administración' : 'Coordinación'})`;
    for (const row of created) {
      const guardian = guardians.find((g) => g.id === row.guardian_id)!;
      this.events.emit(DomainEvents.MeetingScheduled, {
        meetingId: row.id,
        guardianId: guardian.id,
        guardianEmail: guardian.email,
        guardianName: guardian.fullName,
        studentName: student.full_name,
        scheduledAt,
        mode: input.mode,
        place: input.place,
        reason: input.reason,
        organizer,
      } satisfies MeetingScheduledEvent);
    }
    return { created: created.length };
  }

  async closeMeeting(id: string, input: z.infer<typeof meetingCloseSchema>) {
    const meeting = await this.database.db.selectFrom('meetings').select(['status']).where('id', '=', id).executeTakeFirst();
    if (!meeting) throw new ApiError(404, 'NOT_FOUND', 'La citación no existe');
    if (meeting.status === 'held' || meeting.status === 'cancelled') throw new ApiError(409, 'CLOSED', 'La citación ya está cerrada');
    await this.database.db.updateTable('meetings').set({ status: input.status, outcome: input.outcome ?? null }).where('id', '=', id).execute();
    return { ok: true };
  }

  async searchStudents(q: string | undefined) {
    const term = (q ?? '').trim();
    let query = this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('enrollments', (join) => join.onRef('enrollments.user_id', '=', 'users.id').on('enrollments.status', '=', 'active'))
      .leftJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .leftJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select([
        'users.id',
        'users.full_name',
        'groups_class.name as group_name',
        'grades.name as grade_name',
        sql<number>`(SELECT count(*) FROM guardian_links l WHERE l.student_id = users.id AND l.status = 'active')::INT`.as('guardians'),
      ])
      .where('user_roles.role', '=', 'student')
      .where('users.status', '=', 'active');
    if (term) query = query.where('users.full_name', 'ilike', `%${term.replace(/[%_]/g, '')}%`);
    const rows = await query.orderBy('users.full_name').limit(25).execute();
    return rows.map((r) => ({ id: r.id, fullName: r.full_name, group: r.group_name ? `${r.grade_name} · ${r.group_name}` : null, guardians: Number(r.guardians) }));
  }
}
