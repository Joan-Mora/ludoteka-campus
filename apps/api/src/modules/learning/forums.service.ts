import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents, type ForumReplyEvent } from '../../core/events/domain-events';
import { LearningService } from './learning.service';

@Injectable()
export class ForumsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly learning: LearningService,
    private readonly events: EventEmitter2,
  ) {}

  private async threadRow(threadId: string) {
    const thread = await this.database.db.selectFrom('forum_threads').selectAll().where('id', '=', threadId).executeTakeFirst();
    if (!thread) throw new ApiError(404, 'NOT_FOUND', 'El tema no existe');
    return thread;
  }

  private async canModerate(user: AuthUser, courseId: string) {
    const course = await this.learning.assertAccess(user, courseId);
    return user.role === 'admin' || user.role === 'coordinator' || course.teacher_id === user.id;
  }

  /** Writers in a course forum: its students and teacher (and admin). Coordination moderates but doesn't post. */
  private async assertCanPost(user: AuthUser, courseId: string) {
    if (user.role !== 'student' && user.role !== 'teacher' && user.role !== 'admin') {
      throw new ApiError(403, 'READ_ONLY', 'En los foros de curso participan estudiantes y docentes');
    }
    await this.learning.assertAccess(user, courseId);
  }

  async threads(user: AuthUser, courseId: string) {
    const moderator = await this.canModerate(user, courseId);
    const rows = await this.database.db
      .selectFrom('forum_threads')
      .innerJoin('users', 'users.id', 'forum_threads.author_id')
      .select([
        'forum_threads.id',
        'forum_threads.title',
        'forum_threads.body',
        'forum_threads.pinned',
        'forum_threads.locked',
        'forum_threads.posts_count',
        'forum_threads.last_post_at',
        'forum_threads.created_at',
        'users.full_name as author',
        sql<boolean>`EXISTS (SELECT 1 FROM forum_posts p WHERE p.thread_id = forum_threads.id AND p.is_answer)`.as('answered'),
      ])
      .where('forum_threads.course_id', '=', courseId)
      .orderBy('forum_threads.pinned', 'desc')
      .orderBy('forum_threads.last_post_at', 'desc')
      .limit(100)
      .execute();
    return { moderator, threads: rows };
  }

  async createThread(user: AuthUser, courseId: string, input: { title: string; body: string }) {
    await this.assertCanPost(user, courseId);
    return this.database.db
      .insertInto('forum_threads')
      .values({ course_id: courseId, author_id: user.id, title: input.title, body: input.body })
      .returning(['id', 'title'])
      .executeTakeFirstOrThrow();
  }

  async thread(user: AuthUser, threadId: string) {
    const thread = await this.threadRow(threadId);
    const moderator = await this.canModerate(user, thread.course_id);
    const author = await this.database.db.selectFrom('users').select('full_name').where('id', '=', thread.author_id).executeTakeFirst();
    const posts = await this.database.db
      .selectFrom('forum_posts')
      .innerJoin('users', 'users.id', 'forum_posts.author_id')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['forum_posts.id', 'forum_posts.body', 'forum_posts.is_answer', 'forum_posts.created_at', 'forum_posts.author_id', 'users.full_name as author', 'user_roles.role'])
      .where('forum_posts.thread_id', '=', threadId)
      .orderBy('forum_posts.created_at')
      .execute();
    return {
      ...thread,
      author: author?.full_name ?? '—',
      moderator,
      canPost: user.role === 'student' || user.role === 'teacher' || user.role === 'admin',
      canAnswer: (moderator && user.role !== 'coordinator') || thread.author_id === user.id,
      posts,
    };
  }

  async reply(user: AuthUser, threadId: string, body: string) {
    const thread = await this.threadRow(threadId);
    await this.assertCanPost(user, thread.course_id);
    const moderator = await this.canModerate(user, thread.course_id);
    if (thread.locked && !moderator) throw new ApiError(409, 'THREAD_LOCKED', 'El docente cerró este tema');
    const post = await this.database.withTx(async (trx) => {
      const row = await trx
        .insertInto('forum_posts')
        .values({ thread_id: threadId, author_id: user.id, body })
        .returning(['id', 'created_at'])
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('forum_threads')
        .set({ posts_count: sql`posts_count + 1`, last_post_at: new Date() })
        .where('id', '=', threadId)
        .execute();
      return row;
    });
    if (thread.author_id !== user.id) {
      const event: ForumReplyEvent = { userId: thread.author_id, threadId, title: thread.title, authorName: user.fullName };
      this.events.emit(DomainEvents.ForumReply, event);
    }
    return post;
  }

  async moderate(user: AuthUser, threadId: string, patch: { pinned?: boolean; locked?: boolean }) {
    const thread = await this.threadRow(threadId);
    if (!(await this.canModerate(user, thread.course_id))) throw new ApiError(403, 'FORBIDDEN', 'Solo el docente modera el foro');
    const set: { pinned?: boolean; locked?: boolean } = {};
    if (typeof patch.pinned === 'boolean') set.pinned = patch.pinned;
    if (typeof patch.locked === 'boolean') set.locked = patch.locked;
    if (!Object.keys(set).length) return { ok: true };
    await this.database.db.updateTable('forum_threads').set(set).where('id', '=', threadId).execute();
    return { ok: true };
  }

  async markAnswer(user: AuthUser, postId: string) {
    const post = await this.database.db.selectFrom('forum_posts').select(['id', 'thread_id', 'is_answer']).where('id', '=', postId).executeTakeFirst();
    if (!post) throw new ApiError(404, 'NOT_FOUND', 'La respuesta no existe');
    const thread = await this.threadRow(post.thread_id);
    const moderator = await this.canModerate(user, thread.course_id);
    if (!moderator && thread.author_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Solo el autor del tema o el docente marcan la respuesta');
    await this.database.db.updateTable('forum_posts').set({ is_answer: !post.is_answer }).where('id', '=', postId).execute();
    return { ok: true, isAnswer: !post.is_answer };
  }

  async removePost(user: AuthUser, postId: string) {
    const post = await this.database.db.selectFrom('forum_posts').select(['id', 'thread_id', 'author_id']).where('id', '=', postId).executeTakeFirst();
    if (!post) throw new ApiError(404, 'NOT_FOUND', 'La respuesta no existe');
    const thread = await this.threadRow(post.thread_id);
    const moderator = await this.canModerate(user, thread.course_id);
    if (!moderator && post.author_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'No puedes borrar esta respuesta');
    await this.database.withTx(async (trx) => {
      await trx.deleteFrom('forum_posts').where('id', '=', postId).execute();
      await trx.updateTable('forum_threads').set({ posts_count: sql`greatest(posts_count - 1, 0)` }).where('id', '=', post.thread_id).execute();
    });
    return { ok: true };
  }
}
