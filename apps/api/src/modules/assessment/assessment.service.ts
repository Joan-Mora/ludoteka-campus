import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents, type IntegritySuspendEvent } from '../../core/events/domain-events';
import { shortCode } from '../../core/common/crypto';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { LearningService } from '../learning/public-api';

@Injectable()
export class AssessmentService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Evaluaciones');
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly learning: LearningService,
    private readonly events: EventEmitter2,
    private readonly realtime: RealtimeService,
  ) {}

  onApplicationBootstrap() {
    const sweep = () => void this.expireAbandonedLive().catch((error: Error) => this.logger.warn(`Barrido de salas en vivo: ${error.message}`));
    this.sweeper = setInterval(sweep, 10 * 60_000);
    this.sweeper.unref();
    sweep();
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  /** Una sala en vivo que nadie cerró en 3 horas se da por terminada para que no siga contando en el campus. */
  async expireAbandonedLive() {
    const result = await this.database.db
      .updateTable('live_sessions')
      .set({ status: 'ended' })
      .where('status', '<>', 'ended')
      .where('created_at', '<', sql<Date>`now() - INTERVAL '3 hours'`)
      .executeTakeFirst();
    const closed = Number(result.numUpdatedRows);
    if (closed) this.logger.log(`${closed} sala(s) en vivo abandonadas cerradas`);
  }

  async listQuestions(subjectId?: string) {
    let query = this.database.db.selectFrom('questions').selectAll().orderBy('created_at', 'desc');
    if (subjectId) query = query.where('subject_id', '=', subjectId);
    const questions = await query.limit(200).execute();
    if (!questions.length) return [];
    const options = await this.database.db
      .selectFrom('question_options')
      .selectAll()
      .where('question_id', 'in', questions.map((q) => q.id))
      .orderBy('position')
      .execute();
    return questions.map((question) => ({
      ...question,
      options: options.filter((option) => option.question_id === question.id),
    }));
  }

  async createQuestion(user: AuthUser, input: {
    subjectId: string;
    gradeId?: string;
    prompt: string;
    difficulty?: string;
    explanation?: string;
    options: { label: string; text: string; correct: boolean }[];
  }) {
    if (!input.options.some((option) => option.correct)) {
      throw new ApiError(400, 'NO_ANSWER', 'Marca una opción correcta');
    }
    const code = `Q-${shortCode(8)}`;
    return this.database.withTx(async (trx) => {
      const question = await trx
        .insertInto('questions')
        .values({
          code,
          subject_id: input.subjectId,
          grade_id: input.gradeId ?? null,
          prompt: input.prompt,
          difficulty: input.difficulty ?? 'media',
          explanation: input.explanation ?? '',
          created_by: user.id,
          active: true,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      for (const [index, option] of input.options.entries()) {
        await trx
          .insertInto('question_options')
          .values({
            question_id: question.id,
            label: option.label.toUpperCase(),
            text: option.text,
            is_correct: option.correct,
            position: index + 1,
          })
          .execute();
      }
      return question;
    });
  }

  async setActive(id: string, active: boolean) {
    const row = await this.database.db
      .updateTable('questions')
      .set({ active })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'La pregunta no existe');
    return row;
  }

  async createAssessment(user: AuthUser, input: { courseId: string; title: string; kind: string; timeLimitSec?: number; questionIds: string[] }) {
    const course = await this.learning.assertAccess(user, input.courseId, 'write');
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente arma la evaluación');
    return this.database.withTx(async (trx) => {
      const assessment = await trx
        .insertInto('assessments')
        .values({
          code: `EV-${shortCode(6)}`,
          course_id: input.courseId,
          title: input.title,
          kind: input.kind,
          status: 'published',
          time_limit_sec: input.timeLimitSec ?? 600,
          created_by: user.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      for (const [index, questionId] of input.questionIds.entries()) {
        await trx
          .insertInto('assessment_questions')
          .values({ assessment_id: assessment.id, question_id: questionId, position: index + 1, points: 10 })
          .execute();
      }
      return assessment;
    });
  }

  async listForCourse(user: AuthUser, courseId: string) {
    await this.learning.assertAccess(user, courseId);
    return this.database.db
      .selectFrom('assessments')
      .selectAll()
      .where('course_id', '=', courseId)
      .where('status', '=', 'published')
      .orderBy('created_at', 'desc')
      .execute();
  }

  async start(user: AuthUser, assessmentId: string) {
    const assessment = await this.database.db.selectFrom('assessments').selectAll().where('id', '=', assessmentId).executeTakeFirst();
    if (!assessment || assessment.status !== 'published') throw new ApiError(404, 'NOT_FOUND', 'La evaluación no está disponible');
    await this.learning.assertAccess(user, assessment.course_id);
    if (assessment.kind === 'exam') {
      const previous = await this.database.db
        .selectFrom('attempts')
        .select('id')
        .where('assessment_id', '=', assessmentId)
        .where('user_id', '=', user.id)
        .where('status', '=', 'completed')
        .executeTakeFirst();
      if (previous) throw new ApiError(409, 'ALREADY_TAKEN', 'Este examen ya fue presentado');
    }
    const active = await this.database.db
      .selectFrom('attempts')
      .selectAll()
      .where('assessment_id', '=', assessmentId)
      .where('user_id', '=', user.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (active) return this.getAttempt(user, active.id);
    const points = await this.database.db
      .selectFrom('assessment_questions')
      .select(sql<number>`coalesce(sum(points), 0)`.as('n'))
      .where('assessment_id', '=', assessmentId)
      .executeTakeFirstOrThrow();
    const attempt = await this.database.db
      .insertInto('attempts')
      .values({
        assessment_id: assessmentId,
        user_id: user.id,
        max_score: Number(points.n),
        status: 'active',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.database.db.insertInto('attempt_flags').values({ attempt_id: attempt.id }).execute();
    return this.getAttempt(user, attempt.id);
  }

  async getAttempt(user: AuthUser, attemptId: string) {
    const attempt = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .selectAll('attempts')
      .select(['assessments.title', 'assessments.kind', 'assessments.time_limit_sec', 'assessments.course_id'])
      .where('attempts.id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) throw new ApiError(404, 'NOT_FOUND', 'El intento no existe');
    const course = await this.learning.assertAccess(user, attempt.course_id);
    if (user.role === 'student' && attempt.user_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Ese intento no es tuyo');
    if (user.role === 'teacher' && course.teacher_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'No es tu curso');
    const reveal = attempt.status !== 'active' || user.role !== 'student';
    const questions = await this.database.db
      .selectFrom('assessment_questions')
      .innerJoin('questions', 'questions.id', 'assessment_questions.question_id')
      .select(['questions.id', 'questions.prompt', 'questions.explanation', 'assessment_questions.position', 'assessment_questions.points'])
      .where('assessment_questions.assessment_id', '=', attempt.assessment_id)
      .orderBy('assessment_questions.position')
      .execute();
    const options = await this.database.db
      .selectFrom('question_options')
      .select(['id', 'question_id', 'label', 'text', 'is_correct', 'position'])
      .where('question_id', 'in', questions.length ? questions.map((q) => q.id) : ['00000000-0000-0000-0000-000000000000'])
      .orderBy('position')
      .execute();
    const answers = await this.database.db.selectFrom('attempt_answers').selectAll().where('attempt_id', '=', attemptId).execute();
    return {
      id: attempt.id,
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.max_score,
      title: attempt.title,
      kind: attempt.kind,
      timeLimitSec: attempt.time_limit_sec,
      courseId: attempt.course_id,
      startedAt: attempt.started_at,
      questions: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        points: question.points,
        explanation: reveal ? question.explanation : undefined,
        options: options
          .filter((option) => option.question_id === question.id)
          .map((option) => ({
            id: option.id,
            label: option.label,
            text: option.text,
            correct: reveal ? option.is_correct : undefined,
          })),
      })),
      answers: answers.map((answer) => ({ questionId: answer.question_id, optionId: answer.option_id, correct: reveal ? answer.correct : undefined, points: reveal ? answer.points : undefined })),
    };
  }

  async answer(user: AuthUser, attemptId: string, input: { questionId: string; optionId: string; elapsedMs?: number }) {
    const attempt = await this.database.db.selectFrom('attempts').selectAll().where('id', '=', attemptId).executeTakeFirst();
    if (!attempt || attempt.user_id !== user.id) throw new ApiError(404, 'NOT_FOUND', 'El intento no existe');
    if (attempt.status !== 'active') throw new ApiError(409, 'CLOSED', 'Este intento ya no recibe respuestas');
    const option = await this.database.db
      .selectFrom('question_options')
      .selectAll()
      .where('id', '=', input.optionId)
      .where('question_id', '=', input.questionId)
      .executeTakeFirst();
    if (!option) throw new ApiError(400, 'OPTION', 'La opción no corresponde a la pregunta');
    const link = await this.database.db
      .selectFrom('assessment_questions')
      .select(['points'])
      .where('assessment_id', '=', attempt.assessment_id)
      .where('question_id', '=', input.questionId)
      .executeTakeFirst();
    if (!link) throw new ApiError(400, 'QUESTION', 'La pregunta no está en esta evaluación');
    const points = option.is_correct ? link.points : 0;
    await this.database.db
      .insertInto('attempt_answers')
      .values({
        attempt_id: attemptId,
        question_id: input.questionId,
        option_id: input.optionId,
        correct: option.is_correct,
        points,
        elapsed_ms: input.elapsedMs ?? null,
      })
      .onConflict((oc) =>
        oc.columns(['attempt_id', 'question_id']).doUpdateSet({
          option_id: input.optionId,
          correct: option.is_correct,
          points,
          elapsed_ms: input.elapsedMs ?? null,
          answered_at: new Date(),
        }),
      )
      .execute();
    return { saved: true };
  }

  async submit(user: AuthUser, attemptId: string) {
    const attempt = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .selectAll('attempts')
      .select(['assessments.course_id', 'assessments.kind'])
      .where('attempts.id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt || attempt.user_id !== user.id) throw new ApiError(404, 'NOT_FOUND', 'El intento no existe');
    if (attempt.status !== 'active') return this.getAttempt(user, attemptId);
    await this.complete(user.id, attemptId);
    return this.getAttempt(user, attemptId);
  }

  /** Grades an active attempt with the answers it has. */
  private async complete(userId: string, attemptId: string) {
    const attempt = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(['attempts.status', 'attempts.max_score', 'assessments.course_id'])
      .where('attempts.id', '=', attemptId)
      .where('attempts.user_id', '=', userId)
      .executeTakeFirst();
    if (!attempt || attempt.status !== 'active') return;
    const sum = await this.database.db
      .selectFrom('attempt_answers')
      .select(sql<number>`coalesce(sum(points), 0)`.as('n'))
      .where('attempt_id', '=', attemptId)
      .executeTakeFirstOrThrow();
    await this.database.db
      .updateTable('attempts')
      .set({ status: 'completed', score: Number(sum.n), submitted_at: new Date() })
      .where('id', '=', attemptId)
      .execute();
    this.events.emit(DomainEvents.AttemptGraded, {
      userId,
      attemptId,
      courseId: attempt.course_id,
      score: Number(sum.n),
      maxScore: attempt.max_score,
    });
  }

  @OnEvent(DomainEvents.IntegritySuspend)
  async suspend(event: IntegritySuspendEvent) {
    await this.database.db
      .updateTable('attempts')
      .set({ status: 'suspended', submitted_at: new Date() })
      .where('id', '=', event.attemptId)
      .where('status', '=', 'active')
      .execute();
  }

  async hasPassingExam(userId: string, courseId: string) {
    const row = await this.database.db
      .selectFrom('attempts')
      .innerJoin('assessments', 'assessments.id', 'attempts.assessment_id')
      .select(['attempts.score', 'attempts.max_score'])
      .where('attempts.user_id', '=', userId)
      .where('attempts.status', '=', 'completed')
      .where('assessments.course_id', '=', courseId)
      .where('assessments.kind', '=', 'exam')
      .execute();
    return row.some((attempt) => attempt.max_score > 0 && attempt.score / attempt.max_score >= 0.6);
  }

  /** Evaluations a teacher can project: published, from their own courses (exams excluded), with the room still open if any. */
  async hostable(user: AuthUser) {
    const mine = user.role === 'admin' ? sql`true` : sql`c.teacher_id = ${user.id}`;
    const rows = await sql<{ id: string; title: string; kind: string; course: string; questions: number; session_id: string | null; code: string | null; status: string | null }>`
      SELECT a.id, a.title, a.kind, c.title AS course,
        (SELECT count(*)::INT FROM assessment_questions q WHERE q.assessment_id = a.id) AS questions,
        ls.id AS session_id, ls.code, ls.status
      FROM assessments a JOIN courses c ON c.id = a.course_id
      LEFT JOIN LATERAL (
        SELECT id, code, status FROM live_sessions
        WHERE assessment_id = a.id AND host_id = ${user.id} AND status <> 'ended' AND created_at > now() - INTERVAL '3 hours'
        ORDER BY created_at DESC LIMIT 1
      ) ls ON true
      WHERE a.status = 'published' AND a.kind <> 'exam' AND ${mine}
      ORDER BY ls.id IS NULL, a.kind <> 'live', c.title, a.created_at DESC
      LIMIT 200`.execute(this.database.db);
    return rows.rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      course: r.course,
      questions: Number(r.questions),
      open: r.session_id ? { id: r.session_id, code: r.code!, status: r.status! } : null,
    }));
  }

  async createLive(user: AuthUser, assessmentId: string) {
    const assessment = await this.database.db.selectFrom('assessments').selectAll().where('id', '=', assessmentId).executeTakeFirst();
    if (!assessment) throw new ApiError(404, 'NOT_FOUND', 'La evaluación no existe');
    if (assessment.kind === 'exam') throw new ApiError(400, 'NOT_LIVE', 'Los exámenes no se presentan en sala en vivo');
    const course = await this.learning.assertAccess(user, assessment.course_id);
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente abre la sala');
    const open = await this.database.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('assessment_id', '=', assessmentId)
      .where('host_id', '=', user.id)
      .where('status', '<>', 'ended')
      .where('created_at', '>', sql<Date>`now() - INTERVAL '3 hours'`)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (open) return open;
    return this.database.db
      .insertInto('live_sessions')
      .values({ assessment_id: assessmentId, host_id: user.id, code: shortCode(6), status: 'lobby' })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async liveByCode(code: string) {
    const session = await this.database.db
      .selectFrom('live_sessions')
      .innerJoin('assessments', 'assessments.id', 'live_sessions.assessment_id')
      .selectAll('live_sessions')
      .select(['assessments.title', 'assessments.course_id', 'assessments.time_limit_sec'])
      .where('live_sessions.code', '=', code.toUpperCase())
      .executeTakeFirst();
    if (!session) throw new ApiError(404, 'NOT_FOUND', 'No hay una sala con ese código');
    return session;
  }

  private async liveQuestions(assessmentId: string) {
    return this.database.db
      .selectFrom('assessment_questions')
      .innerJoin('questions', 'questions.id', 'assessment_questions.question_id')
      .select(['questions.id', 'questions.prompt', 'assessment_questions.position', 'assessment_questions.points'])
      .where('assessment_questions.assessment_id', '=', assessmentId)
      .orderBy('assessment_questions.position')
      .execute();
  }

  /** The question on screen, as students see it (no correct answer). */
  private async questionAt(assessmentId: string, position: number) {
    const questions = await this.liveQuestions(assessmentId);
    const question = questions[position - 1];
    if (!question) return null;
    const options = await this.database.db
      .selectFrom('question_options')
      .select(['id', 'label', 'text'])
      .where('question_id', '=', question.id)
      .orderBy('position')
      .execute();
    return { position, total: questions.length, questionId: question.id, prompt: question.prompt, options, points: question.points };
  }

  async joinLive(user: AuthUser, code: string) {
    const session = await this.liveByCode(code);
    if (session.status === 'ended') throw new ApiError(409, 'ENDED', 'La sala ya cerró');
    await this.learning.assertAccess(user, session.course_id);
    let attemptId: string | null = null;
    if (user.role === 'student') {
      const started = await this.start(user, session.assessment_id);
      attemptId = started.id;
      await this.database.db
        .insertInto('live_participants')
        .values({ session_id: session.id, user_id: user.id, attempt_id: attemptId })
        .onConflict((oc) => oc.columns(['session_id', 'user_id']).doNothing())
        .execute();
      this.realtime.to(`live:${session.code}`, 'live:roster', { sessionId: session.id });
    }
    const current = session.status === 'live' ? await this.questionAt(session.assessment_id, session.current_position) : null;
    let answered: string | null = null;
    if (current && attemptId) {
      const row = await this.database.db
        .selectFrom('attempt_answers')
        .select('option_id')
        .where('attempt_id', '=', attemptId)
        .where('question_id', '=', current.questionId)
        .executeTakeFirst();
      answered = row?.option_id ?? null;
    }
    return { session, attemptId, current, answered };
  }

  private async hostSession(user: AuthUser, sessionId: string) {
    const session = await this.database.db.selectFrom('live_sessions').selectAll().where('id', '=', sessionId).executeTakeFirst();
    if (!session || (session.host_id !== user.id && user.role !== 'admin')) throw new ApiError(403, 'FORBIDDEN', 'Solo quien abrió la sala la conduce');
    return session;
  }

  /** Everything the teacher's screen needs: code, roster with progress, the current question with its answer and the results. */
  async liveState(user: AuthUser, sessionId: string) {
    const session = await this.hostSession(user, sessionId);
    const assessment = await this.database.db.selectFrom('assessments').select(['title', 'course_id']).where('id', '=', session.assessment_id).executeTakeFirstOrThrow();
    const total = (await this.liveQuestions(session.assessment_id)).length;
    const roster = await sql<{ user_id: string; full_name: string; answered: number; correct: number; points: number; current: string | null }>`
      SELECT p.user_id, u.full_name,
        (SELECT count(*)::INT FROM attempt_answers x WHERE x.attempt_id = p.attempt_id) AS answered,
        (SELECT count(*)::INT FROM attempt_answers x WHERE x.attempt_id = p.attempt_id AND x.correct) AS correct,
        (SELECT coalesce(sum(x.points), 0)::INT FROM attempt_answers x WHERE x.attempt_id = p.attempt_id) AS points,
        (SELECT x.option_id::STRING FROM attempt_answers x JOIN assessment_questions aq ON aq.question_id = x.question_id AND aq.assessment_id = ${session.assessment_id}
          WHERE x.attempt_id = p.attempt_id AND aq.position = ${session.current_position} LIMIT 1) AS current
      FROM live_participants p JOIN users u ON u.id = p.user_id
      WHERE p.session_id = ${session.id} AND p.attempt_id IS NOT NULL
      ORDER BY points DESC, u.full_name`.execute(this.database.db);
    let question = null as (Awaited<ReturnType<AssessmentService['questionAt']>> & { correctId: string | null; tally: Record<string, number> }) | null;
    if (session.status === 'live') {
      const base = await this.questionAt(session.assessment_id, session.current_position);
      if (base) {
        const correct = await this.database.db.selectFrom('question_options').select('id').where('question_id', '=', base.questionId).where('is_correct', '=', true).executeTakeFirst();
        const tally: Record<string, number> = {};
        for (const r of roster.rows) if (r.current) tally[r.current] = (tally[r.current] ?? 0) + 1;
        question = { ...base, correctId: correct?.id ?? null, tally };
      }
    }
    return {
      id: session.id,
      code: session.code,
      status: session.status,
      title: assessment.title,
      courseId: assessment.course_id,
      position: session.current_position,
      total,
      question,
      participants: roster.rows.map((r) => ({ id: r.user_id, fullName: r.full_name, answered: Number(r.answered), correct: Number(r.correct), points: Number(r.points), answeredCurrent: Boolean(r.current) })),
    };
  }

  async advanceLive(user: AuthUser, sessionId: string) {
    const session = await this.hostSession(user, sessionId);
    if (session.status === 'ended') return { status: 'ended' };
    const total = (await this.liveQuestions(session.assessment_id)).length;
    const next = session.current_position + 1;
    if (next > total) return this.endLive(user, sessionId);
    await this.database.db
      .updateTable('live_sessions')
      .set({ status: 'live', current_position: next, question_started_at: new Date() })
      .where('id', '=', sessionId)
      .execute();
    const payload = await this.questionAt(session.assessment_id, next);
    this.realtime.to(`live:${session.code}`, 'live:question', payload);
    return payload;
  }

  /** Closes the room and grades every participant's attempt with the answers they gave. */
  async endLive(user: AuthUser, sessionId: string) {
    const session = await this.hostSession(user, sessionId);
    await this.database.db.updateTable('live_sessions').set({ status: 'ended' }).where('id', '=', sessionId).execute();
    const participants = await this.database.db
      .selectFrom('live_participants')
      .innerJoin('attempts', 'attempts.id', 'live_participants.attempt_id')
      .select(['live_participants.user_id', 'live_participants.attempt_id'])
      .where('live_participants.session_id', '=', sessionId)
      .where('attempts.status', '=', 'active')
      .execute();
    for (const p of participants) {
      await this.complete(p.user_id, p.attempt_id!).catch((error: Error) => this.logger.warn(`Intento en vivo sin cerrar: ${error.message}`));
    }
    this.realtime.to(`live:${session.code}`, 'live:ended', { sessionId });
    return { status: 'ended' };
  }

  async liveAnswer(user: AuthUser, sessionId: string, input: { questionId: string; optionId: string }) {
    const session = await this.database.db.selectFrom('live_sessions').selectAll().where('id', '=', sessionId).executeTakeFirst();
    if (!session || session.status !== 'live') throw new ApiError(409, 'CLOSED', 'La pregunta no está abierta');
    const participant = await this.database.db
      .selectFrom('live_participants')
      .selectAll()
      .where('session_id', '=', sessionId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!participant?.attempt_id) throw new ApiError(403, 'FORBIDDEN', 'Entra a la sala como estudiante');
    const elapsed = session.question_started_at ? Date.now() - new Date(session.question_started_at).getTime() : 0;
    await this.answer(user, participant.attempt_id, { ...input, elapsedMs: elapsed });
    const count = await this.database.db
      .selectFrom('attempt_answers')
      .innerJoin('live_participants', 'live_participants.attempt_id', 'attempt_answers.attempt_id')
      .select(sql<number>`count(*)`.as('n'))
      .where('live_participants.session_id', '=', sessionId)
      .where('attempt_answers.question_id', '=', input.questionId)
      .executeTakeFirstOrThrow();
    this.realtime.to(`live:${session.code}`, 'live:progress', { questionId: input.questionId, answers: Number(count.n) });
    return { saved: true };
  }
}
