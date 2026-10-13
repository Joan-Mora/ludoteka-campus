/**
 * Fills the library from db/seeds/library/manifest.json: subjects, one group per grade, demo courses,
 * the school's own study guides (PDF to Cloudinary, then indexed for the tutor) and open documents with source and license.
 * Idempotent: items are matched by title, so running it again only adds what is missing or retries failed indexing.
 *
 *   npm run library:seed -w @eduquest/api            all
 *   npm run library:seed -w @eduquest/api -- --dry   report only
 */
import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import * as argon2 from 'argon2';
import { sql } from 'kysely';
import { Env } from '../src/core/config/config.module';
import { repoRoot } from '../src/core/config/env';
import { AiService } from '../src/core/ai/ai.service';
import { DatabaseService } from '../src/core/database/database.service';
import { Cloudinary } from '../src/modules/library/cloudinary';
import { renderGuidePdf, type GuideContent } from '../src/modules/library/guide-pdf';
import { LibraryService } from '../src/modules/library/library.service';

interface Manifest {
  author: string;
  subjects: { code: string; name: string; area: string }[];
  demoTeachers: { subject: string; email: string; name: string }[];
  guides: { slug: string; grade: number; subject: string; dba: number[]; title: string; focus: string[]; tags: string[] }[];
  documents: { slug: string; title: string; description: string; subject: string; grade?: number; kind: 'pdf' | 'link'; url: string; sourceName: string; license: string; tags: string[] }[];
}

type GuideFile = GuideContent & { dbaStatements?: string[] };

const GRADE_NAME: Record<number, string> = { 6: 'sexto', 7: 'séptimo', 8: 'octavo', 9: 'noveno', 10: 'décimo', 11: 'undécimo' };
const OWN_LICENSE = 'Material propio del colegio · uso educativo';
const dry = process.argv.includes('--dry');

const tagOf = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim().slice(0, 40);

async function main() {
  const root = repoRoot();
  const dir = path.join(root, 'db', 'seeds', 'library');
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as Manifest;
  const env = new Env();
  const database = new DatabaseService(env);
  const cloudinary = new Cloudinary(env);
  const ai = new AiService(env, database);
  const library = new LibraryService(database, cloudinary, ai);
  const db = database.db;
  const log = (message: string) => console.log(message);

  try {
    if (!cloudinary.enabled) throw new Error('CLOUDINARY_URL no está configurada: las guías necesitan dónde guardarse');

    for (const subject of manifest.subjects) {
      if (!dry) await db.insertInto('subjects').values(subject).onConflict((oc) => oc.column('code').doNothing()).execute();
    }
    const subjects = new Map((await db.selectFrom('subjects').select(['id', 'code', 'name']).execute()).map((s) => [s.code, s]));
    const year = await db.selectFrom('academic_years').select('id').where('is_current', '=', true).executeTakeFirstOrThrow();
    const grades = new Map((await db.selectFrom('grades').select(['id', 'level']).execute()).map((g) => [Number(g.level), g.id]));

    const groups = new Map<number, string>();
    for (const [level, gradeId] of grades) {
      const name = `${level}A`;
      let group = await db.selectFrom('groups_class').select('id').where('grade_id', '=', gradeId).where('academic_year_id', '=', year.id).where('name', '=', name).executeTakeFirst();
      if (!group && !dry) group = await db.insertInto('groups_class').values({ grade_id: gradeId, academic_year_id: year.id, name }).returning('id').executeTakeFirstOrThrow();
      if (group) groups.set(level, group.id);
    }

    const teachers = new Map<string, string>();
    for (const teacher of manifest.demoTeachers) {
      let user = await db.selectFrom('users').select('id').where('email', '=', teacher.email).executeTakeFirst();
      if (!user && !dry) {
        const hash = await argon2.hash(randomBytes(24).toString('base64url'), { type: argon2.argon2id });
        user = await db.insertInto('users').values({ email: teacher.email, password_hash: hash, full_name: teacher.name, status: 'disabled' }).returning('id').executeTakeFirstOrThrow();
        await db.insertInto('user_roles').values({ user_id: user.id, role: 'teacher' }).execute();
        log(`docente demo ${teacher.email}`);
      }
      if (user) teachers.set(teacher.subject, user.id);
    }
    const coordinator = await db.selectFrom('users').select('id').where('email', '=', 'coordinacion@eduquest.local').executeTakeFirst();

    /** One course per grade and subject; a real course for that group is reused instead of adding a demo one. */
    const courses = new Map<string, { id: string; teacherId: string; demo: boolean }>();
    for (const [level, groupId] of groups) {
      for (const subject of manifest.subjects) {
        const subjectId = subjects.get(subject.code)?.id;
        if (!subjectId) continue;
        let course = await db.selectFrom('courses').select(['id', 'teacher_id', 'is_demo']).where('subject_id', '=', subjectId).where('group_id', '=', groupId).where('academic_year_id', '=', year.id).executeTakeFirst();
        const teacherId = teachers.get(subject.code);
        if (!course && teacherId && !dry) {
          course = await db
            .insertInto('courses')
            .values({
              subject_id: subjectId,
              group_id: groupId,
              teacher_id: teacherId,
              academic_year_id: year.id,
              title: `${subject.name} ${level}° · curso demo`,
              description: `Curso de demostración de ${subject.name.toLowerCase()} para grado ${GRADE_NAME[level]}: reúne las guías de la biblioteca alineadas con los DBA.`,
              published: true,
              is_demo: true,
            })
            .returning(['id', 'teacher_id', 'is_demo'])
            .executeTakeFirstOrThrow();
          await db.insertInto('teaching_assignments').values({ teacher_id: teacherId, subject_id: subjectId, group_id: groupId, academic_year_id: year.id })
            .onConflict((oc) => oc.columns(['teacher_id', 'subject_id', 'group_id', 'academic_year_id']).doNothing()).execute();
          log(`curso ${subject.code} ${level}°`);
        }
        if (course) courses.set(`${subject.code}-${level}`, { id: course.id, teacherId: course.teacher_id, demo: course.is_demo });
      }
    }

    let added = 0;
    let retried = 0;
    let missing = 0;
    for (const guide of manifest.guides) {
      const file = path.join(dir, 'guides', `${guide.slug}.json`);
      if (!existsSync(file)) {
        missing++;
        log(`sin redactar: ${guide.slug}`);
        continue;
      }
      const content = JSON.parse(readFileSync(file, 'utf8')) as GuideFile;
      const subject = subjects.get(guide.subject)!;
      const course = courses.get(`${guide.subject}-${guide.grade}`);
      const title = `${guide.title} · ${guide.grade}.°`;
      const existing = await db.selectFrom('library_items').select(['id', 'status']).where('title', '=', title).executeTakeFirst();
      if (existing?.status === 'published') continue;
      if (dry) {
        log(`${existing ? 'reindexar' : 'crear'}: ${title}`);
        continue;
      }
      let itemId = existing?.id;
      if (!itemId) {
        const pdf = await renderGuidePdf(
          { title: guide.title, subject: subject.name, grade: GRADE_NAME[guide.grade]!, dba: content.dbaStatements ?? [], author: manifest.author },
          content,
        );
        const upload = await cloudinary.uploadBuffer(pdf, `${guide.slug}.pdf`, 'application/pdf');
        const row = await db
          .insertInto('library_items')
          .values({
            title,
            description: content.intro.length > 280 ? `${content.intro.slice(0, content.intro.lastIndexOf(' ', 277))}…` : content.intro,
            subject_id: subject.id,
            grade_id: grades.get(guide.grade) ?? null,
            kind: 'pdf',
            url: upload.secure_url,
            cloudinary_public_id: upload.public_id,
            resource_type: upload.resource_type,
            format: upload.format ?? 'pdf',
            bytes: upload.bytes,
            pages: upload.pages ?? null,
            checksum: upload.etag ?? null,
            visibility: course ? 'course' : 'institution',
            course_id: course?.id ?? null,
            status: 'processing',
            uploaded_by: course?.teacherId ?? coordinator?.id ?? null,
            source_name: manifest.author,
            license: OWN_LICENSE,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        itemId = row.id;
        const tags = [...new Set([...guide.tags, GRADE_NAME[guide.grade]!, 'guia'].map(tagOf).filter((t) => t.length >= 2))];
        await db.insertInto('library_tags').values(tags.map((tag) => ({ item_id: row.id, tag }))).execute();
        added++;
      } else retried++;
      await library.ingest(itemId, course?.teacherId ?? null, { glossary: false });
      await pause(PACE_MS);
      for (const entry of content.glossary) {
        if (!entry.term || entry.term.length > 80 || !entry.definition || entry.definition.length < 5) continue;
        await sql`INSERT INTO glossary_terms (subject_id, term, definition, example, source_item_id, created_by)
          VALUES (${subject.id}, ${entry.term.trim()}, ${entry.definition.trim().slice(0, 1200)}, '', ${itemId}, ${course?.teacherId ?? null})
          ON CONFLICT DO NOTHING`.execute(db);
      }
      if (course?.demo) await addLesson(db, course.id, guide.title, content, title);
      const status = await db.selectFrom('library_items').select('status').where('id', '=', itemId).executeTakeFirstOrThrow();
      log(`${status.status === 'published' ? '✓' : '✗'} ${title}`);
    }

    for (const doc of manifest.documents) {
      const subject = subjects.get(doc.subject)!;
      const existing = await db.selectFrom('library_items').select(['id', 'status']).where('title', '=', doc.title).executeTakeFirst();
      if (existing?.status === 'published') continue;
      if (dry) {
        log(`${existing ? 'reindexar' : 'crear'}: ${doc.title}`);
        continue;
      }
      let itemId = existing?.id;
      if (!itemId) {
        const row = await db
          .insertInto('library_items')
          .values({
            title: doc.title,
            description: doc.description,
            subject_id: subject.id,
            grade_id: doc.grade ? (grades.get(doc.grade) ?? null) : null,
            kind: doc.kind,
            url: doc.url,
            format: doc.kind === 'pdf' ? 'pdf' : null,
            visibility: 'public',
            status: doc.kind === 'pdf' ? 'processing' : 'published',
            uploaded_by: coordinator?.id ?? null,
            source_name: doc.sourceName,
            source_url: doc.url,
            license: doc.license,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        itemId = row.id;
        await db.insertInto('library_tags').values([...new Set(doc.tags.map(tagOf))].map((tag) => ({ item_id: row.id, tag }))).execute();
        added++;
      } else retried++;
      if (doc.kind === 'pdf') {
        await library.ingest(itemId, null, { glossary: false });
        await pause(PACE_MS);
      } else await library.makeCover(itemId);
      const status = await db.selectFrom('library_items').select('status').where('id', '=', itemId).executeTakeFirstOrThrow();
      log(`${status.status === 'published' ? '✓' : '✗'} ${doc.title}`);
    }
    const titles = [...manifest.guides.map((g) => `${g.title} · ${g.grade}.°`), ...manifest.documents.map((d) => d.title)];
    const embedded = dry ? 0 : await backfillEmbeddings(database, ai, titles, log);
    log(`Biblioteca: ${added} nuevos, ${retried} reindexados, ${embedded} fragmentos con embedding recuperado, ${missing} guías sin redactar${dry ? ' (simulación)' : ''}`);
  } finally {
    await database.onModuleDestroy?.();
  }
}

/**
 * The embeddings endpoint has a per-minute quota: ingest keeps the chunks (full-text search works) but leaves
 * `embedding` empty when it answers 429. This pass fills those gaps, waiting a minute whenever the quota runs out.
 */
async function backfillEmbeddings(database: DatabaseService, ai: AiService, titles: string[], log: (message: string) => void) {
  const rows = await database.db
    .selectFrom('library_chunks')
    .innerJoin('library_items', 'library_items.id', 'library_chunks.item_id')
    .select(['library_chunks.id', 'library_chunks.content', 'library_items.title'])
    .where('library_chunks.embedding', 'is', null)
    .where('library_items.title', 'in', titles)
    .orderBy('library_items.title')
    .orderBy('library_chunks.ordinal')
    .execute();
  if (rows.length) log(`${rows.length} fragmentos sin embedding`);
  let done = 0;
  for (let i = 0; i < rows.length; i += 64) {
    const batch = rows.slice(i, i + 64);
    let vectors: number[][] | null = null;
    for (let attempt = 0; attempt < 6 && !vectors; attempt++) {
      vectors = await ai.embed(batch.map((row) => row.content), { feature: 'biblioteca.indexar' });
      if (!vectors) await pause(60_000);
    }
    if (!vectors) {
      log('La cuota de embeddings no se recuperó; vuelve a correr la siembra más tarde.');
      break;
    }
    for (const [j, row] of batch.entries()) {
      const literal = `[${vectors[j]!.map((v) => (Number.isFinite(v) ? v.toFixed(6) : '0')).join(',')}]`;
      await sql`UPDATE library_chunks SET embedding = ${literal}::VECTOR WHERE id = ${row.id}`.execute(database.db);
    }
    done += batch.length;
    await pause(PACE_MS);
  }
  return done;
}

const PACE_MS = 4000;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Demo courses get one reading station per guide, so the course map and «Léeme la lección» have something to open. */
async function addLesson(db: DatabaseService['db'], courseId: string, guideTitle: string, content: GuideContent, itemTitle: string) {
  let unit = await db.selectFrom('units').select('id').where('course_id', '=', courseId).where('position', '=', 1).executeTakeFirst();
  unit ??= await db.insertInto('units').values({ course_id: courseId, title: 'Guías de la biblioteca', summary: 'Lecturas de consulta alineadas con los DBA del grado.', position: 1 }).returning('id').executeTakeFirstOrThrow();
  const exists = await db.selectFrom('lessons').select('id').where('unit_id', '=', unit.id).where('title', '=', guideTitle).executeTakeFirst();
  if (exists) return;
  const last = await db.selectFrom('lessons').select(sql<number>`coalesce(max(position), 0)`.as('n')).where('unit_id', '=', unit.id).executeTakeFirstOrThrow();
  const body = [
    content.intro,
    ...content.sections.map((section) => `${section.title}. ${section.paragraphs[0]}`),
    `La guía completa, con ejemplos resueltos, práctica y respuestas, está en la Biblioteca con el título «${itemTitle}».`,
  ].join('\n\n');
  await db.insertInto('lessons').values({ unit_id: unit.id, title: guideTitle, body_md: body, estimated_min: 15, position: Number(last.n) + 1 }).execute();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
