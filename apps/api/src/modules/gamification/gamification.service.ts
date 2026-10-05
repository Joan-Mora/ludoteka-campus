import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import {
  DomainEvents,
  type AttemptGradedEvent,
  type LessonCompletedEvent,
  type SubmissionGradedEvent,
  type TutorMessageEvent,
} from '../../core/events/domain-events';
import { asIsoDate, bogotaToday, shiftDate, weekKey } from '../../core/time';

@Injectable()
export class GamificationService {
  constructor(private readonly database: DatabaseService) {}

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
    if (next >= 3) await this.giveBadge(userId, 'racha-3');
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

  private async giveBadge(userId: string, code: string) {
    const badge = await this.database.db.selectFrom('badges').selectAll().where('code', '=', code).executeTakeFirst();
    if (!badge) return;
    await this.database.db
      .insertInto('user_badges')
      .values({ user_id: userId, badge_id: badge.id })
      .onConflict((oc) => oc.columns(['user_id', 'badge_id']).doNothing())
      .execute();
  }

  @OnEvent(DomainEvents.LessonCompleted)
  async onLesson(event: LessonCompletedEvent) {
    await this.award(event.userId, 25, 'lesson_completed', 'lesson', event.lessonId);
    await this.touchStreak(event.userId);
    await this.bumpMission(event.userId, 'lessons', 1);
    const count = await this.database.db
      .selectFrom('lesson_progress')
      .select(sql<number>`count(*)`.as('n'))
      .where('user_id', '=', event.userId)
      .where('status', '=', 'completed')
      .executeTakeFirstOrThrow();
    if (Number(count.n) >= 1) await this.giveBadge(event.userId, 'primera-leccion');
  }

  @OnEvent(DomainEvents.SubmissionGraded)
  async onSubmission(event: SubmissionGradedEvent) {
    await this.award(event.userId, 15, 'submission_graded', 'submission', event.submissionId);
    await this.touchStreak(event.userId);
  }

  @OnEvent(DomainEvents.AttemptGraded)
  async onAttempt(event: AttemptGradedEvent) {
    const ratio = event.maxScore > 0 ? event.score / event.maxScore : 0;
    await this.award(event.userId, Math.round(20 + ratio * 80), 'attempt_graded', 'attempt', event.attemptId);
    await this.touchStreak(event.userId);
    if (event.maxScore > 0 && event.score === event.maxScore) await this.giveBadge(event.userId, 'examen-perfecto');
  }

  @OnEvent(DomainEvents.TutorMessage)
  async onTutor(event: TutorMessageEvent) {
    await this.giveBadge(event.userId, 'tutor-curioso');
  }

  async recordMinigame(userId: string, game: 'carrera' | 'fracciones', score: number) {
    const xp = Math.min(40, Math.floor(score / 10));
    await this.database.db.insertInto('minigame_runs').values({ user_id: userId, game, score, xp_awarded: xp }).execute();
    await this.award(userId, xp, 'minigame', 'minigame', game);
    await this.bumpMission(userId, 'minigame', 1);
    await this.touchStreak(userId);
    return { xp };
  }

  async me(userId: string) {
    const totalRow = await this.database.db
      .selectFrom('xp_ledger')
      .select(sql<number>`coalesce(sum(amount), 0)`.as('n'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    const xp = Number(totalRow.n);
    const level = await this.database.db
      .selectFrom('levels')
      .selectAll()
      .where('min_xp', '<=', xp)
      .orderBy('min_xp', 'desc')
      .executeTakeFirst();
    const next = await this.database.db
      .selectFrom('levels')
      .selectAll()
      .where('min_xp', '>', xp)
      .orderBy('min_xp')
      .executeTakeFirst();
    const streak = await this.database.db.selectFrom('streaks').selectAll().where('user_id', '=', userId).executeTakeFirst();
    const badges = await this.database.db
      .selectFrom('user_badges')
      .innerJoin('badges', 'badges.id', 'user_badges.badge_id')
      .select(['badges.code', 'badges.name', 'badges.description', 'badges.icon', 'user_badges.awarded_at'])
      .where('user_badges.user_id', '=', userId)
      .execute();
    const catalog = await this.database.db.selectFrom('badges').select(['code', 'name', 'description', 'icon']).execute();
    const missions = await this.database.db
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
      .execute();
    return {
      xp,
      level: level ?? { level: 1, min_xp: 0, title: 'Aprendiz' },
      nextLevel: next ?? null,
      streak: {
        current: streak?.current_count ?? 0,
        best: streak?.best_count ?? 0,
      },
      badges,
      catalog,
      missions: missions.map((mission) => ({
        ...mission,
        progress: mission.progress ?? 0,
      })),
    };
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
