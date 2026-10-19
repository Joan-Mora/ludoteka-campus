import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import ExcelJS from 'exceljs';
import { sql } from 'kysely';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { randomToken, shortCode } from '../../core/common/crypto';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { IdentityService } from '../identity/public-api';
import { RealtimeService } from '../../core/realtime/realtime.service';
import {
  CASES, CASE_SECONDS, CLASS_GRADE, CLASS_GRADES, CLASS_GROUPS, FACTORY, FACTORY_GATES, GATES, GRADE_ACTIVITIES, GRADE_NAME, PLAY_GAMES,
  examItems, normAnswer, publicItem, publicLock, sceneView, type Activity, type Item,
} from './guest.content';
import { applyCoop, applySolo, explainGauss, parseMatrix, startCoop, startSolo, viewCoop, viewSolo, type Coop, type Move, type Solo } from './play.engine';

const GAMES = ['diagnostico', 'final', 'fabrica', 'elementos', 'casos', ...PLAY_GAMES] as const;
type Game = (typeof GAMES)[number];

function asState<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  return (value ?? {}) as T;
}

function plain(name: string) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slug(name: string) {
  return plain(name).replace(/ /g, '.').slice(0, 40) || 'estudiante';
}

function num(value: unknown) {
  return Number(value ?? 0);
}

@Injectable()
export class GuestService {
  private hash: Promise<string> | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly identity: IdentityService,
    private readonly realtime: RealtimeService,
  ) {}

  private unusable() {
    this.hash ??= argon2.hash(randomToken(), { type: argon2.argon2id });
    return this.hash;
  }

  private gradeName(grade: number) {
    return GRADE_NAME[grade] ?? `Grado ${grade}`;
  }

  async open(user: AuthUser, input: { grade?: number; groupCode?: string }) {
    const legacy = CLASS_GROUPS.includes((input.groupCode ?? '') as (typeof CLASS_GROUPS)[number]);
    const grade = legacy ? CLASS_GRADE : Number(input.grade);
    if (!CLASS_GRADES.includes(grade as (typeof CLASS_GRADES)[number])) {
      throw new ApiError(400, 'BAD_GRADE', 'La sesión es para sexto, séptimo, octavo o noveno');
    }
    const previous = await this.database.db.selectFrom('guest_sessions').select(sql<number>`count(*)::int`.as('n')).executeTakeFirst();
    const n = num(previous?.n) + 1;
    const when = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
    const created = await this.database.db
      .insertInto('guest_sessions')
      .values({
        code: shortCode(6),
        title: `Sesión ${n} (Invitados) - ${when}`,
        grade,
        group_code: legacy ? input.groupCode! : `g${grade}`,
        opened_by: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.present(created);
  }

  async list() {
    const rows = await this.database.db.selectFrom('guest_sessions').selectAll().orderBy('opened_at', 'desc').limit(40).execute();
    return Promise.all(rows.map((row) => this.present(row)));
  }

  async one(id: string) {
    return this.present(await this.sessionById(id));
  }

  async setActivity(id: string, activity: string) {
    const row = await this.sessionById(id);
    const allowed = (GRADE_ACTIVITIES[num(row.grade)] ?? []).map((item) => item.id);
    if (!allowed.includes(activity)) throw new ApiError(400, 'BAD_ACTIVITY', 'Esa actividad no es de este grado');
    if (row.status !== 'open') throw new ApiError(409, 'CLOSED', 'Esa sesión ya está cerrada');
    await this.database.db.updateTable('guest_sessions').set({ activity }).where('id', '=', id).execute();
    this.ping(id);
    return this.one(id);
  }

  async close(id: string) {
    await this.database.db.updateTable('guest_sessions').set({ status: 'closed', closed_at: new Date() }).where('id', '=', id).where('status', '=', 'open').execute();
    this.ping(id);
    return this.one(id);
  }

  async lookup(code: string) {
    const row = await this.byCode(code);
    if (row.status !== 'open') throw new ApiError(409, 'CLOSED', 'Esta sesión ya cerró. Pídele el código nuevo a tu docente.');
    const people = await this.database.db
      .selectFrom('users')
      .select(['id', 'full_name'])
      .where('is_guest', '=', true)
      .where('guest_grade', '=', row.grade)
      .where('guest_group', '=', row.group_code)
      .orderBy('full_name')
      .execute();
    return {
      code: row.code,
      title: row.title,
      grade: num(row.grade),
      gradeName: this.gradeName(num(row.grade)),
      groupCode: row.group_code,
      people: people.map((p) => ({ id: p.id, fullName: p.full_name })),
    };
  }

  async enter(code: string, input: { userId?: string; name?: string }, client: { ip?: string | null; userAgent?: string | null }) {
    const row = await this.byCode(code);
    if (row.status !== 'open') throw new ApiError(409, 'CLOSED', 'Esta sesión ya cerró');
    const userId = input.userId ? await this.claimListed(row, input.userId) : await this.claimTyped(row, input.name ?? '');
    await this.database.db
      .insertInto('guest_joins')
      .values({ session_id: row.id, user_id: userId })
      .onConflict((oc) => oc.columns(['session_id', 'user_id']).doNothing())
      .execute();
    this.ping(row.id);
    return this.identity.issueSession(userId, 'password', client);
  }

  async mine(user: AuthUser) {
    const join = await this.database.db
      .selectFrom('guest_joins')
      .innerJoin('guest_sessions', 'guest_sessions.id', 'guest_joins.session_id')
      .selectAll('guest_sessions')
      .where('guest_joins.user_id', '=', user.id)
      .orderBy('guest_sessions.opened_at', 'desc')
      .executeTakeFirst();
    if (!join) throw new ApiError(404, 'NO_CLASS', 'Todavía no entras a una clase. Escanea el código de tu docente.');
    const activity = join.activity as Activity;
    if (join.status === 'open' && GAMES.includes(activity)) await this.ensureRun(join.id, user.id, activity);
    const runs = await this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', join.id).where('user_id', '=', user.id).execute();
    return {
      session: await this.present(join),
      activity,
      runs: Object.fromEntries(runs.map((r) => [r.game, this.runView(r)])),
      play: join.status === 'open' ? await this.playState(join.id, user.id, activity) : null,
    };
  }

  async answerDiagnostic(user: AuthUser, picks: Record<string, string>) {
    const { session } = await this.openRun(user, 'diagnostico');
    const run = await this.runOf(session.id, user.id, 'diagnostico');
    if (run.finished_at) throw new ApiError(409, 'DONE', 'Ya presentaste el diagnóstico de esta sesión');
    const elapsed = Date.now() - new Date(run.started_at).getTime();
    if (elapsed > 22 * 60_000) throw new ApiError(409, 'TIME', 'Se acabó el tiempo del diagnóstico');
    return this.finishItems(run.id, examItems(num(session.grade), 'diagnostico'), picks, 20 * 60);
  }

  async answerFinal(user: AuthUser, picks: Record<string, string>) {
    const { session } = await this.openRun(user, 'final');
    const run = await this.runOf(session.id, user.id, 'final');
    if (run.finished_at) throw new ApiError(409, 'DONE', 'Ya presentaste el examen final de esta sesión');
    return this.finishItems(run.id, examItems(num(session.grade), 'final'), picks, 30 * 60);
  }

  async play(user: AuthUser, move: Move) {
    const session = await this.openSession(user);
    const game = session.activity as Game;
    if (game === 'elementos') return this.coopMove(user, move);
    if (game === 'gauss' && move.action === 'libre') return this.freeGauss(move);
    if (!PLAY_GAMES.includes(game as (typeof PLAY_GAMES)[number])) throw new ApiError(409, 'OTHER', 'Tu docente todavía no abre un juego');
    const { session: open } = await this.openRun(user, game);
    const run = await this.runOf(open.id, user.id, game);
    if (run.finished_at) return { done: true, message: 'Esta partida ya quedó guardada', play: viewSolo(asState<Solo>(run.state)) };
    const seed = `${open.id}:${user.id}:${game}`;
    const current = asState<Solo>(run.state);
    const state = current.kind ? current : startSolo(game, seed)!;
    const result = applySolo(state, move, seed);
    const rounds = 'rounds' in result.state ? result.state.rounds : num(run.total) || 1;
    const round = 'round' in result.state ? result.state.round : 0;
    await this.database.db.updateTable('guest_runs').set({
      state: JSON.stringify(result.state),
      score: 'score' in result.state ? num(result.state.score) : 0,
      correct: result.done ? rounds : Math.max(0, round - 1),
      total: rounds,
      finished_at: result.done ? new Date() : null,
    }).where('id', '=', run.id).execute();
    this.ping(open.id);
    return { message: result.message, done: result.done, play: viewSolo(result.state) };
  }

  async freeGauss(move: Move) {
    const cells = parseMatrix((move as { matrix?: unknown }).matrix);
    if (!cells) throw new ApiError(400, 'BAD_MATRIX', 'La matriz debe tener de 1 a 6 filas y de 2 a 8 columnas, con números o fracciones');
    const steps = explainGauss(cells);
    return { steps, reduced: steps.at(-1) };
  }

  async saveDiagnostic(user: AuthUser, picks: Record<string, string>) {
    const { session } = await this.openRun(user, 'diagnostico');
    const run = await this.runOf(session.id, user.id, 'diagnostico');
    if (run.finished_at) return this.runView(run);
    const state = asState<{ picks?: Record<string, string> }>(run.state);
    state.picks = picks;
    await this.database.db.updateTable('guest_runs').set({ state: JSON.stringify(state) }).where('id', '=', run.id).execute();
    return { saved: true };
  }

  async answerFactory(user: AuthUser, choice: string) {
    const { session } = await this.openRun(user, 'fabrica');
    const run = await this.runOf(session.id, user.id, 'fabrica');
    if (run.finished_at) return { ...this.runView(run), done: true };
    const state = asState<{ scene: string; mistakes: string[]; first: string[] }>(run.state);
    const scene = FACTORY.find((s) => s.id === state.scene);
    if (!scene || scene.end || !scene.answer) throw new ApiError(409, 'DONE', 'La historia ya terminó');
    const correct = choice === scene.answer;
    if (correct && FACTORY_GATES.includes(scene.id) && !state.first.includes(scene.id)) state.first.push(scene.id);
    if (!correct && scene.topic && !state.mistakes.includes(scene.topic)) state.mistakes.push(scene.topic);
    const nextId = correct ? scene.ok! : scene.bad!;
    state.scene = nextId;
    const next = FACTORY.find((s) => s.id === nextId)!;
    const score = state.first.length * 25;
    const finished = Boolean(next.end);
    await this.database.db.updateTable('guest_runs').set({
      state: JSON.stringify(state),
      score,
      correct: state.first.length,
      total: FACTORY_GATES.length,
      finished_at: finished ? new Date() : null,
    }).where('id', '=', run.id).execute();
    this.ping(session.id);
    return { correct, explain: scene.explain, scene: sceneView(next), score, done: finished };
  }

  async answerCases(user: AuthUser, picks: Record<string, string>) {
    const { session } = await this.openRun(user, 'casos');
    const run = await this.runOf(session.id, user.id, 'casos');
    if (run.finished_at) throw new ApiError(409, 'DONE', 'Ya jugaste ¿Qué caso es?');
    const elapsed = Date.now() - new Date(run.started_at).getTime();
    if (elapsed > (CASE_SECONDS + 15) * 1000) throw new ApiError(409, 'TIME', 'Se acabó el tiempo');
    const graded = this.grade(CASES, picks);
    const bonus = elapsed <= 45_000 ? 20 : elapsed <= CASE_SECONDS * 1000 ? 10 : 0;
    await this.database.db.updateTable('guest_runs').set({
      state: JSON.stringify({ wrongs: graded.wrongs, elapsed }),
      score: graded.correct * 10 + bonus,
      correct: graded.correct,
      total: CASES.length,
      finished_at: new Date(),
    }).where('id', '=', run.id).execute();
    this.ping(session.id);
    return { correct: graded.correct, total: CASES.length, score: graded.correct * 10 + bonus, review: graded.review };
  }

  async pair(user: AuthUser) {
    const { session } = await this.openRun(user, 'elementos');
    const mine = await this.pairOf(session.id, user.id);
    const waiting = await this.database.db
      .selectFrom('guest_pairs')
      .innerJoin('users', 'users.id', 'guest_pairs.user_a')
      .select(['guest_pairs.id', 'users.full_name'])
      .where('guest_pairs.session_id', '=', session.id)
      .where('guest_pairs.user_b', 'is', null)
      .where('guest_pairs.user_a', '!=', user.id)
      .execute();
    return { pair: mine ? this.pairView(mine, user.id) : null, waiting: waiting.map((w) => ({ id: w.id, name: w.full_name })) };
  }

  async sit(user: AuthUser, pairId?: string) {
    const { session } = await this.openRun(user, 'elementos');
    const existing = await this.pairOf(session.id, user.id);
    if (existing) return this.pairView(existing, user.id);
    if (!pairId) {
      const created = await this.database.db.insertInto('guest_pairs').values({
        session_id: session.id,
        user_a: user.id,
        state: JSON.stringify(startCoop(`${session.id}:${user.id}`)),
      }).returningAll().executeTakeFirstOrThrow();
      this.ping(session.id);
      return this.pairView(created, user.id);
    }
    const updated = await this.database.db.updateTable('guest_pairs').set({
      user_b: user.id,
      updated_at: new Date(),
    }).where('id', '=', pairId).where('session_id', '=', session.id).where('user_b', 'is', null).where('user_a', '!=', user.id).returningAll().executeTakeFirst();
    if (!updated) throw new ApiError(409, 'TAKEN', 'Esa pareja ya está completa. Elige otra o abre una mesa.');
    this.ping(session.id);
    return this.pairView(updated, user.id);
  }

  async lock(user: AuthUser, choice: string) {
    const { session } = await this.openRun(user, 'elementos');
    for (let attempt = 0; attempt < 3; attempt++) {
      const pair = await this.pairOf(session.id, user.id);
      if (!pair) throw new ApiError(404, 'NO_PAIR', 'Primero busca una pareja');
      if (!pair.user_b) throw new ApiError(409, 'WAIT', 'Falta que alguien se siente contigo');
      if (pair.finished_at) return this.pairView(pair, user.id);
      const side = pair.user_a === user.id ? 'fire' : 'water';
      const state = asState<PairState>(pair.state);
      const lock = state[side];
      if (lock.solved) return this.pairView(pair, user.id);
      const correct = choice === lock.answer;
      if (correct) lock.solved = true;
      const both = state.fire.solved && state.water.solved;
      let gate = num(pair.gate);
      let scoreA = num(pair.score_a);
      let scoreB = num(pair.score_b);
      let finished: Date | null = null;
      if (correct) {
        if (side === 'fire') scoreA += 10;
        else scoreB += 10;
      }
      if (both) {
        gate += 1;
        if (gate >= GATES.length) finished = new Date();
        else Object.assign(state, this.gateState(gate));
      }
      const saved = await this.database.db.updateTable('guest_pairs').set({
        state: JSON.stringify(state),
        gate,
        score_a: scoreA,
        score_b: scoreB,
        finished_at: finished,
        updated_at: new Date(),
      }).where('id', '=', pair.id).where('updated_at', '=', pair.updated_at).returningAll().executeTakeFirst();
      if (!saved) continue;
      await this.syncPairRuns(session.id, saved);
      this.ping(session.id);
      return { correct, explain: correct ? lock.explain : 'Esa cerradura no abrió. Intenten de nuevo.', ...this.pairView(saved, user.id) };
    }
    throw new ApiError(409, 'RETRY', 'Tu pareja respondió al mismo tiempo. Vuelve a enviar.');
  }

  async board(id: string) {
    const session = await this.sessionById(id);
    const joins = await this.database.db
      .selectFrom('guest_joins')
      .innerJoin('users', 'users.id', 'guest_joins.user_id')
      .select(['users.id', 'users.full_name', 'users.guest_group', 'guest_joins.joined_at'])
      .where('guest_joins.session_id', '=', id)
      .orderBy('users.full_name')
      .execute();
    const runs = await this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', id).execute();
    const students = joins.map((join) => {
      const mine = runs.filter((r) => r.user_id === join.id);
      const byGame = Object.fromEntries(mine.map((r) => [r.game, { score: num(r.score), correct: num(r.correct), total: num(r.total), done: Boolean(r.finished_at) }]));
      const score = mine.reduce((sum, r) => sum + num(r.score), 0);
      const seconds = mine.reduce((sum, r) => sum + Math.max(0, ((r.finished_at ? new Date(r.finished_at).getTime() : Date.now()) - new Date(r.started_at).getTime()) / 1000), 0);
      const wrongs = mine.flatMap((r) => asState<{ mistakes?: string[]; wrongs?: string[] }>(r.state).mistakes ?? asState<{ wrongs?: string[] }>(r.state).wrongs ?? []);
      return { id: join.id, name: join.full_name, group: join.guest_group, joinedAt: join.joined_at, games: byGame, score, seconds: Math.round(seconds), wrongs };
    });
    const ranked = [...students].filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.seconds - b.seconds);
    return { session: await this.present(session), students, best: ranked[0] ?? null };
  }

  async export(ids: string[], from?: string, to?: string) {
    let query = this.database.db.selectFrom('guest_sessions').selectAll().orderBy('opened_at');
    if (ids.length) query = query.where('id', 'in', ids);
    if (from) query = query.where('opened_at', '>=', new Date(from));
    if (to) query = query.where('opened_at', '<', new Date(new Date(to).getTime() + 86400000));
    const sessions = await query.execute();
    const book = new ExcelJS.Workbook();
    book.creator = 'Ludoteka Campus';
    const sheet = book.addWorksheet('Sesiones');
    sheet.addRow(['Sesión', 'Fecha', 'Grado', 'Estudiante', 'Actividad', 'Puntaje', 'Aciertos', 'Total', 'Minutos', 'Dificultades']);
    sheet.getRow(1).font = { bold: true };
    for (const session of sessions) {
      const view = await this.board(session.id);
      for (const student of view.students) {
        const games = Object.entries(student.games);
        if (!games.length) {
          sheet.addRow([session.title, new Date(session.opened_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }), this.gradeName(num(session.grade)), student.name, '', student.score, '', '', Math.round(student.seconds / 60), student.wrongs.join(', ')]);
        }
        for (const [game, result] of games) {
          sheet.addRow([
            session.title,
            new Date(session.opened_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
            this.gradeName(num(session.grade)),
            student.name,
            game,
            result?.score ?? '',
            result?.correct ?? '',
            result?.total ?? '',
            Math.round(student.seconds / 60),
            student.wrongs.join(', '),
          ]);
        }
      }
      if (!view.students.length) {
        sheet.addRow([session.title, new Date(session.opened_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' }), this.gradeName(num(session.grade)), session.group_code, 'Nadie entró']);
      }
    }
    sheet.columns.forEach((column) => { column.width = 22; });
    const data = await book.xlsx.writeBuffer();
    return Buffer.from(data);
  }

  private async claimListed(session: { grade: number; group_code: string }, userId: string) {
    const row = await this.database.db.selectFrom('users').select(['id', 'is_guest', 'guest_grade', 'guest_group']).where('id', '=', userId).executeTakeFirst();
    if (!row?.is_guest || num(row.guest_grade) !== num(session.grade) || row.guest_group !== session.group_code) {
      throw new ApiError(404, 'NOT_ON_LIST', 'Ese nombre no está en la lista de este grupo');
    }
    return row.id;
  }

  private async claimTyped(session: { grade: number; group_code: string }, raw: string) {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (name.length < 3 || name.length > 80) throw new ApiError(400, 'BAD_NAME', 'Escribe tu nombre y apellido');
    const people = await this.database.db.selectFrom('users').select(['id', 'full_name']).where('is_guest', '=', true).where('guest_group', '=', session.group_code).execute();
    const found = people.find((p) => plain(p.full_name) === plain(name));
    if (found) return found.id;
    const email = `invitado.${session.group_code}.${slug(name)}.${shortCode(4).toLowerCase()}@invitados.ludoteka.local`;
    const created = await this.database.db.insertInto('users').values({
      email,
      password_hash: await this.unusable(),
      full_name: name,
      is_minor: true,
      is_guest: true,
      guest_grade: session.grade,
      guest_group: session.group_code,
      must_change_password: false,
    }).returning('id').executeTakeFirstOrThrow();
    await this.database.db.insertInto('user_roles').values({ user_id: created.id, role: 'student' }).execute();
    return created.id;
  }

  private async openSession(user: AuthUser) {
    const guest = await this.database.db.selectFrom('users').select('is_guest').where('id', '=', user.id).executeTakeFirst();
    if (!guest?.is_guest) throw new ApiError(403, 'NOT_GUEST', 'Esta actividad es de la clase de invitados');
    const session = await this.database.db
      .selectFrom('guest_joins')
      .innerJoin('guest_sessions', 'guest_sessions.id', 'guest_joins.session_id')
      .selectAll('guest_sessions')
      .where('guest_joins.user_id', '=', user.id)
      .where('guest_sessions.status', '=', 'open')
      .orderBy('guest_sessions.opened_at', 'desc')
      .executeTakeFirst();
    if (!session) throw new ApiError(409, 'CLOSED', 'No hay una clase abierta para ti');
    return session;
  }

  private async coopMove(user: AuthUser, move: Move) {
    const { session } = await this.openRun(user, 'elementos');
    for (let attempt = 0; attempt < 3; attempt++) {
      const pair = await this.pairOf(session.id, user.id);
      if (!pair) throw new ApiError(404, 'NO_PAIR', 'Primero abre una mesa o siéntate con alguien');
      if (!pair.user_b) throw new ApiError(409, 'WAIT', 'Falta que alguien se siente contigo');
      if (pair.finished_at) return { ...this.pairView(pair, user.id), done: true };
      const side = pair.user_a === user.id ? 'fire' : 'water';
      const state = asState<Coop>(pair.state);
      const result = applyCoop(state.a ? state : startCoop(pair.id), side, move, pair.id);
      const scoreA = num(pair.score_a) + (side === 'fire' ? result.points : 0);
      const scoreB = num(pair.score_b) + (side === 'water' ? result.points : 0);
      const saved = await this.database.db.updateTable('guest_pairs').set({
        state: JSON.stringify(result.state),
        score_a: scoreA,
        score_b: scoreB,
        gate: result.state.round,
        finished_at: result.done ? new Date() : null,
        updated_at: new Date(),
      }).where('id', '=', pair.id).where('updated_at', '=', pair.updated_at).returningAll().executeTakeFirst();
      if (!saved) continue;
      await this.syncPairRuns(session.id, saved);
      this.ping(session.id);
      return { ...this.pairView(saved, user.id), message: result.message, done: result.done };
    }
    throw new ApiError(409, 'RETRY', 'Tu pareja movió al mismo tiempo. Intenta de nuevo.');
  }

  private async openRun(user: AuthUser, game: string) {
    const guest = await this.database.db.selectFrom('users').select('is_guest').where('id', '=', user.id).executeTakeFirst();
    if (!guest?.is_guest) throw new ApiError(403, 'NOT_GUEST', 'Esta actividad es de la clase de invitados');
    const session = await this.database.db
      .selectFrom('guest_joins')
      .innerJoin('guest_sessions', 'guest_sessions.id', 'guest_joins.session_id')
      .selectAll('guest_sessions')
      .where('guest_joins.user_id', '=', user.id)
      .where('guest_sessions.status', '=', 'open')
      .orderBy('guest_sessions.opened_at', 'desc')
      .executeTakeFirst();
    if (!session) throw new ApiError(409, 'CLOSED', 'No hay una clase abierta para ti');
    if (session.activity !== game) throw new ApiError(409, 'OTHER', 'Tu docente todavía no abre esta actividad');
    await this.ensureRun(session.id, user.id, game as Game);
    return { session };
  }

  private async ensureRun(sessionId: string, userId: string, game: Game) {
    const existing = await this.database.db.selectFrom('guest_runs').select('id').where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', game).executeTakeFirst();
    if (existing) return;
    const grade = num((await this.sessionById(sessionId)).grade);
    const solo = PLAY_GAMES.includes(game as (typeof PLAY_GAMES)[number]) && game !== 'elementos' ? startSolo(game, `${sessionId}:${userId}:${game}`) : null;
    const exam = game === 'diagnostico' || game === 'final' ? examItems(grade, game) : null;
    const state = solo ?? (game === 'fabrica' ? { scene: 'porton', mistakes: [], first: [] } : { picks: {} });
    await this.database.db.insertInto('guest_runs').values({
      session_id: sessionId,
      user_id: userId,
      game,
      total: solo && 'rounds' in solo ? solo.rounds : exam ? exam.length : game === 'fabrica' ? FACTORY_GATES.length : game === 'casos' ? CASES.length : GATES.length,
      state: JSON.stringify(state),
    }).onConflict((oc) => oc.columns(['session_id', 'user_id', 'game']).doNothing()).execute();
  }

  private async runOf(sessionId: string, userId: string, game: Game) {
    return this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', game).executeTakeFirstOrThrow();
  }

  private grade(items: Item[], picks: Record<string, string>) {
    const review = items.map((item) => {
      const yours = picks[item.id] ?? '';
      const ok = item.options.length ? yours === item.answer : normAnswer(yours) === normAnswer(item.answer);
      return { id: item.id, topic: item.topic, prompt: item.prompt, yours, answer: item.answer, explain: item.explain, ok };
    });
    return { correct: review.filter((r) => r.ok).length, wrongs: review.filter((r) => !r.ok).map((r) => r.topic), review };
  }

  private async finishItems(runId: string, items: Item[], picks: Record<string, string>, _seconds: number) {
    const graded = this.grade(items, picks);
    const score = Math.round((graded.correct / items.length) * 100);
    await this.database.db.updateTable('guest_runs').set({
      state: JSON.stringify({ picks, wrongs: graded.wrongs }),
      score,
      correct: graded.correct,
      total: items.length,
      finished_at: new Date(),
    }).where('id', '=', runId).execute();
    const run = await this.database.db.selectFrom('guest_runs').select('session_id').where('id', '=', runId).executeTakeFirstOrThrow();
    this.ping(run.session_id);
    return { score, correct: graded.correct, total: items.length, review: graded.review };
  }

  private gateState(index: number) {
    const gate = GATES[index]!;
    return {
      fire: { ...gate.fire, solved: false },
      water: { ...gate.water, solved: false },
    };
  }

  private async pairOf(sessionId: string, userId: string) {
    return this.database.db.selectFrom('guest_pairs').selectAll().where('session_id', '=', sessionId).where((eb) => eb.or([eb('user_a', '=', userId), eb('user_b', '=', userId)])).orderBy('updated_at', 'desc').executeTakeFirst();
  }

  private pairView(pair: { id: string; user_a: string; user_b: string | null; gate: number; total: number; state: unknown; score_a: number; score_b: number; finished_at: Date | null }, userId: string) {
    const side = pair.user_a === userId ? 'fire' : 'water';
    const coop = asState<Coop>(pair.state);
    if (typeof coop.a === 'number') {
      return {
        id: pair.id,
        waiting: !pair.user_b,
        score: num(side === 'fire' ? pair.score_a : pair.score_b),
        ...viewCoop(coop, side),
        side,
        done: Boolean(pair.finished_at),
      };
    }
    const state = asState<PairState>(pair.state);
    const mine = state[side];
    const other = state[side === 'fire' ? 'water' : 'fire'];
    return {
      id: pair.id,
      side,
      waiting: !pair.user_b,
      gate: num(pair.gate) + 1,
      total: GATES.length,
      done: Boolean(pair.finished_at),
      score: num(side === 'fire' ? pair.score_a : pair.score_b),
      you: mine ? { ...publicLock(mine), solved: mine.solved } : null,
      partnerSolved: Boolean(other?.solved),
    };
  }

  private async syncPairRuns(sessionId: string, pair: { user_a: string; user_b: string | null; score_a: number; score_b: number; gate: number; finished_at: Date | null }) {
    const seats: [string, number][] = [[pair.user_a, num(pair.score_a)]];
    if (pair.user_b) seats.push([pair.user_b, num(pair.score_b)]);
    for (const [userId, score] of seats) {
      await this.ensureRun(sessionId, userId, 'elementos');
      await this.database.db.updateTable('guest_runs').set({
        score,
        correct: Math.round(score / 10),
        total: GATES.length,
        finished_at: pair.finished_at,
      }).where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', 'elementos').execute();
    }
  }

  private async playState(sessionId: string, userId: string, activity: string) {
    if (activity === 'diagnostico' || activity === 'final') {
      const grade = num((await this.sessionById(sessionId)).grade);
      const run = await this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', activity).executeTakeFirst();
      const picks = asState<{ picks?: Record<string, string> }>(run?.state).picks ?? {};
      return { seconds: activity === 'final' ? 30 * 60 : 20 * 60, startedAt: run?.started_at ?? null, done: Boolean(run?.finished_at), picks, items: examItems(grade, activity).map(publicItem) };
    }
    if (PLAY_GAMES.includes(activity as (typeof PLAY_GAMES)[number]) && activity !== 'elementos') {
      const run = await this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', activity).executeTakeFirst();
      const state = asState<Solo>(run?.state);
      return state.kind ? viewSolo(state) : null;
    }
    if (activity === 'fabrica') {
      const run = await this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', 'fabrica').executeTakeFirst();
      const sceneId = asState<{ scene?: string }>(run?.state).scene ?? 'porton';
      const scene = FACTORY.find((s) => s.id === sceneId) ?? FACTORY[0]!;
      return { scene: sceneView(scene), score: num(run?.score), done: Boolean(run?.finished_at) };
    }
    if (activity === 'casos') {
      const run = await this.database.db.selectFrom('guest_runs').selectAll().where('session_id', '=', sessionId).where('user_id', '=', userId).where('game', '=', 'casos').executeTakeFirst();
      return { seconds: CASE_SECONDS, startedAt: run?.started_at ?? null, done: Boolean(run?.finished_at), items: CASES.map(publicItem) };
    }
    return null;
  }

  private runView(run: { game: string; score: number; correct: number; total: number; finished_at: Date | null; state: unknown }) {
    return { game: run.game, score: num(run.score), correct: num(run.correct), total: num(run.total), done: Boolean(run.finished_at) };
  }

  private async present(row: { id: string; code: string; title: string; grade: number; group_code: string; activity: string; status: string; opened_at: Date; closed_at: Date | null }) {
    const count = await this.database.db.selectFrom('guest_joins').select(sql<number>`count(*)::int`.as('n')).where('session_id', '=', row.id).executeTakeFirst();
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      grade: num(row.grade),
      gradeName: this.gradeName(num(row.grade)),
      groupCode: row.group_code,
      activity: row.activity,
      activities: GRADE_ACTIVITIES[num(row.grade)] ?? GRADE_ACTIVITIES[8],
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      joined: num(count?.n),
    };
  }

  private async sessionById(id: string) {
    const row = await this.database.db.selectFrom('guest_sessions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Esa sesión no existe');
    return row;
  }

  private async byCode(code: string) {
    const row = await this.database.db.selectFrom('guest_sessions').selectAll().where('code', '=', code.trim().toUpperCase()).executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Ese código no corresponde a una clase');
    return row;
  }

  private ping(sessionId: string) {
    this.realtime.to(`clase:${sessionId}`, 'clase', { refresh: true });
  }
}

interface LockState { prompt: string; topic: string; options: { id: string; text: string }[]; answer: string; explain: string; solved: boolean }
interface PairState { fire: LockState; water: LockState }
