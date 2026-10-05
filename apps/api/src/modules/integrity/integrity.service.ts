import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents } from '../../core/events/domain-events';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { AuthUser } from '../../core/auth/auth.decorators';

@Injectable()
export class IntegrityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly env: Env,
    private readonly events: EventEmitter2,
    private readonly realtime: RealtimeService,
  ) {}

  async record(user: AuthUser, attemptId: string, type: string) {
    const attempt = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .innerJoin('courses', 'courses.id', 'assessments.course_id')
      .select(['attempts.id', 'attempts.user_id', 'attempts.status', 'assessments.kind', 'assessments.course_id', 'courses.teacher_id'])
      .where('attempts.id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt || attempt.user_id !== user.id) throw new ApiError(404, 'NOT_FOUND', 'El intento no existe');
    if (attempt.status !== 'active' || attempt.kind === 'practice') return { ignored: true, count: 0, suspended: false };
    await this.database.db.insertInto('integrity_events').values({ attempt_id: attemptId, user_id: user.id, type, meta: null }).execute();
    const flag = await this.database.db
      .selectFrom('attempt_flags')
      .selectAll()
      .where('attempt_id', '=', attemptId)
      .executeTakeFirst();
    const count = (flag?.violation_count ?? 0) + 1;
    const suspended = count >= this.env.values.INTEGRITY_SUSPEND_AFTER;
    await this.database.db
      .insertInto('attempt_flags')
      .values({ attempt_id: attemptId, violation_count: count, flagged: count > 0, suspended })
      .onConflict((oc) => oc.column('attempt_id').doUpdateSet({ violation_count: count, flagged: true, suspended }))
      .execute();
    const payload = {
      userId: user.id,
      attemptId,
      courseId: attempt.course_id,
      teacherId: attempt.teacher_id,
      type,
      count,
      suspended,
    };
    this.events.emit(DomainEvents.IntegrityViolation, payload);
    if (suspended) this.events.emit(DomainEvents.IntegritySuspend, { attemptId });
    this.realtime.to(`user:${attempt.teacher_id}`, 'integrity:alert', {
      attemptId,
      courseId: attempt.course_id,
      student: user.fullName,
      type,
      count,
      suspended,
    });
    return { ignored: false, count, suspended };
  }

  async courseEvents(user: AuthUser, courseId: string) {
    const course = await this.database.db.selectFrom('courses').select(['teacher_id']).where('id', '=', courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    if (user.role === 'teacher' && course.teacher_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'No es tu curso');
    if (user.role === 'student') throw new ApiError(403, 'FORBIDDEN', 'El registro de integridad es del docente');
    return this.database.db
      .selectFrom('integrity_events')
      .innerJoin('attempts', 'attempts.id', 'integrity_events.attempt_id')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .innerJoin('users', 'users.id', 'integrity_events.user_id')
      .select([
        'integrity_events.id',
        'integrity_events.type',
        'integrity_events.at',
        'integrity_events.attempt_id',
        'users.full_name',
        'assessments.title as assessment_title',
      ])
      .where('assessments.course_id', '=', courseId)
      .orderBy('integrity_events.at', 'desc')
      .limit(100)
      .execute();
  }

  async hasBlockingAttempt(userId: string) {
    const row = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select('attempts.id')
      .where('attempts.user_id', '=', userId)
      .where('attempts.status', '=', 'active')
      .where('assessments.kind', 'in', ['exam', 'live'])
      .executeTakeFirst();
    return Boolean(row);
  }
}
