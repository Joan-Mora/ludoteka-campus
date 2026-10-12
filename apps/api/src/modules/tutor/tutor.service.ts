import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents } from '../../core/events/domain-events';
import { shortCode } from '../../core/common/crypto';
import { personaLine, personaOf } from '../../core/common/companion';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { GuardiansService } from '../identity/public-api';
import { IntegrityService } from '../integrity/public-api';
import { LibraryService } from '../library/public-api';
import { LearningProfileService } from '../profile/public-api';
import type { LearningMethod } from '@eduquest/contracts';
import { AiService } from '../../core/ai/ai.service';

const SYSTEM = `Eres el tutor de matemáticas de sexto del Colegio Francisco Arango, dentro de Ludoteka Campus.
Ayudas a practicar. Das pistas, preguntas y un siguiente paso. No entregas la respuesta final ni resuelves el ejercicio completo.
Si te piden la respuesta directa, devuelve una pista más pequeña.
No hables de temas ajenos al curso. Responde en español, breve, con calma.
No uses LaTeX ni signos $: escribe las operaciones con ×, ÷ y /.`;

@Injectable()
export class TutorService {
  constructor(
    private readonly database: DatabaseService,
    private readonly env: Env,
    private readonly integrity: IntegrityService,
    private readonly events: EventEmitter2,
    private readonly ai: AiService,
    private readonly guardians: GuardiansService,
    private readonly library: LibraryService,
    private readonly profiles: LearningProfileService,
  ) {}

  async chat(user: AuthUser, input: { message: string; courseId?: string; lessonId?: string; conversationId?: string; method?: LearningMethod }) {
    if (await this.integrity.hasBlockingAttempt(user.id)) {
      throw new ApiError(403, 'KIOSK_ACTIVE', 'El tutor se apaga durante un examen. Termina la evaluación y vuelve a practicar.');
    }
    if (user.role === 'student' && !(await this.guardians.isAuthorized(user.id, 'ai_tutor'))) {
      throw new ApiError(403, 'GUARDIAN_REQUIRED', 'Tu acudiente debe autorizar el tutor con IA desde su panel antes de que puedas usarlo.');
    }
    let conversationId = input.conversationId;
    if (!conversationId) {
      const created = await this.database.db
        .insertInto('tutor_conversations')
        .values({ user_id: user.id, course_id: input.courseId ?? null, lesson_id: input.lessonId ?? null })
        .returning('id')
        .executeTakeFirstOrThrow();
      conversationId = created.id;
    }
    await this.database.db
      .insertInto('tutor_messages')
      .values({ conversation_id: conversationId, role: 'user', content: input.message })
      .execute();
    const lesson = input.lessonId
      ? await this.database.db.selectFrom('lessons').select(['title', 'body_md']).where('id', '=', input.lessonId).executeTakeFirst()
      : null;
    const history = await this.database.db
      .selectFrom('tutor_messages')
      .select(['role', 'content'])
      .where('conversation_id', '=', conversationId)
      .orderBy('created_at')
      .limit(12)
      .execute();
    const context = lesson ? `Lección «${lesson.title}»:\n${lesson.body_md.slice(0, 2500)}` : 'Práctica general de matemáticas de sexto.';
    const citations = await this.library.search(user, input.message, { limit: 3 }).catch(() => []);
    const sources = citations.length
      ? `Fragmentos de la biblioteca del colegio. Si los usas, cítalos con [n]:\n${citations.map((c) => `[${c.n}] «${c.title}»${c.page ? `, pág. ${c.page}` : ''}: ${c.excerpt}`).join('\n')}`
      : null;
    const [persona, method] = await Promise.all([personaOf(this.database, user.id), input.method ?? (user.role === 'student' ? this.profiles.methodOf(user.id) : null)]);
    const style = this.profiles.tutorStyle(method);
    const llm = await this.ai.chatText(
      [
        { role: 'system', content: `${SYSTEM}\n${personaLine(persona)}${style ? `\n${style}` : ''}` },
        { role: 'system', content: context },
        ...(sources ? [{ role: 'system' as const, content: sources }] : []),
        ...history.map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content })),
      ],
      { feature: 'tutor', userId: user.id },
    );
    const content = llm ?? this.localHint(input.message, lesson?.title, lesson?.body_md);
    const cited = llm ? citations.filter((c) => content.includes(`[${c.n}]`)) : [];
    await this.database.db
      .insertInto('tutor_messages')
      .values({ conversation_id: conversationId, role: 'assistant', content, citations: cited.length ? JSON.stringify(cited) : null })
      .execute();
    this.events.emit(DomainEvents.TutorMessage, { userId: user.id });
    return { conversationId, content, citations: cited, source: llm ? 'llm' : 'leccion' };
  }

  private localHint(message: string, title?: string, body?: string) {
    const excerpt = (body ?? 'Empieza por escribir los datos que ya conoces y la pregunta exacta.').replace(/\s+/g, ' ').slice(0, 420);
    return `Pista desde ${title ? `«${title}»` : 'el temario de sexto'}. No te voy a dar el resultado de «${message.slice(0, 80)}».\n\n${excerpt}\n\nDime qué dato del enunciado ya tienes y cuál te falta.`;
  }

  async drafts(user: AuthUser, input: { courseId: string; topic: string; count?: number }) {
    const course = await this.database.db.selectFrom('courses').selectAll().where('id', '=', input.courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    if (course.teacher_id !== user.id && user.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Solo el docente pide borradores');
    const count = input.count ?? 2;
    const llm = await this.ai.chatText(
      [
        { role: 'system', content: 'Genera preguntas de opción múltiple para matemáticas de sexto. Responde solo JSON: {"questions":[{"prompt":"","explanation":"","options":[{"text":"","correct":false}]}]}' },
        { role: 'user', content: `Tema: ${input.topic}. Cantidad: ${count}. Una sola opción correcta por pregunta.` },
      ],
      { feature: 'docente.borradores', userId: user.id, smart: true, json: true },
    );
    const parsed = this.parseDrafts(llm, input.topic, count);
    const saved = [];
    for (const draft of parsed) {
      const question = await this.database.withTx(async (trx) => {
        const row = await trx
          .insertInto('questions')
          .values({
            code: `DRAFT-${shortCode(8)}`,
            subject_id: course.subject_id,
            prompt: draft.prompt,
            explanation: draft.explanation,
            created_by: user.id,
            active: false,
            difficulty: 'media',
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        for (const [index, option] of draft.options.entries()) {
          await trx
            .insertInto('question_options')
            .values({
              question_id: row.id,
              label: String.fromCharCode(65 + index),
              text: option.text,
              is_correct: option.correct,
              position: index + 1,
            })
            .execute();
        }
        return row;
      });
      saved.push(question);
    }
    return { questions: saved, source: llm ? 'llm' : 'plantilla' };
  }

  private parseDrafts(raw: string | null, topic: string, count: number) {
    if (raw) {
      try {
        const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as {
          questions: { prompt: string; explanation?: string; options: { text: string; correct: boolean }[] }[];
        };
        if (json.questions?.length) {
          return json.questions.slice(0, count).map((question) => ({
            prompt: question.prompt,
            explanation: question.explanation ?? '',
            options: question.options.slice(0, 4),
          }));
        }
      } catch {
        /* plantilla local */
      }
    }
    return Array.from({ length: count }, (_, index) => ({
      prompt: `Borrador ${index + 1} sobre ${topic}: plantea un problema de sexto y márcalo como revisión del docente.`,
      explanation: 'Generado sin modelo externo. El docente debe reescribirlo antes de activarlo.',
      options: [
        { text: 'Revisar enunciado', correct: false },
        { text: 'Completar datos', correct: true },
        { text: 'Publicar sin mirar', correct: false },
      ],
    }));
  }

  async recommend(user: AuthUser, courseId: string) {
    const course = await this.database.db.selectFrom('courses').selectAll().where('id', '=', courseId).executeTakeFirst();
    if (!course || (course.teacher_id !== user.id && user.role !== 'admin')) {
      throw new ApiError(403, 'FORBIDDEN', 'Solo el docente pide recomendaciones');
    }
    const students = await this.database.db
      .selectFrom('enrollments')
      .innerJoin('users', 'users.id', 'enrollments.user_id')
      .leftJoin('attempts', 'attempts.user_id', 'users.id')
      .leftJoin('assessments', (join) =>
        join.onRef('assessments.id', '=', 'attempts.assessment_id').on('assessments.course_id', '=', courseId),
      )
      .select([
        'users.id',
        'users.full_name',
        sql<number>`coalesce(avg(case when attempts.max_score > 0 then attempts.score * 100.0 / attempts.max_score end), 0)`.as('avg'),
      ])
      .where('enrollments.group_id', '=', course.group_id)
      .where('enrollments.status', '=', 'active')
      .groupBy(['users.id', 'users.full_name'])
      .execute();
    const weak = students.filter((student) => Number(student.avg) < 60);
    const saved = [];
    for (const student of weak) {
      const llm = await this.ai.chatText(
        [
          { role: 'system', content: 'Escribe una recomendación breve para el docente, en español, sin diagnosticar. Máximo 80 palabras. El estudiante aparece como "el estudiante".' },
          { role: 'user', content: `El estudiante tiene promedio ${Math.round(Number(student.avg))}% en ${course.title}.` },
        ],
        { feature: 'docente.recomendaciones', userId: user.id },
      );
      const body = llm ?? `${student.full_name} va en ${Math.round(Number(student.avg))}%. Conviene repetir la lección anterior con un problema más corto y revisar la tarea antes del examen.`;
      const row = await this.database.db
        .insertInto('recommendations')
        .values({ teacher_id: user.id, course_id: courseId, student_id: student.id, body })
        .returningAll()
        .executeTakeFirstOrThrow();
      saved.push({ ...row, fullName: student.full_name });
    }
    return saved;
  }

  listRecommendations(courseId: string) {
    return this.database.db
      .selectFrom('recommendations')
      .innerJoin('users', 'users.id', 'recommendations.student_id')
      .select(['recommendations.id', 'recommendations.body', 'recommendations.created_at', 'users.full_name'])
      .where('recommendations.course_id', '=', courseId)
      .orderBy('recommendations.created_at', 'desc')
      .execute();
  }
}
