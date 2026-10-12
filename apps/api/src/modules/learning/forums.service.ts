import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { ForumReaction } from '@eduquest/contracts';
import { AiService } from '../../core/ai/ai.service';
import { personaLine, personaOf } from '../../core/common/companion';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents, type ForumBestAnswerEvent, type ForumMentionEvent, type ForumReplyEvent } from '../../core/events/domain-events';
import { LearningService } from './learning.service';

const BEST_ANSWER_SOURCE = 'forum_answer';
const TRANSCRIPT_LIMIT = 14_000;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word match that understands accented letters (JavaScript's \b only knows ASCII). */
const wordRegex = (text: string, flags = 'gu') => new RegExp(`(?<![\\p{L}\\p{N}])@?${escapeRegex(text)}(?![\\p{L}\\p{N}])`, flags);

interface Member {
  id: string;
  name: string;
  role: 'teacher' | 'student';
}

@Injectable()
export class ForumsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly learning: LearningService,
    private readonly events: EventEmitter2,
    private readonly ai: AiService,
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

  /** The course teacher and its actively enrolled students: who can be mentioned and who gets a pseudonym in summaries. */
  private async courseMembers(courseId: string): Promise<Member[]> {
    const result = await sql<Member>`
      SELECT u.id, u.full_name AS name, 'teacher' AS role
      FROM courses c JOIN users u ON u.id = c.teacher_id
      WHERE c.id = ${courseId}
      UNION
      SELECT u.id, u.full_name AS name, 'student' AS role
      FROM courses c
      JOIN enrollments e ON e.group_id = c.group_id AND e.academic_year_id = c.academic_year_id AND e.status = 'active'
      JOIN users u ON u.id = e.user_id
      WHERE c.id = ${courseId}`.execute(this.database.db);
    return result.rows.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'es') : a.role === 'teacher' ? -1 : 1));
  }

  async members(user: AuthUser, courseId: string) {
    await this.learning.assertAccess(user, courseId);
    return (await this.courseMembers(courseId)).filter((m) => m.id !== user.id);
  }

  /**
   * Attachments must be readable by everyone in the course: published items that are public, institutional or
   * belong to this same course. Returns the ids in the order given.
   */
  private async checkAttachments(courseId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const rows = await this.database.db
      .selectFrom('library_items')
      .select('id')
      .where('id', 'in', unique)
      .where('status', '=', 'published')
      .where((eb) => eb.or([eb('visibility', 'in', ['public', 'institution']), eb.and([eb('visibility', '=', 'course'), eb('course_id', '=', courseId)])]))
      .execute();
    if (rows.length !== unique.length) {
      throw new ApiError(400, 'ATTACHMENT_NOT_VISIBLE', 'Solo puedes adjuntar documentos publicados de la biblioteca general o de este curso');
    }
    return unique;
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
        sql<number>`(SELECT count(*)::INT FROM forum_attachments a WHERE a.thread_id = forum_threads.id)`.as('files'),
        sql<boolean>`EXISTS (SELECT 1 FROM forum_posts p JOIN forum_mentions m ON m.post_id = p.id WHERE p.thread_id = forum_threads.id AND m.user_id = ${user.id})`.as('mentioned'),
      ])
      .where('forum_threads.course_id', '=', courseId)
      .orderBy('forum_threads.pinned', 'desc')
      .orderBy('forum_threads.last_post_at', 'desc')
      .limit(100)
      .execute();
    return { moderator, threads: rows };
  }

  async createThread(user: AuthUser, courseId: string, input: { title: string; body: string; attachments?: string[] }) {
    await this.assertCanPost(user, courseId);
    const attachments = await this.checkAttachments(courseId, input.attachments ?? []);
    return this.database.withTx(async (trx) => {
      const thread = await trx
        .insertInto('forum_threads')
        .values({ course_id: courseId, author_id: user.id, title: input.title, body: input.body })
        .returning(['id', 'title'])
        .executeTakeFirstOrThrow();
      if (attachments.length) {
        await trx.insertInto('forum_attachments').values(attachments.map((item_id) => ({ thread_id: thread.id, item_id }))).execute();
      }
      return thread;
    });
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
    const postIds = posts.map((p) => p.id);
    const [reactions, mentions, attachments] = await Promise.all([
      postIds.length
        ? this.database.db
            .selectFrom('forum_reactions')
            .select(['post_id', 'kind', sql<number>`count(*)::INT`.as('n'), sql<boolean>`bool_or(user_id = ${user.id})`.as('mine')])
            .where('post_id', 'in', postIds)
            .groupBy(['post_id', 'kind'])
            .execute()
        : [],
      postIds.length
        ? this.database.db
            .selectFrom('forum_mentions')
            .innerJoin('users', 'users.id', 'forum_mentions.user_id')
            .select(['forum_mentions.post_id', 'users.id', 'users.full_name as name'])
            .where('forum_mentions.post_id', 'in', postIds)
            .execute()
        : [],
      this.database.db
        .selectFrom('forum_attachments')
        .innerJoin('library_items', 'library_items.id', 'forum_attachments.item_id')
        .select(['forum_attachments.post_id', 'library_items.id', 'library_items.title', 'library_items.kind'])
        .where('forum_attachments.thread_id', '=', threadId)
        .orderBy('forum_attachments.created_at')
        .execute(),
    ]);
    return {
      ...thread,
      summary: moderator ? thread.summary : null,
      summary_at: moderator ? thread.summary_at : null,
      summaryStale: moderator && thread.summary != null && Number(thread.summary_posts) !== Number(thread.posts_count),
      author: author?.full_name ?? '—',
      moderator,
      canPost: user.role === 'student' || user.role === 'teacher' || user.role === 'admin',
      canAnswer: (moderator && user.role !== 'coordinator') || thread.author_id === user.id,
      canSummarize: moderator,
      attachments: attachments.filter((a) => a.post_id == null).map(({ post_id: _, ...item }) => item),
      posts: posts.map((post) => ({
        ...post,
        reactions: reactions.filter((r) => r.post_id === post.id).map(({ post_id: _, ...r }) => r),
        mentions: mentions.filter((m) => m.post_id === post.id).map(({ post_id: _, ...m }) => m),
        attachments: attachments.filter((a) => a.post_id === post.id).map(({ post_id: _, ...item }) => item),
      })),
    };
  }

  async reply(user: AuthUser, threadId: string, input: { body: string; mentions?: string[]; attachments?: string[] }) {
    const thread = await this.threadRow(threadId);
    await this.assertCanPost(user, thread.course_id);
    const moderator = await this.canModerate(user, thread.course_id);
    if (thread.locked && !moderator) throw new ApiError(409, 'THREAD_LOCKED', 'El docente cerró este tema');
    const attachments = await this.checkAttachments(thread.course_id, input.attachments ?? []);
    const wanted = new Set(input.mentions ?? []);
    const mentioned = wanted.size
      ? (await this.courseMembers(thread.course_id)).filter((m) => wanted.has(m.id) && m.id !== user.id && input.body.includes(`@${m.name}`))
      : [];
    const post = await this.database.withTx(async (trx) => {
      const row = await trx
        .insertInto('forum_posts')
        .values({ thread_id: threadId, author_id: user.id, body: input.body })
        .returning(['id', 'created_at'])
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('forum_threads')
        .set({ posts_count: sql`posts_count + 1`, last_post_at: new Date() })
        .where('id', '=', threadId)
        .execute();
      if (mentioned.length) {
        await trx.insertInto('forum_mentions').values(mentioned.map((m) => ({ post_id: row.id, user_id: m.id }))).execute();
      }
      if (attachments.length) {
        await trx.insertInto('forum_attachments').values(attachments.map((item_id) => ({ thread_id: threadId, post_id: row.id, item_id }))).execute();
      }
      return row;
    });
    const mentionIds = mentioned.map((m) => m.id);
    if (thread.author_id !== user.id && !mentionIds.includes(thread.author_id)) {
      const event: ForumReplyEvent = { userId: thread.author_id, threadId, title: thread.title, authorName: user.fullName };
      this.events.emit(DomainEvents.ForumReply, event);
    }
    if (mentionIds.length) {
      const event: ForumMentionEvent = { userIds: mentionIds, threadId, title: thread.title, authorName: user.fullName };
      this.events.emit(DomainEvents.ForumMention, event);
    }
    return post;
  }

  async react(user: AuthUser, postId: string, kind: ForumReaction) {
    const post = await this.database.db.selectFrom('forum_posts').select(['id', 'thread_id', 'author_id']).where('id', '=', postId).executeTakeFirst();
    if (!post) throw new ApiError(404, 'NOT_FOUND', 'La respuesta no existe');
    const thread = await this.threadRow(post.thread_id);
    await this.assertCanPost(user, thread.course_id);
    if (post.author_id === user.id) throw new ApiError(409, 'OWN_POST', 'Las reacciones son para los mensajes de los demás');
    const removed = await this.database.db
      .deleteFrom('forum_reactions')
      .where('post_id', '=', postId)
      .where('user_id', '=', user.id)
      .where('kind', '=', kind)
      .executeTakeFirst();
    if (Number(removed.numDeletedRows) === 0) {
      await this.database.db.insertInto('forum_reactions').values({ post_id: postId, user_id: user.id, kind }).execute();
    }
    return { ok: true, active: Number(removed.numDeletedRows) === 0 };
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

  async removeThread(user: AuthUser, threadId: string) {
    const thread = await this.threadRow(threadId);
    if (!(await this.canModerate(user, thread.course_id))) throw new ApiError(403, 'FORBIDDEN', 'Solo el docente borra temas del foro');
    await this.database.db.deleteFrom('forum_threads').where('id', '=', threadId).execute();
    return { ok: true };
  }

  async markAnswer(user: AuthUser, postId: string) {
    const post = await this.database.db.selectFrom('forum_posts').select(['id', 'thread_id', 'is_answer', 'author_id']).where('id', '=', postId).executeTakeFirst();
    if (!post) throw new ApiError(404, 'NOT_FOUND', 'La respuesta no existe');
    const thread = await this.threadRow(post.thread_id);
    const moderator = await this.canModerate(user, thread.course_id);
    if (!moderator && thread.author_id !== user.id) throw new ApiError(403, 'FORBIDDEN', 'Solo el autor del tema o el docente marcan la respuesta');
    await this.database.db.updateTable('forum_posts').set({ is_answer: !post.is_answer }).where('id', '=', postId).execute();
    if (!post.is_answer && post.author_id !== user.id) {
      const [rewarded, student] = await Promise.all([
        this.database.db.selectFrom('xp_ledger').select('id').where('source_type', '=', BEST_ANSWER_SOURCE).where('source_id', '=', postId).executeTakeFirst(),
        this.database.db.selectFrom('user_roles').select('user_id').where('user_id', '=', post.author_id).where('role', '=', 'student').executeTakeFirst(),
      ]);
      if (student && !rewarded) {
        const event: ForumBestAnswerEvent = { userId: post.author_id, postId, threadId: thread.id, title: thread.title };
        this.events.emit(DomainEvents.ForumBestAnswer, event);
      }
    }
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

  /**
   * Teacher-facing digest of a thread. The model only sees pseudonyms ("Estudiante 3", "Docente"): names of every
   * course member are replaced in the text too, and contact data is stripped. Names are put back in the answer here.
   */
  async summarize(user: AuthUser, threadId: string, force = false) {
    const thread = await this.threadRow(threadId);
    if (!(await this.canModerate(user, thread.course_id))) throw new ApiError(403, 'FORBIDDEN', 'El resumen es para quien modera el foro');
    if (!force && thread.summary && Number(thread.summary_posts) === Number(thread.posts_count)) {
      return { summary: thread.summary, summary_at: thread.summary_at, source: 'cache' as const };
    }
    const posts = await this.database.db
      .selectFrom('forum_posts')
      .select(['id', 'author_id', 'body', 'is_answer'])
      .where('thread_id', '=', threadId)
      .orderBy('created_at')
      .execute();
    const reactions = posts.length
      ? await this.database.db
          .selectFrom('forum_reactions')
          .select(['post_id', sql<number>`count(*)::INT`.as('n')])
          .where('post_id', 'in', posts.map((p) => p.id))
          .groupBy('post_id')
          .execute()
      : [];
    const members = await this.courseMembers(thread.course_id);
    const byId = new Map(members.map((m) => [m.id, m]));
    const alias = new Map<string, string>();
    let students = 0;
    let others = 0;
    const aliasOf = (id: string) => {
      const role = byId.get(id)?.role;
      if (!alias.has(id)) alias.set(id, role === 'teacher' ? 'Docente' : role === 'student' ? `Estudiante ${++students}` : `Participante ${++others}`);
      return alias.get(id)!;
    };
    aliasOf(thread.author_id);
    posts.forEach((p) => aliasOf(p.author_id));
    members.forEach((m) => aliasOf(m.id));

    const patterns = members
      .flatMap((m) => {
        const label = alias.get(m.id)!;
        const parts = m.name.split(/\s+/).filter((part) => part.length >= 3);
        return [m.name, ...parts].map((text) => ({ re: wordRegex(text, 'giu'), label, size: text.length }));
      })
      .sort((a, b) => b.size - a.size);
    const scrub = (text: string) => {
      let out = text
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
        .replace(/\+?\d[\d\s-]{7,}\d/g, '[teléfono]');
      for (const { re, label } of patterns) out = out.replace(re, label);
      return out;
    };
    const likes = new Map(reactions.map((r) => [r.post_id, r.n]));
    let transcript = `TEMA (${alias.get(thread.author_id)}): ${scrub(thread.title)}\n${scrub(thread.body)}\n`;
    for (const post of posts) {
      const extra = [post.is_answer ? 'marcada como respuesta' : '', likes.get(post.id) ? `${likes.get(post.id)} reacciones` : ''].filter(Boolean).join(', ');
      transcript += `\n— ${alias.get(post.author_id)}${extra ? ` (${extra})` : ''}: ${scrub(post.body)}`;
    }
    if (transcript.length > TRANSCRIPT_LIMIT) transcript = `${transcript.slice(0, TRANSCRIPT_LIMIT)}\n[…]`;

    const persona = await personaOf(this.database, user.id);
    const answer = await this.ai.chatText(
      [
        {
          role: 'system',
          content: `Eres ${persona.name}, asistente docente de Ludoteka Campus. ${personaLine(persona)} Resume para el docente un hilo de foro escolar. No saludes ni te presentes: empieza directamente por el primer apartado. Usa exactamente tres apartados, cada uno con su título en negrita (**Ideas principales**, **Dudas sin resolver**, **Quién podría necesitar apoyo**) en su propia línea seguido de viñetas cortas con «- ». Refiérete a las personas solo con las etiquetas que aparecen (Estudiante N, Docente). No inventes datos. Máximo 160 palabras, sin LaTeX.`,
        },
        { role: 'user', content: transcript },
      ],
      { feature: 'foros.resumen', userId: user.id, temperature: 0.2, maxTokens: 700 },
    );
    if (!answer) {
      const answered = posts.some((p) => p.is_answer);
      const top = [...posts].sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0))[0];
      const names = new Map([...alias].map(([id, label]) => [label, byId.get(id)?.name ?? label]));
      const fallback = [
        `${posts.length} respuestas de ${new Set(posts.map((p) => p.author_id)).size} participantes.`,
        answered ? 'El tema ya tiene una respuesta marcada.' : 'Todavía no hay una respuesta marcada.',
        top && likes.get(top.id) ? `El mensaje con más reacciones es de ${names.get(alias.get(top.author_id)!)}.` : '',
      ].filter(Boolean).join(' ');
      return { summary: fallback, summary_at: null, source: 'fragmentos' as const };
    }
    const labels = [...alias].map(([id, label]) => ({ label, name: byId.get(id)?.name ?? (id === thread.author_id ? 'Autor del tema' : 'Participante') }));
    labels.sort((a, b) => b.label.length - a.label.length);
    let summary = answer;
    for (const { label, name } of labels) summary = summary.replace(wordRegex(label), name);
    const now = new Date();
    await this.database.db
      .updateTable('forum_threads')
      .set({ summary: summary.slice(0, 4000), summary_posts: thread.posts_count, summary_at: now })
      .where('id', '=', threadId)
      .execute();
    return { summary, summary_at: now, source: 'llm' as const };
  }
}
