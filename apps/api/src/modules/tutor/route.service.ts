import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { personaLine, personaOf } from '../../core/common/companion';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type AttemptGradedEvent, type RouteSolvedEvent } from '../../core/events/domain-events';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { AiService } from '../../core/ai/ai.service';
import { IntegrityService } from '../integrity/public-api';
import { LearningProfileService } from '../profile/public-api';
import type { LearningMethod } from '@eduquest/contracts';
import {
  checkAnswer,
  defaultHint,
  isGenerator,
  mentionsAll,
  schemaFor,
  solve,
  templateExercise,
  templatePrompt,
  type AnswerKind,
  type GeneratorKey,
  type Params,
} from './route.generators';

const TOPICS: { code: string; name: string; generator: GeneratorKey; questions: string[] }[] = [
  { code: 'MAT6-OPS', name: 'Operaciones combinadas', generator: 'order_ops', questions: ['MAT6-01', 'MAT6-02'] },
  { code: 'MAT6-FRAC-EQ', name: 'Fracciones equivalentes y simplificación', generator: 'simplify', questions: ['MAT6-03'] },
  { code: 'MAT6-FRAC-OPS', name: 'Suma y resta de fracciones', generator: 'frac_add', questions: ['MAT6-04'] },
  { code: 'MAT6-MCD-MCM', name: 'MCD y MCM', generator: 'gcd_lcm', questions: [] },
  { code: 'MAT6-DEC', name: 'Operaciones con decimales', generator: 'decimal', questions: ['MAT6-05'] },
  { code: 'MAT6-PCT', name: 'Porcentajes', generator: 'percent', questions: ['MAT6-06'] },
  { code: 'MAT6-PROP', name: 'Razones y proporciones', generator: 'proportion', questions: ['MAT6-07', 'MAT6-08'] },
  { code: 'MAT6-ANG', name: 'Ángulos del triángulo', generator: 'triangle', questions: ['MAT6-09'] },
  { code: 'MAT6-AREA', name: 'Perímetro y área', generator: 'area', questions: ['MAT6-10'] },
  { code: 'MAT6-EST', name: 'Promedio y datos', generator: 'mean', questions: ['MAT6-11', 'MAT6-12'] },
];

const MAX_PENDING = 6;
const BOSS_MIN_LEVEL = 4;

/** Una estrella al nivel 4, dos al 7 y tres al 10. */
export const starsFor = (level: number) => (level >= 10 ? 3 : level >= 7 ? 2 : level >= 4 ? 1 : 0);

interface AiExercise {
  params?: Params;
  enunciado?: string;
  pista?: string;
  respuesta?: string | number;
}

interface NewItem {
  params: Params;
  prompt: string;
  hint: string;
  answer: string;
  kind: AnswerKind;
  explanation: string;
  source: 'ia' | 'plantilla';
  aiAnswer: string | null;
  verification: 'verified' | 'corrected' | 'template';
}

/** Mastery rule: two hits in a row raise the level, two misses in a row lower it. */
export function nextMastery(current: { level: number; streak: number }, correct: boolean) {
  let { level, streak } = current;
  let change: -1 | 0 | 1 = 0;
  if (correct) {
    streak = streak >= 0 ? streak + 1 : 1;
    if (streak >= 2 && level < 10) [level, streak, change] = [level + 1, 0, 1];
  } else {
    streak = streak <= 0 ? streak - 1 : -1;
    if (streak <= -2 && level > 1) [level, streak, change] = [level - 1, 0, -1];
  }
  return { level, streak: Math.max(-2, Math.min(2, streak)), change };
}

/** Vencer al jefe sube un nivel de una vez; perder no castiga. */
export function bossMastery(current: { level: number; streak: number }, correct: boolean) {
  if (!correct || current.level >= 10) return { level: current.level, streak: current.streak, change: 0 as const };
  return { level: current.level + 1, streak: 0, change: 1 as const };
}

@Injectable()
export class RouteService implements OnApplicationBootstrap {
  private readonly logger = new Logger('MiRuta');

  constructor(
    private readonly database: DatabaseService,
    private readonly ai: AiService,
    private readonly integrity: IntegrityService,
    private readonly events: EventEmitter2,
    private readonly profiles: LearningProfileService,
  ) {}

  onApplicationBootstrap() {
    void this.ensureTopics().catch((error) => this.logger.warn(`Temas no sembrados: ${error instanceof Error ? error.message : error}`));
  }

  /** Idempotent: sixth-grade topics and their link to the seeded question bank. */
  async ensureTopics() {
    const subject = await this.database.db.selectFrom('subjects').select('id').where('code', '=', 'MAT').executeTakeFirst();
    if (!subject) return;
    const grade = await this.database.db.selectFrom('grades').select('id').where('level', '=', 6).executeTakeFirst();
    await this.database.db
      .insertInto('topics')
      .values(TOPICS.map((t, i) => ({ subject_id: subject.id, grade_id: grade?.id ?? null, code: t.code, name: t.name, generator: t.generator, position: i + 1 })))
      .onConflict((oc) => oc.column('code').doNothing())
      .execute();
    for (const topic of TOPICS.filter((t) => t.questions.length)) {
      await sql`
        INSERT INTO question_topics (question_id, topic_id)
        SELECT q.id, t.id FROM questions q, topics t
        WHERE t.code = ${topic.code} AND q.code IN (${sql.join(topic.questions)})
        ON CONFLICT (question_id) DO NOTHING
      `.execute(this.database.db);
    }
  }

  /** First visit: start each topic from the student's history in the question bank (capped at level 5). */
  private async seedMastery(userId: string) {
    const existing = await this.database.db.selectFrom('topic_mastery').select('topic_id').where('user_id', '=', userId).limit(1).executeTakeFirst();
    if (existing) return;
    const history = await sql<{ topic_id: string; n: number; ok: number }>`
      SELECT qt.topic_id, count(*)::INT AS n, sum(CASE WHEN aa.correct THEN 1 ELSE 0 END)::INT AS ok
      FROM attempt_answers aa
      JOIN attempts a ON a.id = aa.attempt_id
      JOIN question_topics qt ON qt.question_id = aa.question_id
      WHERE a.user_id = ${userId}
      GROUP BY qt.topic_id
    `.execute(this.database.db);
    const topics = await this.database.db.selectFrom('topics').select('id').execute();
    if (!topics.length) return;
    const byTopic = new Map(history.rows.map((row) => [row.topic_id, row]));
    await this.database.db
      .insertInto('topic_mastery')
      .values(topics.map((t) => {
        const h = byTopic.get(t.id);
        return {
          user_id: userId,
          topic_id: t.id,
          level: h ? Math.max(1, Math.min(5, 1 + Math.round((h.ok / h.n) * 4))) : 1,
          correct_count: h?.ok ?? 0,
          attempt_count: h?.n ?? 0,
        };
      }))
      .onConflict((oc) => oc.columns(['user_id', 'topic_id']).doNothing())
      .execute();
  }

  async overview(user: AuthUser) {
    await this.seedMastery(user.id);
    const topics = await sql<{
      id: string; code: string; name: string; generator: string; level: number; streak: number; correct_count: number; attempt_count: number; pending: number;
      crowns: number; boss_pending: boolean;
    }>`
      SELECT t.id, t.code, t.name, t.generator,
             coalesce(m.level, 1) AS level, coalesce(m.streak, 0) AS streak,
             coalesce(m.correct_count, 0) AS correct_count, coalesce(m.attempt_count, 0) AS attempt_count,
             (SELECT count(*)::INT FROM route_items r WHERE r.user_id = ${user.id} AND r.topic_id = t.id AND r.status = 'pending') AS pending,
             (SELECT count(*)::INT FROM route_items r WHERE r.user_id = ${user.id} AND r.topic_id = t.id AND r.boss AND r.status = 'correct') AS crowns,
             EXISTS (SELECT 1 FROM route_items r WHERE r.user_id = ${user.id} AND r.topic_id = t.id AND r.boss AND r.status = 'pending') AS boss_pending
      FROM topics t
      LEFT JOIN topic_mastery m ON m.topic_id = t.id AND m.user_id = ${user.id}
      ORDER BY t.position
    `.execute(this.database.db);
    const pending = await this.database.db
      .selectFrom('route_items')
      .innerJoin('topics', 'topics.id', 'route_items.topic_id')
      .select([
        'route_items.id',
        'route_items.topic_id',
        'topics.name as topic',
        'route_items.level',
        'route_items.prompt',
        'route_items.hint',
        'route_items.source',
        'route_items.created_at',
        'route_items.generator',
        'route_items.params',
        'route_items.method',
        'route_items.boss',
      ])
      .where('route_items.user_id', '=', user.id)
      .where('route_items.status', '=', 'pending')
      .orderBy('route_items.created_at')
      .limit(MAX_PENDING)
      .execute();
    const recent = await this.database.db
      .selectFrom('route_items')
      .innerJoin('topics', 'topics.id', 'route_items.topic_id')
      .select(['route_items.id', 'topics.name as topic', 'route_items.level', 'route_items.prompt', 'route_items.status', 'route_items.given', 'route_items.answer', 'route_items.explanation', 'route_items.verification', 'route_items.answered_at', 'route_items.method', 'route_items.boss'])
      .where('route_items.user_id', '=', user.id)
      .where('route_items.status', '!=', 'pending')
      .orderBy('route_items.answered_at', 'desc')
      .limit(8)
      .execute();
    const rows = topics.rows.map((t) => ({
      ...t,
      stars: starsFor(t.level),
      crowns: Number(t.crowns),
      bossReady: t.level >= BOSS_MIN_LEVEL && !t.boss_pending,
    }));
    const suggestion = [...rows].sort((a, b) => a.level - b.level || a.attempt_count - b.attempt_count)[0] ?? null;
    const average = rows.length ? Math.round((rows.reduce((s, t) => s + t.level, 0) / rows.length) * 10) / 10 : 0;
    const method = await this.profiles.methodOf(user.id);
    return {
      topics: rows,
      pending,
      recent,
      suggestion: suggestion ? { topicId: suggestion.id, name: suggestion.name, level: suggestion.level } : null,
      average,
      method,
      stars: rows.reduce((s, t) => s + t.stars, 0),
      bossMinLevel: BOSS_MIN_LEVEL,
    };
  }

  /** Ejemplos resueltos de plantilla al nivel del estudiante, para la sección «Ejemplos» de Mi espacio. */
  async examples(user: AuthUser, topicId: string) {
    const row = await sql<{ name: string; generator: string; level: number }>`
      SELECT t.name, t.generator, coalesce(m.level, 1) AS level FROM topics t
      LEFT JOIN topic_mastery m ON m.topic_id = t.id AND m.user_id = ${user.id}
      WHERE t.id = ${topicId}`.execute(this.database.db);
    const topic = row.rows[0];
    if (!topic || !isGenerator(topic.generator)) throw new ApiError(404, 'NOT_FOUND', 'El tema no existe');
    const generator = topic.generator;
    const seen = new Set<string>();
    const items = [];
    for (let i = 0; i < 12 && items.length < 3; i++) {
      const exercise = templateExercise(generator, Math.max(1, topic.level - 1 + (items.length % 2)));
      if (seen.has(exercise.prompt)) continue;
      seen.add(exercise.prompt);
      items.push({ prompt: exercise.prompt, hint: exercise.hint, answer: exercise.answer, explanation: exercise.explanation, params: exercise.params });
    }
    return { topic: { id: topicId, name: topic.name, level: topic.level, generator }, items };
  }

  async generate(user: AuthUser, input: { topicId?: string; count?: number; method?: LearningMethod; boss?: boolean }) {
    if (await this.integrity.hasBlockingAttempt(user.id)) {
      throw new ApiError(403, 'KIOSK_ACTIVE', 'Mi ruta se pausa durante un examen. Termina la evaluación y vuelve.');
    }
    await this.seedMastery(user.id);
    const pending = await this.database.db
      .selectFrom('route_items')
      .select(sql<number>`count(*)::INT`.as('n'))
      .where('user_id', '=', user.id)
      .where('status', '=', 'pending')
      .executeTakeFirstOrThrow();
    const room = MAX_PENDING - pending.n;
    if (room <= 0) throw new ApiError(409, 'ROUTE_FULL', 'Responde o salta los retos pendientes antes de pedir más.');
    if (input.boss && !input.topicId) throw new ApiError(400, 'TOPIC_REQUIRED', 'El reto jefe es de un tema');
    const count = input.boss ? 1 : Math.min(room, Math.max(1, Math.min(5, input.count ?? 3)));
    const method = input.method ?? (await this.profiles.methodOf(user.id));

    const topic = input.topicId
      ? await sql<{ id: string; name: string; generator: string; level: number }>`
          SELECT t.id, t.name, t.generator, coalesce(m.level, 1) AS level FROM topics t
          LEFT JOIN topic_mastery m ON m.topic_id = t.id AND m.user_id = ${user.id}
          WHERE t.id = ${input.topicId}`.execute(this.database.db)
      : await sql<{ id: string; name: string; generator: string; level: number }>`
          SELECT t.id, t.name, t.generator, coalesce(m.level, 1) AS level FROM topics t
          LEFT JOIN topic_mastery m ON m.topic_id = t.id AND m.user_id = ${user.id}
          ORDER BY coalesce(m.level, 1), coalesce(m.attempt_count, 0), t.position LIMIT 1`.execute(this.database.db);
    const row = topic.rows[0];
    if (!row || !isGenerator(row.generator)) throw new ApiError(404, 'NOT_FOUND', 'El tema no existe');
    let level = row.level;
    if (input.boss) {
      if (row.level < BOSS_MIN_LEVEL) throw new ApiError(409, 'BOSS_LOCKED', `El jefe de este tema aparece desde el nivel ${BOSS_MIN_LEVEL}`);
      const open = await this.database.db
        .selectFrom('route_items')
        .select('id')
        .where('user_id', '=', user.id)
        .where('topic_id', '=', row.id)
        .where('boss', '=', true)
        .where('status', '=', 'pending')
        .executeTakeFirst();
      if (open) throw new ApiError(409, 'BOSS_PENDING', 'Ya tienes el jefe de este tema esperándote');
      level = Math.min(10, row.level + 2);
    }

    const items = await this.build(row.generator, row.name, level, count, user.id, method);
    const saved = await this.database.db
      .insertInto('route_items')
      .values(items.map((item) => ({
        user_id: user.id,
        topic_id: row.id,
        level,
        method,
        boss: Boolean(input.boss),
        generator: row.generator,
        params: JSON.stringify(item.params),
        prompt: item.prompt,
        hint: item.hint,
        answer: item.answer,
        answer_kind: item.kind,
        explanation: item.explanation,
        source: item.source,
        ai_answer: item.aiAnswer,
        verification: item.verification,
      })))
      .returning(['id', 'prompt', 'hint', 'source', 'level', 'generator', 'params', 'method', 'boss'])
      .execute();
    return {
      topic: { id: row.id, name: row.name, level: row.level },
      items: saved,
      fromAi: items.filter((i) => i.source === 'ia').length,
      corrected: items.filter((i) => i.verification === 'corrected').length,
    };
  }

  /**
   * The model proposes params, statement and its own answer. The server re-validates the params,
   * recomputes the answer and only keeps the model's statement if it quotes every number.
   */
  private async build(generator: GeneratorKey, topicName: string, level: number, count: number, userId: string, method: LearningMethod | null): Promise<NewItem[]> {
    const out: NewItem[] = [];
    const persona = await personaOf(this.database, userId);
    const style = this.profiles.routeStyle(method);
    const proposal = await this.ai.chatJson<{ ejercicios?: AiExercise[] }>(
      [
        {
          role: 'system',
          content: `Generas ejercicios de matemáticas de grado sexto para un colegio de Colombia. Respondes solo JSON válido. No uses LaTeX ni nombres de personas reales. ${personaLine(persona)} Las pistas van en segunda persona y con tono amable.`,
        },
        {
          role: 'user',
          content: [
            `Tema: ${topicName}. Nivel ${level} de 10. Genera ${count} ejercicios distintos entre sí.`,
            `Cada ejercicio usa "params" con esta forma: ${schemaFor(generator, level)}.`,
            '"enunciado": problema corto (máximo 3 frases) de la vida diaria en Colombia que incluya todos los números de params tal cual, sin dar la respuesta, y que termine con la pregunta que se debe responder.',
            ...(style ? [`Estilo de redacción: ${style}`] : []),
            '"pista": orienta el primer paso sin resolver. "respuesta": tu resultado (fracciones como a/b irreducible, decimales con coma).',
            'Formato: {"ejercicios":[{"params":{},"enunciado":"","pista":"","respuesta":""}]}',
          ].join('\n'),
        },
      ],
      { feature: 'ruta.generar', userId, smart: true, temperature: 0.8 },
    );
    for (const candidate of proposal?.ejercicios ?? []) {
      if (out.length >= count || !candidate?.params || typeof candidate.params !== 'object') continue;
      const solution = solve(generator, candidate.params);
      if (!solution) continue;
      const statement = typeof candidate.enunciado === 'string' ? candidate.enunciado.trim() : '';
      const usable = statement.length >= 10 && statement.length <= 600 && mentionsAll(generator, candidate.params, statement);
      const aiAnswer = candidate.respuesta === undefined || candidate.respuesta === null ? null : String(candidate.respuesta).slice(0, 60);
      out.push({
        ...solution,
        params: candidate.params,
        prompt: usable ? statement : templatePrompt(generator, candidate.params),
        hint: typeof candidate.pista === 'string' && candidate.pista.trim() ? candidate.pista.trim().slice(0, 300) : defaultHint(generator, candidate.params),
        source: 'ia',
        aiAnswer,
        verification: aiAnswer && checkAnswer(solution.kind, solution.answer, aiAnswer) ? 'verified' : 'corrected',
      });
    }
    while (out.length < count) {
      const exercise = templateExercise(generator, level);
      out.push({ ...exercise, source: 'plantilla', aiAnswer: null, verification: 'template' });
    }
    return out;
  }

  async answer(user: AuthUser, id: string, given: string) {
    const item = await this.database.db.selectFrom('route_items').selectAll().where('id', '=', id).where('user_id', '=', user.id).executeTakeFirst();
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'El reto no existe');
    if (item.status !== 'pending') throw new ApiError(409, 'ALREADY_ANSWERED', 'Ese reto ya fue respondido');
    const correct = checkAnswer(item.answer_kind as AnswerKind, item.answer, given);
    const mastery = await this.database.withTx(async (trx) => {
      const updated = await trx
        .updateTable('route_items')
        .set({ status: correct ? 'correct' : 'wrong', given: given.slice(0, 60), answered_at: new Date() })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();
      if (!Number(updated.numUpdatedRows)) throw new ApiError(409, 'ALREADY_ANSWERED', 'Ese reto ya fue respondido');
      const current = await sql<{ level: number; streak: number }>`
        SELECT level, streak FROM topic_mastery WHERE user_id = ${user.id} AND topic_id = ${item.topic_id} FOR UPDATE
      `.execute(trx);
      const before = current.rows[0] ?? { level: 1, streak: 0 };
      const next = item.boss ? bossMastery(before, correct) : nextMastery(before, correct);
      await trx.updateTable('route_items').set({ level_change: next.change }).where('id', '=', id).execute();
      await sql`
        INSERT INTO topic_mastery (user_id, topic_id, level, streak, correct_count, attempt_count, updated_at)
        VALUES (${user.id}, ${item.topic_id}, ${next.level}, ${next.streak}, ${correct ? 1 : 0}, 1, now())
        ON CONFLICT (user_id, topic_id) DO UPDATE SET
          level = excluded.level, streak = excluded.streak,
          correct_count = topic_mastery.correct_count + excluded.correct_count,
          attempt_count = topic_mastery.attempt_count + 1, updated_at = now()
      `.execute(trx);
      return next;
    });
    if (correct) {
      this.events.emit(DomainEvents.RouteSolved, { userId: user.id, itemId: id, level: item.level, levelUp: mastery.change === 1 } satisfies RouteSolvedEvent);
    }
    return {
      correct,
      answer: item.answer,
      explanation: item.explanation,
      verification: item.verification,
      boss: item.boss,
      mastery: { level: mastery.level, change: mastery.change, stars: starsFor(mastery.level) },
    };
  }

  async skip(user: AuthUser, id: string) {
    const result = await this.database.db
      .updateTable('route_items')
      .set({ status: 'skipped', answered_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .where('status', '=', 'pending')
      .returning(['answer', 'explanation'])
      .executeTakeFirst();
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'El reto no existe o ya fue respondido');
    return result;
  }

  /** Assessment answers also move mastery: ≥ 80 % in a topic raises it, < 50 % lowers it. */
  @OnEvent(DomainEvents.AttemptGraded)
  async onAttempt(event: AttemptGradedEvent) {
    const existing = await this.database.db.selectFrom('topic_mastery').select('topic_id').where('user_id', '=', event.userId).limit(1).executeTakeFirst();
    if (!existing) return this.seedMastery(event.userId);
    const rows = await sql<{ topic_id: string; n: number; ok: number }>`
      SELECT qt.topic_id, count(*)::INT AS n, sum(CASE WHEN aa.correct THEN 1 ELSE 0 END)::INT AS ok
      FROM attempt_answers aa JOIN question_topics qt ON qt.question_id = aa.question_id
      WHERE aa.attempt_id = ${event.attemptId}
      GROUP BY qt.topic_id
    `.execute(this.database.db);
    for (const row of rows.rows) {
      const ratio = row.ok / row.n;
      const delta = ratio >= 0.8 ? 1 : ratio < 0.5 ? -1 : 0;
      await sql`
        INSERT INTO topic_mastery (user_id, topic_id, level, correct_count, attempt_count, updated_at)
        VALUES (${event.userId}, ${row.topic_id}, ${Math.max(1, 1 + delta)}, ${row.ok}, ${row.n}, now())
        ON CONFLICT (user_id, topic_id) DO UPDATE SET
          level = greatest(1, least(10, topic_mastery.level + ${delta})), streak = 0,
          correct_count = topic_mastery.correct_count + excluded.correct_count,
          attempt_count = topic_mastery.attempt_count + excluded.attempt_count, updated_at = now()
      `.execute(this.database.db);
    }
  }

  /** Teacher heat map: students of the course group × topics of its subject. */
  async courseMastery(user: AuthUser, courseId: string) {
    const course = await this.database.db.selectFrom('courses').select(['id', 'teacher_id', 'group_id', 'subject_id', 'title']).where('id', '=', courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    if (user.role === 'teacher' && course.teacher_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Solo ves la maestría de tus cursos');
    const topics = await this.database.db.selectFrom('topics').select(['id', 'name', 'code']).where('subject_id', '=', course.subject_id).orderBy('position').execute();
    const cells = await sql<{ user_id: string; full_name: string; topic_id: string | null; level: number | null; attempt_count: number | null }>`
      SELECT u.id AS user_id, u.full_name, m.topic_id, m.level, m.attempt_count
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN topic_mastery m ON m.user_id = u.id
      WHERE e.group_id = ${course.group_id} AND e.status = 'active'
      ORDER BY u.full_name
    `.execute(this.database.db);
    const students = new Map<string, { id: string; name: string; levels: Record<string, number>; attempts: number }>();
    for (const cell of cells.rows) {
      const student = students.get(cell.user_id) ?? { id: cell.user_id, name: cell.full_name, levels: {}, attempts: 0 };
      if (cell.topic_id && cell.level !== null) {
        student.levels[cell.topic_id] = cell.level;
        student.attempts += cell.attempt_count ?? 0;
      }
      students.set(cell.user_id, student);
    }
    const list = [...students.values()].map((s) => {
      const values = Object.values(s.levels);
      return { ...s, average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null };
    });
    const topicAverages = topics.map((t) => {
      const values = list.map((s) => s.levels[t.id]).filter((v): v is number => v !== undefined);
      return { topicId: t.id, average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null };
    });
    return { course: { id: course.id, title: course.title }, topics, students: list, topicAverages };
  }
}