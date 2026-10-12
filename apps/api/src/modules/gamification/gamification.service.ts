import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import {
  DomainEvents,
  type ArcadeFinishedEvent,
  type ArenaFinishedEvent,
  type AttemptGradedEvent,
  type BadgeEarnedEvent,
  type BadgesSeenEvent,
  type LearningProfileSavedEvent,
  type LessonCompletedEvent,
  type RouteSolvedEvent,
  type StudyProgressEvent,
  type SubmissionGradedEvent,
  type TutorMessageEvent,
} from '../../core/events/domain-events';
import { asIsoDate, bogotaToday, shiftDate, weekKey } from '../../core/time';
import { BADGES, tierFor, type Metric } from './badges';

const ALWAYS = 'siempre';
type Metrics = Record<Metric, number>;

interface Season {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

@Injectable()
export class GamificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Logros');
  private readonly evaluating = new Map<string, Promise<unknown>>();

  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  onApplicationBootstrap() {
    void this.syncCatalog().catch((error) => this.logger.warn(`Catálogo de insignias sin sincronizar: ${error instanceof Error ? error.message : error}`));
  }

  /** El catálogo vive en código; la tabla `badges` se pone al día al arrancar. */
  async syncCatalog() {
    for (const [position, badge] of BADGES.entries()) {
      await this.database.db
        .insertInto('badges')
        .values({
          code: badge.code,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          thresholds: JSON.stringify(badge.thresholds),
          hidden: Boolean(badge.hidden),
          seasonal: Boolean(badge.seasonal),
          position: position + 1,
          active: true,
        })
        .onConflict((oc) =>
          oc.column('code').doUpdateSet({
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            category: badge.category,
            thresholds: JSON.stringify(badge.thresholds),
            hidden: Boolean(badge.hidden),
            seasonal: Boolean(badge.seasonal),
            position: position + 1,
            active: true,
          }),
        )
        .execute();
    }
    await this.database.db.updateTable('badges').set({ active: false }).where('code', 'not in', BADGES.map((b) => b.code)).execute();
  }

  private async award(userId: string, amount: number, reason: string, sourceType: string, sourceId?: string) {
    if (amount <= 0) return;
    await this.database.db
      .insertInto('xp_ledger')
      .values({ user_id: userId, amount, reason, source_type: sourceType, source_id: sourceId ?? null })
      .execute();
    await this.bumpMission(userId, 'xp', amount);
  }

  private async touchStreak(userId: string) {
    const today = bogotaToday();
    const row = await this.database.db.selectFrom('streaks').selectAll().where('user_id', '=', userId).executeTakeFirst();
    if (!row) {
      await this.database.db.insertInto('streaks').values({ user_id: userId, current_count: 1, best_count: 1, last_activity_on: today }).execute();
      return;
    }
    const last = asIsoDate(row.last_activity_on);
    if (last === today) return;
    const next = last === shiftDate(today, -1) ? Number(row.current_count) + 1 : 1;
    const best = Math.max(Number(row.best_count), next);
    await this.database.db
      .updateTable('streaks')
      .set({ current_count: next, best_count: best, last_activity_on: today })
      .where('user_id', '=', userId)
      .execute();
  }

  /** La racha guardada solo vale si hubo actividad hoy o ayer; si no, ya se rompió. */
  private liveStreak(row: { current_count: number; last_activity_on: unknown } | undefined) {
    if (!row) return 0;
    const last = asIsoDate(row.last_activity_on);
    const today = bogotaToday();
    return last === today || last === shiftDate(today, -1) ? Number(row.current_count) : 0;
  }

  private async bumpMission(userId: string, goalType: 'lessons' | 'xp' | 'minigame', amount: number) {
    const week = weekKey();
    const missions = await this.database.db
      .selectFrom('missions')
      .selectAll()
      .where('goal_type', '=', goalType)
      .where('active', '=', true)
      .execute();
    for (const mission of missions) {
      const current = await this.database.db
        .selectFrom('mission_progress')
        .selectAll()
        .where('user_id', '=', userId)
        .where('mission_id', '=', mission.id)
        .where('week_key', '=', week)
        .executeTakeFirst();
      const progress = Math.min(mission.goal_count, Number(current?.progress ?? 0) + amount);
      const justDone = !current?.completed_at && progress >= mission.goal_count;
      await this.database.db
        .insertInto('mission_progress')
        .values({
          user_id: userId,
          mission_id: mission.id,
          week_key: week,
          progress,
          completed_at: justDone ? new Date() : current?.completed_at ?? null,
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'mission_id', 'week_key']).doUpdateSet({
            progress,
            completed_at: justDone ? new Date() : current?.completed_at ?? null,
          }),
        )
        .execute();
      if (justDone) await this.award(userId, mission.xp_reward, 'mission', 'mission', mission.id);
    }
  }

  private async season(): Promise<Season | null> {
    const today = bogotaToday();
    const row = await this.database.db
      .selectFrom('periods')
      .innerJoin('academic_years', 'academic_years.id', 'periods.academic_year_id')
      .select(['periods.id', 'periods.name', 'periods.starts_on', 'periods.ends_on'])
      .where('academic_years.is_current', '=', true)
      .where('periods.starts_on', '<=', today)
      .where('periods.ends_on', '>=', today)
      .executeTakeFirst();
    return row ? { id: row.id, name: row.name, startsOn: asIsoDate(row.starts_on)!, endsOn: asIsoDate(row.ends_on)! } : null;
  }

  /** Todos los contadores de las insignias en una sola consulta (solo lectura sobre tablas de otros módulos). */
  private async metrics(userId: string, season: Season | null): Promise<Metrics> {
    const from = season ? new Date(`${season.startsOn}T00:00:00-05:00`) : new Date(0);
    const to = season ? new Date(`${shiftDate(season.endsOn, 1)}T00:00:00-05:00`) : new Date(0);
    const u = userId;
    const result = await sql<Record<string, string | number>>`
      SELECT
        (SELECT coalesce(max(best_count), 0) FROM streaks WHERE user_id = ${u}) AS streak_best,
        (SELECT count(*) FROM (
          SELECT date_trunc('week', created_at AT TIME ZONE 'America/Bogota') AS w
          FROM xp_ledger WHERE user_id = ${u}
          GROUP BY 1 HAVING count(DISTINCT (created_at AT TIME ZONE 'America/Bogota')::DATE) >= 5) s) AS full_weeks,
        (SELECT count(*) FROM xp_ledger WHERE user_id = ${u} AND extract(hour FROM created_at AT TIME ZONE 'America/Bogota') < 7) AS early,
        (SELECT coalesce(sum(amount), 0) FROM xp_ledger WHERE user_id = ${u}) AS xp,
        (SELECT count(*) FROM mission_progress WHERE user_id = ${u} AND completed_at IS NOT NULL) AS missions,
        (SELECT count(*) FROM lesson_progress WHERE user_id = ${u} AND status = 'completed') AS lessons,
        (SELECT count(*) FROM submissions WHERE user_id = ${u} AND status = 'graded') AS submissions,
        (SELECT count(*) FROM attempts WHERE user_id = ${u} AND status = 'completed') AS exams,
        (SELECT count(*) FROM attempts WHERE user_id = ${u} AND status = 'completed' AND max_score > 0 AND score >= max_score) AS perfect_exams,
        (SELECT coalesce(sum(CASE WHEN level >= 10 THEN 3 WHEN level >= 7 THEN 2 WHEN level >= 4 THEN 1 ELSE 0 END), 0) FROM topic_mastery WHERE user_id = ${u}) AS stars,
        (SELECT count(*) FROM route_items WHERE user_id = ${u} AND boss AND status = 'correct') AS bosses,
        (SELECT count(*) FROM route_items WHERE user_id = ${u} AND status = 'correct') AS route_correct,
        (SELECT count(*) FROM topic_mastery WHERE user_id = ${u} AND level >= 10) AS topics_max,
        (SELECT count(DISTINCT topic_id) FROM route_items WHERE user_id = ${u} AND status = 'correct') AS topics_touched,
        (SELECT count(*) FROM topic_mastery m JOIN topics t ON t.id = m.topic_id WHERE m.user_id = ${u} AND t.generator IN ('simplify', 'frac_add') AND m.level >= 7) AS fraction_gold,
        (SELECT count(*) FROM flashcard_reviews WHERE user_id = ${u}) AS reviews,
        (SELECT coalesce(sum(actual_sec), 0) / 60 FROM focus_sessions WHERE user_id = ${u} AND status = 'done') AS focus_min,
        (SELECT count(*) FROM ai_usage WHERE user_id = ${u} AND feature = 'tutor') AS tutor,
        (SELECT count(DISTINCT method) FROM learning_activity WHERE user_id = ${u}) AS methods_tried,
        (SELECT count(*) FROM forum_posts WHERE author_id = ${u}) AS forum_posts,
        (SELECT count(*) FROM forum_posts WHERE author_id = ${u} AND is_answer) AS best_answers,
        (SELECT count(DISTINCT room_id) FROM arena_members WHERE user_id = ${u}) AS arena_games,
        (SELECT count(*) FROM arena_answers WHERE locked_by = ${u} AND correct) AS arena_locks,
        (SELECT count(DISTINCT session_id) FROM live_participants WHERE user_id = ${u}) AS live,
        (SELECT count(*) FROM arcade_sessions WHERE user_id = ${u} AND finished_at IS NOT NULL) AS arcade,
        (SELECT count(*) FROM arcade_sessions WHERE user_id = ${u} AND finished_at IS NOT NULL AND correct = total) AS arcade_perfect,
        (SELECT count(*) FROM arcade_sessions WHERE user_id = ${u} AND finished_at IS NOT NULL AND daily_on IS NOT NULL) AS daily,
        (SELECT count(DISTINCT game) FROM arcade_sessions WHERE user_id = ${u} AND finished_at IS NOT NULL) AS arcade_games,
        (SELECT count(*) FROM arcade_sessions WHERE user_id = ${u} AND game = 'memoria' AND score >= 90) AS memory_perfect,
        (SELECT count(*) FROM arcade_sessions WHERE user_id = ${u} AND game = 'ahorcado' AND score >= 80) AS hangman_clean,
        (SELECT coalesce(sum(correct), 0) FROM arcade_sessions WHERE user_id = ${u} AND game IN ('quiz', 'ahorcado')) AS glossary_hits,
        (SELECT count(*) FROM library_views WHERE user_id = ${u}) AS library_views,
        (SELECT count(*) FROM library_views v JOIN library_items i ON i.id = v.item_id WHERE v.user_id = ${u} AND i.kind = 'video') AS videos,
        (SELECT count(*) FROM bookmarks WHERE user_id = ${u}) AS bookmarks,
        (SELECT count(*) FROM learning_profiles WHERE user_id = ${u}) AS profiles,
        (SELECT count(*) FROM route_items r WHERE r.user_id = ${u} AND r.status = 'correct'
           AND r.method = (SELECT primary_method FROM learning_profiles WHERE user_id = ${u} ORDER BY taken_at DESC LIMIT 1)) AS own_method,
        (SELECT count(*) FROM (SELECT method FROM route_items WHERE user_id = ${u} AND status = 'correct' AND method IS NOT NULL GROUP BY method HAVING count(*) >= 3) s) AS methods_mastered,
        (SELECT coalesce(sum(amount), 0) FROM xp_ledger WHERE user_id = ${u} AND created_at >= ${from} AND created_at < ${to}) AS season_xp,
        (SELECT count(DISTINCT (created_at AT TIME ZONE 'America/Bogota')::DATE) FROM xp_ledger WHERE user_id = ${u} AND created_at >= ${from} AND created_at < ${to}) AS season_days,
        (SELECT count(*) FROM arcade_sessions WHERE user_id = ${u} AND finished_at >= ${from} AND finished_at < ${to}) AS season_arcade
    `.execute(this.database.db);
    const row = result.rows[0] ?? {};
    const metrics = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0])) as Metrics;
    metrics.buildings = [metrics.lessons, metrics.library_views, metrics.route_correct, metrics.reviews + metrics.focus_min, metrics.arcade, metrics.arena_games + metrics.live, metrics.tutor, metrics.forum_posts]
      .filter((n) => n > 0).length;
    return metrics;
  }

  /** Recalcula niveles; guarda solo las subidas y avisa con `badge.earned`. Una evaluación a la vez por estudiante. */
  async evaluate(userId: string) {
    const running = this.evaluating.get(userId);
    if (running) await running.catch(() => undefined);
    const job = this.runEvaluation(userId).finally(() => this.evaluating.delete(userId));
    this.evaluating.set(userId, job);
    return job;
  }

  private async runEvaluation(userId: string) {
    const season = await this.season();
    const [metrics, rows, current] = await Promise.all([
      this.metrics(userId, season),
      this.database.db.selectFrom('badges').select(['id', 'code']).where('active', '=', true).execute(),
      this.database.db.selectFrom('user_achievements').select(['badge_id', 'season', 'tier']).where('user_id', '=', userId).execute(),
    ]);
    const ids = new Map(rows.map((r) => [r.code, r.id]));
    const have = new Map(current.map((c) => [`${c.badge_id}:${c.season}`, Number(c.tier)]));
    const earned: BadgeEarnedEvent['badges'] = [];
    for (const badge of BADGES) {
      const badgeId = ids.get(badge.code);
      if (!badgeId || (badge.seasonal && !season)) continue;
      const seasonKey = badge.seasonal ? season!.id : ALWAYS;
      const value = metrics[badge.metric];
      const tier = tierFor(badge.thresholds, value);
      const before = have.get(`${badgeId}:${seasonKey}`) ?? 0;
      if (tier <= before) continue;
      const now = new Date();
      await this.database.db
        .insertInto('user_achievements')
        .values({ user_id: userId, badge_id: badgeId, season: seasonKey, tier, progress: value, awarded_at: now, upgraded_at: now, seen_at: null })
        .onConflict((oc) => oc.columns(['user_id', 'badge_id', 'season']).doUpdateSet({ tier, progress: value, upgraded_at: now, seen_at: null }))
        .execute();
      await this.database.db
        .insertInto('user_badges')
        .values({ user_id: userId, badge_id: badgeId })
        .onConflict((oc) => oc.columns(['user_id', 'badge_id']).doNothing())
        .execute();
      earned.push({ code: badge.code, name: badge.name, tier, maxTier: badge.thresholds.length });
    }
    if (earned.length) this.events.emit(DomainEvents.BadgeEarned, { userId, badges: earned } satisfies BadgeEarnedEvent);
    return { season, metrics, earned };
  }

  private async safeEvaluate(userId: string) {
    await this.evaluate(userId).catch((error) => this.logger.warn(`Insignias sin evaluar para ${userId}: ${error instanceof Error ? error.message : error}`));
  }

  @OnEvent(DomainEvents.LessonCompleted)
  async onLesson(event: LessonCompletedEvent) {
    await this.award(event.userId, 25, 'lesson_completed', 'lesson', event.lessonId);
    await this.touchStreak(event.userId);
    await this.bumpMission(event.userId, 'lessons', 1);
    await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.SubmissionGraded)
  async onSubmission(event: SubmissionGradedEvent) {
    await this.award(event.userId, 15, 'submission_graded', 'submission', event.submissionId);
    await this.touchStreak(event.userId);
    await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.AttemptGraded)
  async onAttempt(event: AttemptGradedEvent) {
    const ratio = event.maxScore > 0 ? event.score / event.maxScore : 0;
    await this.award(event.userId, Math.round(20 + ratio * 80), 'attempt_graded', 'attempt', event.attemptId);
    await this.touchStreak(event.userId);
    await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.RouteSolved)
  async onRoute(event: RouteSolvedEvent) {
    await this.award(event.userId, 4 + event.level + (event.levelUp ? 10 : 0), event.levelUp ? 'route_level_up' : 'route_solved', 'route_item', event.itemId);
    await this.touchStreak(event.userId);
    await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.ArenaFinished)
  async onArena(event: ArenaFinishedEvent) {
    const podium = [0, 30, 20, 10];
    for (const player of event.players) {
      await this.award(player.userId, 10 + player.correct * 5 + (podium[player.rank] ?? 0), 'arena_played', 'arena_room', event.roomId);
      await this.touchStreak(player.userId);
      await this.safeEvaluate(player.userId);
    }
  }

  @OnEvent(DomainEvents.StudyProgress)
  async onStudy(event: StudyProgressEvent) {
    const xp = event.kind === 'review' ? 1 : Math.min(20, Math.floor(event.amount / 5) * 2);
    await this.award(event.userId, xp, event.kind === 'review' ? 'flashcard_review' : 'focus_session', event.kind === 'review' ? 'flashcard' : 'focus_session', event.refId);
    await this.touchStreak(event.userId);
    if (event.kind !== 'review') await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.TutorMessage)
  async onTutor(event: TutorMessageEvent) {
    await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.LearningProfileSaved)
  async onProfile(event: LearningProfileSavedEvent) {
    await this.safeEvaluate(event.userId);
  }

  @OnEvent(DomainEvents.ArcadeFinished)
  async onArcade(event: ArcadeFinishedEvent) {
    await this.award(event.userId, event.xp, event.daily ? 'daily_challenge' : 'minigame', 'arcade_session', event.sessionId);
    await this.bumpMission(event.userId, 'minigame', 1);
    if (event.correct > 0) await this.touchStreak(event.userId);
    await this.safeEvaluate(event.userId);
  }

  async me(userId: string) {
    const { season, metrics } = await this.evaluate(userId);
    const xp = metrics.xp;
    const seasonKey = season?.id ?? null;
    const db = this.database.db;
    const [level, next, streak, owned, missions, pastSeasons] = await Promise.all([
      db.selectFrom('levels').selectAll().where('min_xp', '<=', xp).orderBy('min_xp', 'desc').executeTakeFirst(),
      db.selectFrom('levels').selectAll().where('min_xp', '>', xp).orderBy('min_xp').executeTakeFirst(),
      db.selectFrom('streaks').selectAll().where('user_id', '=', userId).executeTakeFirst(),
      db
        .selectFrom('user_achievements')
        .innerJoin('badges', 'badges.id', 'user_achievements.badge_id')
        .select(['badges.code', 'user_achievements.season', 'user_achievements.tier', 'user_achievements.upgraded_at', 'user_achievements.awarded_at', 'user_achievements.seen_at'])
        .where('user_achievements.user_id', '=', userId)
        .execute(),
      db
        .selectFrom('missions')
        .leftJoin('mission_progress', (join) =>
          join
            .onRef('mission_progress.mission_id', '=', 'missions.id')
            .on('mission_progress.user_id', '=', userId)
            .on('mission_progress.week_key', '=', weekKey()),
        )
        .select([
          'missions.code',
          'missions.title',
          'missions.description',
          'missions.goal_count',
          'missions.xp_reward',
          'mission_progress.progress',
          'mission_progress.completed_at',
        ])
        .where('missions.active', '=', true)
        .execute(),
      sql<{ season: string; name: string; badges: number; golds: number }>`
        SELECT a.season, p.name, count(*)::INT AS badges, sum(CASE WHEN a.tier = 3 THEN 1 ELSE 0 END)::INT AS golds
        FROM user_achievements a
        JOIN periods p ON p.id::STRING = a.season
        WHERE a.user_id = ${userId} AND a.season <> ${ALWAYS} AND a.season <> ${seasonKey ?? ''}
        GROUP BY a.season, p.name, p.starts_on
        ORDER BY p.starts_on DESC`.execute(db),
    ]);

    const achievements = BADGES.map((badge) => {
      const key = badge.seasonal ? seasonKey : ALWAYS;
      const mine = key ? owned.find((o) => o.code === badge.code && o.season === key) : undefined;
      const tier = mine ? Number(mine.tier) : 0;
      const progress = badge.seasonal && !season ? 0 : metrics[badge.metric];
      const next = badge.thresholds[tier] ?? null;
      const secret = Boolean(badge.hidden) && tier === 0;
      return {
        code: badge.code,
        name: secret ? 'Insignia secreta' : badge.name,
        description: secret ? 'Sigue explorando el campus para descubrirla.' : badge.description,
        icon: secret ? 'lock' : badge.icon,
        category: badge.category,
        hidden: Boolean(badge.hidden),
        seasonal: Boolean(badge.seasonal),
        tier,
        maxTier: badge.thresholds.length,
        thresholds: secret ? [] : badge.thresholds,
        progress: secret ? 0 : progress,
        next: secret ? null : next,
        unit: badge.unit,
        earnedAt: mine?.upgraded_at ?? null,
        isNew: Boolean(mine && !mine.seen_at),
      };
    });

    return {
      xp,
      level: level ?? { level: 1, min_xp: 0, title: 'Aprendiz' },
      nextLevel: next ?? null,
      streak: {
        current: this.liveStreak(streak),
        best: streak?.best_count ?? 0,
        lastActivityOn: asIsoDate(streak?.last_activity_on) ?? null,
      },
      badges: achievements.filter((a) => a.tier > 0).map((a) => ({ code: a.code, name: a.name, description: a.description, icon: a.icon, tier: a.tier })),
      achievements,
      unseen: achievements.filter((a) => a.isNew).length,
      season,
      pastSeasons: pastSeasons.rows,
      missions: missions.map((mission) => ({
        ...mission,
        progress: mission.progress ?? 0,
      })),
    };
  }

  async markSeen(userId: string) {
    const result = await this.database.db
      .updateTable('user_achievements')
      .set({ seen_at: new Date() })
      .where('user_id', '=', userId)
      .where('seen_at', 'is', null)
      .executeTakeFirst();
    this.events.emit(DomainEvents.BadgesSeen, { userId } satisfies BadgesSeenEvent);
    return { seen: Number(result.numUpdatedRows) };
  }

  async leaderboard(groupId: string) {
    const group = await this.database.db.selectFrom('groups_class').selectAll().where('id', '=', groupId).executeTakeFirst();
    if (!group) throw new ApiError(404, 'NOT_FOUND', 'El grupo no existe');
    const rows = await this.database.db
      .selectFrom('enrollments')
      .innerJoin('users', 'users.id', 'enrollments.user_id')
      .leftJoin('xp_ledger', 'xp_ledger.user_id', 'users.id')
      .select(['users.id', 'users.full_name', sql<number>`coalesce(sum(xp_ledger.amount), 0)`.as('xp')])
      .where('enrollments.group_id', '=', groupId)
      .where('enrollments.status', '=', 'active')
      .groupBy(['users.id', 'users.full_name'])
      .orderBy('xp', 'desc')
      .execute();
    const ranks = rows.map((row, index) => ({ position: index + 1, userId: row.id, fullName: row.full_name, xp: Number(row.xp) }));
    await this.database.db
      .insertInto('leaderboard_snapshots')
      .values({ group_id: groupId, week_key: weekKey(), ranks: JSON.stringify(ranks) })
      .onConflict((oc) => oc.columns(['group_id', 'week_key']).doUpdateSet({ ranks: JSON.stringify(ranks) }))
      .execute();
    return ranks;
  }
}
