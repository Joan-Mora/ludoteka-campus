import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { LEARNING_METHODS, LEARNING_QUIZ_VERSION, METHOD_INFO, scoreLearningQuiz, type LearningMethod } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { DomainEvents, type LearningProfileSavedEvent } from '../../core/events/domain-events';

export const isMethod = (value: unknown): value is LearningMethod => typeof value === 'string' && (LEARNING_METHODS as readonly string[]).includes(value);

/** Lo único que la IA sabe del estudiante es esta frase: nunca nombre, curso ni puntajes. */
const TUTOR_STYLE: Record<LearningMethod, string> = {
  teoria: 'Esta persona aprende mejor entendiendo la regla: antes de la pista, enuncia en una o dos frases la idea o propiedad que se usa y por qué funciona.',
  ejemplos: 'Esta persona aprende mejor con ejemplos resueltos: muestra un ejemplo parecido con otros números, resuelto paso a paso, y pídele que imite esos pasos en su ejercicio.',
  juegos: 'Esta persona aprende mejor jugando: plantea la pista como un reto corto o un acertijo, con tono animado y una meta pequeña («¿lo logras en dos pasos?»).',
  practica: 'Esta persona aprende mejor practicando: da pistas muy cortas y, cuando acierte, propón un ejercicio parecido un poco más difícil.',
  visual: 'Esta persona aprende mejor de forma visual: describe un dibujo, una recta numérica, unas barras o una tabla que pueda hacer en su cuaderno para ver el problema.',
  conversacion: 'Esta persona aprende mejor conversando: haz una sola pregunta a la vez, pídele que explique su razonamiento con sus palabras y responde a lo que diga.',
};

const ROUTE_STYLE: Record<LearningMethod, string> = {
  teoria: 'Empieza el enunciado recordando en una frase la regla que se usa.',
  ejemplos: 'Plantea un ejercicio directo; la pista debe ser un ejemplo parecido resuelto con otros números.',
  juegos: 'Redáctalo como misión de juego (tesoros, puntos, niveles), corto y animado.',
  practica: 'Redáctalo directo y breve, como un ejercicio de entrenamiento.',
  visual: 'Usa una situación que se pueda dibujar (barras, recta numérica, cuadrícula o figura) y menciona ese dibujo en la pista.',
  conversacion: 'Redáctalo como un amigo que pide ayuda y quiere que le expliquen cómo se llega al resultado.',
};

/** Otro método se recomienda si rinde al menos 15 puntos más con un mínimo de intentos en ambos. */
const MIN_ATTEMPTS = 5;
const MARGIN = 0.15;

interface MethodStat {
  method: LearningMethod;
  label: string;
  attempts: number;
  correct: number;
  levelUps: number;
  rate: number | null;
  opened: number;
}

@Injectable()
export class LearningProfileService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  private async currentPeriod() {
    const row = await sql<{ id: string; name: string }>`
      SELECT p.id, p.name FROM periods p JOIN academic_years y ON y.id = p.academic_year_id
      WHERE y.is_current AND (now() AT TIME ZONE 'America/Bogota')::DATE BETWEEN p.starts_on AND p.ends_on
      ORDER BY p.position LIMIT 1`.execute(this.database.db);
    return row.rows[0] ?? null;
  }

  private latest(userId: string) {
    return this.database.db
      .selectFrom('learning_profiles')
      .leftJoin('periods', 'periods.id', 'learning_profiles.period_id')
      .select([
        'learning_profiles.id',
        'learning_profiles.period_id',
        'learning_profiles.version',
        'learning_profiles.scores',
        'learning_profiles.primary_method',
        'learning_profiles.secondary_method',
        'learning_profiles.taken_at',
        'periods.name as period_name',
      ])
      .where('learning_profiles.user_id', '=', userId)
      .orderBy('learning_profiles.taken_at', 'desc')
      .limit(1)
      .executeTakeFirst();
  }

  async methodOf(userId: string): Promise<LearningMethod | null> {
    const row = await this.database.db
      .selectFrom('learning_profiles')
      .select('primary_method')
      .where('user_id', '=', userId)
      .orderBy('taken_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return isMethod(row?.primary_method) ? row.primary_method : null;
  }

  tutorStyle(method: LearningMethod | null) {
    return method ? TUTOR_STYLE[method] : '';
  }

  routeStyle(method: LearningMethod | null) {
    return method ? ROUTE_STYLE[method] : '';
  }

  /** Resumen para el acudiente: solo el método, no las respuestas. */
  async summary(studentId: string) {
    const row = await this.latest(studentId);
    if (!row || !isMethod(row.primary_method)) return null;
    return {
      method: row.primary_method,
      label: METHOD_INFO[row.primary_method].label,
      secondary: isMethod(row.secondary_method) ? METHOD_INFO[row.secondary_method].label : null,
      takenAt: row.taken_at,
    };
  }

  async status(user: AuthUser) {
    const [row, period, stats] = await Promise.all([this.latest(user.id), this.currentPeriod(), this.stats(user.id)]);
    const profile =
      row && isMethod(row.primary_method)
        ? {
            method: row.primary_method,
            secondary: isMethod(row.secondary_method) ? row.secondary_method : null,
            scores: row.scores as Record<LearningMethod, number>,
            version: row.version,
            period: row.period_name,
            takenAt: row.taken_at,
          }
        : null;
    return {
      version: LEARNING_QUIZ_VERSION,
      profile,
      period: period?.name ?? null,
      canTake: this.canTake(row, period?.id ?? null),
      stats,
      recommendation: profile ? this.recommend(profile.method, stats) : null,
    };
  }

  /** Se responde una vez por periodo; una versión nueva del cuestionario lo vuelve a abrir. */
  private canTake(row: { period_id: string | null; version: number } | undefined, periodId: string | null) {
    if (!row) return true;
    if (row.version !== LEARNING_QUIZ_VERSION) return true;
    return Boolean(periodId) && row.period_id !== periodId;
  }

  async submit(user: AuthUser, input: { version: number; answers: number[] }) {
    const [row, period] = await Promise.all([this.latest(user.id), this.currentPeriod()]);
    if (!this.canTake(row, period?.id ?? null)) {
      throw new ApiError(409, 'ALREADY_TAKEN', `Ya respondiste el cuestionario en ${row?.period_name ?? 'este periodo'}; podrás repetirlo el próximo periodo`);
    }
    const { scores, primary, secondary } = scoreLearningQuiz(input.answers);
    await this.database.db
      .insertInto('learning_profiles')
      .values({
        user_id: user.id,
        period_id: period?.id ?? null,
        version: input.version,
        answers: JSON.stringify(input.answers),
        scores: JSON.stringify(scores),
        primary_method: primary,
        secondary_method: secondary,
      })
      .execute();
    this.events.emit(DomainEvents.LearningProfileSaved, { userId: user.id, method: primary, retake: Boolean(row) } satisfies LearningProfileSavedEvent);
    return this.status(user);
  }

  async recordActivity(user: AuthUser, input: { method: LearningMethod; topicId?: string; resource?: string }) {
    await this.database.db
      .insertInto('learning_activity')
      .values({ user_id: user.id, method: input.method, topic_id: input.topicId ?? null, resource: input.resource ?? '' })
      .execute();
    return { ok: true };
  }

  /** Rendimiento por método en Mi ruta durante los últimos 60 días. */
  async stats(userId: string): Promise<MethodStat[]> {
    const [route, opened] = await Promise.all([
      sql<{ method: string; attempts: number; correct: number; ups: number }>`
        SELECT method, count(*)::INT AS attempts,
          sum(CASE WHEN status = 'correct' THEN 1 ELSE 0 END)::INT AS correct,
          sum(CASE WHEN level_change = 1 THEN 1 ELSE 0 END)::INT AS ups
        FROM route_items
        WHERE user_id = ${userId} AND method IS NOT NULL AND status IN ('correct', 'wrong') AND answered_at > now() - INTERVAL '60 days'
        GROUP BY method`.execute(this.database.db),
      sql<{ method: string; n: number }>`
        SELECT method, count(*)::INT AS n FROM learning_activity
        WHERE user_id = ${userId} AND created_at > now() - INTERVAL '60 days'
        GROUP BY method`.execute(this.database.db),
    ]);
    return LEARNING_METHODS.map((method) => {
      const r = route.rows.find((x) => x.method === method);
      const attempts = Number(r?.attempts ?? 0);
      const correct = Number(r?.correct ?? 0);
      return {
        method,
        label: METHOD_INFO[method].label,
        attempts,
        correct,
        levelUps: Number(r?.ups ?? 0),
        rate: attempts ? Math.round((correct / attempts) * 100) / 100 : null,
        opened: Number(opened.rows.find((x) => x.method === method)?.n ?? 0),
      };
    });
  }

  private recommend(primary: LearningMethod, stats: MethodStat[]) {
    const mine = stats.find((s) => s.method === primary);
    if (!mine || mine.attempts < MIN_ATTEMPTS || mine.rate === null) return null;
    const better = stats
      .filter((s) => s.method !== primary && s.attempts >= MIN_ATTEMPTS && s.rate !== null && s.rate >= mine.rate! + MARGIN)
      .sort((a, b) => b.rate! - a.rate!)[0];
    if (!better) return null;
    return {
      method: better.method,
      label: better.label,
      reason: `Con ${better.label.toLowerCase()} aciertas el ${Math.round(better.rate! * 100)} % de los retos y con ${mine.label.toLowerCase()} el ${Math.round(mine.rate * 100)} %.`,
    };
  }

  async courseDistribution(user: AuthUser, courseId: string) {
    const course = await this.database.db.selectFrom('courses').select(['teacher_id', 'group_id']).where('id', '=', courseId).executeTakeFirst();
    if (!course) throw new ApiError(404, 'NOT_FOUND', 'El curso no existe');
    if (user.role === 'teacher' && course.teacher_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Solo ves los perfiles de tus cursos');
    const [students, effect] = await Promise.all([
      sql<{ id: string; full_name: string; primary_method: string | null; secondary_method: string | null; taken_at: Date | null }>`
        SELECT u.id, u.full_name, lp.primary_method, lp.secondary_method, lp.taken_at
        FROM enrollments e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN LATERAL (
          SELECT primary_method, secondary_method, taken_at FROM learning_profiles
          WHERE user_id = u.id ORDER BY taken_at DESC LIMIT 1
        ) lp ON true
        WHERE e.group_id = ${course.group_id} AND e.status = 'active'
        ORDER BY u.full_name`.execute(this.database.db),
      sql<{ method: string; attempts: number; correct: number }>`
        SELECT r.method, count(*)::INT AS attempts, sum(CASE WHEN r.status = 'correct' THEN 1 ELSE 0 END)::INT AS correct
        FROM route_items r JOIN enrollments e ON e.user_id = r.user_id AND e.group_id = ${course.group_id} AND e.status = 'active'
        WHERE r.method IS NOT NULL AND r.status IN ('correct', 'wrong') AND r.answered_at > now() - INTERVAL '60 days'
        GROUP BY r.method`.execute(this.database.db),
    ]);
    const list = students.rows.map((s) => ({
      id: s.id,
      name: s.full_name,
      method: isMethod(s.primary_method) ? s.primary_method : null,
      secondary: isMethod(s.secondary_method) ? s.secondary_method : null,
      takenAt: s.taken_at,
    }));
    return {
      total: list.length,
      pending: list.filter((s) => !s.method).length,
      methods: LEARNING_METHODS.map((method) => {
        const e = effect.rows.find((x) => x.method === method);
        const attempts = Number(e?.attempts ?? 0);
        return {
          method,
          label: METHOD_INFO[method].label,
          students: list.filter((s) => s.method === method).length,
          secondary: list.filter((s) => s.secondary === method).length,
          attempts,
          rate: attempts ? Math.round((Number(e?.correct ?? 0) / attempts) * 100) / 100 : null,
        };
      }),
      students: list,
    };
  }
}
