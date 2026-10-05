import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Kysely, PostgresDialect, Transaction, sql } from 'kysely';
import { Pool, types } from 'pg';
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
    this.pool = new Pool({ connectionString: env.values.DATABASE_URL, max: 10 });
    this.db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: this.pool }) });
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }

  async ping() {
    await sql`select 1 as ok`.execute(this.db);
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
