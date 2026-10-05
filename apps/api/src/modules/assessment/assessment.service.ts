import { Injectable } from '@nestjs/common';
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
export class AssessmentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly learning: LearningService,
    private readonly events: EventEmitter2,
    private readonly realtime: RealtimeService,
  ) {}

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
    const course = await this.learning.assertAccess(user, input.courseId);
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
      userId: user.id,
      attemptId,
      courseId: attempt.course_id,
      score: Number(sum.n),
      maxScore: attempt.max_score,
    });
    return this.getAttempt(user, attemptId);
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

  async createLive(user: AuthUser, assessmentId: string) {
    const assessment = await this.database.db.selectFrom('assessments').selectAll().where('id', '=', assessmentId).executeTakeFirst();
    if (!assessment) throw new ApiError(404, 'NOT_FOUND', 'La evaluación no existe');
    const course = await this.learning.assertAccess(user, assessment.course_id);
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente abre la sala');
    const session = await this.database.db
      .insertInto('live_sessions')
      .values({ assessment_id: assessmentId, host_id: user.id, code: shortCode(6), status: 'lobby' })
      .returningAll()
      .executeTakeFirstOrThrow();
    return session;
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

  async joinLive(user: AuthUser, code: string) {
    const session = await this.liveByCode(code);
    if (session.status === 'ended') throw new ApiError(409, 'ENDED', 'La sala ya cerró');
    await this.learning.assertAccess(user, session.course_id);
    let attemptId: string | null = null;
    if (user.role === 'student') {
      const started = await this.start(user, session.assessment_id);
      attemptId = started.id;
    }
    await this.database.db
      .insertInto('live_participants')
      .values({ session_id: session.id, user_id: user.id, attempt_id: attemptId })
      .onConflict((oc) => oc.columns(['session_id', 'user_id']).doNothing())
      .execute();
    return { session, attemptId };
  }

  async advanceLive(user: AuthUser, sessionId: string) {
    const session = await this.database.db.selectFrom('live_sessions').selectAll().where('id', '=', sessionId).executeTakeFirst();
    if (!session || session.host_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Solo quien abrió la sala avanza');
    const questions = await this.database.db
      .selectFrom('assessment_questions')
      .innerJoin('questions', 'questions.id', 'assessment_questions.question_id')
      .select(['questions.id', 'questions.prompt', 'assessment_questions.position', 'assessment_questions.points'])
      .where('assessment_questions.assessment_id', '=', session.assessment_id)
      .orderBy('assessment_questions.position')
      .execute();
    const next = session.current_position + 1;
    if (next > questions.length) {
      await this.database.db.updateTable('live_sessions').set({ status: 'ended', current_position: next }).where('id', '=', sessionId).execute();
      this.realtime.to(`live:${session.code}`, 'live:ended', { sessionId });
      return { status: 'ended' };
    }
    const question = questions[next - 1]!;
    const options = await this.database.db
      .selectFrom('question_options')
      .select(['id', 'label', 'text'])
      .where('question_id', '=', question.id)
      .orderBy('position')
      .execute();
    await this.database.db
      .updateTable('live_sessions')
      .set({ status: 'live', current_position: next, question_started_at: new Date() })
      .where('id', '=', sessionId)
      .execute();
    const payload = { position: next, total: questions.length, questionId: question.id, prompt: question.prompt, options, points: question.points };
    this.realtime.to(`live:${session.code}`, 'live:question', payload);
    return payload;
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
