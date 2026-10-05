import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { AiService } from '../../core/ai/ai.service';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type StudyProgressEvent } from '../../core/events/domain-events';
import { bogotaToday, shiftDate } from '../../core/time';
import { LearningService } from '../learning/public-api';
import { cleanSummary, localSummary, redact, sm2, type StudySummary } from './study.logic';

const SUMMARY_PROMPT = `Eres Luka, asistente de estudio de un colegio en Colombia (grados 6° a 11°).
Recibes los apuntes de un estudiante. Responde SOLO con JSON:
{"resumen": "3 a 5 oraciones claras", "ideas": ["3 a 6 ideas clave"], "tarjetas": [{"frente": "pregunta corta", "reverso": "respuesta breve"}]}
Reglas: usa solo lo que está en los apuntes, no inventes datos; de 3 a 6 tarjetas; español de Colombia; nada de nombres propios de personas.`;

function periodStart(period: string) {
  const today = bogotaToday();
  if (period === 'daily') return new Date(`${today}T00:00:00-05:00`);
  const weekday = (new Date(`${today}T12:00:00-05:00`).getUTCDay() + 6) % 7;
  return new Date(`${shiftDate(today, -weekday)}T00:00:00-05:00`);
}

@Injectable()
export class StudyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly ai: AiService,
    private readonly learning: LearningService,
    private readonly events: EventEmitter2,
  ) {}

  /* ---------- Resumen general ---------- */

  async overview(user: AuthUser) {
    const [pages, due, total, reviewedToday, goals, focus] = await Promise.all([
      this.database.db
        .selectFrom('notebook_pages')
        .leftJoin('courses', 'courses.id', 'notebook_pages.course_id')
        .select([
          'notebook_pages.id',
          'notebook_pages.title',
          'notebook_pages.course_id',
          'courses.title as course_title',
          'notebook_pages.updated_at',
          sql<boolean>`notebook_pages.summary IS NOT NULL`.as('summarized'),
          sql<string>`substr(notebook_pages.body, 1, 140)`.as('snippet'),
          sql<number>`(SELECT count(*) FROM flashcards f WHERE f.page_id = notebook_pages.id)`.as('cards'),
        ])
        .where('notebook_pages.user_id', '=', user.id)
        .orderBy('notebook_pages.updated_at', 'desc')
        .limit(100)
        .execute(),
      this.count(sql`SELECT count(*) AS n FROM flashcards WHERE user_id = ${user.id} AND due_at <= now()`),
      this.count(sql`SELECT count(*) AS n FROM flashcards WHERE user_id = ${user.id}`),
      this.count(sql`SELECT count(*) AS n FROM flashcard_reviews WHERE user_id = ${user.id} AND reviewed_at >= ${periodStart('daily')}`),
      this.goals(user),
      this.focus(user),
    ]);
    return {
      pages: pages.map((page) => ({ ...page, cards: Number(page.cards) })),
      cards: { due, total, reviewedToday },
      goals,
      focus,
    };
  }

  private async count(query: ReturnType<typeof sql<{ n: string | number }>>) {
    const result = await query.execute(this.database.db);
    return Number(result.rows[0]?.n ?? 0);
  }

  /* ---------- Apuntes ---------- */

  async page(user: AuthUser, id: string) {
    const page = await this.database.db.selectFrom('notebook_pages').selectAll().where('id', '=', id).where('user_id', '=', user.id).executeTakeFirst();
    if (!page) throw new ApiError(404, 'NOT_FOUND', 'El apunte no existe');
    const cards = await this.database.db
      .selectFrom('flashcards')
      .select(['id', 'front', 'back', 'source', 'due_at', 'interval_days', 'repetitions'])
      .where('page_id', '=', id)
      .orderBy('created_at')
      .execute();
    return { ...page, cards };
  }

  async createPage(user: AuthUser, input: { title: string; body: string; courseId?: string | null }) {
    if (input.courseId) await this.learning.assertAccess(user, input.courseId);
    return this.database.db
      .insertInto('notebook_pages')
      .values({ user_id: user.id, title: input.title, body: input.body, course_id: input.courseId ?? null })
      .returning(['id'])
      .executeTakeFirstOrThrow();
  }

  async updatePage(user: AuthUser, id: string, input: { title: string; body: string; courseId?: string | null }) {
    if (input.courseId) await this.learning.assertAccess(user, input.courseId);
    const result = await this.database.db
      .updateTable('notebook_pages')
      .set({ title: input.title, body: input.body, course_id: input.courseId ?? null, updated_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!Number(result.numUpdatedRows)) throw new ApiError(404, 'NOT_FOUND', 'El apunte no existe');
    return { ok: true };
  }

  async deletePage(user: AuthUser, id: string) {
    await this.database.db.deleteFrom('notebook_pages').where('id', '=', id).where('user_id', '=', user.id).execute();
    return { ok: true };
  }

  /** Resume con IA (apuntes sin datos personales); si no hay modelo, usa un resumen local. */
  async summarize(user: AuthUser, id: string) {
    const page = await this.page(user, id);
    if (page.body.trim().length < 60) throw new ApiError(400, 'TOO_SHORT', 'Escribe un poco más para poder resumir (mínimo 60 caracteres)');
    let result: StudySummary | null = null;
    let source: 'ia' | 'local' = 'ia';
    const reply = await this.ai.chatJson<{ resumen?: unknown; ideas?: unknown; tarjetas?: unknown }>(
      [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: `Título: ${redact(page.title)}\n\nApuntes:\n${redact(page.body).slice(0, 8000)}` },
      ],
      { feature: 'cuaderno.resumen', userId: user.id, temperature: 0.3 },
    );
    result = cleanSummary(reply);
    if (!result) {
      result = localSummary(page.body);
      source = 'local';
    }
    await this.database.db
      .updateTable('notebook_pages')
      .set({ summary: result.summary, key_points: JSON.stringify({ ideas: result.ideas, cards: result.cards }), summary_source: source, summarized_at: new Date() })
      .where('id', '=', id)
      .execute();
    return { ...result, source };
  }

  /** Crea las tarjetas sugeridas en el último resumen guardado (no se aceptan tarjetas del cliente con origen IA). */
  async cardsFromSummary(user: AuthUser, id: string) {
    const page = await this.page(user, id);
    const points = (page.key_points ?? null) as { cards?: { front: string; back: string }[] } | null;
    const suggested = points?.cards ?? [];
    if (!suggested.length) throw new ApiError(400, 'NO_CARDS', 'El resumen no sugirió tarjetas; crea una a mano');
    const existing = new Set(page.cards.map((card) => card.front.toLowerCase()));
    const fresh = suggested.filter((card) => !existing.has(card.front.toLowerCase()));
    if (fresh.length) {
      await this.database.db
        .insertInto('flashcards')
        .values(fresh.map((card) => ({ user_id: user.id, page_id: id, front: card.front, back: card.back, source: page.summary_source === 'ia' ? 'ia' : 'local' })))
        .execute();
    }
    return { created: fresh.length };
  }

  /* ---------- Tarjetas ---------- */

  async cards(user: AuthUser, scope: 'due' | 'all') {
    let query = this.database.db
      .selectFrom('flashcards')
      .leftJoin('notebook_pages', 'notebook_pages.id', 'flashcards.page_id')
      .select(['flashcards.id', 'flashcards.front', 'flashcards.back', 'flashcards.source', 'flashcards.due_at', 'flashcards.interval_days', 'flashcards.repetitions', 'flashcards.ease', 'notebook_pages.title as page_title'])
      .where('flashcards.user_id', '=', user.id)
      .orderBy('flashcards.due_at')
      .limit(scope === 'due' ? 50 : 300);
    if (scope === 'due') query = query.where('flashcards.due_at', '<=', new Date());
    return query.execute();
  }

  async createCard(user: AuthUser, input: { front: string; back: string; pageId?: string }) {
    if (input.pageId) await this.page(user, input.pageId);
    return this.database.db
      .insertInto('flashcards')
      .values({ user_id: user.id, page_id: input.pageId ?? null, front: input.front, back: input.back, source: 'manual' })
      .returning(['id'])
      .executeTakeFirstOrThrow();
  }

  async deleteCard(user: AuthUser, id: string) {
    await this.database.db.deleteFrom('flashcards').where('id', '=', id).where('user_id', '=', user.id).execute();
    return { ok: true };
  }

  /** Repaso SM-2. Solo cuentan tarjetas vencidas, así el XP no se puede inflar repasando sin parar. */
  async review(user: AuthUser, id: string, grade: number) {
    const outcome = await this.database.withTx(async (trx) => {
      const card = await trx.selectFrom('flashcards').selectAll().where('id', '=', id).where('user_id', '=', user.id).forUpdate().executeTakeFirst();
      if (!card) throw new ApiError(404, 'NOT_FOUND', 'La tarjeta no existe');
      if (new Date(card.due_at).getTime() > Date.now() + 60_000) throw new ApiError(409, 'NOT_DUE', 'Esta tarjeta aún no toca repasarla');
      const next = sm2({ ease: Number(card.ease), intervalDays: card.interval_days, repetitions: card.repetitions }, grade);
      const dueAt = new Date(Date.now() + next.intervalDays * 86_400_000);
      await trx
        .updateTable('flashcards')
        .set({ ease: next.ease, interval_days: next.intervalDays, repetitions: next.repetitions, due_at: dueAt, last_reviewed_at: new Date() })
        .where('id', '=', id)
        .execute();
      await trx.insertInto('flashcard_reviews').values({ card_id: id, user_id: user.id, grade, interval_days: next.intervalDays, ease: next.ease }).execute();
      return { ...next, dueAt };
    });
    this.events.emit(DomainEvents.StudyProgress, { userId: user.id, kind: 'review', refId: id, amount: 1 } satisfies StudyProgressEvent);
    return outcome;
  }

  /* ---------- Metas ---------- */

  async goals(user: AuthUser) {
    const rows = await this.database.db.selectFrom('goals').selectAll().where('user_id', '=', user.id).where('active', '=', true).orderBy('created_at').execute();
    return Promise.all(
      rows.map(async (goal) => {
        const since = periodStart(goal.period);
        const progress =
          goal.kind === 'flashcards'
            ? await this.count(sql`SELECT count(*) AS n FROM flashcard_reviews WHERE user_id = ${user.id} AND reviewed_at >= ${since}`)
            : goal.kind === 'focus_minutes'
              ? await this.count(sql`SELECT COALESCE(sum(actual_sec), 0) / 60 AS n FROM focus_sessions WHERE user_id = ${user.id} AND status = 'done' AND started_at >= ${since}`)
              : goal.kind === 'lessons'
                ? await this.count(sql`SELECT count(*) AS n FROM lesson_progress WHERE user_id = ${user.id} AND status = 'completed' AND completed_at >= ${since}`)
                : await this.count(sql`SELECT count(*) AS n FROM route_items WHERE user_id = ${user.id} AND status = 'correct' AND answered_at >= ${since}`);
        return { id: goal.id, kind: goal.kind, period: goal.period, target: goal.target, progress: Math.floor(progress), done: progress >= goal.target };
      }),
    );
  }

  async setGoal(user: AuthUser, input: { kind: string; period: string; target: number }) {
    return this.database.withTx(async (trx) => {
      await trx.updateTable('goals').set({ active: false }).where('user_id', '=', user.id).where('kind', '=', input.kind).where('period', '=', input.period).where('active', '=', true).execute();
      return trx.insertInto('goals').values({ user_id: user.id, kind: input.kind, period: input.period, target: input.target }).returning(['id']).executeTakeFirstOrThrow();
    });
  }

  async removeGoal(user: AuthUser, id: string) {
    await this.database.db.updateTable('goals').set({ active: false }).where('id', '=', id).where('user_id', '=', user.id).execute();
    return { ok: true };
  }

  /* ---------- Sesiones de enfoque ---------- */

  async focus(user: AuthUser) {
    const [running, minutesToday] = await Promise.all([
      this.database.db.selectFrom('focus_sessions').select(['id', 'planned_min', 'started_at', 'page_id']).where('user_id', '=', user.id).where('status', '=', 'running').executeTakeFirst(),
      this.count(sql`SELECT COALESCE(sum(actual_sec), 0) / 60 AS n FROM focus_sessions WHERE user_id = ${user.id} AND status = 'done' AND started_at >= ${periodStart('daily')}`),
    ]);
    return { running: running ?? null, minutesToday: Math.floor(minutesToday), serverNow: Date.now() };
  }

  async startFocus(user: AuthUser, input: { plannedMin: number; pageId?: string }) {
    if (input.pageId) await this.page(user, input.pageId);
    return this.database.withTx(async (trx) => {
      await trx
        .updateTable('focus_sessions')
        .set({ status: 'abandoned', ended_at: new Date(), actual_sec: sql<number>`LEAST(EXTRACT(EPOCH FROM now() - started_at)::INT, planned_min * 60)` })
        .where('user_id', '=', user.id)
        .where('status', '=', 'running')
        .execute();
      return trx
        .insertInto('focus_sessions')
        .values({ user_id: user.id, planned_min: input.plannedMin, page_id: input.pageId ?? null })
        .returning(['id', 'planned_min', 'started_at'])
        .executeTakeFirstOrThrow();
    });
  }

  /** Cierra la sesión; el tiempo contado no pasa de lo planeado (no se gana XP dejando la pestaña abierta). */
  async finishFocus(user: AuthUser, id: string, abandon = false) {
    const session = await this.database.db.selectFrom('focus_sessions').selectAll().where('id', '=', id).where('user_id', '=', user.id).executeTakeFirst();
    if (!session || session.status !== 'running') throw new ApiError(409, 'NOT_RUNNING', 'La sesión ya terminó');
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    const actual = Math.max(0, Math.min(elapsed, session.planned_min * 60));
    const done = !abandon && actual >= 60;
    await this.database.db
      .updateTable('focus_sessions')
      .set({ status: done ? 'done' : 'abandoned', actual_sec: actual, ended_at: new Date() })
      .where('id', '=', id)
      .execute();
    const minutes = Math.floor(actual / 60);
    if (done) this.events.emit(DomainEvents.StudyProgress, { userId: user.id, kind: 'focus', refId: id, amount: minutes } satisfies StudyProgressEvent);
    return { status: done ? 'done' : 'abandoned', minutes };
  }
}
