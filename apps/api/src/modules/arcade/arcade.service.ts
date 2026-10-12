import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { ARCADE_GAMES, ARCADE_INFO, type ArcadeGame } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type ArcadeFinishedEvent } from '../../core/events/domain-events';
import { bogotaToday, shiftDate } from '../../core/time';
import { IntegrityService } from '../integrity/public-api';
import { checkAnswer } from '../tutor/public-api';
import {
  BASE_TERMS,
  buildItems,
  gridOk,
  linePoints,
  plainLetter,
  publicItem,
  seeded,
  unitsOf,
  type ArcadeItem,
  type GlossaryTerm,
} from './arcade.games';

/** Tope diario de XP del Arcade, para que jugar en bucle no reemplace las lecciones. */
export const XP_DAILY_CAP = 150;
const DAILY_LEVEL = 4;
const DAILY_BONUS = 15;
const GRACE_MS = 3000;
const HANGMAN_LIVES = 6;

interface AnswerState { given: string; ok: boolean; points: number }
interface SessionState {
  answers?: Record<string, AnswerState>;
  memory?: { matched: number[]; misses: number };
  hangman?: Record<string, { guessed: string[]; misses: number; done: boolean }>;
  lastAt?: number;
}

const parse = <T>(value: unknown, fallback: T): T => (typeof value === 'string' ? (JSON.parse(value) as T) : ((value as T) ?? fallback));
const startOfDay = (date: string) => new Date(`${date}T00:00:00-05:00`);

interface FinishResult {
  score: number;
  correct: number;
  total: number;
  xp: number;
  dailyBonus: number;
  capped: boolean;
  perfect: boolean;
  best: number;
  newBest: boolean;
}
const shortName = (full: string) => {
  const [first, second] = full.trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : first ?? full;
};

/** El reto del día es el mismo para todo el colegio: juego y preguntas salen de la fecha. */
export function dailyGame(date: string): ArcadeGame {
  return ARCADE_GAMES[Math.floor(seeded(`juego:${date}`)() * ARCADE_GAMES.length)]!;
}

function mondayOf(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

@Injectable()
export class ArcadeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly integrity: IntegrityService,
    private readonly events: EventEmitter2,
  ) {}

  private async terms(): Promise<GlossaryTerm[]> {
    const rows = await this.database.db.selectFrom('glossary_terms').select(['term', 'definition']).limit(300).execute();
    const seen = new Set<string>();
    return [...rows, ...BASE_TERMS].filter((t) => {
      const key = plainLetter(t.term.trim());
      if (seen.has(key) || t.definition.trim().length < 12) return false;
      seen.add(key);
      return true;
    });
  }

  private async topics(userId: string) {
    const rows = await sql<{ id: string; name: string; generator: string; level: number }>`
      SELECT t.id, t.name, t.generator, coalesce(m.level, 1)::INT AS level FROM topics t
      LEFT JOIN topic_mastery m ON m.topic_id = t.id AND m.user_id = ${userId}
      ORDER BY t.position`.execute(this.database.db);
    return rows.rows;
  }

  private async xpToday(userId: string, db = this.database.db) {
    const row = await db
      .selectFrom('arcade_sessions')
      .select(sql<number>`coalesce(sum(xp_awarded), 0)::INT`.as('n'))
      .where('user_id', '=', userId)
      .where('finished_at', '>=', startOfDay(bogotaToday()))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  async overview(user: AuthUser) {
    const today = bogotaToday();
    const [games, bests, topics, dailyRow, xpToday] = await Promise.all([
      this.database.db.selectFrom('arcade_games').selectAll().where('active', '=', true).orderBy('position').execute(),
      this.database.db
        .selectFrom('arcade_sessions')
        .select(['game', sql<number>`max(score)::INT`.as('best'), sql<number>`count(*)::INT`.as('plays')])
        .where('user_id', '=', user.id)
        .where('finished_at', 'is not', null)
        .groupBy('game')
        .execute(),
      this.topics(user.id),
      this.database.db
        .selectFrom('arcade_sessions')
        .select(['score', 'correct', 'total'])
        .where('user_id', '=', user.id)
        .where('daily_on', '=', today)
        .where('finished_at', 'is not', null)
        .orderBy('score', 'desc')
        .executeTakeFirst(),
      this.xpToday(user.id),
    ]);
    const byGame = new Map(bests.map((b) => [b.game, b]));
    const daily = dailyGame(today);
    return {
      games: games
        .filter((g) => (ARCADE_GAMES as readonly string[]).includes(g.code))
        .map((g) => {
          const topic = g.generator ? topics.find((t) => t.generator === g.generator) ?? null : null;
          return {
            code: g.code as ArcadeGame,
            title: g.title,
            rounds: Number(g.rounds),
            seconds: Number(g.seconds),
            topic: topic ? { id: topic.id, name: topic.name, level: Number(topic.level) } : null,
            best: Number(byGame.get(g.code)?.best ?? 0),
            plays: Number(byGame.get(g.code)?.plays ?? 0),
          };
        }),
      daily: {
        date: today,
        game: daily,
        title: ARCADE_INFO[daily].title,
        played: Boolean(dailyRow),
        score: dailyRow ? Number(dailyRow.score) : null,
        correct: dailyRow ? Number(dailyRow.correct) : null,
        total: dailyRow ? Number(dailyRow.total) : null,
      },
      xpToday,
      xpCap: XP_DAILY_CAP,
    };
  }

  async start(user: AuthUser, input: { game: ArcadeGame; topicId?: string; daily?: boolean }) {
    if (await this.integrity.hasBlockingAttempt(user.id)) {
      throw new ApiError(403, 'KIOSK_ACTIVE', 'El Arcade se pausa durante un examen. Termina la evaluación y vuelve.');
    }
    const game = await this.database.db.selectFrom('arcade_games').selectAll().where('code', '=', input.game).where('active', '=', true).executeTakeFirst();
    if (!game) throw new ApiError(404, 'NOT_FOUND', 'Ese juego no está disponible');
    const today = bogotaToday();
    let level = 3;
    let topicId: string | null = null;
    let rnd: () => number = Math.random;
    if (input.daily) {
      if (dailyGame(today) !== input.game) throw new ApiError(400, 'NOT_DAILY', 'Ese no es el reto de hoy');
      const done = await this.database.db
        .selectFrom('arcade_sessions')
        .select('id')
        .where('user_id', '=', user.id)
        .where('daily_on', '=', today)
        .where('finished_at', 'is not', null)
        .executeTakeFirst();
      if (done) throw new ApiError(409, 'DAILY_DONE', 'Ya jugaste el reto de hoy. Vuelve mañana por otro.');
      level = DAILY_LEVEL;
      rnd = seeded(`reto:${today}`);
    } else if (game.generator) {
      const topics = (await this.topics(user.id)).filter((t) => t.generator === game.generator);
      const topic = input.topicId ? topics.find((t) => t.id === input.topicId) : topics[0];
      if (input.topicId && !topic) throw new ApiError(400, 'TOPIC_MISMATCH', 'Ese tema no se juega en este juego');
      if (topic) [level, topicId] = [Math.max(1, Number(topic.level)), topic.id];
    }
    const needsTerms = input.game === 'ahorcado' || input.game === 'quiz';
    const items = buildItems(input.game, level, rnd, Number(game.rounds), needsTerms ? await this.terms() : []);
    const total = unitsOf(input.game, items);
    if (!total) throw new ApiError(409, 'NO_CONTENT', 'Todavía no hay suficiente contenido para este juego');
    const session = await this.database.db
      .insertInto('arcade_sessions')
      .values({
        user_id: user.id,
        game: input.game,
        topic_id: topicId,
        level,
        daily_on: input.daily ? today : null,
        items: JSON.stringify(items),
        state: JSON.stringify({ lastAt: Date.now() } satisfies SessionState),
        total,
      })
      .returning(['id', 'started_at'])
      .executeTakeFirstOrThrow();
    return {
      id: session.id,
      game: input.game,
      level,
      daily: Boolean(input.daily),
      seconds: Number(game.seconds),
      total,
      startedAt: session.started_at,
      items: items.map(publicItem),
    };
  }

  async answer(user: AuthUser, id: string, input: { index: number; answer: string }) {
    return this.database.withTx(async (trx) => {
      const session = await trx
        .selectFrom('arcade_sessions')
        .innerJoin('arcade_games', 'arcade_games.code', 'arcade_sessions.game')
        .select(['arcade_sessions.items', 'arcade_sessions.state', 'arcade_sessions.started_at', 'arcade_sessions.finished_at', 'arcade_games.seconds'])
        .where('arcade_sessions.id', '=', id)
        .where('arcade_sessions.user_id', '=', user.id)
        .forUpdate()
        .executeTakeFirst();
      if (!session) throw new ApiError(404, 'NOT_FOUND', 'La partida no existe');
      if (session.finished_at) throw new ApiError(409, 'FINISHED', 'La partida ya terminó');
      const now = Date.now();
      if (now > new Date(session.started_at).getTime() + Number(session.seconds) * 1000 + GRACE_MS) {
        throw new ApiError(409, 'TIME_UP', 'Se acabó el tiempo');
      }
      const items = parse<ArcadeItem[]>(session.items, []);
      const state = parse<SessionState>(session.state, {});
      const item = items[input.index];
      if (!item) throw new ApiError(400, 'BAD_INDEX', 'Esa pregunta no existe');
      const save = () => trx.updateTable('arcade_sessions').set({ state: JSON.stringify({ ...state, lastAt: now }) }).where('id', '=', id).execute();

      if (item.ui === 'memory') {
        const memory = (state.memory ??= { matched: [], misses: 0 });
        const [a, b] = input.answer.split(',').map(Number);
        const cards = item.cards?.length ?? 0;
        if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a! < 0 || b! < 0 || a! >= cards || b! >= cards || memory.matched.includes(a!) || memory.matched.includes(b!)) {
          throw new ApiError(400, 'BAD_ANSWER', 'Elige dos cartas sin pareja');
        }
        const ok = item.pairs![a!] === item.pairs![b!];
        if (ok) memory.matched.push(a!, b!);
        else memory.misses += 1;
        await save();
        return { ok, matched: memory.matched, misses: memory.misses, done: memory.matched.length === cards, explanation: memory.matched.length === cards ? item.explanation : undefined };
      }

      if (item.ui === 'hangman') {
        const letter = plainLetter(input.answer.trim())[0] ?? '';
        if (!/^[a-zñ]$/.test(letter)) throw new ApiError(400, 'BAD_ANSWER', 'Escribe una letra');
        const word = item.word ?? '';
        const game = ((state.hangman ??= {})[input.index] ??= { guessed: [], misses: 0, done: false });
        if (game.done) throw new ApiError(409, 'ALREADY_ANSWERED', 'Esa palabra ya terminó');
        const hit = [...word].some((ch) => plainLetter(ch) === letter);
        if (!game.guessed.includes(letter)) {
          game.guessed.push(letter);
          if (!hit) game.misses += 1;
        }
        const mask = [...word].map((ch) => (game.guessed.includes(plainLetter(ch)) ? ch : '_')).join('');
        const solved = !mask.includes('_');
        const failed = !solved && game.misses >= HANGMAN_LIVES;
        if (solved || failed) {
          game.done = true;
          (state.answers ??= {})[input.index] = { given: mask, ok: solved, points: solved ? Math.max(6, 20 - 2 * game.misses) : 0 };
        }
        await save();
        return {
          ok: hit,
          mask,
          misses: game.misses,
          lives: HANGMAN_LIVES,
          done: solved || failed,
          solved,
          answer: solved || failed ? word : undefined,
          explanation: solved || failed ? item.explanation : undefined,
        };
      }

      if (state.answers?.[input.index]) throw new ApiError(409, 'ALREADY_ANSWERED', 'Ya respondiste esa pregunta');
      const given = input.answer.trim();
      const quick = now - (state.lastAt ?? now);
      const speed = quick < 4000 ? 5 : quick < 8000 ? 3 : 0;
      let ok = false;
      let points = 0;
      switch (item.ui) {
        case 'input':
          ok = checkAnswer('decimal', item.answer, given);
          points = ok ? 10 + speed : 0;
          break;
        case 'choice':
          ok = given === item.answer;
          points = ok ? 10 + speed : 0;
          break;
        case 'line': {
          const value = Number(given.replace(',', '.'));
          if (!Number.isFinite(value)) throw new ApiError(400, 'BAD_ANSWER', 'Marca un punto en la recta');
          ({ ok, points } = linePoints(item, value));
          break;
        }
        case 'order':
          ok = given.replace(/\s+/g, '') === item.answer;
          points = ok ? 15 : 0;
          break;
        case 'grid':
          ok = gridOk(item, given.replace(/\s+/g, ''));
          points = ok ? 15 : 0;
          break;
      }
      (state.answers ??= {})[input.index] = { given, ok, points };
      await save();
      return { ok, points, answer: item.ui === 'grid' ? undefined : item.answer, explanation: item.explanation };
    });
  }

  async finish(user: AuthUser, id: string): Promise<FinishResult> {
    const session = await this.database.db
      .selectFrom('arcade_sessions')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!session) throw new ApiError(404, 'NOT_FOUND', 'La partida no existe');
    const total = Number(session.total);
    const previous = await this.database.db
      .selectFrom('arcade_sessions')
      .select(sql<number>`coalesce(max(score), 0)::INT`.as('best'))
      .where('user_id', '=', user.id)
      .where('game', '=', session.game)
      .where('finished_at', 'is not', null)
      .where('id', '!=', id)
      .executeTakeFirstOrThrow();
    const bestBefore = Number(previous.best);
    if (session.finished_at) {
      const score = Number(session.score ?? 0);
      return { score, correct: Number(session.correct ?? 0), total, xp: Number(session.xp_awarded ?? 0), dailyBonus: 0, capped: false, perfect: Number(session.correct) === total, best: Math.max(bestBefore, score), newBest: false };
    }
    const state = parse<SessionState>(session.state, {});
    let correct: number;
    let score: number;
    if (session.game === 'memoria') {
      const memory = state.memory ?? { matched: [], misses: 0 };
      correct = memory.matched.length / 2;
      score = Math.max(0, correct * 15 - Math.max(0, memory.misses - 3) * 3);
    } else {
      const answers = Object.values(state.answers ?? {});
      correct = answers.filter((a) => a.ok).length;
      score = answers.reduce((sum, a) => sum + a.points, 0);
    }
    const perfect = correct === total;
    const daily = Boolean(session.daily_on);
    const earned = Math.min(40, Math.round((correct / total) * 30) + (perfect ? 10 : 0));
    const dailyBonus = daily && correct > 0 ? DAILY_BONUS : 0;
    const room = Math.max(0, XP_DAILY_CAP - (await this.xpToday(user.id)));
    const xp = Math.min(earned + dailyBonus, room);
    const closed = await this.database.db
      .updateTable('arcade_sessions')
      .set({ finished_at: new Date(), correct, score, xp_awarded: xp })
      .where('id', '=', id)
      .where('finished_at', 'is', null)
      .executeTakeFirst();
    if (!Number(closed.numUpdatedRows)) return this.finish(user, id);
    await this.database.db
      .insertInto('minigame_runs')
      .values({ user_id: user.id, game: session.game, score, xp_awarded: xp, session_id: id, daily })
      .execute();
    this.events.emit(DomainEvents.ArcadeFinished, { userId: user.id, sessionId: id, game: session.game, score, correct, total, xp, daily, perfect } satisfies ArcadeFinishedEvent);
    return { score, correct, total, xp, dailyBonus: Math.min(dailyBonus, xp), capped: xp < earned + dailyBonus, perfect, best: Math.max(bestBefore, score), newBest: score > bestBefore && score > 0 };
  }

  /** Ranking del grupo: semana (suma del mejor puntaje en cada juego) o reto del día. */
  async ranking(user: AuthUser, scope: 'week' | 'daily') {
    const today = bogotaToday();
    const groups = await this.database.db
      .selectFrom('enrollments')
      .innerJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .select(['groups_class.id', 'groups_class.name'])
      .where('enrollments.user_id', '=', user.id)
      .where('enrollments.status', '=', 'active')
      .execute();
    if (!groups.length) return { scope, group: null, rows: [] };
    const groupIds = groups.map((g) => g.id);
    const filter = scope === 'daily'
      ? sql`s.daily_on = ${today}`
      : sql`s.finished_at >= ${startOfDay(mondayOf(today))}`;
    const rows = await sql<{ id: string; full_name: string; points: number; games: number }>`
      WITH mates AS (
        SELECT DISTINCT user_id FROM enrollments WHERE status = 'active' AND group_id IN (${sql.join(groupIds)})
      ), best AS (
        SELECT s.user_id, s.game, max(s.score) AS best FROM arcade_sessions s
        JOIN mates m ON m.user_id = s.user_id
        WHERE s.finished_at IS NOT NULL AND s.score IS NOT NULL AND ${filter}
        GROUP BY s.user_id, s.game
      )
      SELECT u.id, u.full_name, sum(b.best)::INT AS points, count(*)::INT AS games
      FROM best b JOIN users u ON u.id = b.user_id
      GROUP BY u.id, u.full_name
      ORDER BY points DESC, u.full_name
      LIMIT 20`.execute(this.database.db);
    return {
      scope,
      group: groups.map((g) => g.name).join(', '),
      since: scope === 'daily' ? today : mondayOf(today),
      rows: rows.rows.map((row, i) => ({ position: i + 1, name: shortName(row.full_name), points: Number(row.points), games: Number(row.games), me: row.id === user.id })),
    };
  }
}
