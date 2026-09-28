import { Pool } from "pg";
import { config } from "../config";

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false },
    })
  : null;

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) {
  if (!pool) throw new Error("DATABASE_URL no configurada");
  return pool.query<T>(text, params);
}

export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}