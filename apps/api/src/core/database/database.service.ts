import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect, Transaction, sql } from 'kysely';
import { Pool, types, type PoolClient } from 'pg';
import { Env } from '../config/config.module';
import { Database } from './database.types';

types.setTypeParser(1082, (value) => value);
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(21, (value) => Number(value));
types.setTypeParser(23, (value) => Number(value));

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Kysely<Database>;
  private readonly pool: Pool;

  constructor(env: Env) {
    this.pool = new Pool({ connectionString: env.values.DATABASE_URL, max: 20 });
    this.db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: this.pool }) });
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }

  async ping() {
    await sql`select 1 as ok`.execute(this.db);
  }

  /**
   * Runs work inside a READ ONLY transaction that is always rolled back, with a statement
   * timeout and, optionally, a restricted role (SET LOCAL ROLE lasts only for the transaction).
   */
  async readOnly<T>(options: { role?: string; timeoutMs: number }, work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (options.role && !/^[a-z_]+$/.test(options.role)) throw new Error('Rol inválido');
    const client = await this.pool.connect();
    let broken: Error | undefined;
    try {
      await client.query('BEGIN TRANSACTION READ ONLY');
      await client.query(`SET LOCAL statement_timeout = '${Math.max(100, Math.floor(options.timeoutMs))}ms'`);
      if (options.role) await client.query(`SET LOCAL ROLE ${options.role}`);
      return await work(client);
    } finally {
      await client.query('ROLLBACK').catch((error: Error) => {
        broken = error;
      });
      client.release(broken);
    }
  }

  async withTx<T>(work: (trx: Transaction<Database>) => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let last: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.db.transaction().execute(work);
      } catch (error) {
        last = error;
        const code = (error as { code?: string }).code;
        const retryable = code === '40001' || code === 'CR000';
        if (!retryable || attempt === maxAttempts) throw error;
      }
    }
    throw last;
  }
}
