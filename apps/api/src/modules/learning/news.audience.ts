import { sql, type RawBuilder } from 'kysely';
import { isBoard } from '@eduquest/contracts';
import type { AuthUser } from '../../core/auth/auth.decorators';

type Viewer = Pick<AuthUser, 'id' | 'role'>;

/** Groups whose news reach the viewer: own enrollment, taught groups, or the groups of linked students. */
export function viewerGroups(viewer: Viewer): RawBuilder<unknown> {
  if (viewer.role === 'student') {
    return sql`SELECT group_id FROM enrollments WHERE user_id = ${viewer.id} AND status = 'active'`;
  }
  if (viewer.role === 'teacher') {
    return sql`SELECT group_id FROM teaching_assignments WHERE teacher_id = ${viewer.id} UNION SELECT group_id FROM courses WHERE teacher_id = ${viewer.id}`;
  }
  if (viewer.role === 'guardian') {
    return sql`SELECT e.group_id FROM enrollments e JOIN guardian_links g ON g.student_id = e.user_id
      WHERE g.guardian_id = ${viewer.id} AND g.status = 'active' AND e.status = 'active'`;
  }
  return sql`SELECT id AS group_id FROM groups_class`;
}

export function viewerCourses(viewer: Viewer): RawBuilder<unknown> {
  if (viewer.role === 'teacher') return sql`SELECT id FROM courses WHERE teacher_id = ${viewer.id}`;
  if (viewer.role === 'student' || viewer.role === 'guardian') {
    return sql`SELECT id FROM courses WHERE published AND group_id IN (${viewerGroups(viewer)})`;
  }
  return sql`SELECT id FROM courses`;
}

/**
 * WHERE fragment over a `news` row aliased `n`. Published, unexpired and addressed to the viewer.
 * Authors always see their own items; admin and coordinación also see scheduled ones when `includeScheduled`.
 */
export function visibleNews(viewer: Viewer, includeScheduled = false): RawBuilder<boolean> {
  const board = isBoard(viewer.role);
  if (board && includeScheduled) return sql<boolean>`true`;
  return sql<boolean>`(
    n.author_id = ${viewer.id}
    OR (
      n.publish_at <= now()
      AND (n.expires_at IS NULL OR n.expires_at > now())
      AND EXISTS (
        SELECT 1 FROM news_audience a WHERE a.news_id = n.id AND (
          a.kind = 'all'
          OR (a.kind = 'role' AND a.value = ${viewer.role})
          OR (a.kind = 'group' AND a.value IN (SELECT group_id::STRING FROM (${viewerGroups(viewer)}) AS vg))
          OR (a.kind = 'course' AND a.value IN (SELECT id::STRING FROM (${viewerCourses(viewer)}) AS vc))
        )
      )
    )
  )`;
}

/** Unread news counter used by the campus "Cartelera" building. */
export function unreadNewsCount(viewer: Viewer) {
  return sql<{ n: string | number }>`SELECT count(*) AS n FROM news n
    WHERE n.author_id <> ${viewer.id} AND ${visibleNews(viewer)}
    AND NOT EXISTS (SELECT 1 FROM news_reads r WHERE r.news_id = n.id AND r.user_id = ${viewer.id})`;
}
