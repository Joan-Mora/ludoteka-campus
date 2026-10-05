import { readFileSync } from 'fs';
import path from 'path';
import * as argon2 from 'argon2';
import { loadEnv } from '../config/env';
import { seedsDir, splitSql, withClient } from './sql-runner';

const PEOPLE = [
  { email: 'admin@eduquest.local', name: 'Ada Admin', role: 'admin' },
  { email: 'rectoria@eduquest.local', name: 'Rectoría CFA', role: 'directivo' },
  { email: 'docente@eduquest.local', name: 'Marta López', role: 'teacher' },
  { email: 'estudiante@eduquest.local', name: 'Juan Esteban Ruiz', role: 'student' },
  { email: 'estudiante2@eduquest.local', name: 'Lucía Fernández', role: 'student' },
];

export async function seed() {
  const env = loadEnv();
  const passwordHash = await argon2.hash(env.SEED_PASSWORD, { type: argon2.argon2id });
  await withClient(env.DATABASE_URL, async (client) => {
    for (const person of PEOPLE) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [person.email]);
      if (existing.rows[0]?.id) continue;
      const inserted = await client.query(
        'INSERT INTO users (email, password_hash, full_name, is_minor) VALUES ($1, $2, $3, false) RETURNING id',
        [person.email, passwordHash, person.name],
      );
      await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [inserted.rows[0].id, person.role]);
    }
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
}
