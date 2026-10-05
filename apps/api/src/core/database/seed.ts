import { readFileSync } from 'fs';
import path from 'path';
import * as argon2 from 'argon2';
import type { Client } from 'pg';
import { loadEnv } from '../config/env';
import { seedsDir, splitSql, withClient } from './sql-runner';

const PEOPLE = [
  { email: 'admin@eduquest.local', name: 'Ada Admin', role: 'admin', minor: false },
  { email: 'rectoria@eduquest.local', name: 'Rectoría CFA', role: 'directivo', minor: false },
  { email: 'coordinacion@eduquest.local', name: 'Coordinación Académica', role: 'directivo', minor: false },
  { email: 'docente@eduquest.local', name: 'Marta López', role: 'teacher', minor: false },
  { email: 'estudiante@eduquest.local', name: 'Juan Esteban Ruiz', role: 'student', minor: false },
  { email: 'estudiante2@eduquest.local', name: 'Lucía Fernández', role: 'student', minor: true },
  { email: 'acudiente@eduquest.local', name: 'Carlos Ruiz', role: 'guardian', minor: false },
];

const GUARDIANS = [
  { guardian: 'acudiente@eduquest.local', student: 'estudiante@eduquest.local', relationship: 'padre' },
  { guardian: 'acudiente@eduquest.local', student: 'estudiante2@eduquest.local', relationship: 'tutor' },
];

/** Creates any missing lab account and guardian link. Safe to run on every boot. */
async function ensurePeople(client: Client, seedPassword: string) {
  let passwordHash: string | null = null;
  for (const person of PEOPLE) {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [person.email]);
    if (existing.rows[0]?.id) continue;
    passwordHash ??= await argon2.hash(seedPassword, { type: argon2.argon2id });
    const inserted = await client.query(
      'INSERT INTO users (email, password_hash, full_name, is_minor) VALUES ($1, $2, $3, $4) RETURNING id',
      [person.email, passwordHash, person.name, person.minor],
    );
    await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [inserted.rows[0].id, person.role]);
  }
  for (const link of GUARDIANS) {
    await client.query(
      `INSERT INTO guardian_links (guardian_id, student_id, relationship)
       SELECT g.id, s.id, $3 FROM users g, users s WHERE g.email = $1 AND s.email = $2
       ON CONFLICT (guardian_id, student_id) DO NOTHING`,
      [link.guardian, link.student, link.relationship],
    );
  }
  const news = await client.query('SELECT count(*)::int AS n FROM news');
  if (Number(news.rows[0].n) === 0) {
    const welcome = await client.query(
      `INSERT INTO news (author_id, title, body, category, pinned)
       SELECT id, $1, $2, 'general', true FROM users WHERE email = 'coordinacion@eduquest.local' RETURNING id`,
      [
        'Bienvenidos a Ludoteka Campus',
        'Este es el nuevo campus digital del Colegio Francisco Arango. Aquí encontrarán las circulares, los avisos de cada curso y los foros por materia. Las circulares importantes piden confirmación de lectura.',
      ],
    );
    if (welcome.rows[0]) await client.query(`INSERT INTO news_audience (news_id, kind, value) VALUES ($1, 'all', '')`, [welcome.rows[0].id]);
  }
}

export async function seed() {
  const env = loadEnv();
  await withClient(env.DATABASE_URL, async (client) => {
    await ensurePeople(client, env.SEED_PASSWORD);
    const sql = readFileSync(path.join(seedsDir(), '001_contenido.sql'), 'utf8');
    await client.query('BEGIN');
    try {
      for (const statement of splitSql(sql)) await client.query(statement);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
  console.log('semilla lista');
}

export async function seedIfEmpty() {
  const env = loadEnv();
  const empty = await withClient(env.DATABASE_URL, async (client) => {
    const result = await client.query('SELECT count(*)::int AS n FROM users');
    return Number(result.rows[0].n) === 0;
  });
  if (empty) await seed();
  else await withClient(env.DATABASE_URL, (client) => ensurePeople(client, env.SEED_PASSWORD));
}
