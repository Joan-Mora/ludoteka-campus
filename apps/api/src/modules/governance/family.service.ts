import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { Env } from '../../core/config/config.module';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type GuardianMessageEvent, type MeetingRespondedEvent } from '../../core/events/domain-events';
import { Mailer } from '../../core/mail/mailer';
import { weeklyDigestEmail } from '../../core/mail/templates';

const toGrade = (ratio: number) => Math.round((1 + 4 * Math.max(0, Math.min(1, ratio))) * 10) / 10;
const shortDate = (value: Date) => value.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short' });

const ALERT_LABEL: Record<string, string> = { low_grade: 'Nota baja', absences: 'Inasistencias', integrity: 'Integridad', inactivity: 'Inactividad' };

@Injectable()
export class FamilyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FamilyService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
    private readonly mailer: Mailer,
    private readonly env: Env,
  ) {}

  onModuleInit() {
    if (this.env.values.NODE_ENV !== 'production') return;
    this.timer = setInterval(() => void this.sendDueDigests().catch((error) => this.logger.error(error)), 60 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /* ---------- Hijos ---------- */

  private async linkedStudents(guardianId: string) {
    return this.database.db
      .selectFrom('guardian_links')
      .innerJoin('users', 'users.id', 'guardian_links.student_id')
      .leftJoin('enrollments', (join) => join.onRef('enrollments.user_id', '=', 'users.id').on('enrollments.status', '=', 'active'))
      .leftJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .leftJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select(['users.id', 'users.full_name', 'guardian_links.relationship', 'groups_class.name as group_name', 'grades.name as grade_name'])
      .where('guardian_links.guardian_id', '=', guardianId)
      .where('guardian_links.status', '=', 'active')
      .orderBy('users.full_name')
      .execute();
  }

  private async upcoming(studentId: string, days: number) {
    const rows = await sql<{ kind: string; id: string; title: string; course: string; at: Date }>`
      SELECT 'assignment' AS kind, a.id, a.title, c.title AS course, a.due_at AS at
      FROM assignments a JOIN courses c ON c.id = a.course_id JOIN enrollments e ON e.group_id = c.group_id
      WHERE e.user_id = ${studentId} AND e.status = 'active' AND a.due_at BETWEEN now() AND now() + ${`${days} days`}::INTERVAL
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.user_id = ${studentId})
      UNION ALL
      SELECT ev.kind, ev.id, ev.title, c.title, ev.starts_at
      FROM calendar_events ev JOIN courses c ON c.id = ev.course_id JOIN enrollments e ON e.group_id = c.group_id
      WHERE e.user_id = ${studentId} AND e.status = 'active' AND ev.starts_at BETWEEN now() AND now() + ${`${days} days`}::INTERVAL
      ORDER BY at
      LIMIT 12`.execute(this.database.db);
    return rows.rows.map((r) => ({ kind: r.kind, id: r.id, title: r.title, course: r.course, at: r.at }));
  }

  private async recentGrades(studentId: string, since: Date | null, limit: number) {
    const rows = await sql<{ kind: string; title: string; course: string; ratio: number; at: Date }>`
      SELECT a.kind, a.title, c.title AS course, t.score::FLOAT / t.max_score::FLOAT AS ratio, t.submitted_at AS at
      FROM attempts t JOIN assessments a ON a.id = t.assessment_id JOIN courses c ON c.id = a.course_id
      WHERE t.user_id = ${studentId} AND t.status = 'completed' AND t.max_score > 0 ${since ? sql`AND t.submitted_at >= ${since}` : sql``}
      UNION ALL
      SELECT 'assignment', a.title, c.title, s.score::FLOAT / a.max_score::FLOAT, s.graded_at
      FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
      WHERE s.user_id = ${studentId} AND s.score IS NOT NULL AND a.max_score > 0 ${since ? sql`AND s.graded_at >= ${since}` : sql``}
      ORDER BY at DESC NULLS LAST
      LIMIT ${limit}`.execute(this.database.db);
    return rows.rows.map((r) => ({ kind: r.kind, title: r.title, course: r.course, grade: toGrade(Number(r.ratio)), at: r.at }));
  }

  private async attendance(studentId: string, days: number) {
    const row = await sql<{ total: number; absent: number; late: number; excused: number }>`
      SELECT count(*)::INT AS total,
        sum(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::INT AS absent,
        sum(CASE WHEN status = 'late' THEN 1 ELSE 0 END)::INT AS late,
        sum(CASE WHEN status = 'excused' THEN 1 ELSE 0 END)::INT AS excused
      FROM attendance WHERE student_id = ${studentId} AND session_on >= (now() AT TIME ZONE 'America/Bogota')::DATE - ${days}::INT`.execute(this.database.db);
    const r = row.rows[0];
    return { days, total: Number(r?.total ?? 0), absent: Number(r?.absent ?? 0), late: Number(r?.late ?? 0), excused: Number(r?.excused ?? 0) };
  }

  private teachersOf(studentId: string) {
    return sql<{ id: string; full_name: string; subjects: string }>`
      SELECT t.id, t.full_name, string_agg(DISTINCT s.name, ', ') AS subjects
      FROM courses c JOIN enrollments e ON e.group_id = c.group_id JOIN users t ON t.id = c.teacher_id JOIN subjects s ON s.id = c.subject_id
      WHERE e.user_id = ${studentId} AND e.status = 'active'
      GROUP BY t.id, t.full_name ORDER BY t.full_name`
      .execute(this.database.db)
      .then((r) => r.rows.map((t) => ({ id: t.id, fullName: t.full_name, subjects: t.subjects })));
  }

  async children(guardian: AuthUser) {
    const students = await this.linkedStudents(guardian.id);
    const children = await Promise.all(
      students.map(async (s) => {
        const [upcoming, grades, attendance, teachers, alerts, meetings, unread] = await Promise.all([
          this.upcoming(s.id, 14),
          this.recentGrades(s.id, null, 8),
          this.attendance(s.id, 30),
          this.teachersOf(s.id),
          this.database.db
            .selectFrom('risk_alerts')
            .innerJoin('courses', 'courses.id', 'risk_alerts.course_id')
            .select(['risk_alerts.id', 'risk_alerts.kind', 'risk_alerts.level', 'risk_alerts.detail', 'risk_alerts.status', 'courses.title as course'])
            .where('risk_alerts.student_id', '=', s.id)
            .where('risk_alerts.status', '<>', 'resolved')
            .where('risk_alerts.kind', '<>', 'inactivity')
            .execute(),
          this.database.db
            .selectFrom('meetings')
            .innerJoin('users', 'users.id', 'meetings.created_by')
            .select(['meetings.id', 'meetings.scheduled_at', 'meetings.mode', 'meetings.place', 'meetings.reason', 'meetings.status', 'meetings.response_note', 'meetings.outcome', 'users.full_name as organizer'])
            .where('meetings.student_id', '=', s.id)
            .where('meetings.guardian_id', '=', guardian.id)
            .orderBy('meetings.scheduled_at', 'desc')
            .limit(10)
            .execute(),
          sql<{ n: number }>`SELECT count(*)::INT AS n FROM guardian_messages WHERE student_id = ${s.id} AND guardian_id = ${guardian.id} AND author_id <> ${guardian.id} AND read_at IS NULL`
            .execute(this.database.db)
            .then((r) => Number(r.rows[0]?.n ?? 0)),
        ]);
        return {
          id: s.id,
          fullName: s.full_name,
          relationship: s.relationship,
          group: s.group_name ? `${s.grade_name} · ${s.group_name}` : null,
          upcoming,
          grades,
          attendance,
          teachers,
          alerts: alerts.map((a) => ({ id: a.id, kind: ALERT_LABEL[a.kind] ?? a.kind, level: a.level, detail: a.detail, status: a.status, course: a.course })),
          meetings: meetings.map((m) => ({
            id: m.id,
            scheduledAt: m.scheduled_at,
            mode: m.mode,
            place: m.place,
            reason: m.reason,
            status: m.status,
            responseNote: m.response_note,
            outcome: m.outcome,
            organizer: m.organizer,
          })),
          unreadMessages: unread,
          learningProfile: await this.learningProfile(s.id),
        };
      }),
    );
    const prefs = await this.database.db.selectFrom('user_preferences').select(['weekly_digest', 'digest_sent_at']).where('user_id', '=', guardian.id).executeTakeFirst();
    return { children, digest: { enabled: prefs?.weekly_digest ?? true, lastSentAt: prefs?.digest_sent_at ?? null } };
  }

  /** Se llena cuando el estudiante responde «Descubre cómo aprendes». */
  protected async learningProfile(_studentId: string): Promise<{ method: string; label: string; takenAt: Date } | null> {
    return null;
  }

  async respondMeeting(guardian: AuthUser, id: string, input: { attending: boolean; note?: string }) {
    const meeting = await this.database.db
      .selectFrom('meetings')
      .innerJoin('users', 'users.id', 'meetings.student_id')
      .select(['meetings.status', 'meetings.scheduled_at', 'meetings.created_by', 'users.full_name as student_name'])
      .where('meetings.id', '=', id)
      .where('meetings.guardian_id', '=', guardian.id)
      .executeTakeFirst();
    if (!meeting) throw new ApiError(404, 'NOT_FOUND', 'La citación no existe');
    if (!['scheduled', 'confirmed', 'declined'].includes(meeting.status)) throw new ApiError(409, 'CLOSED', 'La citación ya se cerró');
    if (new Date(meeting.scheduled_at).getTime() < Date.now()) throw new ApiError(409, 'PAST', 'La fecha de la citación ya pasó');
    await this.database.db
      .updateTable('meetings')
      .set({ status: input.attending ? 'confirmed' : 'declined', response_note: input.note || null, responded_at: new Date() })
      .where('id', '=', id)
      .execute();
    this.events.emit(DomainEvents.MeetingResponded, {
      meetingId: id,
      organizerId: meeting.created_by,
      guardianName: guardian.fullName,
      studentName: meeting.student_name,
      attending: input.attending,
      note: input.note || null,
    } satisfies MeetingRespondedEvent);
    return { ok: true };
  }

  /* ---------- Mensajes acudiente ↔ docente ---------- */

  private async thread(user: AuthUser, studentId: string, counterpartId: string) {
    if (user.role !== 'guardian' && user.role !== 'teacher') throw new ApiError(403, 'FORBIDDEN', 'Los mensajes son entre acudientes y docentes');
    const guardianId = user.role === 'guardian' ? user.id : counterpartId;
    const teacherId = user.role === 'teacher' ? user.id : counterpartId;
    const ok = await sql<{ linked: boolean; teaches: boolean }>`
      SELECT
        EXISTS (SELECT 1 FROM guardian_links WHERE guardian_id = ${guardianId} AND student_id = ${studentId} AND status = 'active') AS linked,
        EXISTS (SELECT 1 FROM courses c JOIN enrollments e ON e.group_id = c.group_id
          WHERE e.user_id = ${studentId} AND e.status = 'active' AND c.teacher_id = ${teacherId}) AS teaches`.execute(this.database.db);
    if (!ok.rows[0]?.linked || !ok.rows[0]?.teaches) throw new ApiError(403, 'FORBIDDEN', 'No puedes escribir sobre este estudiante con esa persona');
    return { guardianId, teacherId };
  }

  async contacts(user: AuthUser) {
    if (user.role === 'guardian') {
      const students = await this.linkedStudents(user.id);
      return Promise.all(
        students.map(async (s) => ({
          student: { id: s.id, fullName: s.full_name, group: s.group_name ? `${s.grade_name} · ${s.group_name}` : null },
          people: (await this.teachersOf(s.id)).map((t) => ({ id: t.id, fullName: t.fullName, detail: t.subjects })),
        })),
      );
    }
    const rows = await sql<{ student_id: string; student_name: string; group_name: string; guardian_id: string; guardian_name: string; relationship: string }>`
      SELECT DISTINCT s.id AS student_id, s.full_name AS student_name, gr.name || ' · ' || g.name AS group_name,
        gu.id AS guardian_id, gu.full_name AS guardian_name, l.relationship
      FROM courses c
      JOIN enrollments e ON e.group_id = c.group_id AND e.status = 'active'
      JOIN users s ON s.id = e.user_id
      JOIN groups_class g ON g.id = c.group_id JOIN grades gr ON gr.id = g.grade_id
      JOIN guardian_links l ON l.student_id = s.id AND l.status = 'active'
      JOIN users gu ON gu.id = l.guardian_id
      WHERE c.teacher_id = ${user.id}
      ORDER BY student_name, guardian_name`.execute(this.database.db);
    const byStudent = new Map<string, { student: { id: string; fullName: string; group: string | null }; people: { id: string; fullName: string; detail: string }[] }>();
    for (const r of rows.rows) {
      const entry = byStudent.get(r.student_id) ?? { student: { id: r.student_id, fullName: r.student_name, group: r.group_name }, people: [] };
      entry.people.push({ id: r.guardian_id, fullName: r.guardian_name, detail: r.relationship });
      byStudent.set(r.student_id, entry);
    }
    return [...byStudent.values()];
  }

  async threads(user: AuthUser) {
    if (user.role !== 'guardian' && user.role !== 'teacher') throw new ApiError(403, 'FORBIDDEN', 'Los mensajes son entre acudientes y docentes');
    const mine = user.role === 'guardian' ? sql`m.guardian_id = ${user.id}` : sql`m.teacher_id = ${user.id}`;
    const other = user.role === 'guardian' ? sql`m.teacher_id` : sql`m.guardian_id`;
    const rows = await sql<{ student_id: string; student_name: string; counterpart_id: string; counterpart_name: string; last_at: Date; unread: number; last_body: string; total: number }>`
      SELECT m.student_id, s.full_name AS student_name, ${other} AS counterpart_id, o.full_name AS counterpart_name,
        max(m.created_at) AS last_at,
        sum(CASE WHEN m.author_id <> ${user.id} AND m.read_at IS NULL THEN 1 ELSE 0 END)::INT AS unread,
        count(*)::INT AS total,
        (SELECT x.body FROM guardian_messages x WHERE x.student_id = m.student_id AND x.guardian_id = m.guardian_id AND x.teacher_id = m.teacher_id ORDER BY x.created_at DESC LIMIT 1) AS last_body
      FROM guardian_messages m JOIN users s ON s.id = m.student_id JOIN users o ON o.id = ${other}
      WHERE ${mine}
      GROUP BY m.student_id, s.full_name, m.guardian_id, m.teacher_id, ${other}, o.full_name
      ORDER BY last_at DESC
      LIMIT 100`.execute(this.database.db);
    return rows.rows.map((r) => ({
      student: { id: r.student_id, fullName: r.student_name },
      counterpart: { id: r.counterpart_id, fullName: r.counterpart_name },
      lastAt: r.last_at,
      lastBody: r.last_body,
      unread: Number(r.unread),
      total: Number(r.total),
    }));
  }

  async messages(user: AuthUser, studentId: string, counterpartId: string) {
    const { guardianId, teacherId } = await this.thread(user, studentId, counterpartId);
    await this.database.db
      .updateTable('guardian_messages')
      .set({ read_at: new Date() })
      .where('student_id', '=', studentId)
      .where('guardian_id', '=', guardianId)
      .where('teacher_id', '=', teacherId)
      .where('author_id', '<>', user.id)
      .where('read_at', 'is', null)
      .execute();
    const rows = await this.database.db
      .selectFrom('guardian_messages')
      .innerJoin('users', 'users.id', 'guardian_messages.author_id')
      .select(['guardian_messages.id', 'guardian_messages.body', 'guardian_messages.author_id', 'guardian_messages.read_at', 'guardian_messages.created_at', 'users.full_name as author'])
      .where('guardian_messages.student_id', '=', studentId)
      .where('guardian_messages.guardian_id', '=', guardianId)
      .where('guardian_messages.teacher_id', '=', teacherId)
      .orderBy('guardian_messages.created_at')
      .limit(300)
      .execute();
    return rows.map((m) => ({ id: m.id, body: m.body, author: m.author, mine: m.author_id === user.id, readAt: m.read_at, createdAt: m.created_at }));
  }

  async post(user: AuthUser, input: { studentId: string; counterpartId: string; body: string }) {
    const { guardianId, teacherId } = await this.thread(user, input.studentId, input.counterpartId);
    await this.database.db
      .insertInto('guardian_messages')
      .values({ student_id: input.studentId, guardian_id: guardianId, teacher_id: teacherId, author_id: user.id, body: input.body })
      .execute();
    const [recipient, student] = await Promise.all([
      this.database.db.selectFrom('users').select(['email', 'full_name']).where('id', '=', input.counterpartId).executeTakeFirstOrThrow(),
      this.database.db.selectFrom('users').select('full_name').where('id', '=', input.studentId).executeTakeFirstOrThrow(),
    ]);
    this.events.emit(DomainEvents.GuardianMessage, {
      recipientId: input.counterpartId,
      recipientEmail: recipient.email,
      recipientName: recipient.full_name,
      recipientRole: user.role === 'guardian' ? 'teacher' : 'guardian',
      authorName: user.fullName,
      studentId: input.studentId,
      studentName: student.full_name,
      body: input.body,
    } satisfies GuardianMessageEvent);
    return this.messages(user, input.studentId, input.counterpartId);
  }

  async unreadCount(user: AuthUser) {
    if (user.role !== 'guardian' && user.role !== 'teacher') return 0;
    const column = user.role === 'guardian' ? sql`guardian_id` : sql`teacher_id`;
    const r = await sql<{ n: number }>`SELECT count(*)::INT AS n FROM guardian_messages WHERE ${column} = ${user.id} AND author_id <> ${user.id} AND read_at IS NULL`.execute(this.database.db);
    return Number(r.rows[0]?.n ?? 0);
  }

  /* ---------- Resumen semanal ---------- */

  async setDigest(guardian: AuthUser, enabled: boolean) {
    await this.database.db
      .insertInto('user_preferences')
      .values({ user_id: guardian.id, weekly_digest: enabled })
      .onConflict((oc) => oc.column('user_id').doUpdateSet({ weekly_digest: enabled, updated_at: new Date() }))
      .execute();
    return { enabled };
  }

  async sendDigest(guardianId: string) {
    const guardian = await this.database.db.selectFrom('users').select(['email', 'full_name']).where('id', '=', guardianId).executeTakeFirst();
    if (!guardian) throw new ApiError(404, 'NOT_FOUND', 'La cuenta no existe');
    const students = await this.linkedStudents(guardianId);
    if (!students.length) throw new ApiError(409, 'NO_STUDENTS', 'No tienes estudiantes vinculados');
    const since = new Date(Date.now() - 7 * 86_400_000);
    const children = await Promise.all(
      students.map(async (s) => {
        const [upcoming, grades, attendance, alerts] = await Promise.all([
          this.upcoming(s.id, 7),
          this.recentGrades(s.id, since, 8),
          this.attendance(s.id, 7),
          sql<{ n: number }>`SELECT count(*)::INT AS n FROM risk_alerts WHERE student_id = ${s.id} AND status <> 'resolved' AND kind <> 'inactivity'`
            .execute(this.database.db)
            .then((r) => Number(r.rows[0]?.n ?? 0)),
        ]);
        return {
          name: s.full_name,
          group: s.group_name ? `${s.grade_name} · ${s.group_name}` : null,
          upcoming: upcoming.map((u) => ({ title: u.title, detail: `${u.course} · ${shortDate(new Date(u.at))}`, tag: u.kind === 'assignment' ? 'Tarea' : u.kind === 'exam' ? 'Examen' : 'Evento' })),
          grades: grades.map((g) => ({ title: g.title, detail: g.course, tag: g.grade.toFixed(1) })),
          absences: attendance.absent,
          alerts,
        };
      }),
    );
    const to = this.mailer.deliveryAddress(guardian.email);
    await this.mailer.send(to, weeklyDigestEmail({ baseUrl: this.mailer.baseUrl, fullName: guardian.full_name, account: guardian.email, forLab: to !== guardian.email, children }));
    await this.database.db
      .insertInto('user_preferences')
      .values({ user_id: guardianId, digest_sent_at: new Date() })
      .onConflict((oc) => oc.column('user_id').doUpdateSet({ digest_sent_at: new Date() }))
      .execute();
    return { ok: true, children: children.length };
  }

  /** Los viernes desde las 3 p. m. (hora de Bogotá), una vez por semana por acudiente. */
  async sendDueDigests() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    if (weekday !== 'Fri' || hour < 15) return;
    const due = await sql<{ id: string }>`
      SELECT DISTINCT u.id FROM users u
      JOIN user_roles r ON r.user_id = u.id AND r.role = 'guardian'
      JOIN guardian_links l ON l.guardian_id = u.id AND l.status = 'active'
      LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE u.status = 'active' AND coalesce(p.weekly_digest, true)
        AND (p.digest_sent_at IS NULL OR p.digest_sent_at < now() - INTERVAL '6 days')
      LIMIT 200`.execute(this.database.db);
    for (const row of due.rows) {
      await this.sendDigest(row.id).catch((error) => this.logger.warn(`resumen semanal no enviado: ${(error as Error).message}`));
    }
  }
}
