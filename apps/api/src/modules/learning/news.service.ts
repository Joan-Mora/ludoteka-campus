import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { isBoard as boardRole, ROLE_LABELS, type NewsAudience } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents, type NewsPublishedEvent, type NewsReadEvent } from '../../core/events/domain-events';
import { visibleNews } from './news.audience';

interface NewsInput {
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  requiresAck: boolean;
  official?: boolean;
  publishAt?: string;
  expiresAt?: string;
  audience: NewsAudience[];
}

interface NewsRow {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  requires_ack: boolean;
  official: boolean;
  publish_at: Date;
  expires_at: Date | null;
  created_at: Date;
  read_at: Date | null;
  acknowledged_at: Date | null;
  reads: number;
  acks: number;
}

const isBoard = (user: AuthUser) => boardRole(user.role);
const AUDIENCE_LABELS: Record<string, string> = { ...ROLE_LABELS, teacher: 'Docentes', student: 'Estudiantes', guardian: 'Acudientes' };

@Injectable()
export class NewsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  async feed(viewer: AuthUser, limit = 40) {
    const rows = await sql<NewsRow>`
      SELECT n.id, n.author_id, u.full_name AS author_name, n.title, n.body, n.category, n.pinned, n.requires_ack, n.official,
             n.publish_at, n.expires_at, n.created_at, r.read_at, r.acknowledged_at,
             (SELECT count(*) FROM news_reads x WHERE x.news_id = n.id) AS reads,
             (SELECT count(*) FROM news_reads x WHERE x.news_id = n.id AND x.acknowledged_at IS NOT NULL) AS acks
      FROM news n
      JOIN users u ON u.id = n.author_id
      LEFT JOIN news_reads r ON r.news_id = n.id AND r.user_id = ${viewer.id}
      WHERE ${visibleNews(viewer, true)}
      ORDER BY n.pinned DESC, n.publish_at DESC
      LIMIT ${Math.min(100, Math.max(1, limit))}
    `.execute(this.database.db);
    const ids = rows.rows.map((row) => row.id);
    const audiences = ids.length
      ? await this.database.db.selectFrom('news_audience').selectAll().where('news_id', 'in', ids).execute()
      : [];
    const labels = await this.audienceLabels(audiences);
    const now = Date.now();
    return rows.rows.map((row) => {
      const mine = row.author_id === viewer.id || isBoard(viewer);
      return {
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        pinned: row.pinned,
        requiresAck: row.requires_ack,
        official: row.official,
        publishAt: row.publish_at,
        expiresAt: row.expires_at,
        author: row.author_name,
        scheduled: new Date(row.publish_at).getTime() > now,
        expired: row.expires_at ? new Date(row.expires_at).getTime() <= now : false,
        readAt: row.read_at,
        acknowledgedAt: row.acknowledged_at,
        canManage: mine,
        audience: audiences.filter((a) => a.news_id === row.id).map((a) => ({ kind: a.kind, value: a.value, label: labels.get(`${a.kind}:${a.value}`) ?? a.value })),
        stats: mine ? { reads: Number(row.reads), acks: Number(row.acks) } : undefined,
      };
    });
  }

  private async audienceLabels(rows: { kind: string; value: string }[]) {
    const labels = new Map<string, string>([['all:', 'Toda la comunidad']]);
    for (const [role, label] of Object.entries(AUDIENCE_LABELS)) labels.set(`role:${role}`, label);
    const groupIds = [...new Set(rows.filter((r) => r.kind === 'group').map((r) => r.value))];
    const courseIds = [...new Set(rows.filter((r) => r.kind === 'course').map((r) => r.value))];
    const gradeIds = [...new Set(rows.filter((r) => r.kind === 'grade').map((r) => r.value))];
    if (gradeIds.length) {
      const grades = await this.database.db.selectFrom('grades').select(['id', 'name']).where('id', 'in', gradeIds).execute();
      for (const g of grades) labels.set(`grade:${g.id}`, `Grado ${g.name}`);
    }
    if (groupIds.length) {
      const groups = await this.database.db
        .selectFrom('groups_class')
        .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
        .select(['groups_class.id', 'groups_class.name', 'grades.name as grade'])
        .where('groups_class.id', 'in', groupIds)
        .execute();
      for (const g of groups) labels.set(`group:${g.id}`, `${g.grade} · ${g.name}`);
    }
    if (courseIds.length) {
      const courses = await this.database.db.selectFrom('courses').select(['id', 'title']).where('id', 'in', courseIds).execute();
      for (const c of courses) labels.set(`course:${c.id}`, c.title);
    }
    return labels;
  }

  /**
   * Targets the author may publish to, by grade. Board roles reach everyone, whole grades and roles;
   * a teacher reaches the groups they teach (however many courses they have in each), grouped by grade.
   */
  async targets(viewer: AuthUser) {
    const board = isBoard(viewer);
    const groups = await this.database.db
      .selectFrom('groups_class')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select(['groups_class.id', 'groups_class.name', 'groups_class.grade_id', 'grades.name as grade', 'grades.level'])
      .$if(!board, (q) =>
        q.where((eb) =>
          eb.or([
            eb.exists(eb.selectFrom('teaching_assignments').select('teaching_assignments.id').whereRef('teaching_assignments.group_id', '=', 'groups_class.id').where('teaching_assignments.teacher_id', '=', viewer.id)),
            eb.exists(eb.selectFrom('courses').select('courses.id').whereRef('courses.group_id', '=', 'groups_class.id').where('courses.teacher_id', '=', viewer.id)),
          ]),
        ),
      )
      .orderBy('grades.level')
      .orderBy('groups_class.name')
      .execute();
    const grades = new Map<string, { id: string; label: string; groups: { id: string; label: string }[] }>();
    for (const g of groups) {
      const grade = grades.get(g.grade_id) ?? { id: g.grade_id, label: g.grade, groups: [] };
      grade.groups.push({ id: g.id, label: `${g.grade} ${g.name}` });
      grades.set(g.grade_id, grade);
    }
    return {
      allowAll: board,
      roles: board ? ['student', 'guardian', 'teacher', 'coordinator', 'rector'] : [],
      canOfficial: viewer.role === 'rector',
      grades: [...grades.values()],
    };
  }

  private async assertAudience(viewer: AuthUser, audience: NewsAudience[]) {
    if (isBoard(viewer)) return;
    const allowed = await this.targets(viewer);
    const groups = new Set(allowed.grades.flatMap((g) => g.groups.map((group) => group.id)));
    for (const target of audience) {
      if (target.kind !== 'group' || !groups.has(target.value)) throw new ApiError(403, 'AUDIENCE_FORBIDDEN', 'Como docente publicas a los grupos que tienes a cargo');
    }
  }

  async create(viewer: AuthUser, input: NewsInput) {
    await this.assertAudience(viewer, input.audience);
    if (input.requiresAck && !isBoard(viewer) && input.category === 'urgente') {
      throw new ApiError(403, 'FORBIDDEN', 'Las circulares urgentes con confirmación las emite coordinación');
    }
    if (input.official && viewer.role !== 'rector') throw new ApiError(403, 'FORBIDDEN', 'Los comunicados oficiales los firma rectoría');
    const publishAt = input.publishAt ? new Date(input.publishAt) : new Date();
    const unique = new Map(input.audience.map((a) => [`${a.kind}:${'value' in a ? a.value : ''}`, a]));
    const news = await this.database.withTx(async (trx) => {
      const row = await trx
        .insertInto('news')
        .values({
          author_id: viewer.id,
          title: input.title,
          body: input.body,
          category: input.category,
          pinned: input.pinned,
          requires_ack: input.requiresAck,
          official: Boolean(input.official),
          publish_at: publishAt,
          expires_at: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .returning(['id', 'title'])
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('news_audience')
        .values([...unique.values()].map((a) => ({ news_id: row.id, kind: a.kind, value: 'value' in a ? a.value : '' })))
        .execute();
      await trx
        .insertInto('audit_log')
        .values({ actor_id: viewer.id, action: 'news.create', entity: 'news', entity_id: row.id, meta: JSON.stringify({ audience: [...unique.keys()] }) })
        .execute();
      return row;
    });
    if (publishAt.getTime() <= Date.now() + 5000) {
      const recipients = await this.recipients(news.id);
      const event: NewsPublishedEvent = {
        newsId: news.id,
        title: news.title,
        category: input.category,
        requiresAck: input.requiresAck,
        recipientIds: recipients.map((r) => r.id).filter((id) => id !== viewer.id),
      };
      this.events.emit(DomainEvents.NewsPublished, event);
    }
    return { id: news.id };
  }

  private async manageable(viewer: AuthUser, id: string) {
    const row = await this.database.db.selectFrom('news').select(['id', 'author_id', 'pinned']).where('id', '=', id).executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'La novedad no existe');
    if (row.author_id !== viewer.id && !isBoard(viewer)) throw new ApiError(403, 'FORBIDDEN', 'Solo el autor o coordinación pueden gestionarla');
    return row;
  }

  async pin(viewer: AuthUser, id: string, pinned: boolean) {
    await this.manageable(viewer, id);
    await this.database.db.updateTable('news').set({ pinned, updated_at: new Date() }).where('id', '=', id).execute();
    return { ok: true };
  }

  async remove(viewer: AuthUser, id: string) {
    await this.manageable(viewer, id);
    await this.database.db.deleteFrom('news').where('id', '=', id).execute();
    await this.database.db.insertInto('audit_log').values({ actor_id: viewer.id, action: 'news.delete', entity: 'news', entity_id: id, meta: null }).execute();
    return { ok: true };
  }

  private async assertVisible(viewer: AuthUser, id: string) {
    const visible = await sql<{ id: string }>`SELECT n.id FROM news n WHERE n.id = ${id} AND ${visibleNews(viewer)}`.execute(this.database.db);
    if (!visible.rows.length) throw new ApiError(404, 'NOT_FOUND', 'La novedad no existe');
  }

  async markRead(viewer: AuthUser, id: string, acknowledge: boolean) {
    await this.assertVisible(viewer, id);
    const now = new Date();
    await this.database.db
      .insertInto('news_reads')
      .values({ news_id: id, user_id: viewer.id, read_at: now, acknowledged_at: acknowledge ? now : null })
      .onConflict((oc) =>
        acknowledge
          ? oc.columns(['news_id', 'user_id']).doUpdateSet({ acknowledged_at: sql`coalesce(news_reads.acknowledged_at, ${now})` })
          : oc.columns(['news_id', 'user_id']).doNothing(),
      )
      .execute();
    this.events.emit(DomainEvents.NewsRead, { userId: viewer.id, newsId: id } satisfies NewsReadEvent);
    return { ok: true };
  }

  /** Everyone the audience resolves to, so authors can see who has read or acknowledged. */
  async recipients(newsId: string) {
    const result = await sql<{ id: string; full_name: string; role: string }>`
      SELECT DISTINCT u.id, u.full_name, ur.role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      WHERE EXISTS (
        SELECT 1 FROM news_audience a WHERE a.news_id = ${newsId} AND (
          a.kind = 'all'
          OR (a.kind = 'role' AND a.value = ur.role)
          OR (a.kind = 'grade' AND (
            EXISTS (SELECT 1 FROM enrollments e JOIN groups_class gc ON gc.id = e.group_id WHERE e.user_id = u.id AND e.status = 'active' AND gc.grade_id::STRING = a.value)
            OR EXISTS (SELECT 1 FROM teaching_assignments t JOIN groups_class gc ON gc.id = t.group_id WHERE t.teacher_id = u.id AND gc.grade_id::STRING = a.value)
            OR EXISTS (SELECT 1 FROM courses c JOIN groups_class gc ON gc.id = c.group_id WHERE c.teacher_id = u.id AND gc.grade_id::STRING = a.value)
            OR EXISTS (SELECT 1 FROM guardian_links g JOIN enrollments e ON e.user_id = g.student_id JOIN groups_class gc ON gc.id = e.group_id
                       WHERE g.guardian_id = u.id AND g.status = 'active' AND e.status = 'active' AND gc.grade_id::STRING = a.value)
          ))
          OR (a.kind = 'group' AND (
            EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.status = 'active' AND e.group_id::STRING = a.value)
            OR EXISTS (SELECT 1 FROM teaching_assignments t WHERE t.teacher_id = u.id AND t.group_id::STRING = a.value)
            OR EXISTS (SELECT 1 FROM courses c WHERE c.teacher_id = u.id AND c.group_id::STRING = a.value)
            OR EXISTS (SELECT 1 FROM guardian_links g JOIN enrollments e ON e.user_id = g.student_id
                       WHERE g.guardian_id = u.id AND g.status = 'active' AND e.status = 'active' AND e.group_id::STRING = a.value)
          ))
          OR (a.kind = 'course' AND EXISTS (
            SELECT 1 FROM courses c WHERE c.id::STRING = a.value AND (
              c.teacher_id = u.id
              OR EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.status = 'active' AND e.group_id = c.group_id)
              OR EXISTS (SELECT 1 FROM guardian_links g JOIN enrollments e ON e.user_id = g.student_id
                         WHERE g.guardian_id = u.id AND g.status = 'active' AND e.status = 'active' AND e.group_id = c.group_id)
            )
          ))
        )
      )
      ORDER BY u.full_name
      LIMIT 2000
    `.execute(this.database.db);
    return result.rows;
  }

  async receipts(viewer: AuthUser, id: string) {
    const news = await this.manageable(viewer, id);
    const people = (await this.recipients(id)).filter((p) => p.id !== news.author_id);
    const reads = await this.database.db.selectFrom('news_reads').selectAll().where('news_id', '=', id).execute();
    const byUser = new Map(reads.map((r) => [r.user_id, r]));
    const rows = people.map((p) => ({
      userId: p.id,
      name: p.full_name,
      role: p.role,
      readAt: byUser.get(p.id)?.read_at ?? null,
      acknowledgedAt: byUser.get(p.id)?.acknowledged_at ?? null,
    }));
    return {
      total: rows.length,
      read: rows.filter((r) => r.readAt).length,
      acknowledged: rows.filter((r) => r.acknowledgedAt).length,
      people: rows,
    };
  }
}
