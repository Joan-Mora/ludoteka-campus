import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { repoRoot } from '../config/env';

export function splitSql(source: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;
  let dollar: string | null = null;
  while (i < source.length) {
    if (dollar) {
      if (source.startsWith(dollar, i)) {
        buf += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
      buf += source[i];
      i++;
      continue;
    }
    if (source[i] === '-' && source[i + 1] === '-') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }
    if (source[i] === '$') {
      const match = /^\$[A-Za-z0-9_]*\$/.exec(source.slice(i));
      if (match) {
        dollar = match[0];
        buf += dollar;
        i += dollar.length;
        continue;
      }
    }
    if (source[i] === "'") {
      buf += source[i];
      i++;
      while (i < source.length) {
        buf += source[i];
        if (source[i] === "'" && source[i + 1] === "'") {
          buf += source[i + 1];
          i += 2;
          continue;
        }
        if (source[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (source[i] === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++;
      continue;
    }
    buf += source[i];
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export async function withClient<T>(databaseUrl: string, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function runSqlDir(client: Client, dir: string) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const name of files) {
    const sql = readFileSync(path.join(dir, name), 'utf8');
    for (const statement of splitSql(sql)) {
      await client.query(statement);
    }
  }
}

export function migrationsDir() {
  return path.join(repoRoot(), 'db', 'migrations');
}

export function seedsDir() {
  return path.join(repoRoot(), 'db', 'seeds');
}
