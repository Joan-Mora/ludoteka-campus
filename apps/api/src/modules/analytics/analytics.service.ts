import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { renderPdf, renderWorkbook } from '../../core/reports/documents';
import { ReportLog } from '../../core/reports/report-log.service';
import { unreadNewsCount } from '../learning/public-api';

const pct = (score: number, max: number) => (max > 0 ? Math.round((score * 100) / max) : 0);
const day = (value: Date | string | null | undefined) => (value ? new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '—');
const when = (value: Date | string | null | undefined) => (value ? new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }) : '—');

const violationLabel: Record<string, string> = {
  fullscreen_exit: 'Salió de pantalla completa',
  visibility_hidden: 'Cambió de pestaña',
  blur: 'Perdió el foco',
  escape: 'Presionó Escape',
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly reports: ReportLog,
  ) {}

  private async courseFor(viewer: AuthUser, courseId: string) {
    const course = await this.database.db
      .selectFrom('courses')
      .innerJoin('groups_class', 'groups_class.id', 'courses.group_id')
      .innerJoin('users', 'users.id', 'courses.teacher_id')
      .select(['courses.id', 'courses.title', 'courses.group_id', 'courses.teacher_id', 'groups_class.name as group_name', 'users.full_name as teacher_name'])
      .where('courses.id', '=', courseId)
      .executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    if (viewer.role === 'teacher' && course.teacher_id !== viewer.id) throw new ApiError(403, 'FORBIDDEN', 'Solo el docente del curso ve sus reportes');
    return course;
  }

  private async assertStudentAccess(viewer: AuthUser, studentId: string) {
    if (['admin', 'directivo'].includes(viewer.role) || viewer.id === studentId) return;
    if (viewer.role === 'teacher') {
      const teaches = await this.database.db
        .selectFrom('enrollments')
        .innerJoin('teaching_assignments', 'teaching_assignments.group_id', 'enrollments.group_id')
        .select('enrollments.id')
        .where('enrollments.user_id', '=', studentId)
        .where('teaching_assignments.teacher_id', '=', viewer.id)
        .executeTakeFirst();
      if (teaches) return;
    }
    if (viewer.role === 'guardian') {
      const linked = await sql<{ ok: number }>`SELECT 1 AS ok FROM guardian_links WHERE guardian_id = ${viewer.id} AND student_id = ${studentId} AND status = 'active' LIMIT 1`
        .execute(this.database.db)
        .catch(() => ({ rows: [] }));
      if (linked.rows.length) return;
    }
    throw new ApiError(403, 'FORBIDDEN', 'No tienes acceso al boletín de este estudiante');
  }

  async course(viewer: AuthUser, courseId: string) {
    const course = await this.courseFor(viewer, courseId);
    const attempts = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(sql<number>`coalesce(avg(case when attempts.max_score > 0 then attempts.score * 100.0 / attempts.max_score end), 0)`.as('avg'))
      .where('assessments.course_id', '=', courseId)
      .where('attempts.status', '=', 'completed')
      .executeTakeFirstOrThrow();
    const lessons = await this.database.db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .select(sql<number>`count(*)`.as('n'))
      .where('units.course_id', '=', courseId)
      .executeTakeFirstOrThrow();
    const flags = await this.database.db
      .selectFrom('attempt_flags')
      .innerJoin('attempts', 'attempts.id', 'attempt_flags.attempt_id')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(sql<number>`count(*)`.as('n'))
      .where('assessments.course_id', '=', courseId)
      .where('attempt_flags.flagged', '=', true)
      .executeTakeFirstOrThrow();
    return {
      courseId,
      title: course.title,
      average: Math.round(Number(attempts.avg)),
      lessons: Number(lessons.n),
      flaggedAttempts: Number(flags.n),
    };
  }

  async institution() {
    const byGrade = await this.database.db
      .selectFrom('grades')
      .leftJoin('groups_class', 'groups_class.grade_id', 'grades.id')
      .leftJoin('enrollments', 'enrollments.group_id', 'groups_class.id')
      .select(['grades.level', 'grades.name', sql<number>`count(enrollments.id)`.as('students')])
      .groupBy(['grades.level', 'grades.name'])
      .orderBy('grades.level')
      .execute();
    const usage = await this.database.db
      .selectFrom('ai_usage')
      .select(['feature', sql<number>`count(*)`.as('n')])
      .where('created_at', '>', new Date(Date.now() - 30 * 86400000))
      .groupBy('feature')
      .orderBy(sql`count(*)`, 'desc')
      .execute();
    return {
      byGrade: byGrade.map((row) => ({ ...row, students: Number(row.students) })),
      aiUsage: usage.map((row) => ({ feature: row.feature, uses: Number(row.n) })),
    };
  }

  private async count(query: ReturnType<typeof sql<{ n: string | number }>>) {
    const result = await query.execute(this.database.db).catch(() => ({ rows: [] as { n: string | number }[] }));
    return Number(result.rows[0]?.n ?? 0);
  }

  /** Live counters for each campus building, scoped to what the viewer can see. */
  async campus(viewer: AuthUser) {
    const today = sql`(now() AT TIME ZONE 'America/Bogota')::DATE`;
    const studentCourses = sql`SELECT c.id FROM courses c JOIN enrollments e ON e.group_id = c.group_id WHERE e.user_id = ${viewer.id} AND e.status = 'active'`;
    const isStudent = viewer.role === 'student';
    const isTeacher = viewer.role === 'teacher';
    const isBoard = viewer.role === 'admin' || viewer.role === 'directivo';

    const [aula, cartelera, arena, trofeos, lab, biblioteca, cuaderno, ruta] = await Promise.all([
      isStudent
        ? this.count(sql`SELECT count(*) AS n FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.published AND u.course_id IN (${studentCourses})
            AND NOT EXISTS (SELECT 1 FROM lesson_progress p WHERE p.lesson_id = l.id AND p.user_id = ${viewer.id} AND p.status = 'completed')`)
        : isTeacher
          ? this.count(sql`SELECT count(*) AS n FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id WHERE c.teacher_id = ${viewer.id} AND s.status = 'submitted'`)
          : this.count(sql`SELECT count(*) AS n FROM courses`),
      Promise.all([
        this.count(sql`SELECT count(*) AS n FROM notifications WHERE user_id = ${viewer.id} AND read_at IS NULL`),
        this.count(unreadNewsCount(viewer)),
      ]).then(([notes, news]) => notes + news),
      isStudent
        ? this.count(sql`SELECT (SELECT count(*) FROM live_sessions ls JOIN assessments a ON a.id = ls.assessment_id WHERE ls.status <> 'ended' AND a.course_id IN (${studentCourses}))
            + (SELECT count(*) FROM arena_rooms WHERE status <> 'ended' AND course_id IN (${studentCourses})) AS n`)
        : this.count(sql`SELECT (SELECT count(*) FROM live_sessions WHERE status <> 'ended' ${isBoard ? sql`` : sql`AND host_id = ${viewer.id}`})
            + (SELECT count(*) FROM arena_rooms WHERE status <> 'ended' ${isBoard ? sql`` : sql`AND host_id = ${viewer.id}`}) AS n`),
      isStudent
        ? this.count(sql`SELECT count(*) AS n FROM user_badges WHERE user_id = ${viewer.id}`)
        : this.count(sql`SELECT count(*) AS n FROM certificates ${isBoard ? sql`` : sql`WHERE course_id IN (SELECT id FROM courses WHERE teacher_id = ${viewer.id})`}`),
      this.count(sql`SELECT count(*) AS n FROM ai_usage WHERE ${isBoard ? sql`true` : sql`user_id = ${viewer.id}`} AND (created_at AT TIME ZONE 'America/Bogota')::DATE = ${today}`),
      this.count(sql`SELECT count(*) AS n FROM library_items WHERE status = 'published'`),
      this.count(sql`SELECT count(*) AS n FROM flashcards WHERE user_id = ${viewer.id} AND due_on <= ${today}`),
      this.count(sql`SELECT count(*) AS n FROM route_items WHERE user_id = ${viewer.id} AND status = 'pending'`),
    ]);

    const [lessonsToday, attemptsToday, online] = await Promise.all([
      this.count(sql`SELECT count(*) AS n FROM lesson_progress WHERE status = 'completed' AND (completed_at AT TIME ZONE 'America/Bogota')::DATE = ${today}`),
      this.count(sql`SELECT count(*) AS n FROM attempts WHERE (started_at AT TIME ZONE 'America/Bogota')::DATE = ${today}`),
      this.count(sql`SELECT count(DISTINCT user_id) AS n FROM refresh_tokens WHERE revoked_at IS NULL AND created_at > now() - INTERVAL '30 minutes'`),
    ]);

    return {
      buildings: { aula, cartelera, arena, trofeos, lab, biblioteca, cuaderno, ruta },
      pulse: { lessonsToday, attemptsToday, online },
    };
  }

  /** Compact progress card for a student, shown to the student's guardians and teachers. */
  async studentOverview(viewer: AuthUser, studentId: string) {
    await this.assertStudentAccess(viewer, studentId);
    const courses = sql`SELECT c.id FROM courses c JOIN enrollments e ON e.group_id = c.group_id WHERE e.user_id = ${studentId} AND e.status = 'active' AND c.published`;
    const [lessonsDone, lessonsTotal, xp, badges, flagged, pending] = await Promise.all([
      this.count(sql`SELECT count(*) AS n FROM lesson_progress WHERE user_id = ${studentId} AND status = 'completed'`),
      this.count(sql`SELECT count(*) AS n FROM lessons l JOIN units u ON u.id = l.unit_id WHERE l.published AND u.course_id IN (${courses})`),
      this.count(sql`SELECT coalesce(sum(amount), 0) AS n FROM xp_ledger WHERE user_id = ${studentId}`),
      this.count(sql`SELECT count(*) AS n FROM user_badges WHERE user_id = ${studentId}`),
      this.count(sql`SELECT count(*) AS n FROM attempt_flags f JOIN attempts a ON a.id = f.attempt_id WHERE a.user_id = ${studentId} AND f.flagged`),
      this.count(sql`SELECT count(*) AS n FROM assignments a WHERE a.course_id IN (${courses})
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.user_id = ${studentId})`),
    ]);
    const recent = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .innerJoin('courses', 'courses.id', 'assessments.course_id')
      .select(['attempts.id', 'assessments.title', 'assessments.kind', 'courses.title as course', 'attempts.score', 'attempts.max_score', 'attempts.submitted_at'])
      .where('attempts.user_id', '=', studentId)
      .where('attempts.status', '=', 'completed')
      .orderBy('attempts.submitted_at', 'desc')
      .limit(6)
      .execute();
    const last = await sql<{ at: Date | null }>`SELECT greatest(
        (SELECT max(completed_at) FROM lesson_progress WHERE user_id = ${studentId}),
        (SELECT max(started_at) FROM attempts WHERE user_id = ${studentId})
      ) AS at`.execute(this.database.db);
    const average = recent.length ? Math.round(recent.reduce((sum, r) => sum + pct(r.score, r.max_score), 0) / recent.length) : null;
    return {
      lessons: { completed: lessonsDone, total: lessonsTotal },
      xp,
      badges,
      flaggedAttempts: flagged,
      pendingAssignments: pending,
      average,
      lastActivity: last.rows[0]?.at ?? null,
      recent: recent.map((r) => ({ id: r.id, title: r.title, kind: r.kind, course: r.course, percent: pct(r.score, r.max_score), at: r.submitted_at })),
    };
  }

  async bulletin(viewer: AuthUser, userId: string) {
    await this.assertStudentAccess(viewer, userId);
    const user = await this.database.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'El estudiante no existe');
    const group = await this.database.db
      .selectFrom('enrollments')
      .innerJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select(['groups_class.name as group_name', 'grades.name as grade_name'])
      .where('enrollments.user_id', '=', userId)
      .where('enrollments.status', '=', 'active')
      .executeTakeFirst();
    const attempts = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .innerJoin('courses', 'courses.id', 'assessments.course_id')
      .select(['courses.title as course', 'assessments.title as assessment', 'assessments.kind', 'attempts.score', 'attempts.max_score', 'attempts.status', 'attempts.submitted_at'])
      .where('attempts.user_id', '=', userId)
      .orderBy('attempts.started_at', 'desc')
      .execute();
    const byCourse = new Map<string, { sum: number; n: number }>();
    for (const row of attempts) {
      if (row.status !== 'completed') continue;
      const entry = byCourse.get(row.course) ?? { sum: 0, n: 0 };
      entry.sum += pct(row.score, row.max_score);
      entry.n += 1;
      byCourse.set(row.course, entry);
    }
    const lessons = await this.database.db
      .selectFrom('lesson_progress')
      .select(sql<number>`count(*)`.as('n'))
      .where('user_id', '=', userId)
      .where('status', '=', 'completed')
      .executeTakeFirstOrThrow();
    const xp = await this.database.db.selectFrom('xp_ledger').select(sql<number>`coalesce(sum(amount), 0)`.as('xp')).where('user_id', '=', userId).executeTakeFirstOrThrow();
    const badges = await this.database.db
      .selectFrom('user_badges')
      .innerJoin('badges', 'badges.id', 'user_badges.badge_id')
      .select(['badges.name', 'user_badges.awarded_at'])
      .where('user_badges.user_id', '=', userId)
      .execute();
    const meta = await this.reports.register({
      kind: 'boletin',
      format: 'pdf',
      title: 'Boletín de desempeño',
      subtitle: user.full_name,
      userId: viewer.id,
      params: { studentId: userId },
      rowCount: attempts.length,
      source: 'users, enrollments, attempts, assessments, courses, lesson_progress, xp_ledger, user_badges',
    });
    return renderPdf(meta, (_doc, h) => {
      h.section('Estudiante');
      h.keyValues([
        ['Nombre', user.full_name],
        ['Correo', user.email],
        ['Grupo', group ? `${group.grade_name} · ${group.group_name}` : 'Sin matrícula activa'],
        ['Lecciones completadas', Number(lessons.n)],
        ['Experiencia acumulada', `${Number(xp.xp)} XP`],
        ['Insignias', badges.length ? badges.map((b) => b.name).join(', ') : 'Ninguna todavía'],
      ]);
      h.section('Promedio por curso');
      h.table(
        [{ label: 'Curso', width: 4 }, { label: 'Evaluaciones', width: 1.4, align: 'right' }, { label: 'Promedio', width: 1.4, align: 'right' }, { label: 'Desempeño', width: 1.8 }],
        [...byCourse.entries()].map(([course, entry]) => {
          const avg = Math.round(entry.sum / entry.n);
          return [course, entry.n, `${avg}%`, avg >= 90 ? 'Superior' : avg >= 75 ? 'Alto' : avg >= 60 ? 'Básico' : 'Bajo'];
        }),
      );
      h.section('Detalle de evaluaciones');
      h.table(
        [{ label: 'Curso', width: 2.4 }, { label: 'Evaluación', width: 3 }, { label: 'Tipo', width: 1.2 }, { label: 'Puntaje', width: 1.2, align: 'right' }, { label: 'Fecha', width: 1.4 }],
        attempts.map((row) => [row.course, row.assessment, row.kind === 'exam' ? 'Examen' : row.kind === 'live' ? 'En vivo' : 'Práctica', row.status === 'completed' ? `${row.score}/${row.max_score}` : 'En curso', day(row.submitted_at)]),
      );
      h.paragraph('Escala institucional: Superior 90-100 · Alto 75-89 · Básico 60-74 · Bajo menos de 60.', { muted: true, size: 9 });
    });
  }

  async courseExcel(viewer: AuthUser, courseId: string) {
    const course = await this.courseFor(viewer, courseId);
    const students = await this.database.db
      .selectFrom('enrollments')
      .innerJoin('users', 'users.id', 'enrollments.user_id')
      .select(['users.id', 'users.full_name', 'users.email'])
      .where('enrollments.group_id', '=', course.group_id)
      .where('enrollments.status', '=', 'active')
      .orderBy('users.full_name')
      .execute();
    const ids = students.map((student) => student.id);
    const totalLessons = await this.database.db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .select(sql<number>`count(*)`.as('n'))
      .where('units.course_id', '=', courseId)
      .executeTakeFirstOrThrow();
    const progress = ids.length
      ? await this.database.db
          .selectFrom('lesson_progress')
          .innerJoin('lessons', 'lessons.id', 'lesson_progress.lesson_id')
          .innerJoin('units', 'units.id', 'lessons.unit_id')
          .select(['lesson_progress.user_id', sql<number>`count(*)`.as('n')])
          .where('units.course_id', '=', courseId)
          .where('lesson_progress.status', '=', 'completed')
          .where('lesson_progress.user_id', 'in', ids)
          .groupBy('lesson_progress.user_id')
          .execute()
      : [];
    const scores = ids.length
      ? await this.database.db
          .selectFrom('attempts')
          .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
          .select(['attempts.user_id', sql<number>`avg(case when attempts.max_score > 0 then attempts.score * 100.0 / attempts.max_score end)`.as('avg'), sql<number>`count(*)`.as('n')])
          .where('assessments.course_id', '=', courseId)
          .where('attempts.status', '=', 'completed')
          .where('attempts.user_id', 'in', ids)
          .groupBy('attempts.user_id')
          .execute()
      : [];
    const submissions = ids.length
      ? await this.database.db
          .selectFrom('submissions')
          .innerJoin('assignments', 'assignments.id', 'submissions.assignment_id')
          .select(['submissions.user_id', sql<number>`count(*)`.as('n')])
          .where('assignments.course_id', '=', courseId)
          .where('submissions.user_id', 'in', ids)
          .groupBy('submissions.user_id')
          .execute()
      : [];
    const xp = ids.length
      ? await this.database.db.selectFrom('xp_ledger').select(['user_id', sql<number>`sum(amount)`.as('xp')]).where('user_id', 'in', ids).groupBy('user_id').execute()
      : [];
    const assessments = await this.database.db
      .selectFrom('assessments')
      .leftJoin('attempts', (join) => join.onRef('attempts.assessment_id', '=', 'assessments.id').on('attempts.status', '=', 'completed'))
      .select([
        'assessments.title',
        'assessments.kind',
        sql<number>`count(attempts.id)`.as('n'),
        sql<number>`coalesce(avg(case when attempts.max_score > 0 then attempts.score * 100.0 / attempts.max_score end), 0)`.as('avg'),
      ])
      .where('assessments.course_id', '=', courseId)
      .groupBy(['assessments.id', 'assessments.title', 'assessments.kind'])
      .execute();
    const find = <T extends { user_id: string }>(rows: T[], id: string) => rows.find((row) => row.user_id === id);
    const meta = await this.reports.register({
      kind: 'curso',
      format: 'xlsx',
      title: 'Reporte de curso',
      subtitle: `${course.title} · ${course.group_name}`,
      userId: viewer.id,
      params: { courseId },
      rowCount: students.length,
      source: 'courses, enrollments, lesson_progress, attempts, submissions, xp_ledger',
    });
    return renderWorkbook(meta, (h) => {
      h.sheet(
        'Estudiantes',
        [
          { header: 'Estudiante', width: 30 },
          { header: 'Correo', width: 32 },
          { header: 'Lecciones', width: 12 },
          { header: '% avance', width: 11, numFmt: '0%' },
          { header: 'Evaluaciones', width: 13 },
          { header: 'Promedio %', width: 12 },
          { header: 'Entregas', width: 10 },
          { header: 'XP', width: 9 },
        ],
        students.map((student) => {
          const done = Number(find(progress, student.id)?.n ?? 0);
          const score = find(scores, student.id);
          return [
            student.full_name,
            student.email,
            `${done}/${Number(totalLessons.n)}`,
            Number(totalLessons.n) ? done / Number(totalLessons.n) : 0,
            Number(score?.n ?? 0),
            score ? Math.round(Number(score.avg)) : null,
            Number(find(submissions, student.id)?.n ?? 0),
            Number(find(xp, student.id)?.xp ?? 0),
          ];
        }),
        `${course.title} · Docente ${course.teacher_name}`,
      );
      h.sheet(
        'Evaluaciones',
        [{ header: 'Evaluación', width: 40 }, { header: 'Tipo', width: 12 }, { header: 'Intentos', width: 10 }, { header: 'Promedio %', width: 12 }],
        assessments.map((row) => [row.title, row.kind, Number(row.n), Math.round(Number(row.avg))]),
      );
    });
  }

  async assessmentExcel(viewer: AuthUser, assessmentId: string) {
    const assessment = await this.database.db.selectFrom('assessments').selectAll().where('id', '=', assessmentId).executeTakeFirst();
    if (!assessment) throw new ApiError(404, 'NOT_FOUND', 'La evaluación no existe');
    await this.courseFor(viewer, assessment.course_id);
    const rows = await this.database.db
      .selectFrom('attempts')
      .innerJoin('users', 'users.id', 'attempts.user_id')
      .select(['users.full_name', 'users.email', 'attempts.score', 'attempts.max_score', 'attempts.status', 'attempts.submitted_at'])
      .where('attempts.assessment_id', '=', assessmentId)
      .orderBy('users.full_name')
      .execute();
    const meta = await this.reports.register({
      kind: 'evaluacion', format: 'xlsx', title: 'Resultados de evaluación', subtitle: assessment.title,
      userId: viewer.id, params: { assessmentId }, rowCount: rows.length, source: 'attempts, users, assessments',
    });
    return renderWorkbook(meta, (h) => {
      h.sheet(
        'Resultados',
        [{ header: 'Estudiante', width: 30 }, { header: 'Correo', width: 32 }, { header: 'Puntaje', width: 10 }, { header: 'Máximo', width: 10 }, { header: '%', width: 8 }, { header: 'Estado', width: 12 }, { header: 'Entrega', width: 20 }],
        rows.map((row) => [row.full_name, row.email, row.score, row.max_score, pct(row.score, row.max_score), row.status, when(row.submitted_at)]),
      );
    });
  }

  private integrityEvents(courseId: string) {
    return this.database.db
      .selectFrom('integrity_events')
      .innerJoin('users', 'users.id', 'integrity_events.user_id')
      .innerJoin('attempts', 'attempts.id', 'integrity_events.attempt_id')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .leftJoin('attempt_flags', 'attempt_flags.attempt_id', 'attempts.id')
      .select(['users.full_name', 'users.email', 'integrity_events.type', 'integrity_events.at', 'assessments.title', 'attempt_flags.suspended'])
      .where('assessments.course_id', '=', courseId)
      .orderBy('integrity_events.at', 'desc')
      .execute();
  }

  async integrityPdf(viewer: AuthUser, courseId: string) {
    const course = await this.courseFor(viewer, courseId);
    const events = await this.integrityEvents(courseId);
    const byStudent = new Map<string, { n: number; suspended: boolean }>();
    const byType = new Map<string, number>();
    for (const event of events) {
      const entry = byStudent.get(event.full_name) ?? { n: 0, suspended: false };
      entry.n += 1;
      entry.suspended ||= Boolean(event.suspended);
      byStudent.set(event.full_name, entry);
      byType.set(event.type, (byType.get(event.type) ?? 0) + 1);
    }
    const meta = await this.reports.register({
      kind: 'integridad', format: 'pdf', title: 'Integridad académica', subtitle: `${course.title} · ${course.group_name}`,
      userId: viewer.id, params: { courseId }, rowCount: events.length, source: 'integrity_events, attempts, attempt_flags, assessments, users',
    });
    return renderPdf(meta, (_doc, h) => {
      h.section('Resumen');
      h.keyValues([
        ['Curso', course.title],
        ['Docente', course.teacher_name],
        ['Eventos registrados', events.length],
        ['Estudiantes con eventos', byStudent.size],
        ['Intentos suspendidos', [...byStudent.values()].filter((entry) => entry.suspended).length],
      ]);
      h.section('Eventos por tipo');
      h.table([{ label: 'Tipo de evento', width: 4 }, { label: 'Cantidad', width: 1.2, align: 'right' }], [...byType.entries()].map(([type, n]) => [violationLabel[type] ?? type, n]));
      h.section('Estudiantes');
      h.table(
        [{ label: 'Estudiante', width: 4 }, { label: 'Eventos', width: 1.2, align: 'right' }, { label: 'Estado', width: 2 }],
        [...byStudent.entries()].sort((a, b) => b[1].n - a[1].n).map(([name, entry]) => [name, entry.n, entry.suspended ? 'Suspendido' : 'En revisión']),
      );
      h.section('Bitácora de eventos');
      h.table(
        [{ label: 'Fecha', width: 1.8 }, { label: 'Estudiante', width: 2.6 }, { label: 'Evaluación', width: 2.6 }, { label: 'Evento', width: 2.2 }],
        events.slice(0, 200).map((event) => [when(event.at), event.full_name, event.title, violationLabel[event.type] ?? event.type]),
        'No hay eventos de integridad para este curso.',
      );
    });
  }

  async integrityExcel(viewer: AuthUser, courseId: string) {
    const course = await this.courseFor(viewer, courseId);
    const events = await this.integrityEvents(courseId);
    const meta = await this.reports.register({
      kind: 'integridad', format: 'xlsx', title: 'Integridad académica', subtitle: course.title,
      userId: viewer.id, params: { courseId }, rowCount: events.length, source: 'integrity_events, attempts, assessments, users',
    });
    return renderWorkbook(meta, (h) => {
      h.sheet(
        'Integridad',
        [{ header: 'Fecha', width: 20 }, { header: 'Estudiante', width: 30 }, { header: 'Correo', width: 32 }, { header: 'Evaluación', width: 34 }, { header: 'Evento', width: 26 }, { header: 'Suspendido', width: 12 }],
        events.map((event) => [when(event.at), event.full_name, event.email, event.title, violationLabel[event.type] ?? event.type, event.suspended ? 'Sí' : 'No']),
      );
    });
  }

  async usageExcel(viewer: AuthUser, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const byFeature = await this.database.db
      .selectFrom('ai_usage')
      .select(['feature', sql<number>`count(*)`.as('n'), sql<number>`count(DISTINCT user_id)`.as('users'), sql<string>`max(created_at)`.as('last')])
      .where('created_at', '>', since)
      .groupBy('feature')
      .orderBy(sql`count(*)`, 'desc')
      .execute();
    const byModel = await this.database.db
      .selectFrom('ai_usage')
      .select(['model', sql<number>`count(*)`.as('n')])
      .where('created_at', '>', since)
      .groupBy('model')
      .orderBy(sql`count(*)`, 'desc')
      .execute();
    const byDay = await this.database.db
      .selectFrom('ai_usage')
      .select([sql<string>`(created_at AT TIME ZONE 'America/Bogota')::DATE::STRING`.as('day'), sql<number>`count(*)`.as('n')])
      .where('created_at', '>', since)
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .execute();
    const library = await this.libraryUsage(since);
    const meta = await this.reports.register({
      kind: 'uso', format: 'xlsx', title: 'Uso de biblioteca e IA', subtitle: `Últimos ${days} días`,
      userId: viewer.id, params: { days }, rowCount: byFeature.length + library.items.length,
      source: 'ai_usage, library_items, library_views, bookmarks',
    });
    return renderWorkbook(meta, (h) => {
      h.sheet('IA por funcionalidad', [{ header: 'Funcionalidad', width: 30 }, { header: 'Usos', width: 10 }, { header: 'Usuarios distintos', width: 18 }, { header: 'Último uso', width: 20 }],
        byFeature.map((row) => [row.feature, Number(row.n), Number(row.users), when(row.last)]));
      h.sheet('IA por modelo', [{ header: 'Modelo', width: 30 }, { header: 'Usos', width: 10 }], byModel.map((row) => [row.model, Number(row.n)]));
      h.sheet('IA por día', [{ header: 'Día', width: 14 }, { header: 'Usos', width: 10 }], byDay.map((row) => [row.day, Number(row.n)]));
      h.sheet('Biblioteca', [{ header: 'Recurso', width: 40 }, { header: 'Materia', width: 22 }, { header: 'Tipo', width: 10 }, { header: 'Vistas', width: 10 }, { header: 'Marcadores', width: 12 }],
        library.items.map((row) => [row.title, row.subject, row.kind, row.views, row.bookmarks]));
    });
  }

  private async libraryUsage(since: Date) {
    try {
      const result = await sql<{ title: string; subject: string; kind: string; views: number; bookmarks: number }>`
        SELECT li.title, s.name AS subject, li.kind,
          (SELECT count(*) FROM library_views lv WHERE lv.item_id = li.id AND lv.viewed_at > ${since})::INT AS views,
          (SELECT count(*) FROM bookmarks b WHERE b.item_id = li.id)::INT AS bookmarks
        FROM library_items li JOIN subjects s ON s.id = li.subject_id
        ORDER BY views DESC, li.title
        LIMIT 200`.execute(this.database.db);
      return { items: result.rows };
    } catch {
      return { items: [] };
    }
  }

  async rosterExcel(viewer: AuthUser) {
    const rows = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('enrollments', (join) => join.onRef('enrollments.user_id', '=', 'users.id').on('enrollments.status', '=', 'active'))
      .leftJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .select(['users.full_name', 'users.email', 'user_roles.role', 'users.is_minor', 'groups_class.name as group_name', 'users.created_at'])
      .orderBy('user_roles.role')
      .orderBy('users.full_name')
      .execute();
    const meta = await this.reports.register({
      kind: 'usuarios', format: 'xlsx', title: 'Reporte de usuarios', userId: viewer.id, rowCount: rows.length,
      source: 'users, user_roles, enrollments, groups_class',
    });
    const roleLabel: Record<string, string> = { admin: 'Administración', directivo: 'Coordinación', teacher: 'Docente', student: 'Estudiante', guardian: 'Acudiente' };
    return renderWorkbook(meta, (h) => {
      h.sheet('Usuarios', [{ header: 'Nombre', width: 30 }, { header: 'Correo', width: 32 }, { header: 'Rol', width: 16 }, { header: 'Menor', width: 8 }, { header: 'Grupo', width: 10 }, { header: 'Creado', width: 14 }],
        rows.map((row) => [row.full_name, row.email, roleLabel[row.role] ?? row.role, row.is_minor ? 'Sí' : 'No', row.group_name, day(row.created_at)]));
    });
  }
}
