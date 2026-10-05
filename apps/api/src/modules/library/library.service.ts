import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { sql } from 'kysely';
import type { Citation } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { AiService } from '../../core/ai/ai.service';
import { viewerCourses } from '../learning/public-api';
import { Cloudinary } from './cloudinary';
import { buildGuidePdf, GUIDE_TITLE } from './library.seed';

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS = 400;

type Viewer = Pick<AuthUser, 'id' | 'role'>;

interface ItemInput {
  title: string;
  description: string;
  subjectId: string;
  gradeId?: string;
  visibility: 'public' | 'institution' | 'course';
  courseId?: string;
  tags: string[];
  link?: string;
  upload?: {
    publicId: string;
    version: string | number;
    signature: string;
    secureUrl: string;
    resourceType: 'image' | 'video' | 'raw';
    format?: string;
    bytes: number;
    etag?: string;
    pages?: number;
  };
}

interface Hit {
  chunk_id: string;
  item_id: string;
  title: string;
  url: string;
  page: number | null;
  content: string;
}

const isBoard = (viewer: Viewer) => viewer.role === 'admin' || viewer.role === 'directivo';
const isStaff = (viewer: Viewer) => isBoard(viewer) || viewer.role === 'teacher';
const vectorLiteral = (values: number[]) => `[${values.map((v) => (Number.isFinite(v) ? v.toFixed(6) : '0')).join(',')}]`;

/** Splits page text into overlapping windows that end on a sentence when possible. */
export function chunkPages(pages: { num: number; text: string }[]) {
  const out: { page: number; content: string }[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\s+/g, ' ').trim();
    let start = 0;
    while (start < text.length && out.length < MAX_CHUNKS) {
      let end = Math.min(text.length, start + CHUNK_SIZE);
      if (end < text.length) {
        const stop = text.lastIndexOf('. ', end);
        if (stop > start + CHUNK_SIZE * 0.5) end = stop + 1;
      }
      const content = text.slice(start, end).trim();
      if (content.length >= 40) out.push({ page: page.num, content });
      if (end >= text.length) break;
      start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }
  }
  return out;
}

/**
 * OR-query of the meaningful words, so a question still matches fragments that share only some terms.
 * Accents are kept: the Spanish stemmer only strips accented suffixes ("precipitación" → "precipit").
 */
function orQuery(question: string) {
  const words = question
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 12);
  return [...new Set(words)].join(' | ');
}

@Injectable()
export class LibraryService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Biblioteca');

  constructor(
    private readonly database: DatabaseService,
    private readonly cloudinary: Cloudinary,
    private readonly ai: AiService,
  ) {}

  onApplicationBootstrap() {
    void this.seedGuide().catch((error) => this.logger.warn(`Guía de ejemplo no sembrada: ${error instanceof Error ? error.message : error}`));
  }

  /** First boot with an empty library: generate, upload and index the sixth-grade guide. */
  private async seedGuide() {
    if (!this.cloudinary.enabled) return;
    const any = await this.database.db.selectFrom('library_items').select('id').limit(1).executeTakeFirst();
    if (any) return;
    const subject = await this.database.db.selectFrom('subjects').select('id').where('code', 'ilike', 'MAT%').orderBy('code').executeTakeFirst()
      ?? (await this.database.db.selectFrom('subjects').select('id').orderBy('name').executeTakeFirst());
    const author = await this.database.db.selectFrom('users').select('id').where('email', '=', 'docente@eduquest.local').executeTakeFirst();
    if (!subject) return;
    const upload = await this.cloudinary.uploadBuffer(await buildGuidePdf(), 'guia-matematicas-sexto.pdf', 'application/pdf');
    const created = await this.database.db
      .insertInto('library_items')
      .values({
        title: GUIDE_TITLE,
        description: 'Resumen con ejemplos de fracciones, MCD y MCM, decimales, perímetro y área. Sirve de fuente para el tutor Luka.',
        subject_id: subject.id,
        kind: 'pdf',
        url: upload.secure_url,
        cloudinary_public_id: upload.public_id,
        resource_type: upload.resource_type,
        format: upload.format ?? 'pdf',
        bytes: upload.bytes,
        pages: upload.pages ?? null,
        checksum: upload.etag ?? null,
        visibility: 'public',
        status: 'processing',
        uploaded_by: author?.id ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await this.database.db
      .insertInto('library_tags')
      .values(['fracciones', 'decimales', 'geometria', 'sexto'].map((tag) => ({ item_id: created.id, tag })))
      .execute();
    await this.ingest(created.id, author?.id ?? null);
  }

  /** WHERE fragment over `library_items li`: published (or own/board), and the viewer can see its visibility scope. */
  private visible(viewer: Viewer) {
    if (isBoard(viewer)) return sql<boolean>`(li.status <> 'archived' OR li.uploaded_by = ${viewer.id})`;
    return sql<boolean>`(
      (li.status = 'published' OR li.uploaded_by = ${viewer.id})
      AND (li.visibility IN ('public', 'institution') OR li.uploaded_by = ${viewer.id}
           OR (li.visibility = 'course' AND li.course_id IN (${viewerCourses(viewer)})))
    )`;
  }

  async catalog() {
    const subjects = await this.database.db.selectFrom('subjects').select(['id', 'name', 'code']).orderBy('name').execute();
    const grades = await this.database.db.selectFrom('grades').select(['id', 'name', 'level']).orderBy('level').execute();
    const tags = await sql<{ tag: string; n: number }>`SELECT tag, count(*)::INT AS n FROM library_tags GROUP BY tag ORDER BY n DESC, tag LIMIT 30`.execute(this.database.db);
    return { subjects, grades, tags: tags.rows, uploads: this.cloudinary.enabled };
  }

  async list(viewer: Viewer, filters: { q?: string; subjectId?: string; kind?: string; tag?: string; saved?: boolean }) {
    const q = filters.q?.trim();
    const ts = q ? orQuery(q) : '';
    const rows = await sql<{
      id: string; title: string; description: string; kind: string; url: string; format: string | null; bytes: number; pages: number | null;
      visibility: string; status: string; subject: string; subject_id: string; grade: string | null; course: string | null; uploaded_by: string | null;
      uploader: string | null; created_at: Date; views: number; saved: boolean; tags: string[] | null; resource_type: string | null; public_id: string | null;
    }>`
      SELECT li.id, li.title, li.description, li.kind, li.url, li.format, li.bytes, li.pages, li.visibility, li.status,
             s.name AS subject, li.subject_id, g.name AS grade, c.title AS course, li.uploaded_by, u.full_name AS uploader, li.created_at,
             li.resource_type, li.cloudinary_public_id AS public_id,
             (SELECT count(*)::INT FROM library_views v WHERE v.item_id = li.id) AS views,
             EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_id = li.id AND b.user_id = ${viewer.id}) AS saved,
             (SELECT array_agg(t.tag ORDER BY t.tag) FROM library_tags t WHERE t.item_id = li.id) AS tags
      FROM library_items li
      JOIN subjects s ON s.id = li.subject_id
      LEFT JOIN grades g ON g.id = li.grade_id
      LEFT JOIN courses c ON c.id = li.course_id
      LEFT JOIN users u ON u.id = li.uploaded_by
      WHERE ${this.visible(viewer)}
        ${filters.subjectId ? sql`AND li.subject_id = ${filters.subjectId}` : sql``}
        ${filters.kind ? sql`AND li.kind = ${filters.kind}` : sql``}
        ${filters.tag ? sql`AND EXISTS (SELECT 1 FROM library_tags t WHERE t.item_id = li.id AND t.tag = ${filters.tag.toLowerCase()})` : sql``}
        ${filters.saved ? sql`AND EXISTS (SELECT 1 FROM bookmarks b WHERE b.item_id = li.id AND b.user_id = ${viewer.id})` : sql``}
        ${q
          ? sql`AND (li.title ILIKE ${`%${q}%`} OR li.description ILIKE ${`%${q}%`}
                 OR EXISTS (SELECT 1 FROM library_tags t WHERE t.item_id = li.id AND t.tag ILIKE ${`%${q.toLowerCase()}%`})
                 ${ts ? sql`OR EXISTS (SELECT 1 FROM library_chunks k WHERE k.item_id = li.id AND k.tsv @@ to_tsquery('spanish', ${ts}))` : sql``})`
          : sql``}
      ORDER BY li.created_at DESC
      LIMIT 120
    `.execute(this.database.db);
    return rows.rows.map((row) => ({
      ...row,
      tags: row.tags ?? [],
      thumbnail: this.thumbnail(row.url, row.kind, row.resource_type),
      canManage: row.uploaded_by === viewer.id || isBoard(viewer),
    }));
  }

  /** Cloudinary renders the first page of an image-type PDF or a frame of a video as a JPEG cover. */
  private thumbnail(url: string, kind: string, resourceType: string | null) {
    if (!url.includes('res.cloudinary.com') || !resourceType || resourceType === 'raw') return null;
    const transform = kind === 'pdf' ? 'pg_1,w_480,h_320,c_fill,g_north,f_jpg' : 'w_480,h_320,c_fill,f_jpg';
    if (kind !== 'pdf' && kind !== 'image' && kind !== 'video') return null;
    return url.replace('/upload/', `/upload/${transform}/`).replace(/\.(pdf|mp4|mov|webm|png|jpe?g|gif|webp)$/i, '.jpg');
  }

  private async itemFor(viewer: Viewer, id: string) {
    const row = await sql<{ id: string }>`SELECT li.id FROM library_items li WHERE li.id = ${id} AND ${this.visible(viewer)}`.execute(this.database.db);
    if (!row.rows.length) throw new ApiError(404, 'NOT_FOUND', 'El recurso no existe o no tienes acceso');
    return this.database.db.selectFrom('library_items').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  }

  async get(viewer: Viewer, id: string) {
    const item = await this.itemFor(viewer, id);
    await this.database.db.insertInto('library_views').values({ item_id: id, user_id: viewer.id }).execute();
    const [subject, tags, bookmark, chunks, glossary, views] = await Promise.all([
      this.database.db.selectFrom('subjects').select(['id', 'name']).where('id', '=', item.subject_id).executeTakeFirst(),
      this.database.db.selectFrom('library_tags').select('tag').where('item_id', '=', id).orderBy('tag').execute(),
      this.database.db.selectFrom('bookmarks').select(['page', 'note']).where('item_id', '=', id).where('user_id', '=', viewer.id).executeTakeFirst(),
      this.database.db.selectFrom('library_chunks').select(sql<number>`count(*)`.as('n')).where('item_id', '=', id).executeTakeFirstOrThrow(),
      this.database.db.selectFrom('glossary_terms').select(['id', 'term', 'definition', 'example']).where('source_item_id', '=', id).orderBy('term').execute(),
      this.database.db.selectFrom('library_views').select(sql<number>`count(*)`.as('n')).where('item_id', '=', id).executeTakeFirstOrThrow(),
    ]);
    return {
      ...item,
      subject: subject?.name ?? '',
      tags: tags.map((t) => t.tag),
      bookmark: bookmark ?? null,
      chunks: Number(chunks.n),
      views: Number(views.n),
      glossary,
      thumbnail: this.thumbnail(item.url, item.kind, item.resource_type),
      canManage: item.uploaded_by === viewer.id || isBoard(viewer),
    };
  }

  uploadTicket() {
    if (!this.cloudinary.enabled) throw new ApiError(503, 'STORAGE_OFF', 'Cloudinary no está configurado en el servidor');
    return this.cloudinary.uploadTicket('auto');
  }

  private kindOf(input: ItemInput): string {
    if (input.link) return 'link';
    const format = (input.upload?.format ?? '').toLowerCase();
    if (format === 'pdf') return 'pdf';
    if (input.upload?.resourceType === 'video') return 'video';
    if (input.upload?.resourceType === 'image') return 'image';
    return 'doc';
  }

  private async assertCourse(viewer: Viewer, courseId: string | undefined | null) {
    if (!courseId || isBoard(viewer)) return;
    const own = await this.database.db.selectFrom('courses').select('id').where('id', '=', courseId).where('teacher_id', '=', viewer.id).executeTakeFirst();
    if (!own) throw new ApiError(403, 'FORBIDDEN', 'Solo puedes publicar en tus cursos');
  }

  async create(viewer: Viewer, input: ItemInput) {
    if (!isStaff(viewer)) throw new ApiError(403, 'FORBIDDEN', 'Solo docentes y coordinación publican en la biblioteca');
    await this.assertCourse(viewer, input.visibility === 'course' ? input.courseId : null);
    if (input.upload && !this.cloudinary.verifyUpload(input.upload.publicId, input.upload.version, input.upload.signature)) {
      throw new ApiError(400, 'BAD_UPLOAD', 'La firma de Cloudinary no coincide. Vuelve a subir el archivo.');
    }
    const kind = this.kindOf(input);
    const item = await this.database.withTx(async (trx) => {
      const row = await trx
        .insertInto('library_items')
        .values({
          title: input.title,
          description: input.description,
          subject_id: input.subjectId,
          grade_id: input.gradeId ?? null,
          kind,
          url: input.upload?.secureUrl ?? input.link!,
          cloudinary_public_id: input.upload?.publicId ?? null,
          resource_type: input.upload?.resourceType ?? null,
          format: input.upload?.format ?? (input.link && /youtu\.?be|vimeo\.com/i.test(input.link) ? 'youtube' : null),
          bytes: input.upload?.bytes ?? 0,
          pages: input.upload?.pages ?? null,
          checksum: input.upload?.etag ?? null,
          visibility: input.visibility,
          course_id: input.visibility === 'course' ? input.courseId! : null,
          status: kind === 'pdf' ? 'processing' : 'published',
          uploaded_by: viewer.id,
        })
        .returning(['id', 'title'])
        .executeTakeFirstOrThrow();
      const tags = [...new Set(input.tags)];
      if (tags.length) await trx.insertInto('library_tags').values(tags.map((tag) => ({ item_id: row.id, tag }))).execute();
      await trx
        .insertInto('audit_log')
        .values({ actor_id: viewer.id, action: 'library.create', entity: 'library_items', entity_id: row.id, meta: JSON.stringify({ kind, bytes: input.upload?.bytes ?? 0 }) })
        .execute();
      return row;
    });
    if (kind === 'pdf') void this.ingest(item.id, viewer.id);
    return { id: item.id, status: kind === 'pdf' ? 'processing' : 'published' };
  }

  /** Downloads the PDF, extracts text per page, stores chunks with embeddings and proposes glossary terms. */
  async ingest(itemId: string, userId: string | null) {
    const item = await this.database.db.selectFrom('library_items').selectAll().where('id', '=', itemId).executeTakeFirst();
    if (!item) return;
    try {
      const response = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`descarga ${response.status}`);
      const data = new Uint8Array(await response.arrayBuffer());
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data });
      const result = await parser.getText();
      await parser.destroy();
      const pages = result.pages.map((p) => ({ num: p.num, text: p.text }));
      const chunks = chunkPages(pages);
      const embeddings = chunks.length ? await this.ai.embed(chunks.map((c) => c.content), { feature: 'biblioteca.indexar', userId }) : null;
      await this.database.db.deleteFrom('library_chunks').where('item_id', '=', itemId).execute();
      for (let i = 0; i < chunks.length; i += 50) {
        const slice = chunks.slice(i, i + 50);
        await sql`INSERT INTO library_chunks (item_id, ordinal, page, content, embedding) VALUES ${sql.join(
          slice.map((chunk, j) => {
            const vector = embeddings?.[i + j];
            return sql`(${itemId}, ${i + j}, ${chunk.page}, ${chunk.content}, ${vector ? sql`${vectorLiteral(vector)}::VECTOR` : sql`NULL`})`;
          }),
        )}`.execute(this.database.db);
      }
      const textChars = pages.reduce((sum, p) => sum + p.text.length, 0);
      await this.database.db
        .updateTable('library_items')
        .set({ status: 'published', pages: result.total ?? pages.length, text_chars: textChars, updated_at: new Date() })
        .where('id', '=', itemId)
        .execute();
      if (chunks.length) await this.suggestGlossary(item.subject_id, itemId, chunks.slice(0, 6).map((c) => c.content).join('\n'), userId);
      this.logger.log(`«${item.title}»: ${chunks.length} fragmentos, ${embeddings ? 'con' : 'sin'} embeddings`);
    } catch (error) {
      this.logger.warn(`No se pudo indexar ${itemId}: ${error instanceof Error ? error.message : error}`);
      await this.database.db.updateTable('library_items').set({ status: 'failed', updated_at: new Date() }).where('id', '=', itemId).execute();
    }
  }

  private async suggestGlossary(subjectId: string, itemId: string, text: string, userId: string | null) {
    const parsed = await this.ai.chatJson<{ terms?: { term: string; definition: string; example?: string }[] }>(
      [
        { role: 'system', content: 'Extrae de 3 a 6 conceptos clave del texto escolar. Responde solo JSON {"terms":[{"term":"","definition":"","example":""}]}. Definiciones de máximo 40 palabras, para estudiantes de sexto, en español.' },
        { role: 'user', content: text.slice(0, 5000) },
      ],
      { feature: 'biblioteca.glosario', userId },
    );
    for (const term of parsed?.terms?.slice(0, 6) ?? []) {
      if (!term.term || !term.definition || term.term.length > 80 || term.definition.length < 5) continue;
      await sql`INSERT INTO glossary_terms (subject_id, term, definition, example, source_item_id, created_by)
        VALUES (${subjectId}, ${term.term.trim()}, ${term.definition.trim().slice(0, 1200)}, ${(term.example ?? '').trim().slice(0, 600)}, ${itemId}, ${userId})
        ON CONFLICT DO NOTHING`.execute(this.database.db);
    }
  }

  async reindex(viewer: Viewer, id: string) {
    const item = await this.manageable(viewer, id);
    if (item.kind !== 'pdf') throw new ApiError(400, 'NOT_PDF', 'Solo los PDF se indexan');
    await this.database.db.updateTable('library_items').set({ status: 'processing' }).where('id', '=', id).execute();
    void this.ingest(id, viewer.id);
    return { status: 'processing' };
  }

  private async manageable(viewer: Viewer, id: string) {
    const item = await this.database.db.selectFrom('library_items').selectAll().where('id', '=', id).executeTakeFirst();
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'El recurso no existe');
    if (item.uploaded_by !== viewer.id && !isBoard(viewer)) throw new ApiError(403, 'FORBIDDEN', 'Solo quien lo publicó o coordinación pueden editarlo');
    return item;
  }

  async update(viewer: Viewer, id: string, patch: { title?: string; description?: string; visibility?: string; courseId?: string | null; tags?: string[]; status?: string }) {
    const item = await this.manageable(viewer, id);
    const visibility = patch.visibility ?? item.visibility;
    const courseId = visibility === 'course' ? (patch.courseId ?? item.course_id) : null;
    if (visibility === 'course' && !courseId) throw new ApiError(400, 'COURSE_REQUIRED', 'Elige el curso');
    await this.assertCourse(viewer, courseId);
    await this.database.withTx(async (trx) => {
      await trx
        .updateTable('library_items')
        .set({
          ...(patch.title ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status ? { status: patch.status } : {}),
          visibility,
          course_id: courseId,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();
      if (patch.tags) {
        await trx.deleteFrom('library_tags').where('item_id', '=', id).execute();
        const tags = [...new Set(patch.tags)];
        if (tags.length) await trx.insertInto('library_tags').values(tags.map((tag) => ({ item_id: id, tag }))).execute();
      }
    });
    return { ok: true };
  }

  async remove(viewer: Viewer, id: string) {
    const item = await this.manageable(viewer, id);
    await this.database.db.deleteFrom('library_items').where('id', '=', id).execute();
    if (item.cloudinary_public_id) await this.cloudinary.destroy(item.cloudinary_public_id, item.resource_type ?? 'image');
    await this.database.db.insertInto('audit_log').values({ actor_id: viewer.id, action: 'library.delete', entity: 'library_items', entity_id: id, meta: null }).execute();
    return { ok: true };
  }

  async bookmark(viewer: Viewer, id: string, input: { page?: number; note: string }) {
    await this.itemFor(viewer, id);
    await this.database.db
      .insertInto('bookmarks')
      .values({ user_id: viewer.id, item_id: id, page: input.page ?? null, note: input.note })
      .onConflict((oc) => oc.columns(['user_id', 'item_id']).doUpdateSet({ page: input.page ?? null, note: input.note }))
      .execute();
    return { ok: true };
  }

  async unbookmark(viewer: Viewer, id: string) {
    await this.database.db.deleteFrom('bookmarks').where('user_id', '=', viewer.id).where('item_id', '=', id).execute();
    return { ok: true };
  }

  async glossary(filters: { subjectId?: string; q?: string }) {
    return this.database.db
      .selectFrom('glossary_terms')
      .innerJoin('subjects', 'subjects.id', 'glossary_terms.subject_id')
      .leftJoin('library_items', 'library_items.id', 'glossary_terms.source_item_id')
      .select(['glossary_terms.id', 'glossary_terms.term', 'glossary_terms.definition', 'glossary_terms.example', 'glossary_terms.subject_id', 'subjects.name as subject', 'library_items.title as source', 'glossary_terms.source_item_id'])
      .$if(Boolean(filters.subjectId), (q) => q.where('glossary_terms.subject_id', '=', filters.subjectId!))
      .$if(Boolean(filters.q), (q) => q.where((eb) => eb.or([eb('glossary_terms.term', 'ilike', `%${filters.q}%`), eb('glossary_terms.definition', 'ilike', `%${filters.q}%`)])))
      .orderBy('glossary_terms.term')
      .limit(300)
      .execute();
  }

  async addTerm(viewer: Viewer, input: { subjectId: string; term: string; definition: string; example: string }) {
    if (!isStaff(viewer)) throw new ApiError(403, 'FORBIDDEN', 'Solo docentes editan el glosario');
    const exists = await sql<{ id: string }>`SELECT id FROM glossary_terms WHERE subject_id = ${input.subjectId} AND lower(term) = lower(${input.term})`.execute(this.database.db);
    if (exists.rows.length) throw new ApiError(409, 'TERM_EXISTS', 'Ese término ya está en el glosario de la materia');
    return this.database.db
      .insertInto('glossary_terms')
      .values({ subject_id: input.subjectId, term: input.term, definition: input.definition, example: input.example, created_by: viewer.id })
      .returning(['id'])
      .executeTakeFirstOrThrow();
  }

  async removeTerm(viewer: Viewer, id: string) {
    if (!isStaff(viewer)) throw new ApiError(403, 'FORBIDDEN', 'Solo docentes editan el glosario');
    await this.database.db.deleteFrom('glossary_terms').where('id', '=', id).execute();
    return { ok: true };
  }

  /**
   * Hybrid retrieval over the chunks the viewer may read: cosine distance on embeddings plus Spanish full-text rank,
   * merged with reciprocal rank fusion.
   */
  async search(viewer: Viewer, question: string, options: { itemId?: string; subjectId?: string; limit?: number } = {}): Promise<Citation[]> {
    const limit = options.limit ?? 5;
    const scope = sql`${this.visible(viewer)} AND li.status = 'published'
      ${options.itemId ? sql`AND li.id = ${options.itemId}` : sql``}
      ${options.subjectId ? sql`AND li.subject_id = ${options.subjectId}` : sql``}`;
    const ranked = new Map<string, { hit: Hit; score: number }>();
    const add = (hits: Hit[]) => hits.forEach((hit, rank) => {
      const current = ranked.get(hit.chunk_id) ?? { hit, score: 0 };
      current.score += 1 / (60 + rank);
      ranked.set(hit.chunk_id, current);
    });

    const vector = (await this.ai.embed([question], { feature: 'biblioteca.buscar', userId: viewer.id }))?.[0];
    if (vector) {
      const semantic = await sql<Hit>`
        SELECT k.id AS chunk_id, li.id AS item_id, li.title, li.url, k.page, k.content
        FROM library_chunks k JOIN library_items li ON li.id = k.item_id
        WHERE k.embedding IS NOT NULL AND ${scope}
        ORDER BY k.embedding <=> ${vectorLiteral(vector)}::VECTOR
        LIMIT 12`.execute(this.database.db);
      add(semantic.rows);
    }
    const ts = orQuery(question);
    if (ts) {
      const lexical = await sql<Hit>`
        SELECT k.id AS chunk_id, li.id AS item_id, li.title, li.url, k.page, k.content
        FROM library_chunks k JOIN library_items li ON li.id = k.item_id
        WHERE k.tsv @@ to_tsquery('spanish', ${ts}) AND ${scope}
        ORDER BY ts_rank(k.tsv, to_tsquery('spanish', ${ts})) DESC
        LIMIT 12`.execute(this.database.db);
      add(lexical.rows);
    }
    return [...ranked.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ hit }, index) => ({
        n: index + 1,
        itemId: hit.item_id,
        title: hit.title,
        page: hit.page,
        excerpt: hit.content.slice(0, 600),
        url: hit.page && hit.url.endsWith('.pdf') ? `${hit.url}#page=${hit.page}` : hit.url,
      }));
  }

  async ask(viewer: Viewer, input: { question: string; itemId?: string; subjectId?: string }) {
    const citations = await this.search(viewer, input.question, { itemId: input.itemId, subjectId: input.subjectId, limit: 5 });
    if (!citations.length) {
      return { answer: 'No encontré ese tema en los documentos de la biblioteca. Prueba con otras palabras o pregúntale a Luka en el tutor.', citations, source: 'none' };
    }
    const sources = citations.map((c) => `[${c.n}] «${c.title}»${c.page ? `, pág. ${c.page}` : ''}:\n${c.excerpt}`).join('\n\n');
    const answer = await this.ai.chatText(
      [
        { role: 'system', content: 'Eres Luka, bibliotecario de Ludoteka Campus. Responde en español, claro y breve, usando SOLO las fuentes dadas. Cita cada afirmación con [n]. Si las fuentes no alcanzan, dilo. No uses LaTeX ni signos $: escribe las operaciones con ×, ÷ y /.' },
        { role: 'system', content: `Fuentes:\n${sources}` },
        { role: 'user', content: input.question },
      ],
      { feature: 'biblioteca.preguntar', userId: viewer.id, temperature: 0.2 },
    );
    const used = answer ? citations.filter((c) => answer.includes(`[${c.n}]`)) : [];
    return {
      answer: answer ?? `Estos fragmentos hablan de tu pregunta:\n\n${citations.map((c) => `[${c.n}] ${c.excerpt.slice(0, 220)}…`).join('\n\n')}`,
      citations: used.length ? used : citations,
      source: answer ? 'llm' : 'fragmentos',
    };
  }
}
