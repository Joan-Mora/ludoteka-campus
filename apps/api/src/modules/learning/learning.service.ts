import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents } from '../../core/events/domain-events';

@Injectable()
export class LearningService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  private async courseRow(courseId: string) {
    const course = await this.database.db
      .selectFrom('courses')
      .innerJoin('subjects', 'subjects.id', 'courses.subject_id')
      .innerJoin('groups_class', 'groups_class.id', 'courses.group_id')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select([
        'courses.id',
        'courses.title',
        'courses.description',
        'courses.published',
        'courses.teacher_id',
        'courses.group_id',
        'courses.subject_id',
        'courses.academic_year_id',
        'subjects.name as subject_name',
        'groups_class.name as group_name',
        'grades.level as grade_level',
      ])
      .where('courses.id', '=', courseId)
      .executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    return course;
  }

  async assertAccess(user: AuthUser, courseId: string) {
    const course = await this.courseRow(courseId);
    if (user.role === 'admin' || user.role === 'directivo') return course;
    if (user.role === 'teacher' && course.teacher_id === user.id) return course;
    if (user.role === 'student') {
      const enrolled = await this.database.db
        .selectFrom('enrollments')
        .select('id')
        .where('user_id', '=', user.id)
        .where('group_id', '=', course.group_id)
        .where('academic_year_id', '=', course.academic_year_id)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (enrolled && course.published) return course;
    }
    throw new ApiError(403, 'FORBIDDEN', 'No perteneces a este curso');
  }

  async list(user: AuthUser) {
    let query = this.database.db
      .selectFrom('courses')
      .innerJoin('subjects', 'subjects.id', 'courses.subject_id')
      .innerJoin('groups_class', 'groups_class.id', 'courses.group_id')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select([
        'courses.id',
        'courses.title',
        'courses.description',
        'courses.published',
        'subjects.name as subject',
        'groups_class.name as group_name',
        'grades.level as grade_level',
      ]);
    if (user.role === 'teacher') query = query.where('courses.teacher_id', '=', user.id);
    if (user.role === 'student') {
      query = query
        .where('courses.published', '=', true)
        .where(({ exists, selectFrom }) =>
          exists(
            selectFrom('enrollments')
              .select('enrollments.id')
              .whereRef('enrollments.group_id', '=', 'courses.group_id')
              .whereRef('enrollments.academic_year_id', '=', 'courses.academic_year_id')
              .where('enrollments.user_id', '=', user.id)
              .where('enrollments.status', '=', 'active'),
          ),
        );
    }
    const courses = await query.orderBy('grades.level').orderBy('courses.title').execute();
    const progress = await this.progressMap(
      courses.map((c) => c.id),
      user.role === 'student' ? user.id : null,
    );
    return courses.map((course) => ({ ...course, progress: progress.get(course.id) ?? { completed: 0, total: 0 } }));
  }

  private async progressMap(courseIds: string[], userId: string | null) {
    const map = new Map<string, { completed: number; total: number }>();
    if (!courseIds.length) return map;
    const totals = await this.database.db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .select(['units.course_id', sql<number>`count(*)`.as('n')])
      .where('units.course_id', 'in', courseIds)
      .groupBy('units.course_id')
      .execute();
    for (const row of totals) map.set(row.course_id, { completed: 0, total: Number(row.n) });
    if (!userId) return map;
    const done = await this.database.db
      .selectFrom('lesson_progress')
      .innerJoin('lessons', 'lessons.id', 'lesson_progress.lesson_id')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .select(['units.course_id', sql<number>`count(*)`.as('n')])
      .where('lesson_progress.user_id', '=', userId)
      .where('lesson_progress.status', '=', 'completed')
      .where('units.course_id', 'in', courseIds)
      .groupBy('units.course_id')
      .execute();
    for (const row of done) {
      const current = map.get(row.course_id) ?? { completed: 0, total: 0 };
      current.completed = Number(row.n);
      map.set(row.course_id, current);
    }
    return map;
  }

  async detail(user: AuthUser, courseId: string) {
    const course = await this.assertAccess(user, courseId);
    const units = await this.database.db
      .selectFrom('units')
      .selectAll()
      .where('course_id', '=', courseId)
      .orderBy('position')
      .execute();
    const lessons = await this.database.db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .selectAll('lessons')
      .where('units.course_id', '=', courseId)
      .orderBy('lessons.position')
      .execute();
    const progress = user.role === 'student'
      ? await this.database.db
          .selectFrom('lesson_progress')
          .select(['lesson_id', 'status'])
          .where('user_id', '=', user.id)
          .where(
            'lesson_id',
            'in',
            lessons.length ? lessons.map((l) => l.id) : ['00000000-0000-0000-0000-000000000000'],
          )
          .execute()
      : [];
    const done = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.lesson_id));
    return {
      ...course,
      units: units.map((unit) => ({
        ...unit,
        lessons: lessons
          .filter((lesson) => lesson.unit_id === unit.id)
          .map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            estimatedMin: lesson.estimated_min,
            position: lesson.position,
            completed: done.has(lesson.id),
          })),
      })),
    };
  }

  async createCourse(user: AuthUser, input: { subjectId: string; groupId: string; academicYearId: string; title: string; description?: string }) {
    const assignment = await this.database.db
      .selectFrom('teaching_assignments')
      .select('id')
      .where('teacher_id', '=', user.role === 'admin' ? user.id : user.id)
      .where('subject_id', '=', input.subjectId)
      .where('group_id', '=', input.groupId)
      .where('academic_year_id', '=', input.academicYearId)
      .executeTakeFirst();
    if (user.role !== 'admin' && !assignment) {
      throw new ApiError(403, 'NOT_ASSIGNED', 'No tienes asignación para esa materia y grupo');
    }
    const teacherId = user.role === 'teacher' ? user.id : user.id;
    return this.database.db
      .insertInto('courses')
      .values({
        subject_id: input.subjectId,
        group_id: input.groupId,
        academic_year_id: input.academicYearId,
        teacher_id: teacherId,
        title: input.title,
        description: input.description ?? '',
        published: true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async addUnit(user: AuthUser, courseId: string, input: { title: string; summary?: string }) {
    await this.assertAccess(user, courseId);
    if (user.role === 'student') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente edita el curso');
    const last = await this.database.db
      .selectFrom('units')
      .select(sql<number>`coalesce(max(position), 0)`.as('n'))
      .where('course_id', '=', courseId)
      .executeTakeFirstOrThrow();
    return this.database.db
      .insertInto('units')
      .values({ course_id: courseId, title: input.title, summary: input.summary ?? '', position: Number(last.n) + 1 })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async addLesson(user: AuthUser, unitId: string, input: { title: string; bodyMd: string; estimatedMin?: number }) {
    const unit = await this.database.db.selectFrom('units').selectAll().where('id', '=', unitId).executeTakeFirst();
    if (!unit) throw new ApiError(404, 'NOT_FOUND', 'La unidad no existe');
    await this.assertAccess(user, unit.course_id);
    if (user.role === 'student') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente edita el curso');
    const last = await this.database.db
      .selectFrom('lessons')
      .select(sql<number>`coalesce(max(position), 0)`.as('n'))
      .where('unit_id', '=', unitId)
      .executeTakeFirstOrThrow();
    return this.database.db
      .insertInto('lessons')
      .values({
        unit_id: unitId,
        title: input.title,
        body_md: input.bodyMd,
        estimated_min: input.estimatedMin ?? 15,
        position: Number(last.n) + 1,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async lesson(user: AuthUser, lessonId: string) {
    const lesson = await this.database.db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .selectAll('lessons')
      .select(['units.course_id', 'units.title as unit_title'])
      .where('lessons.id', '=', lessonId)
      .executeTakeFirst();
    if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'La lección no existe');
    await this.assertAccess(user, lesson.course_id);
    const resources = await this.database.db
      .selectFrom('lesson_resources')
      .selectAll()
      .where('lesson_id', '=', lessonId)
      .orderBy('position')
      .execute();
    return {
      id: lesson.id,
      title: lesson.title,
      bodyMd: lesson.body_md,
      estimatedMin: lesson.estimated_min,
      courseId: lesson.course_id,
      unitTitle: lesson.unit_title,
      resources,
    };
  }

  async completeLesson(user: AuthUser, lessonId: string) {
    const lesson = await this.lesson(user, lessonId);
    const already = await this.database.db
      .selectFrom('lesson_progress')
      .select('status')
      .where('user_id', '=', user.id)
      .where('lesson_id', '=', lessonId)
      .executeTakeFirst();
    await this.database.db
      .insertInto('lesson_progress')
      .values({ user_id: user.id, lesson_id: lessonId, status: 'completed', completed_at: new Date() })
      .onConflict((oc) => oc.columns(['user_id', 'lesson_id']).doUpdateSet({ status: 'completed', completed_at: new Date() }))
      .execute();
    if (already?.status !== 'completed') {
      this.events.emit(DomainEvents.LessonCompleted, {
        userId: user.id,
        lessonId,
        courseId: lesson.courseId,
      });
    }
    return { ok: true };
  }

  async listAssignments(user: AuthUser, courseId: string) {
    await this.assertAccess(user, courseId);
    const rows = await this.database.db
      .selectFrom('assignments')
      .selectAll()
      .where('course_id', '=', courseId)
      .orderBy('due_at')
      .execute();
    let submissionsQuery = this.database.db
      .selectFrom('submissions')
      .innerJoin('assignments', 'assignments.id', 'submissions.assignment_id')
      .innerJoin('users', 'users.id', 'submissions.user_id')
      .select([
        'submissions.id',
        'submissions.assignment_id',
        'submissions.user_id',
        'submissions.body',
        'submissions.status',
        'submissions.score',
        'submissions.feedback',
        'submissions.submitted_at',
        'users.full_name',
      ])
      .where('assignments.course_id', '=', courseId);
    if (user.role === 'student') submissionsQuery = submissionsQuery.where('submissions.user_id', '=', user.id);
    const submissions = await submissionsQuery.execute();
    return { assignments: rows, submissions };
  }

  async createAssignment(user: AuthUser, courseId: string, input: { title: string; instructions: string; dueAt?: string; maxScore?: number; lessonId?: string }) {
    const course = await this.assertAccess(user, courseId);
    if (course.teacher_id !== user.id && user.role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Solo el docente del curso publica tareas');
    }
    return this.database.db
      .insertInto('assignments')
      .values({
        course_id: courseId,
        title: input.title,
        instructions: input.instructions,
        due_at: input.dueAt ? new Date(input.dueAt) : null,
        max_score: input.maxScore ?? 100,
        lesson_id: input.lessonId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async submit(user: AuthUser, assignmentId: string, body: string) {
    const assignment = await this.database.db.selectFrom('assignments').selectAll().where('id', '=', assignmentId).executeTakeFirst();
    if (!assignment) throw new ApiError(404, 'NOT_FOUND', 'La tarea no existe');
    await this.assertAccess(user, assignment.course_id);
    if (user.role !== 'student') throw new ApiError(403, 'FORBIDDEN', 'La entrega es del estudiante');
    return this.database.db
      .insertInto('submissions')
      .values({ assignment_id: assignmentId, user_id: user.id, body })
      .onConflict((oc) => oc.columns(['assignment_id', 'user_id']).doUpdateSet({ body, submitted_at: new Date(), status: 'submitted' }))
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async grade(user: AuthUser, submissionId: string, input: { score: number; feedback?: string }) {
    const submission = await this.database.db
      .selectFrom('submissions')
      .innerJoin('assignments', 'assignments.id', 'submissions.assignment_id')
      .selectAll('submissions')
      .select(['assignments.course_id', 'assignments.max_score'])
      .where('submissions.id', '=', submissionId)
      .executeTakeFirst();
    if (!submission) throw new ApiError(404, 'NOT_FOUND', 'La entrega no existe');
    const course = await this.assertAccess(user, submission.course_id);
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente califica');
    if (input.score > submission.max_score) throw new ApiError(400, 'SCORE', 'La nota supera el máximo');
    const updated = await this.database.db
      .updateTable('submissions')
      .set({ score: input.score, feedback: input.feedback ?? null, status: 'graded', graded_at: new Date() })
      .where('id', '=', submissionId)
      .returningAll()
      .executeTakeFirstOrThrow();
    this.events.emit(DomainEvents.SubmissionGraded, {
      userId: submission.user_id,
      submissionId,
      score: input.score,
    });
    return updated;
  }

  async listAnnouncements(user: AuthUser, courseId: string) {
    await this.assertAccess(user, courseId);
    return this.database.db
      .selectFrom('announcements')
      .innerJoin('users', 'users.id', 'announcements.author_id')
      .select(['announcements.id', 'announcements.title', 'announcements.body', 'announcements.created_at', 'users.full_name as author'])
      .where('announcements.course_id', '=', courseId)
      .orderBy('announcements.created_at', 'desc')
      .execute();
  }

  async announce(user: AuthUser, courseId: string, input: { title: string; body: string }) {
    const course = await this.assertAccess(user, courseId);
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente publica');
    return this.database.db
      .insertInto('announcements')
      .values({ course_id: courseId, author_id: user.id, title: input.title, body: input.body })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listEvents(user: AuthUser, courseId: string) {
    await this.assertAccess(user, courseId);
    return this.database.db.selectFrom('calendar_events').selectAll().where('course_id', '=', courseId).orderBy('starts_at').execute();
  }

  async addEvent(user: AuthUser, courseId: string, input: { title: string; startsAt: string; endsAt?: string; kind?: string }) {
    const course = await this.assertAccess(user, courseId);
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente agenda');
    return this.database.db
      .insertInto('calendar_events')
      .values({
        course_id: courseId,
        title: input.title,
        starts_at: new Date(input.startsAt),
        ends_at: input.endsAt ? new Date(input.endsAt) : null,
        kind: input.kind ?? 'class',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async homeFeed(user: AuthUser) {
    const announcements = await this.database.db
      .selectFrom('announcements')
      .innerJoin('courses', 'courses.id', 'announcements.course_id')
      .select(['announcements.id', 'announcements.title', 'announcements.body', 'announcements.created_at', 'courses.title as course_title'])
      .where((eb) =>
        user.role === 'teacher'
          ? eb('courses.teacher_id', '=', user.id)
          : eb.exists(
              eb
                .selectFrom('enrollments')
                .select('enrollments.id')
                .whereRef('enrollments.group_id', '=', 'courses.group_id')
                .where('enrollments.user_id', '=', user.id),
            ),
      )
      .orderBy('announcements.created_at', 'desc')
      .limit(6)
      .execute();
    const events = await this.database.db
      .selectFrom('calendar_events')
      .innerJoin('courses', 'courses.id', 'calendar_events.course_id')
      .select(['calendar_events.id', 'calendar_events.title', 'calendar_events.starts_at', 'calendar_events.kind', 'courses.title as course_title'])
      .where('calendar_events.starts_at', '>=', new Date())
      .orderBy('calendar_events.starts_at')
      .limit(6)
      .execute();
    return { announcements, events };
  }
}
