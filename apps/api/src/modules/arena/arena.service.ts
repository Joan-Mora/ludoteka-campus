import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomInt } from 'crypto';
import { sql } from 'kysely';
import { isBoard, type ArenaAction } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { shortCode } from '../../core/common/crypto';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type ArenaFinishedEvent } from '../../core/events/domain-events';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { LearningService } from '../learning/public-api';

export type Phase = 'lobby' | 'question' | 'vote' | 'feedback' | 'table' | 'podium' | 'ended';

const TEAM_PRESETS = [
  { name: 'Cóndores', color: '#ff5d73' },
  { name: 'Jaguares', color: '#ffb13d' },
  { name: 'Colibríes', color: '#19c39c' },
  { name: 'Guacamayas', color: '#3ab8ff' },
  { name: 'Osos de anteojos', color: '#7c5cff' },
  { name: 'Delfines rosados', color: '#d9468f' },
  { name: 'Ranas doradas', color: '#e0a800' },
  { name: 'Tortugas carey', color: '#0ea5a4' },
  { name: 'Manatíes', color: '#5b6cff' },
  { name: 'Tucanes', color: '#ff7a3d' },
];

const COMMAND_AFTER_MS = 30_000;
const EXTRA_MS = 15_000;
const SNAPSHOT_DELAY_MS = 1_500;
const REVEALED: Phase[] = ['feedback', 'table', 'podium', 'ended'];
const WITH_QUESTION: Phase[] = ['question', 'vote', 'feedback', 'table'];

interface Team {
  id: string;
  name: string;
  color: string;
  position: number;
  score: number;
  members: string[];
  captainId: string | null;
}

interface Question {
  id: string;
  prompt: string;
  explanation: string;
  options: { id: string; label: string; text: string }[];
  correctId: string;
}

interface Lock {
  optionId: string;
  by: string;
  elapsedMs: number;
  votes: Record<string, number>;
}

interface Reveal {
  teamId: string;
  optionId: string | null;
  order: number;
  correct: boolean;
  points: number;
}

interface Ranking {
  teamId: string;
  rank: number;
  score: number;
  correct: number;
}

interface Room {
  id: string;
  code: string;
  hostId: string;
  courseId: string;
  title: string;
  teamSize: number;
  questionSec: number;
  questionIds: string[];
  status: Phase;
  index: number;
  teams: Team[];
  names: Record<string, string>;
  question: Question | null;
  startedAt: number | null;
  durationMs: number;
  endsAt: number | null;
  pausedAt: number | null;
  pausedRemaining: number | null;
  pausedTotal: number;
  votes: Record<string, Record<string, string>>;
  locks: Record<string, Lock>;
  reveal: Reveal[];
  ranking: Ranking[] | null;
}

/** Lo que no vive en tablas normalizadas: se guarda con retraso en arena_rooms.snapshot. */
interface Snapshot {
  captains: Record<string, string | null>;
  votes: Room['votes'];
  locks: Room['locks'];
  startedAt: number | null;
  durationMs: number;
  endsAt: number | null;
  pausedAt: number | null;
  pausedRemaining: number | null;
  pausedTotal: number;
}

function parseUuidArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '').replace(/[{}]/g, '').split(',').filter(Boolean);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function tally(votes: Record<string, string> | undefined) {
  const out: Record<string, number> = {};
  for (const optionId of Object.values(votes ?? {})) out[optionId] = (out[optionId] ?? 0) + 1;
  return out;
}

@Injectable()
export class ArenaService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Arena');
  private readonly rooms = new Map<string, Room>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly saves = new Map<string, NodeJS.Timeout>();
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    private readonly database: DatabaseService,
    private readonly learning: LearningService,
    private readonly realtime: RealtimeService,
    private readonly events: EventEmitter2,
  ) {}

  /** Rehidrata las salas en juego para que sus cronómetros sigan corriendo tras un reinicio. */
  onApplicationBootstrap() {
    void this.database.db
      .selectFrom('arena_rooms')
      .select('id')
      .where('status', 'not in', ['lobby', 'ended'])
      .where('created_at', '>', sql<Date>`now() - INTERVAL '1 day'`)
      .execute()
      .then(async (rows) => {
        for (const row of rows) await this.load(row.id);
        if (rows.length) this.logger.log(`${rows.length} sala(s) recuperadas desde el snapshot`);
      })
      .catch((error: Error) => this.logger.warn(`No se pudieron recuperar salas: ${error.message}`));
  }

  /* ---------- Consultas ---------- */

  async list(user: AuthUser) {
    const base = this.database.db
      .selectFrom('arena_rooms')
      .innerJoin('courses', 'courses.id', 'arena_rooms.course_id')
      .select([
        'arena_rooms.id',
        'arena_rooms.code',
        'arena_rooms.title',
        'arena_rooms.status',
        'arena_rooms.created_at',
        'arena_rooms.question_ids',
        'courses.title as course_title',
        sql<number>`(SELECT count(*) FROM arena_members m WHERE m.room_id = arena_rooms.id)`.as('players'),
        sql<boolean>`EXISTS (SELECT 1 FROM arena_members m WHERE m.room_id = arena_rooms.id AND m.user_id = ${user.id})`.as('joined'),
      ])
      .orderBy('arena_rooms.created_at', 'desc')
      .limit(20);
    const rows = user.role === 'student'
      ? await base
          .where((eb) => eb.or([
            eb.and([
              eb('arena_rooms.status', '<>', 'ended'),
              eb.exists(
                eb.selectFrom('enrollments')
                  .select('enrollments.id')
                  .whereRef('enrollments.group_id', '=', 'courses.group_id')
                  .where('enrollments.user_id', '=', user.id)
                  .where('enrollments.status', '=', 'active'),
              ),
            ]),
            eb.exists(eb.selectFrom('arena_members').select('arena_members.user_id').whereRef('arena_members.room_id', '=', 'arena_rooms.id').where('arena_members.user_id', '=', user.id)),
          ]))
          .execute()
      : await (user.role === 'teacher' ? base.where('arena_rooms.host_id', '=', user.id) : base).execute();
    return rows.map(({ question_ids, ...row }) => ({ ...row, players: Number(row.players), questions: parseUuidArray(question_ids).length }));
  }

  async state(user: AuthUser, roomId: string) {
    const room = await this.load(roomId);
    this.assertViewer(user, room);
    return this.view(room, user.id);
  }

  /* ---------- Creación e ingreso ---------- */

  async create(user: AuthUser, input: { courseId: string; title?: string; assessmentId?: string; count?: number; teamSize?: number; questionSec?: number }) {
    const course = await this.learning.assertAccess(user, input.courseId, 'write');
    const hasCorrect = sql<boolean>`EXISTS (SELECT 1 FROM question_options o WHERE o.question_id = questions.id AND o.is_correct)`;
    let questionIds: string[];
    if (input.assessmentId) {
      const assessment = await this.database.db.selectFrom('assessments').select(['course_id']).where('id', '=', input.assessmentId).executeTakeFirst();
      if (!assessment || assessment.course_id !== course.id) throw new ApiError(404, 'NOT_FOUND', 'La evaluación no es de este curso');
      const rows = await this.database.db
        .selectFrom('assessment_questions')
        .innerJoin('questions', 'questions.id', 'assessment_questions.question_id')
        .select('questions.id')
        .where('assessment_questions.assessment_id', '=', input.assessmentId)
        .where(hasCorrect)
        .orderBy('assessment_questions.position')
        .limit(30)
        .execute();
      questionIds = rows.map((row) => row.id);
    } else {
      const rows = await this.database.db
        .selectFrom('questions')
        .select('questions.id')
        .where('questions.subject_id', '=', course.subject_id)
        .where('questions.active', '=', true)
        .where(hasCorrect)
        .orderBy(sql`random()`)
        .limit(input.count ?? 8)
        .execute();
      questionIds = rows.map((row) => row.id);
    }
    if (!questionIds.length) throw new ApiError(400, 'NO_QUESTIONS', 'No hay preguntas con respuesta marcada para esta sala');

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const room = await this.database.db
          .insertInto('arena_rooms')
          .values({
            code: shortCode(6),
            host_id: user.id,
            course_id: course.id,
            title: input.title ?? `Arena · ${course.title}`.slice(0, 120),
            question_ids: questionIds,
            team_size: input.teamSize ?? 5,
            question_sec: input.questionSec ?? 45,
          })
          .returning(['id', 'code'])
          .executeTakeFirstOrThrow();
        return room;
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
      }
    }
    throw new ApiError(503, 'CODE_BUSY', 'No se pudo generar un código libre, intenta de nuevo');
  }

  async join(user: AuthUser, code: string) {
    const row = await this.database.db.selectFrom('arena_rooms').select(['id', 'course_id', 'status']).where('code', '=', code.toUpperCase()).executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'No hay una sala con ese código');
    if (row.status === 'ended') throw new ApiError(409, 'ENDED', 'La sala ya terminó');
    await this.learning.assertAccess(user, row.course_id);
    return this.exclusive(row.id, async () => {
      const room = await this.load(row.id);
      if (room.teams.some((team) => team.members.includes(user.id))) return { id: room.id };
      if (room.status === 'podium' || room.status === 'ended') throw new ApiError(409, 'ENDED', 'La sala ya está cerrando');

      let team = room.teams
        .filter((candidate) => candidate.members.length < room.teamSize)
        .sort((a, b) => a.members.length - b.members.length || a.position - b.position)[0];
      if (!team) team = await this.addTeam(room);
      await this.database.db.insertInto('arena_members').values({ room_id: room.id, user_id: user.id, team_id: team.id }).execute();
      team.members.push(user.id);
      room.names[user.id] = user.fullName;
      if (room.status === 'question' && !team.captainId) team.captainId = user.id;
      this.scheduleSnapshot(room);
      this.broadcast(room);
      return { id: room.id };
    });
  }

  /* ---------- Juego ---------- */

  async vote(user: AuthUser, roomId: string, optionId: string) {
    return this.exclusive(roomId, async () => {
      const room = await this.load(roomId);
      const team = this.openTeam(room, user.id, optionId);
      (room.votes[team.id] ??= {})[user.id] = optionId;
      this.scheduleSnapshot(room);
      for (const memberId of team.members) this.emit(room, memberId);
      return { ok: true };
    });
  }

  async lock(user: AuthUser, roomId: string, optionId: string) {
    return this.exclusive(roomId, async () => {
      const room = await this.load(roomId);
      const team = this.openTeam(room, user.id, optionId);
      if (team.captainId !== user.id) throw new ApiError(403, 'NOT_CAPTAIN', 'Solo el capitán cierra el candado');
      room.locks[team.id] = { optionId, by: user.id, elapsedMs: this.elapsed(room), votes: tally(room.votes[team.id]) };
      const pending = room.teams.filter((candidate) => candidate.members.length && !room.locks[candidate.id]);
      if (!pending.length) {
        await this.closeQuestion(room);
      } else {
        await this.saveSnapshot(room);
        this.broadcast(room);
      }
      return { ok: true };
    });
  }

  async takeCommand(user: AuthUser, roomId: string) {
    return this.exclusive(roomId, async () => {
      const room = await this.load(roomId);
      const team = this.openTeam(room, user.id);
      if (team.captainId === user.id) return { ok: true };
      const wait = COMMAND_AFTER_MS - this.elapsed(room);
      if (wait > 0) throw new ApiError(409, 'TOO_SOON', `Podrás tomar el mando en ${Math.ceil(wait / 1000)} s`);
      team.captainId = user.id;
      await this.saveSnapshot(room);
      this.broadcast(room);
      return { ok: true };
    });
  }

  async control(user: AuthUser, roomId: string, action: ArenaAction) {
    return this.exclusive(roomId, async () => {
      const room = await this.load(roomId);
      if (room.hostId !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Solo quien abrió la sala la modera');
      switch (action) {
        case 'rebalance':
          if (room.status !== 'lobby') throw new ApiError(409, 'STARTED', 'Los equipos se arman antes de empezar');
          await this.rebalance(room);
          break;
        case 'start':
          if (room.status !== 'lobby') throw new ApiError(409, 'STARTED', 'La sala ya empezó');
          await this.start(room);
          break;
        case 'next':
          await this.advance(room);
          break;
        case 'pause':
          this.assertQuestion(room);
          if (room.pausedAt === null && room.endsAt !== null) {
            room.pausedAt = Date.now();
            room.pausedRemaining = Math.max(0, room.endsAt - room.pausedAt);
            this.clearTimer(room.id);
          }
          break;
        case 'resume':
          this.assertQuestion(room);
          if (room.pausedAt !== null) {
            const now = Date.now();
            room.pausedTotal += now - room.pausedAt;
            room.endsAt = now + (room.pausedRemaining ?? 0);
            room.pausedAt = null;
            room.pausedRemaining = null;
            this.arm(room);
          }
          break;
        case 'extra':
          this.assertQuestion(room);
          room.durationMs += EXTRA_MS;
          if (room.pausedAt !== null) room.pausedRemaining = (room.pausedRemaining ?? 0) + EXTRA_MS;
          else if (room.endsAt !== null) room.endsAt += EXTRA_MS;
          this.arm(room);
          break;
      }
      if (action === 'pause' || action === 'resume' || action === 'extra') {
        await this.saveSnapshot(room);
        this.broadcast(room);
      }
      return this.view(room, user.id);
    });
  }

  /* ---------- Transiciones ---------- */

  private async advance(room: Room) {
    switch (room.status) {
      case 'lobby':
        return this.start(room);
      case 'question':
        return this.closeQuestion(room);
      case 'vote':
        return this.setPhase(room, 'feedback');
      case 'feedback':
        // Tras la última pregunta no se muestra la tabla: el podio guarda el suspenso.
        return this.setPhase(room, room.index + 1 < room.questionIds.length ? 'table' : 'podium');
      case 'table':
        return room.index + 1 < room.questionIds.length ? this.openQuestion(room, room.index + 1) : this.setPhase(room, 'podium');
      case 'podium':
        return this.finish(room);
      case 'ended':
        return;
    }
  }

  private async start(room: Room) {
    if (!room.teams.some((team) => team.members.length)) throw new ApiError(409, 'EMPTY', 'Espera a que entre al menos un estudiante');
    await this.rebalance(room, false);
    await this.database.db.updateTable('arena_rooms').set({ started_at: new Date() }).where('id', '=', room.id).execute();
    await this.openQuestion(room, 0);
  }

  private async openQuestion(room: Room, index: number) {
    room.question = await this.loadQuestion(room.questionIds[index]!);
    room.index = index;
    room.status = 'question';
    room.votes = {};
    room.locks = {};
    room.reveal = [];
    const now = Date.now();
    room.startedAt = now;
    room.durationMs = room.questionSec * 1000;
    room.endsAt = now + room.durationMs;
    room.pausedAt = null;
    room.pausedRemaining = null;
    room.pausedTotal = 0;
    for (const team of room.teams) team.captainId = team.members.length ? team.members[index % team.members.length]! : null;
    await this.persistPhase(room);
    this.arm(room);
    this.broadcast(room);
  }

  /** Cierra los candados, abre su orden al azar y puntúa. Hasta aquí la respuesta correcta no sale del servidor. */
  private async closeQuestion(room: Room) {
    if (room.status !== 'question' || !room.question) return;
    this.clearTimer(room.id);
    const question = room.question;
    const playing = room.teams.filter((team) => team.members.length);
    for (const team of playing) {
      if (room.locks[team.id]) continue;
      // Sin candado al agotarse el tiempo: cuenta el voto mayoritario, sin bono de velocidad.
      const votes = tally(room.votes[team.id]);
      const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
      if (ranked[0] && ranked[0][1] !== ranked[1]?.[1]) room.locks[team.id] = { optionId: ranked[0][0], by: '', elapsedMs: room.durationMs, votes };
    }
    room.reveal = shuffle(playing).map((team, i) => {
      const lock = room.locks[team.id];
      const correct = lock?.optionId === question.correctId;
      const bonus = lock ? Math.round((50 * Math.max(0, room.durationMs - lock.elapsedMs)) / room.durationMs) : 0;
      return { teamId: team.id, optionId: lock?.optionId ?? null, order: i + 1, correct, points: correct ? 100 + bonus : 0 };
    });
    room.status = 'vote';
    room.endsAt = null;
    room.pausedAt = null;
    room.pausedRemaining = null;
    await this.database.withTx(async (trx) => {
      if (room.reveal.length) {
        await trx
          .insertInto('arena_answers')
          .values(room.reveal.map((reveal) => {
            const lock = room.locks[reveal.teamId];
            return {
              room_id: room.id,
              team_id: reveal.teamId,
              question_index: room.index,
              question_id: question.id,
              option_id: reveal.optionId,
              locked_by: lock?.by || null,
              votes: JSON.stringify(lock?.votes ?? tally(room.votes[reveal.teamId])),
              elapsed_ms: lock?.elapsedMs ?? room.durationMs,
              correct: reveal.correct,
              points: reveal.points,
              reveal_order: reveal.order,
            };
          }))
          .onConflict((oc) => oc.columns(['room_id', 'team_id', 'question_index']).doNothing())
          .execute();
      }
      for (const reveal of room.reveal) {
        if (reveal.points) await trx.updateTable('arena_teams').set((eb) => ({ score: eb('score', '+', reveal.points) })).where('id', '=', reveal.teamId).execute();
      }
      await trx.updateTable('arena_rooms').set({ status: 'vote', snapshot: JSON.stringify(this.toSnapshot(room)), snapshot_at: new Date() }).where('id', '=', room.id).execute();
    });
    for (const reveal of room.reveal) {
      const team = room.teams.find((candidate) => candidate.id === reveal.teamId);
      if (team) team.score += reveal.points;
    }
    this.broadcast(room);
  }

  private async finish(room: Room) {
    const correct = await this.database.db
      .selectFrom('arena_answers')
      .select(['team_id', sql<number>`count(*) FILTER (WHERE correct)`.as('n')])
      .where('room_id', '=', room.id)
      .groupBy('team_id')
      .execute();
    const correctBy = new Map(correct.map((row) => [row.team_id, Number(row.n)]));
    const ordered = room.teams
      .filter((team) => team.members.length)
      .map((team) => ({ teamId: team.id, score: team.score, correct: correctBy.get(team.id) ?? 0 }))
      .sort((a, b) => b.score - a.score || b.correct - a.correct);
    room.ranking = ordered.map((entry, i) => {
      const previous = ordered[i - 1];
      const tied = previous && previous.score === entry.score && previous.correct === entry.correct;
      return { ...entry, rank: tied ? 0 : i + 1 };
    });
    room.ranking.forEach((entry, i) => {
      if (entry.rank === 0) entry.rank = room.ranking![i - 1]!.rank;
    });
    room.status = 'ended';
    await this.database.withTx(async (trx) => {
      if (room.ranking!.length) {
        await trx
          .insertInto('arena_results')
          .values(room.ranking!.map((entry) => ({ room_id: room.id, team_id: entry.teamId, rank: entry.rank, score: entry.score, correct_count: entry.correct })))
          .onConflict((oc) => oc.columns(['room_id', 'team_id']).doNothing())
          .execute();
      }
      await trx.updateTable('arena_rooms').set({ status: 'ended', ended_at: new Date(), snapshot: JSON.stringify(this.toSnapshot(room)), snapshot_at: new Date() }).where('id', '=', room.id).execute();
    });
    const players = room.ranking.flatMap((entry) => {
      const team = room.teams.find((candidate) => candidate.id === entry.teamId)!;
      return team.members.map((userId) => ({ userId, rank: entry.rank, correct: entry.correct }));
    });
    this.events.emit(DomainEvents.ArenaFinished, { roomId: room.id, players } satisfies ArenaFinishedEvent);
    this.broadcast(room);
  }

  private async setPhase(room: Room, status: Phase) {
    room.status = status;
    await this.persistPhase(room);
    this.broadcast(room);
  }

  /** Reparte a todos en equipos parejos (diferencia máxima de 1) en orden de llegada. */
  private async rebalance(room: Room, notify = true) {
    const players = await this.database.db
      .selectFrom('arena_members')
      .select('user_id')
      .where('room_id', '=', room.id)
      .orderBy('joined_at')
      .execute();
    const count = Math.max(1, Math.ceil(players.length / room.teamSize));
    while (room.teams.length < count) await this.addTeam(room);
    const kept = [...room.teams].sort((a, b) => a.position - b.position).slice(0, count);
    const dropped = room.teams.filter((team) => !kept.includes(team));
    kept.forEach((team) => (team.members = []));
    players.forEach((player, i) => kept[i % count]!.members.push(player.user_id));
    await this.database.withTx(async (trx) => {
      for (const team of kept) {
        if (team.members.length) await trx.updateTable('arena_members').set({ team_id: team.id }).where('room_id', '=', room.id).where('user_id', 'in', team.members).execute();
      }
      if (dropped.length) await trx.deleteFrom('arena_teams').where('id', 'in', dropped.map((team) => team.id)).execute();
    });
    room.teams = kept;
    if (notify) {
      this.scheduleSnapshot(room);
      this.broadcast(room);
    }
  }

  private async addTeam(room: Room) {
    const used = new Set(room.teams.map((team) => team.position));
    let position = 1;
    while (used.has(position)) position++;
    const preset = TEAM_PRESETS[(position - 1) % TEAM_PRESETS.length]!;
    const name = position > TEAM_PRESETS.length ? `${preset.name} ${Math.ceil(position / TEAM_PRESETS.length)}` : preset.name;
    const row = await this.database.db
      .insertInto('arena_teams')
      .values({ room_id: room.id, name, color: preset.color, position })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    const team: Team = { id: row.id, name, color: preset.color, position, score: 0, members: [], captainId: null };
    room.teams.push(team);
    room.teams.sort((a, b) => a.position - b.position);
    return team;
  }

  /* ---------- Estado en memoria y snapshot ---------- */

  private async load(roomId: string): Promise<Room> {
    const cached = this.rooms.get(roomId);
    if (cached) return cached;
    const row = await this.database.db.selectFrom('arena_rooms').selectAll().where('id', '=', roomId).executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'La sala no existe');
    const [teams, members] = await Promise.all([
      this.database.db.selectFrom('arena_teams').selectAll().where('room_id', '=', roomId).orderBy('position').execute(),
      this.database.db
        .selectFrom('arena_members')
        .innerJoin('users', 'users.id', 'arena_members.user_id')
        .select(['arena_members.user_id', 'arena_members.team_id', 'users.full_name'])
        .where('arena_members.room_id', '=', roomId)
        .orderBy('arena_members.joined_at')
        .execute(),
    ]);
    const snapshot = (row.snapshot ?? {}) as Partial<Snapshot>;
    const status = row.status as Phase;
    const room: Room = {
      id: row.id,
      code: row.code,
      hostId: row.host_id,
      courseId: row.course_id,
      title: row.title,
      teamSize: row.team_size,
      questionSec: row.question_sec,
      questionIds: parseUuidArray(row.question_ids),
      status,
      index: row.current_index,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        position: team.position,
        score: team.score,
        members: members.filter((member) => member.team_id === team.id).map((member) => member.user_id),
        captainId: snapshot.captains?.[team.id] ?? null,
      })),
      names: Object.fromEntries(members.map((member) => [member.user_id, member.full_name])),
      question: null,
      startedAt: snapshot.startedAt ?? null,
      durationMs: snapshot.durationMs ?? row.question_sec * 1000,
      endsAt: snapshot.endsAt ?? null,
      pausedAt: snapshot.pausedAt ?? null,
      pausedRemaining: snapshot.pausedRemaining ?? null,
      pausedTotal: snapshot.pausedTotal ?? 0,
      votes: snapshot.votes ?? {},
      locks: snapshot.locks ?? {},
      reveal: [],
      ranking: null,
    };
    if (WITH_QUESTION.includes(status) && room.index >= 0) room.question = await this.loadQuestion(room.questionIds[room.index]!);
    if (status === 'vote' || status === 'feedback' || status === 'table') {
      const answers = await this.database.db
        .selectFrom('arena_answers')
        .select(['team_id', 'option_id', 'reveal_order', 'correct', 'points'])
        .where('room_id', '=', roomId)
        .where('question_index', '=', room.index)
        .orderBy('reveal_order')
        .execute();
      room.reveal = answers.map((answer) => ({ teamId: answer.team_id, optionId: answer.option_id, order: answer.reveal_order, correct: answer.correct, points: answer.points }));
    }
    if (status === 'ended') {
      const results = await this.database.db.selectFrom('arena_results').selectAll().where('room_id', '=', roomId).orderBy('rank').execute();
      room.ranking = results.map((result) => ({ teamId: result.team_id, rank: result.rank, score: result.score, correct: result.correct_count }));
    }
    const raced = this.rooms.get(roomId);
    if (raced) return raced;
    this.rooms.set(roomId, room);
    this.arm(room);
    return room;
  }

  private async loadQuestion(questionId: string): Promise<Question> {
    const [question, options] = await Promise.all([
      this.database.db.selectFrom('questions').select(['id', 'prompt', 'explanation']).where('id', '=', questionId).executeTakeFirstOrThrow(),
      this.database.db.selectFrom('question_options').select(['id', 'label', 'text', 'is_correct']).where('question_id', '=', questionId).orderBy('position').execute(),
    ]);
    return {
      id: question.id,
      prompt: question.prompt,
      explanation: question.explanation,
      options: options.map(({ id, label, text }) => ({ id, label, text })),
      correctId: options.find((option) => option.is_correct)?.id ?? '',
    };
  }

  private toSnapshot(room: Room): Snapshot {
    return {
      captains: Object.fromEntries(room.teams.map((team) => [team.id, team.captainId])),
      votes: room.votes,
      locks: room.locks,
      startedAt: room.startedAt,
      durationMs: room.durationMs,
      endsAt: room.endsAt,
      pausedAt: room.pausedAt,
      pausedRemaining: room.pausedRemaining,
      pausedTotal: room.pausedTotal,
    };
  }

  private async persistPhase(room: Room) {
    this.clearSave(room.id);
    await this.database.db
      .updateTable('arena_rooms')
      .set({ status: room.status, current_index: room.index, snapshot: JSON.stringify(this.toSnapshot(room)), snapshot_at: new Date() })
      .where('id', '=', room.id)
      .execute();
  }

  private async saveSnapshot(room: Room) {
    this.clearSave(room.id);
    await this.database.db
      .updateTable('arena_rooms')
      .set({ snapshot: JSON.stringify(this.toSnapshot(room)), snapshot_at: new Date() })
      .where('id', '=', room.id)
      .execute();
  }

  /** Los votos cambian a cada toque: se agrupan y se guardan con retraso. */
  private scheduleSnapshot(room: Room) {
    if (this.saves.has(room.id)) return;
    this.saves.set(
      room.id,
      setTimeout(() => {
        this.saves.delete(room.id);
        this.saveSnapshot(room).catch((error: Error) => this.logger.warn(`Snapshot ${room.code}: ${error.message}`));
      }, SNAPSHOT_DELAY_MS),
    );
  }

  private clearSave(roomId: string) {
    const pending = this.saves.get(roomId);
    if (pending) clearTimeout(pending);
    this.saves.delete(roomId);
  }

  private arm(room: Room) {
    this.clearTimer(room.id);
    if (room.status !== 'question' || room.endsAt === null || room.pausedAt !== null) return;
    const delay = Math.max(0, room.endsAt - Date.now());
    this.timers.set(
      room.id,
      setTimeout(() => {
        this.timers.delete(room.id);
        this.exclusive(room.id, () => this.closeQuestion(room)).catch((error: Error) => this.logger.error(`Cierre ${room.code}: ${error.message}`));
      }, delay),
    );
  }

  private clearTimer(roomId: string) {
    const timer = this.timers.get(roomId);
    if (timer) clearTimeout(timer);
    this.timers.delete(roomId);
  }

  /** Serializa las operaciones de una sala: los votos y candados llegan en paralelo. */
  private exclusive<T>(roomId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(roomId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    const settled = next.catch(() => undefined);
    this.queues.set(roomId, settled);
    void settled.then(() => {
      if (this.queues.get(roomId) === settled) this.queues.delete(roomId);
    });
    return next;
  }

  /* ---------- Reglas y vistas ---------- */

  private elapsed(room: Room) {
    if (room.startedAt === null) return 0;
    const now = room.pausedAt ?? Date.now();
    return Math.max(0, now - room.startedAt - room.pausedTotal);
  }

  private assertQuestion(room: Room) {
    if (room.status !== 'question') throw new ApiError(409, 'NOT_LIVE', 'No hay una pregunta en curso');
  }

  private openTeam(room: Room, userId: string, optionId?: string) {
    this.assertQuestion(room);
    if (room.pausedAt !== null) throw new ApiError(409, 'PAUSED', 'La sala está en pausa');
    const team = room.teams.find((candidate) => candidate.members.includes(userId));
    if (!team) throw new ApiError(403, 'NOT_MEMBER', 'No estás en esta sala');
    if (room.locks[team.id]) throw new ApiError(409, 'LOCKED', 'Tu equipo ya cerró el candado');
    if (optionId && !room.question?.options.some((option) => option.id === optionId)) throw new ApiError(400, 'BAD_OPTION', 'Esa opción no es de la pregunta');
    return team;
  }

  private assertViewer(user: AuthUser, room: Room) {
    if (room.hostId === user.id || isBoard(user.role)) return;
    if (room.teams.some((team) => team.members.includes(user.id))) return;
    throw new ApiError(403, 'NOT_MEMBER', 'Únete a la sala con su código');
  }

  private view(room: Room, viewerId: string) {
    const revealed = REVEALED.includes(room.status);
    const isHost = viewerId === room.hostId;
    const mine = room.teams.find((team) => team.members.includes(viewerId));
    const last = room.index + 1 >= room.questionIds.length;
    const hideScores = room.status === 'podium' || (last && (room.status === 'vote' || room.status === 'feedback'));
    const showQuestion = WITH_QUESTION.includes(room.status) && room.question;
    const teamVotes: Record<string, string[]> = {};
    if (mine) {
      for (const [userId, optionId] of Object.entries(room.votes[mine.id] ?? {})) (teamVotes[optionId] ??= []).push(room.names[userId] ?? '');
    }
    return {
      id: room.id,
      code: room.code,
      title: room.title,
      status: room.status,
      index: room.index,
      total: room.questionIds.length,
      teamSize: room.teamSize,
      questionSec: room.questionSec,
      serverNow: Date.now(),
      endsAt: room.endsAt,
      durationMs: room.durationMs,
      paused: room.pausedAt !== null,
      pausedRemaining: room.pausedRemaining,
      role: isHost ? 'host' : 'player',
      teams: room.teams
        .filter((team) => team.members.length || room.status === 'lobby')
        .map((team) => ({
          id: team.id,
          name: team.name,
          color: team.color,
          score: hideScores ? null : team.score,
          captainId: team.captainId,
          locked: Boolean(room.locks[team.id]),
          members: team.members.map((id) => ({ id, name: room.names[id] ?? '' })),
        })),
      question: showQuestion
        ? {
            prompt: room.question!.prompt,
            options: room.question!.options,
            correctId: revealed ? room.question!.correctId : null,
            explanation: revealed ? room.question!.explanation : null,
          }
        : null,
      reveal: room.reveal.map((reveal) => ({
        teamId: reveal.teamId,
        optionId: reveal.optionId,
        order: reveal.order,
        correct: revealed ? reveal.correct : null,
        points: revealed ? reveal.points : null,
      })),
      me: mine
        ? {
            teamId: mine.id,
            captain: mine.captainId === viewerId,
            vote: room.votes[mine.id]?.[viewerId] ?? null,
            lock: room.locks[mine.id]?.optionId ?? null,
            commandAt: room.startedAt !== null ? room.startedAt + room.pausedTotal + COMMAND_AFTER_MS : null,
            teamVotes,
          }
        : null,
      ranking: room.status === 'ended' ? room.ranking : null,
    };
  }

  private emit(room: Room, userId: string) {
    this.realtime.to(`user:${userId}`, 'arena:state', this.view(room, userId));
  }

  private broadcast(room: Room) {
    this.emit(room, room.hostId);
    for (const team of room.teams) for (const memberId of team.members) this.emit(room, memberId);
  }
}
