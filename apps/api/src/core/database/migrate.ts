import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { loadEnv } from '../config/env';
import { migrationsDir, splitSql, withClient } from './sql-runner';

export async function runMigrations() {
  const env = loadEnv();
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  await withClient(env.DATABASE_URL, async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id STRING PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    for (const name of files) {
      const id = name.replace(/\.sql$/, '');
      const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [id]);
      if (existing.rowCount) continue;
      const sql = readFileSync(path.join(dir, name), 'utf8');
      await client.query('BEGIN');
      try {
        for (const statement of splitSql(sql)) await client.query(statement);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
        await client.query('COMMIT');
        console.log(`migración ${id}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  });
}
