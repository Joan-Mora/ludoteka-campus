import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { z } from 'zod';

export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'db', 'migrations'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('No se encontró la raíz del repositorio (db/migrations).');
}

function loadDotEnv(file: string) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  APP_PUBLIC_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().default('https://generativelanguage.googleapis.com/v1beta/openai'),
  AI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  AI_MODEL_SMART: z.string().default('gemini-3.5-flash'),
  AI_FALLBACK_MODELS: z.string().default('gemini-3.1-flash-lite,gemini-2.5-flash-lite'),
  AI_EMBED_MODEL: z.string().default('gemini-embedding-2'),
  AI_EMBED_DIM: z.coerce.number().default(768),
  CLOUDINARY_URL: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Ludoteka Campus <onboarding@resend.dev>'),
  FACIAL_MAX_DISTANCE: z.coerce.number().default(0.5),
  FACIAL_POLICY_VERSION: z.string().default('2026-10-05'),
  FACIAL_EMBEDDING_DIM: z.coerce.number().default(128),
  FACIAL_RETENTION_DAYS: z.coerce.number().default(0),
  FACIAL_LOCK_ATTEMPTS: z.coerce.number().default(5),
  FACIAL_LOCK_MINUTES: z.coerce.number().default(15),
  FACIAL_ENC_KEY: z.string().optional().default(''),
  INTEGRITY_SUSPEND_AFTER: z.coerce.number().default(3),
  SEED_PASSWORD: z.string().default('EduQuest2026!'),
  NODE_ENV: z.string().optional().default('development'),
});

export type AppEnv = z.infer<typeof schema> & { JWT_REFRESH_SECRET: string };

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  loadDotEnv(path.join(repoRoot(), 'apps', 'api', '.env'));
  const parsed = schema.parse(process.env);
  cached = {
    ...parsed,
    DATABASE_URL: normalizeDatabaseUrl(parsed.DATABASE_URL),
    JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET || parsed.JWT_SECRET,
  };
  return cached;
}

// Cockroach Cloud uses a publicly trusted CA, so a local-only sslrootcert path is dropped when the file is absent (e.g. on Render).
export function normalizeDatabaseUrl(raw: string): string {
  const match = /([?&])sslrootcert=([^&]*)/.exec(raw);
  if (!match) return raw;
  const file = decodeURIComponent(match[2] ?? '');
  if (file && existsSync(file)) return raw;
  return raw.replace(/([?&])sslrootcert=[^&]*&?/, '$1').replace(/[?&]$/, '');
}
