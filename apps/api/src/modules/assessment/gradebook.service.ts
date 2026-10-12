import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { GradeSource } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type RiskAlertRaisedEvent } from '../../core/events/domain-events';
import { renderPdf, renderWorkbook } from '../../core/reports/documents';
import { ReportLog } from '../../core/reports/report-log.service';
import { asIsoDate, bogotaToday } from '../../core/time';
import { LearningService } from '../learning/public-api';

export const DEFAULT_CATEGORIES: { name: string; source: GradeSource; weight: number }[] = [
  { name: 'Exámenes', source: 'exam', weight: 40 },
  { name: 'Prácticas', source: 'practice', weight: 20 },
  { name: 'Tareas', source: 'assignment', weight: 25 },
  { name: 'Asistencia', source: 'attendance', weight: 15 },
];

const SOURCE_LABEL: Record<string, string> = {
  exam: 'Exámenes', practice: 'Prácticas', live: 'En vivo', assignment: 'Tareas', rubric: 'Rúbricas', attendance: 'Asistencia',
};
const KIND_LABEL: Record<string, string> = {
  low_grade: 'Nota baja', absences: 'Inasistencias', integrity: 'Integridad', inactivity: 'Inactividad',
};

/** Escala colombiana 1.0 – 5.0 (Decreto 1290: cada colegio define la suya; aquí la del Francisco Arango). */
export const toGrade = (ratio: number) => Math.round((1 + 4 * Math.max(0, Math.min(1, ratio))) * 10) / 10;
export const performance = (grade: number | null) =>
  grade == null ? 'Sin notas' : grade >= 4.6 ? 'Superior' : grade >= 4.0 ? 'Alto' : grade >= 3.0 ? 'Básico' : 'Bajo';

type Ratios = Map<string, number[]>;
const push = (map: Ratios, key: string, value: number) => {
  if (!Number.isFinite(value)) return;
  const list = map.get(key) ?? [];
  list.push(Math.max(0, Math.min(1, value)));
  map.set(key, list);
};
const mean = (values: number[] | undefined) => (values?.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

interface ComputedRisk {
  studentId: string;
  kind: 'low_grade' | 'absences' | 'integrity' | 'inactivity';
  level: 'media' | 'alta';
  detail: string;
}

@Injectable()
export class GradebookService {
  constructor(
    private readonly database: DatabaseService,
    private readonly learning: LearningService,
    private readonly reports: ReportLog,
    private readonly events: EventEmitter2,
  ) {}

  private async staffCourse(user: AuthUser, courseId: string, mode: 'read' | 'write' = 'read') {
    if (user.role === 'student' || user.role === 'guardian') throw new ApiError(403, 'FORBIDDEN', 'Solo docentes, coordinación y rectoría');
    return this.learning.assertAccess(user, courseId, mode);
  }

  private students(course: { group_id: string; academic_year_id: string }) {
    return this.database.db
      .selectFrom('enrollments')
      .innerJoin('users', 'users.id', 'enrollments.user_id')
      .select(['users.id', 'users.full_name', 'users.email'])
      .where('enrollments.group_id', '=', course.group_id)
      .where('enrollments.academic_year_id', '=', course.academic_year_id)
      .where('enrollments.status', '=', 'active')
      .orderBy('users.full_name')
      .execute();
  }

  /* ---------- Ponderación ---------- */

  async categories(courseId: string) {
    const rows = await this.database.db
      .selectFrom('grade_categories')
      .select(['name', 'source', 'weight', 'position'])
      .where('course_id', '=', courseId)
      .orderBy('position')
      .execute();
    if (!rows.length) return { isDefault: true, categories: DEFAULT_CATEGORIES };
    return { isDefault: false, categories: rows.map((row) => ({ name: row.name, source: row.source as GradeSource, weight: Number(row.weight) })) };
  }

  async saveCategories(user: AuthUser, courseId: string, categories: { name: string; source: GradeSource; weight: number }[]) {
    await this.staffCourse(user, courseId, 'write');
    const sources = new Set(categories.map((c) => c.source));
    const names = new Set(categories.map((c) => c.name.toLowerCase()));
    if (sources.size !== categories.length) throw new ApiError(400, 'DUPLICATE_SOURCE', 'Cada fuente de nota puede aparecer una sola vez');
    if (names.size !== categories.length) throw new ApiError(400, 'DUPLICATE_NAME', 'Hay categorías con el mismo nombre');
    const sum = Math.round(categories.reduce((acc, c) => acc + c.weight, 0) * 100) / 100;
    if (sum !== 100) throw new ApiError(400, 'WEIGHTS_SUM', `Los pesos deben sumar 100 % (ahora suman ${sum} %)`, { sum });
    await this.database.withTx(async (trx) => {
      await trx.deleteFrom('grade_categories').where('course_id', '=', courseId).execute();
      await trx
        .insertInto('grade_categories')
        .values(categories.map((c, i) => ({ course_id: courseId, name: c.name, source: c.source, weight: c.weight.toFixed(2), position: i + 1 })))
        .execute();
    });
    return this.categories(courseId);
  }

  /* ---------- Cálculo de notas ---------- */

  private async ratios(courseId: string) {
    const bySource: Record<string, Ratios> = { exam: new Map(), practice: new Map(), live: new Map(), assignment: new Map(), rubric: new Map(), attendance: new Map() };

    const attempts = await sql<{ kind: string; user_id: string; ratio: number }>`
      SELECT a.kind, t.user_id, max(t.score::FLOAT / t.max_score::FLOAT) AS ratio
      FROM attempts t JOIN assessments a ON a.id = t.assessment_id
      WHERE a.course_id = ${courseId} AND t.status = 'completed' AND t.max_score > 0
      GROUP BY a.kind, t.user_id, a.id`.execute(this.database.db);
    for (const row of attempts.rows) if (bySource[row.kind]) push(bySource[row.kind]!, row.user_id, Number(row.ratio));

    const submissions = await sql<{ user_id: string; ratio: number }>`
      SELECT s.user_id, s.score::FLOAT / a.max_score::FLOAT AS ratio
      FROM submissions s JOIN assignments a ON a.id = s.assignment_id
      WHERE a.course_id = ${courseId} AND s.score IS NOT NULL AND a.max_score > 0`.execute(this.database.db);
    for (const row of submissions.rows) push(bySource.assignment!, row.user_id, Number(row.ratio));

    const rubrics = await sql<{ student_id: string; ratio: number }>`
      SELECT rs.student_id, sum(rs.points)::FLOAT / (SELECT sum(c.max_points) FROM rubric_criteria c WHERE c.rubric_id = rs.rubric_id)::FLOAT AS ratio
      FROM rubric_scores rs JOIN rubrics r ON r.id = rs.rubric_id
      WHERE r.course_id = ${courseId}
      GROUP BY rs.student_id, rs.rubric_id`.execute(this.database.db);
    for (const row of rubrics.rows) push(bySource.rubric!, row.student_id, Number(row.ratio));

    const attendance = await this.attendanceStats(courseId);
    for (const [studentId, stats] of attendance) {
      const counted = stats.total - stats.excused;
      if (counted > 0) push(bySource.attendance!, studentId, (stats.present + 0.5 * stats.late) / counted);
    }
    return { bySource, attendance };
  }

  private async attendanceStats(courseId: string) {
    const rows = await sql<{ student_id: string; present: number; late: number; absent: number; excused: number; total: number }>`
      SELECT student_id,
        sum(CASE WHEN status = 'present' THEN 1 ELSE 0 END)::INT AS present,
        sum(CASE WHEN status = 'late' THEN 1 ELSE 0 END)::INT AS late,
        sum(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::INT AS absent,
        sum(CASE WHEN status = 'excused' THEN 1 ELSE 0 END)::INT AS excused,
        count(*)::INT AS total
      FROM attendance WHERE course_id = ${courseId} GROUP BY student_id`.execute(this.database.db);
    return new Map(rows.rows.map((row) => [row.student_id, { present: Number(row.present), late: Number(row.late), absent: Number(row.absent), excused: Number(row.excused), total: Number(row.total) }]));
  }

  private async compute(user: AuthUser, courseId: string) {
    const course = await this.staffCourse(user, courseId);
    const [{ categories, isDefault }, students, { bySource, attendance }] = await Promise.all([this.categories(courseId), this.students(course), this.ratios(courseId)]);
    const rows = students.map((student) => {
      const grades: Record<string, number | null> = {};
      let weighted = 0;
      let weights = 0;
      for (const category of categories) {
        const ratio = mean(bySource[category.source]?.get(student.id));
        const grade = ratio == null ? null : toGrade(ratio);
        grades[category.source] = grade;
        if (grade != null) {
          weighted += grade * category.weight;
          weights += category.weight;
        }
      }
      const final = weights > 0 ? Math.round((weighted / weights) * 10) / 10 : null;
      const stats = attendance.get(student.id);
      return { id: student.id, fullName: student.full_name, email: student.email, grades, final, performance: performance(final), coverage: Math.round(weights), attendance: stats ?? null };
    });
    const graded = rows.filter((row) => row.final != null);
    return {
      course: { id: course.id, title: course.title, group: course.group_name, subject: course.subject_name, teacherId: course.teacher_id },
      categories,
      isDefault,
      students: rows,
      summary: {
        students: rows.length,
        graded: graded.length,
        average: graded.length ? Math.round((graded.reduce((acc, row) => acc + row.final!, 0) / graded.length) * 10) / 10 : null,
        below: graded.filter((row) => row.final! < 3).length,
      },
    };
  }

  async gradebook(user: AuthUser, courseId: string) {
    const book = await this.compute(user, courseId);
    await this.recomputeRisk(book);
    const alerts = await this.alerts(user, courseId);
    return { ...book, alerts: alerts.filter((alert) => alert.status !== 'resolved') };
  }

  /* ---------- Alertas de riesgo ---------- */

  private async recomputeRisk(book: Awaited<ReturnType<GradebookService['compute']>>) {
    const courseId = book.course.id;
    const ids = book.students.map((s) => s.id);
    if (!ids.length) return;
    const risks: ComputedRisk[] = [];

    for (const student of book.students) {
      if (student.final != null && student.final < 3) {
        risks.push({ studentId: student.id, kind: 'low_grade', level: student.final < 2.5 ? 'alta' : 'media', detail: `Nota ponderada ${student.final.toFixed(1)} (desempeño bajo)` });
      }
      const stats = student.attendance;
      if (stats && stats.total >= 3) {
        const rate = stats.absent / stats.total;
        if (rate >= 0.15) risks.push({ studentId: student.id, kind: 'absences', level: rate >= 0.25 ? 'alta' : 'media', detail: `${stats.absent} de ${stats.total} clases con inasistencia (${Math.round(rate * 100)} %)` });
      }
    }

    const since = new Date(Date.now() - 60 * 86_400_000);
    const integrity = await sql<{ user_id: string; n: number }>`
      SELECT e.user_id, count(*)::INT AS n
      FROM integrity_events e JOIN attempts t ON t.id = e.attempt_id JOIN assessments a ON a.id = t.assessment_id
      WHERE a.course_id = ${courseId} AND e.at > ${since}
      GROUP BY e.user_id`.execute(this.database.db);
    for (const row of integrity.rows) {
      const n = Number(row.n);
      if (n >= 3 && ids.includes(row.user_id)) risks.push({ studentId: row.user_id, kind: 'integrity', level: n >= 6 ? 'alta' : 'media', detail: `${n} eventos de integridad en los últimos 60 días` });
    }

    const activity = await sql<{ user_id: string; last: Date | null }>`
      SELECT u.id AS user_id, greatest(
        (SELECT max(x.created_at) FROM xp_ledger x WHERE x.user_id = u.id),
        (SELECT max(r.created_at) FROM refresh_tokens r WHERE r.user_id = u.id)
      ) AS last
      FROM users u WHERE u.id = ANY(${ids}::UUID[])`.execute(this.database.db);
    for (const row of activity.rows) {
      const days = row.last ? Math.floor((Date.now() - new Date(row.last).getTime()) / 86_400_000) : null;
      if (days == null || days >= 14) {
        risks.push({ studentId: row.user_id, kind: 'inactivity', level: days == null || days >= 30 ? 'alta' : 'media', detail: days == null ? 'No ha ingresado a la plataforma' : `Sin actividad hace ${days} días` });
      }
    }

    const live = await this.database.db.selectFrom('risk_alerts').selectAll().where('course_id', '=', courseId).where('status', '<>', 'resolved').execute();
    const snoozed = await this.database.db
      .selectFrom('risk_alerts')
      .select(['student_id', 'kind', 'level'])
      .where('course_id', '=', courseId)
      .where('status', '=', 'resolved')
      .where('resolved_by', 'is not', null)
      .where('resolved_at', '>', new Date(Date.now() - 14 * 86_400_000))
      .execute();
    const key = (studentId: string, kind: string) => `${studentId}|${kind}`;
    const liveByKey = new Map(live.map((alert) => [key(alert.student_id, alert.kind), alert]));
    // Una alerta cerrada a mano no reaparece en 14 días, salvo que suba de media a alta.
    const snoozedLevel = new Map(snoozed.map((alert) => [key(alert.student_id, alert.kind), alert.level]));
    const names = new Map(book.students.map((s) => [s.id, s.fullName]));
    const wanted = new Set<string>();

    for (const risk of risks) {
      const k = key(risk.studentId, risk.kind);
      wanted.add(k);
      const current = liveByKey.get(k);
      if (current) {
        const escalated = current.level === 'media' && risk.level === 'alta';
        if (current.level !== risk.level || current.detail !== risk.detail) {
          await this.database.db
            .updateTable('risk_alerts')
            .set({ level: risk.level, detail: risk.detail, ...(escalated ? { status: 'open' } : {}) })
            .where('id', '=', current.id)
            .execute();
        }
        if (escalated) this.raise(current.id, book, risk, names);
        continue;
      }
      const snoozedAt = snoozedLevel.get(k);
      if (snoozedAt === 'alta' || (snoozedAt === 'media' && risk.level === 'media')) continue;
      try {
        const created = await this.database.db
          .insertInto('risk_alerts')
          .values({ student_id: risk.studentId, course_id: courseId, kind: risk.kind, level: risk.level, detail: risk.detail })
          .returning(['id'])
          .executeTakeFirstOrThrow();
        this.raise(created.id, book, risk, names);
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
      }
    }

    const stale = live.filter((alert) => !wanted.has(key(alert.student_id, alert.kind)) && ids.includes(alert.student_id));
    if (stale.length) {
      await this.database.db
        .updateTable('risk_alerts')
        .set({ status: 'resolved', resolved_at: new Date(), resolved_by: null })
        .where('id', 'in', stale.map((alert) => alert.id))
        .execute();
    }
  }

  /** La inactividad solo se muestra en el panel: avisarla generaría ruido con cuentas que nunca han ingresado. */
  private raise(alertId: string, book: { course: { id: string; title: string; teacherId: string } }, risk: ComputedRisk, names: Map<string, string>) {
    if (risk.kind === 'inactivity') return;
    this.events.emit(DomainEvents.RiskAlertRaised, {
      alertId,
      courseId: book.course.id,
      courseTitle: book.course.title,
      teacherId: book.course.teacherId,
      studentId: risk.studentId,
      studentName: names.get(risk.studentId) ?? 'Estudiante',
      kind: KIND_LABEL[risk.kind] ?? risk.kind,
      level: risk.level,
      detail: risk.detail,
    } satisfies RiskAlertRaisedEvent);
  }

  async alerts(user: AuthUser, courseId: string) {
    await this.staffCourse(user, courseId);
    return this.database.db
      .selectFrom('risk_alerts')
      .innerJoin('users', 'users.id', 'risk_alerts.student_id')
      .select(['risk_alerts.id', 'risk_alerts.student_id', 'users.full_name', 'risk_alerts.kind', 'risk_alerts.level', 'risk_alerts.detail', 'risk_alerts.status', 'risk_alerts.created_at', 'risk_alerts.resolved_at'])
      .where('risk_alerts.course_id', '=', courseId)
      .orderBy(sql`CASE risk_alerts.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END`)
      .orderBy(sql`CASE risk_alerts.level WHEN 'alta' THEN 0 ELSE 1 END`)
      .orderBy('risk_alerts.created_at', 'desc')
      .limit(200)
      .execute();
  }

  async updateAlert(user: AuthUser, id: string, status: 'acknowledged' | 'resolved') {
    const alert = await this.database.db.selectFrom('risk_alerts').select(['course_id', 'status']).where('id', '=', id).executeTakeFirst();
    if (!alert) throw new ApiError(404, 'NOT_FOUND', 'La alerta no existe');
    await this.staffCourse(user, alert.course_id);
    if (alert.status === 'resolved') throw new ApiError(409, 'ALREADY_RESOLVED', 'La alerta ya está resuelta');
    await this.database.db
      .updateTable('risk_alerts')
      .set(status === 'resolved' ? { status, resolved_at: new Date(), resolved_by: user.id } : { status })
      .where('id', '=', id)
      .execute();
    return { ok: true };
  }

  /* ---------- Asistencia ---------- */

  async attendanceSheet(user: AuthUser, courseId: string, date?: string) {
    const course = await this.staffCourse(user, courseId);
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : bogotaToday();
    const [students, marks, sessions] = await Promise.all([
      this.students(course),
      this.database.db.selectFrom('attendance').select(['student_id', 'status', 'note']).where('course_id', '=', courseId).where('session_on', '=', day).execute(),
      sql<{ day: string; n: number; absent: number }>`
        SELECT session_on::STRING AS day, count(*)::INT AS n, sum(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)::INT AS absent
        FROM attendance WHERE course_id = ${courseId} GROUP BY session_on ORDER BY session_on DESC LIMIT 30`.execute(this.database.db),
    ]);
    const byStudent = new Map(marks.map((mark) => [mark.student_id, mark]));
    return {
      date: day,
      recorded: marks.length > 0,
      students: students.map((s) => ({ id: s.id, fullName: s.full_name, status: byStudent.get(s.id)?.status ?? null, note: byStudent.get(s.id)?.note ?? '' })),
      sessions: sessions.rows.map((row) => ({ date: asIsoDate(row.day), marked: Number(row.n), absent: Number(row.absent) })),
    };
  }

  async saveAttendance(user: AuthUser, courseId: string, input: { date: string; entries: { studentId: string; status: string; note?: string }[] }) {
    const course = await this.staffCourse(user, courseId, 'write');
    if (input.date > bogotaToday()) throw new ApiError(400, 'FUTURE_DATE', 'No se puede tomar asistencia de una fecha futura');
    const enrolled = new Set((await this.students(course)).map((s) => s.id));
    const foreign = input.entries.filter((entry) => !enrolled.has(entry.studentId));
    if (foreign.length) throw new ApiError(400, 'NOT_ENROLLED', 'Hay estudiantes que no pertenecen al curso');
    await this.database.db
      .insertInto('attendance')
      .values(input.entries.map((entry) => ({ course_id: courseId, student_id: entry.studentId, session_on: input.date, status: entry.status, note: entry.note ?? '', recorded_by: user.id })))
      .onConflict((oc) =>
        oc.columns(['course_id', 'student_id', 'session_on']).doUpdateSet((eb) => ({
          status: eb.ref('excluded.status'),
          note: eb.ref('excluded.note'),
          recorded_by: eb.ref('excluded.recorded_by'),
          recorded_at: new Date(),
        })),
      )
      .execute();
    return { saved: input.entries.length };
  }

  /* ---------- Rúbricas ---------- */

  async rubrics(user: AuthUser, courseId: string) {
    const course = await this.staffCourse(user, courseId);
    const [rubrics, criteria, scores, students, assignments] = await Promise.all([
      this.database.db.selectFrom('rubrics').leftJoin('assignments', 'assignments.id', 'rubrics.assignment_id').select(['rubrics.id', 'rubrics.title', 'rubrics.assignment_id', 'assignments.title as assignment_title', 'rubrics.created_at']).where('rubrics.course_id', '=', courseId).orderBy('rubrics.created_at', 'desc').execute(),
      this.database.db.selectFrom('rubric_criteria').innerJoin('rubrics', 'rubrics.id', 'rubric_criteria.rubric_id').select(['rubric_criteria.id', 'rubric_criteria.rubric_id', 'rubric_criteria.name', 'rubric_criteria.description', 'rubric_criteria.max_points', 'rubric_criteria.position']).where('rubrics.course_id', '=', courseId).orderBy('rubric_criteria.position').execute(),
      this.database.db.selectFrom('rubric_scores').innerJoin('rubrics', 'rubrics.id', 'rubric_scores.rubric_id').select(['rubric_scores.rubric_id', 'rubric_scores.criterion_id', 'rubric_scores.student_id', 'rubric_scores.points', 'rubric_scores.comment']).where('rubrics.course_id', '=', courseId).execute(),
      this.students(course),
      this.database.db.selectFrom('assignments').select(['id', 'title']).where('course_id', '=', courseId).orderBy('title').execute(),
    ]);
    return {
      assignments,
      students: students.map((s) => ({ id: s.id, fullName: s.full_name })),
      rubrics: rubrics.map((rubric) => {
        const own = criteria.filter((c) => c.rubric_id === rubric.id);
        const max = own.reduce((acc, c) => acc + c.max_points, 0);
        const ownScores = scores.filter((s) => s.rubric_id === rubric.id);
        const byStudent: Record<string, { points: Record<string, number>; comments: Record<string, string>; total: number; grade: number | null }> = {};
        for (const score of ownScores) {
          const entry = (byStudent[score.student_id] ??= { points: {}, comments: {}, total: 0, grade: null });
          entry.points[score.criterion_id] = score.points;
          if (score.comment) entry.comments[score.criterion_id] = score.comment;
          entry.total += score.points;
        }
        for (const entry of Object.values(byStudent)) entry.grade = max ? toGrade(entry.total / max) : null;
        return { ...rubric, maxPoints: max, criteria: own, scores: byStudent };
      }),
    };
  }

  async createRubric(user: AuthUser, courseId: string, input: { title: string; assignmentId?: string; criteria: { name: string; description?: string; maxPoints: number }[] }) {
    await this.staffCourse(user, courseId, 'write');
    if (input.assignmentId) {
      const assignment = await this.database.db.selectFrom('assignments').select('course_id').where('id', '=', input.assignmentId).executeTakeFirst();
      if (assignment?.course_id !== courseId) throw new ApiError(400, 'BAD_ASSIGNMENT', 'La tarea no pertenece al curso');
    }
    return this.database.withTx(async (trx) => {
      const rubric = await trx.insertInto('rubrics').values({ course_id: courseId, title: input.title, assignment_id: input.assignmentId ?? null, created_by: user.id }).returning(['id']).executeTakeFirstOrThrow();
      await trx
        .insertInto('rubric_criteria')
        .values(input.criteria.map((c, i) => ({ rubric_id: rubric.id, name: c.name, description: c.description ?? '', max_points: c.maxPoints, position: i + 1 })))
        .execute();
      return rubric;
    });
  }

  async deleteRubric(user: AuthUser, rubricId: string) {
    const rubric = await this.database.db.selectFrom('rubrics').select('course_id').where('id', '=', rubricId).executeTakeFirst();
    if (!rubric) throw new ApiError(404, 'NOT_FOUND', 'La rúbrica no existe');
    await this.staffCourse(user, rubric.course_id, 'write');
    await this.database.db.deleteFrom('rubrics').where('id', '=', rubricId).execute();
    return { ok: true };
  }

  async scoreRubric(user: AuthUser, rubricId: string, input: { studentId: string; scores: { criterionId: string; points: number; comment?: string }[] }) {
    const rubric = await this.database.db.selectFrom('rubrics').select('course_id').where('id', '=', rubricId).executeTakeFirst();
    if (!rubric) throw new ApiError(404, 'NOT_FOUND', 'La rúbrica no existe');
    const course = await this.staffCourse(user, rubric.course_id, 'write');
    const enrolled = (await this.students(course)).some((s) => s.id === input.studentId);
    if (!enrolled) throw new ApiError(400, 'NOT_ENROLLED', 'El estudiante no pertenece al curso');
    const criteria = new Map((await this.database.db.selectFrom('rubric_criteria').select(['id', 'max_points', 'name']).where('rubric_id', '=', rubricId).execute()).map((c) => [c.id, c]));
    for (const score of input.scores) {
      const criterion = criteria.get(score.criterionId);
      if (!criterion) throw new ApiError(400, 'BAD_CRITERION', 'Un criterio no pertenece a la rúbrica');
      if (score.points > criterion.max_points) throw new ApiError(400, 'POINTS_EXCEEDED', `«${criterion.name}» vale máximo ${criterion.max_points} puntos`);
    }
    await this.database.db
      .insertInto('rubric_scores')
      .values(input.scores.map((s) => ({ criterion_id: s.criterionId, student_id: input.studentId, rubric_id: rubricId, points: s.points, comment: s.comment ?? '', graded_by: user.id })))
      .onConflict((oc) =>
        oc.columns(['criterion_id', 'student_id']).doUpdateSet((eb) => ({
          points: eb.ref('excluded.points'),
          comment: eb.ref('excluded.comment'),
          graded_by: eb.ref('excluded.graded_by'),
          graded_at: new Date(),
        })),
      )
      .execute();
    const total = input.scores.reduce((acc, s) => acc + s.points, 0);
    const max = [...criteria.values()].reduce((acc, c) => acc + c.max_points, 0);
    return { total, max, grade: max ? toGrade(total / max) : null };
  }

  /* ---------- Reporte de calificaciones ---------- */

  async reportExcel(user: AuthUser, courseId: string) {
    const book = await this.gradebook(user, courseId);
    const meta = await this.reports.register({
      kind: 'calificaciones', format: 'xlsx', title: 'Libro de calificaciones', subtitle: `${book.course.title} · ${book.course.group}`,
      userId: user.id, params: { courseId }, rowCount: book.students.length,
      source: 'grade_categories, attempts, submissions, rubric_scores, attendance, risk_alerts, enrollments',
    });
    return renderWorkbook(meta, (h) => {
      h.sheet(
        'Notas',
        [
          { header: 'Estudiante', width: 30 },
          { header: 'Correo', width: 32 },
          ...book.categories.map((c) => ({ header: `${c.name} (${c.weight} %)`, width: 16, numFmt: '0.0' })),
          { header: 'Definitiva', width: 12, numFmt: '0.0' },
          { header: 'Desempeño', width: 12 },
          { header: '% con nota', width: 11 },
        ],
        book.students.map((s) => [s.fullName, s.email, ...book.categories.map((c) => s.grades[c.source] ?? null), s.final, s.performance, s.coverage]),
      );
      h.sheet(
        'Ponderación',
        [{ header: 'Categoría', width: 24 }, { header: 'Fuente', width: 16 }, { header: 'Peso %', width: 10 }],
        [...book.categories.map((c) => [c.name, SOURCE_LABEL[c.source] ?? c.source, c.weight]), ['Total', '', book.categories.reduce((acc, c) => acc + c.weight, 0)]],
      );
      h.sheet(
        'Alertas',
        [{ header: 'Estudiante', width: 30 }, { header: 'Tipo', width: 16 }, { header: 'Nivel', width: 10 }, { header: 'Detalle', width: 50 }, { header: 'Estado', width: 14 }],
        book.alerts.map((a) => [a.full_name, KIND_LABEL[a.kind] ?? a.kind, a.level, a.detail, a.status === 'open' ? 'Abierta' : 'En seguimiento']),
      );
    });
  }

  async reportPdf(user: AuthUser, courseId: string) {
    const book = await this.gradebook(user, courseId);
    const meta = await this.reports.register({
      kind: 'calificaciones', format: 'pdf', title: 'Libro de calificaciones', subtitle: `${book.course.title} · ${book.course.group}`,
      userId: user.id, params: { courseId }, rowCount: book.students.length,
      source: 'grade_categories, attempts, submissions, rubric_scores, attendance, risk_alerts, enrollments',
    });
    const counts = ['Superior', 'Alto', 'Básico', 'Bajo'].map((label) => [label, book.students.filter((s) => s.performance === label).length] as [string, number]);
    return renderPdf(meta, (_doc, h) => {
      h.section('Resumen');
      h.keyValues([
        ['Curso', `${book.course.title} (${book.course.subject})`],
        ['Grupo', book.course.group],
        ['Estudiantes', book.summary.students],
        ['Con nota', book.summary.graded],
        ['Promedio del curso', book.summary.average != null ? book.summary.average.toFixed(1) : '—'],
        ['Ponderación', book.categories.map((c) => `${c.name} ${c.weight} %`).join(' · ') + (book.isDefault ? ' (institucional)' : '')],
        ...counts,
      ]);
      h.section('Notas definitivas');
      h.table(
        [{ label: 'Estudiante', width: 3.4 }, ...book.categories.map((c) => ({ label: c.name, width: 1.2, align: 'right' as const })), { label: 'Def.', width: 0.9, align: 'right' }, { label: 'Desempeño', width: 1.4 }],
        book.students.map((s) => [s.fullName, ...book.categories.map((c) => (s.grades[c.source] != null ? s.grades[c.source]!.toFixed(1) : '—')), s.final != null ? s.final.toFixed(1) : '—', s.performance]),
        'El curso no tiene estudiantes matriculados.',
      );
      h.section('Alertas de riesgo abiertas');
      h.table(
        [{ label: 'Estudiante', width: 3 }, { label: 'Tipo', width: 1.6 }, { label: 'Nivel', width: 1 }, { label: 'Detalle', width: 4 }],
        book.alerts.map((a) => [a.full_name, KIND_LABEL[a.kind] ?? a.kind, a.level, a.detail]),
        'No hay alertas abiertas.',
      );
      h.paragraph('Escala 1.0 a 5.0 · Superior 4.6-5.0 · Alto 4.0-4.5 · Básico 3.0-3.9 · Bajo menos de 3.0. La definitiva pondera solo las categorías con notas.', { muted: true, size: 9 });
    });
  }
}
