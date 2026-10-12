import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type SignatureDecidedEvent, type SignatureRequestedEvent } from '../../core/events/domain-events';
import { asIsoDate, bogotaToday } from '../../core/time';

interface Range {
  from: string;
  to: string;
}

interface GroupMetrics {
  sumRatio: number;
  graded: number;
  passed: number;
  present: number;
  late: number;
  counted: number;
  absent: number;
  alerts: number;
  high: number;
  aiUses: number;
  aiUsers: number;
}

const empty = (): GroupMetrics => ({ sumRatio: 0, graded: 0, passed: 0, present: 0, late: 0, counted: 0, absent: 0, alerts: 0, high: 0, aiUses: 0, aiUsers: 0 });

const toGrade = (ratio: number | null) => (ratio == null ? null : Math.round((1 + 4 * Math.max(0, Math.min(1, ratio))) * 10) / 10);
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : null);

function summarize(m: GroupMetrics) {
  return {
    average: toGrade(m.graded ? m.sumRatio / m.graded : null),
    passRate: share(m.passed, m.graded),
    attendance: share(m.present + 0.5 * m.late, m.counted),
    absences: m.absent,
    alerts: m.alerts,
    highAlerts: m.high,
    aiUses: m.aiUses,
    aiUsers: m.aiUsers,
    graded: m.graded,
  };
}

function add(target: GroupMetrics, source: GroupMetrics) {
  for (const key of Object.keys(target) as (keyof GroupMetrics)[]) target[key] += source[key];
}

const delta = (now: number | null, before: number | null) => (now == null || before == null ? null : Math.round((now - before) * 10) / 10);

@Injectable()
export class RectoriaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  private async periods() {
    const rows = await this.database.db
      .selectFrom('periods')
      .innerJoin('academic_years', 'academic_years.id', 'periods.academic_year_id')
      .select(['periods.id', 'periods.name', 'periods.position', 'periods.starts_on', 'periods.ends_on', 'academic_years.name as year', 'academic_years.starts_on as year_start', 'academic_years.ends_on as year_end'])
      .where('academic_years.is_current', '=', true)
      .orderBy('periods.position')
      .execute();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      position: r.position,
      from: asIsoDate(r.starts_on)!,
      to: asIsoDate(r.ends_on)!,
      year: r.year,
      yearFrom: asIsoDate(r.year_start)!,
      yearTo: asIsoDate(r.year_end)!,
    }));
  }

  private async metrics(range: Range) {
    const inRange = (column: string) => sql`(${sql.ref(column)} AT TIME ZONE 'America/Bogota')::DATE BETWEEN ${range.from}::DATE AND ${range.to}::DATE`;
    const [grades, attendance, alerts, ai] = await Promise.all([
      sql<{ group_id: string; sum_ratio: number; graded: number; passed: number }>`
        WITH sc AS (
          SELECT c.group_id, t.user_id, c.id AS course_id, avg(t.score::FLOAT / t.max_score::FLOAT) AS ratio
          FROM attempts t JOIN assessments a ON a.id = t.assessment_id JOIN courses c ON c.id = a.course_id
          WHERE t.status = 'completed' AND t.max_score > 0 AND ${inRange('t.submitted_at')}
          GROUP BY c.group_id, t.user_id, c.id
        )
        SELECT group_id, sum(ratio) AS sum_ratio, count(*)::INT AS graded, sum(CASE WHEN ratio >= 0.5 THEN 1 ELSE 0 END)::INT AS passed
        FROM sc GROUP BY group_id`.execute(this.database.db),
      sql<{ group_id: string; present: number; late: number; counted: number; absent: number }>`
        SELECT c.group_id,
          sum(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::INT AS present,
          sum(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END)::INT AS late,
          sum(CASE WHEN a.status <> 'excused' THEN 1 ELSE 0 END)::INT AS counted,
          sum(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END)::INT AS absent
        FROM attendance a JOIN courses c ON c.id = a.course_id
        WHERE a.session_on BETWEEN ${range.from}::DATE AND ${range.to}::DATE
        GROUP BY c.group_id`.execute(this.database.db),
      sql<{ group_id: string; alerts: number; high: number }>`
        SELECT c.group_id, count(*)::INT AS alerts, sum(CASE WHEN r.level = 'alta' THEN 1 ELSE 0 END)::INT AS high
        FROM risk_alerts r JOIN courses c ON c.id = r.course_id
        WHERE ${inRange('r.created_at')}
        GROUP BY c.group_id`.execute(this.database.db),
      sql<{ group_id: string; uses: number; users: number }>`
        SELECT e.group_id, count(*)::INT AS uses, count(DISTINCT u.user_id)::INT AS users
        FROM ai_usage u JOIN enrollments e ON e.user_id = u.user_id AND e.status = 'active'
        WHERE ${inRange('u.created_at')}
        GROUP BY e.group_id`.execute(this.database.db),
    ]);
    const byGroup = new Map<string, GroupMetrics>();
    const at = (id: string) => {
      let entry = byGroup.get(id);
      if (!entry) byGroup.set(id, (entry = empty()));
      return entry;
    };
    for (const r of grades.rows) Object.assign(at(r.group_id), { sumRatio: Number(r.sum_ratio), graded: Number(r.graded), passed: Number(r.passed) });
    for (const r of attendance.rows) Object.assign(at(r.group_id), { present: Number(r.present), late: Number(r.late), counted: Number(r.counted), absent: Number(r.absent) });
    for (const r of alerts.rows) Object.assign(at(r.group_id), { alerts: Number(r.alerts), high: Number(r.high) });
    for (const r of ai.rows) Object.assign(at(r.group_id), { aiUses: Number(r.uses), aiUsers: Number(r.users) });
    return byGroup;
  }

  async dashboard(periodParam: string | undefined) {
    const periods = await this.periods();
    if (!periods.length) throw new ApiError(409, 'NO_PERIODS', 'El año lectivo actual no tiene periodos');
    const today = bogotaToday();
    const year = { id: 'year', name: `Año ${periods[0]!.year}`, from: periods[0]!.yearFrom, to: periods[0]!.yearTo };
    const current = periods.find((p) => p.from <= today && today <= p.to);
    const period = periodParam === 'year' ? null : (periods.find((p) => p.id === periodParam) ?? current ?? null);
    const selected = period ?? year;
    const previous = period ? (periods.find((p) => p.position === period.position - 1) ?? null) : null;

    const [groups, now, before, aiByFeature, riskByKind] = await Promise.all([
      sql<{ id: string; level: number; grade_name: string; group_name: string; students: number }>`
        SELECT g.id, gr.level, gr.name AS grade_name, g.name AS group_name,
          (SELECT count(*) FROM enrollments e WHERE e.group_id = g.id AND e.status = 'active')::INT AS students
        FROM groups_class g JOIN grades gr ON gr.id = g.grade_id
        JOIN academic_years y ON y.id = g.academic_year_id AND y.is_current
        ORDER BY gr.level, g.name`.execute(this.database.db),
      this.metrics(selected),
      previous ? this.metrics(previous) : Promise.resolve(null),
      sql<{ feature: string; n: number }>`
        SELECT feature, count(*)::INT AS n FROM ai_usage
        WHERE (created_at AT TIME ZONE 'America/Bogota')::DATE BETWEEN ${selected.from}::DATE AND ${selected.to}::DATE
        GROUP BY feature ORDER BY n DESC`.execute(this.database.db),
      sql<{ kind: string; n: number }>`
        SELECT kind, count(*)::INT AS n FROM risk_alerts
        WHERE (created_at AT TIME ZONE 'America/Bogota')::DATE BETWEEN ${selected.from}::DATE AND ${selected.to}::DATE
        GROUP BY kind`.execute(this.database.db),
    ]);

    const total = empty();
    const totalBefore = empty();
    const byGrade = new Map<number, { name: string; metrics: GroupMetrics; students: number }>();
    const groupRows = groups.rows.map((g) => {
      const m = now.get(g.id) ?? empty();
      const p = before?.get(g.id) ?? null;
      add(total, m);
      if (p) add(totalBefore, p);
      const grade = byGrade.get(g.level) ?? { name: g.grade_name, metrics: empty(), students: 0 };
      add(grade.metrics, m);
      grade.students += Number(g.students);
      byGrade.set(g.level, grade);
      const s = summarize(m);
      const ps = p ? summarize(p) : null;
      return {
        id: g.id,
        name: `${g.grade_name} · ${g.group_name}`,
        grade: g.grade_name,
        students: Number(g.students),
        ...s,
        deltaAverage: ps ? delta(s.average, ps.average) : null,
        deltaPassRate: ps ? delta(s.passRate, ps.passRate) : null,
        deltaAttendance: ps ? delta(s.attendance, ps.attendance) : null,
      };
    });
    const overall = summarize(total);
    const overallBefore = before ? summarize(totalBefore) : null;
    return {
      periods: [year, ...periods.map((p) => ({ id: p.id, name: p.name, from: p.from, to: p.to }))],
      selected: { id: selected.id, name: selected.name, from: selected.from, to: selected.to, current: current?.id === selected.id },
      previous: previous ? { id: previous.id, name: previous.name } : null,
      overall: {
        ...overall,
        students: groupRows.reduce((sum, g) => sum + g.students, 0),
        deltaAverage: overallBefore ? delta(overall.average, overallBefore.average) : null,
        deltaPassRate: overallBefore ? delta(overall.passRate, overallBefore.passRate) : null,
        deltaAttendance: overallBefore ? delta(overall.attendance, overallBefore.attendance) : null,
        deltaAlerts: overallBefore ? overall.alerts - overallBefore.alerts : null,
        deltaAiUses: overallBefore ? overall.aiUses - overallBefore.aiUses : null,
      },
      byGrade: [...byGrade.entries()].sort(([a], [b]) => a - b).map(([level, g]) => ({ level, name: g.name, students: g.students, ...summarize(g.metrics) })),
      groups: groupRows,
      aiByFeature: aiByFeature.rows.map((r) => ({ feature: r.feature, uses: Number(r.n) })),
      riskByKind: riskByKind.rows.map((r) => ({ kind: r.kind, count: Number(r.n) })),
    };
  }

  /* ---------- Firmas ---------- */

  async signatures() {
    const [certificates, bulletins, recent] = await Promise.all([
      sql<{ id: string; code: string; title: string; issued_at: Date; student_id: string; student_name: string; course_title: string | null; requested_by: string | null }>`
        SELECT c.id, c.code, c.title, c.issued_at, c.user_id AS student_id, s.full_name AS student_name, co.title AS course_title, r.full_name AS requested_by
        FROM certificates c JOIN users s ON s.id = c.user_id
        LEFT JOIN courses co ON co.id = c.course_id
        LEFT JOIN users r ON r.id = c.requested_by
        WHERE c.status = 'pending_signature'
        ORDER BY c.issued_at`.execute(this.database.db),
      sql<{ id: string; created_at: Date; student_id: string; student_name: string; group_name: string | null; period_name: string | null; requested_by: string }>`
        SELECT b.id, b.created_at, b.student_id, s.full_name AS student_name,
          (SELECT gr.name || ' · ' || g.name FROM enrollments e JOIN groups_class g ON g.id = e.group_id JOIN grades gr ON gr.id = g.grade_id
            WHERE e.user_id = b.student_id AND e.status = 'active' LIMIT 1) AS group_name,
          p.name AS period_name, r.full_name AS requested_by
        FROM bulletin_signatures b JOIN users s ON s.id = b.student_id JOIN users r ON r.id = b.requested_by
        LEFT JOIN periods p ON p.id = b.period_id
        WHERE b.status = 'pending_signature'
        ORDER BY b.created_at`.execute(this.database.db),
      sql<{ kind: string; id: string; title: string; student_name: string; status: string; signed_at: Date; note: string | null }>`
        SELECT * FROM (
          SELECT 'certificate' AS kind, c.id, c.title, s.full_name AS student_name, c.status, c.signed_at, c.decision_note AS note
          FROM certificates c JOIN users s ON s.id = c.user_id WHERE c.signed_by IS NOT NULL
          UNION ALL
          SELECT 'bulletin' AS kind, b.id, 'Boletín ' || coalesce(p.name, ''), s.full_name, b.status, b.signed_at, b.decision_note
          FROM bulletin_signatures b JOIN users s ON s.id = b.student_id LEFT JOIN periods p ON p.id = b.period_id WHERE b.signed_by IS NOT NULL
        ) AS d ORDER BY signed_at DESC LIMIT 15`.execute(this.database.db),
    ]);
    return {
      certificates: certificates.rows.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        requestedAt: c.issued_at,
        student: { id: c.student_id, fullName: c.student_name },
        course: c.course_title,
        requestedBy: c.requested_by,
      })),
      bulletins: bulletins.rows.map((b) => ({
        id: b.id,
        requestedAt: b.created_at,
        student: { id: b.student_id, fullName: b.student_name },
        group: b.group_name,
        period: b.period_name,
        requestedBy: b.requested_by,
      })),
      recent: recent.rows.map((r) => ({ kind: r.kind, id: r.id, title: r.title.trim(), student: r.student_name, status: r.status, at: r.signed_at, note: r.note })),
    };
  }

  async decide(user: AuthUser, kind: 'certificate' | 'bulletin', id: string, input: { approve: boolean; note?: string }) {
    if (!input.approve && !input.note) throw new ApiError(400, 'NOTE_REQUIRED', 'Explica por qué se devuelve');
    const status = input.approve ? 'signed' : 'rejected';
    const decision = { status, signed_by: user.id, signed_at: new Date(), decision_note: input.note ?? null };
    let event: SignatureDecidedEvent;
    if (kind === 'certificate') {
      const row = await this.database.db
        .updateTable('certificates')
        .set(decision)
        .where('id', '=', id)
        .where('status', '=', 'pending_signature')
        .returning(['user_id', 'title', 'requested_by'])
        .executeTakeFirst();
      if (!row) throw new ApiError(409, 'NOT_PENDING', 'El certificado no está pendiente de firma');
      const student = await this.database.db.selectFrom('users').select('full_name').where('id', '=', row.user_id).executeTakeFirstOrThrow();
      event = { kind, requesterId: row.requested_by, studentId: row.user_id, title: row.title, studentName: student.full_name, approved: input.approve, note: input.note ?? null };
    } else {
      const row = await this.database.db
        .updateTable('bulletin_signatures')
        .set(decision)
        .where('id', '=', id)
        .where('status', '=', 'pending_signature')
        .returning(['student_id', 'requested_by', 'period_id'])
        .executeTakeFirst();
      if (!row) throw new ApiError(409, 'NOT_PENDING', 'El boletín no está pendiente de firma');
      const student = await this.database.db.selectFrom('users').select('full_name').where('id', '=', row.student_id).executeTakeFirstOrThrow();
      const period = row.period_id ? await this.database.db.selectFrom('periods').select('name').where('id', '=', row.period_id).executeTakeFirst() : null;
      event = {
        kind,
        requesterId: row.requested_by,
        studentId: row.student_id,
        title: `Boletín ${period?.name ?? ''}`.trim(),
        studentName: student.full_name,
        approved: input.approve,
        note: input.note ?? null,
      };
    }
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: user.id, action: `signature.${status}`, entity: kind === 'certificate' ? 'certificates' : 'bulletin_signatures', entity_id: id, meta: JSON.stringify({ note: input.note ?? null }) })
      .execute();
    this.events.emit(DomainEvents.SignatureDecided, event);
    return { ok: true, status };
  }

  /** El docente solo puede pedir boletines de sus estudiantes; coordinación y administración, de cualquiera. */
  async requestBulletin(user: AuthUser, studentId: string) {
    const student = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.id', 'users.full_name'])
      .where('users.id', '=', studentId)
      .where('user_roles.role', '=', 'student')
      .executeTakeFirst();
    if (!student) throw new ApiError(404, 'NOT_FOUND', 'El estudiante no existe');
    if (user.role === 'teacher') {
      const teaches = await sql<{ ok: number }>`
        SELECT 1 AS ok FROM courses c JOIN enrollments e ON e.group_id = c.group_id
        WHERE e.user_id = ${studentId} AND e.status = 'active' AND c.teacher_id = ${user.id} LIMIT 1`.execute(this.database.db);
      if (!teaches.rows.length) throw new ApiError(403, 'FORBIDDEN', 'Solo puedes pedir boletines de tus estudiantes');
    }
    const periods = await this.periods();
    const today = bogotaToday();
    const period = periods.find((p) => p.from <= today && today <= p.to) ?? periods.filter((p) => p.to < today).at(-1) ?? null;
    try {
      await this.database.db.insertInto('bulletin_signatures').values({ student_id: studentId, period_id: period?.id ?? null, requested_by: user.id }).execute();
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'ALREADY_PENDING', 'Ya hay un boletín de este estudiante esperando la firma de rectoría');
      throw error;
    }
    this.events.emit(DomainEvents.SignatureRequested, { kind: 'bulletin', title: `Boletín ${period?.name ?? ''}`.trim(), studentName: student.full_name } satisfies SignatureRequestedEvent);
    return { ok: true, status: 'pending_signature' };
  }

  async bulletinStatus(studentIds: string[]) {
    if (!studentIds.length) return {};
    const rows = await sql<{ student_id: string; status: string; at: Date }>`
      SELECT DISTINCT ON (student_id) student_id, status, coalesce(signed_at, created_at) AS at
      FROM bulletin_signatures WHERE student_id IN (${sql.join(studentIds)})
      ORDER BY student_id, created_at DESC`.execute(this.database.db);
    return Object.fromEntries(rows.rows.map((r) => [r.student_id, { status: r.status, at: r.at }]));
  }
}
