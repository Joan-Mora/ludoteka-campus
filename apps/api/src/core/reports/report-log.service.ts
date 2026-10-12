import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { Env } from '../config/config.module';
import { DatabaseService } from '../database/database.service';
import { ApiError } from '../errors/api-error';
import type { ReportMeta } from './documents';

export type ReportKind = 'boletin' | 'curso' | 'evaluacion' | 'integridad' | 'uso' | 'usuarios' | 'certificado' | 'calificaciones';

const kindLabel: Record<ReportKind, string> = {
  boletin: 'Boletín de desempeño',
  curso: 'Reporte de curso',
  evaluacion: 'Resultados de evaluación',
  integridad: 'Integridad académica',
  uso: 'Uso de biblioteca e IA',
  usuarios: 'Reporte de usuarios',
  certificado: 'Certificado',
  calificaciones: 'Libro de calificaciones',
};

@Injectable()
export class ReportLog {
  constructor(
    private readonly database: DatabaseService,
    private readonly env: Env,
  ) {}

  /** Reserves the next consecutive number (LK-<year>-<seq>) and records who generated what. */
  async register(input: {
    kind: ReportKind;
    format: 'pdf' | 'xlsx';
    title: string;
    subtitle?: string;
    userId?: string | null;
    params?: Record<string, unknown>;
    rowCount: number;
    source: string;
  }): Promise<ReportMeta> {
    const next = await sql<{ seq: string | number }>`SELECT nextval('report_seq') AS seq`.execute(this.database.db);
    const seq = Number(next.rows[0]!.seq);
    const generatedAt = new Date();
    const code = `LK-${generatedAt.getFullYear()}-${String(seq).padStart(6, '0')}`;
    await this.database.db
      .insertInto('report_log')
      .values({
        seq,
        code,
        kind: input.kind,
        format: input.format,
        title: input.title,
        generated_by: input.userId ?? null,
        params: input.params ? JSON.stringify(input.params) : null,
        row_count: input.rowCount,
        created_at: generatedAt,
      })
      .execute();
    const user = input.userId
      ? await this.database.db.selectFrom('users').select('full_name').where('id', '=', input.userId).executeTakeFirst()
      : null;
    return {
      code,
      title: input.title,
      subtitle: input.subtitle,
      generatedAt,
      generatedBy: user?.full_name ?? null,
      verifyUrl: `${this.env.values.APP_PUBLIC_URL.replace(/\/$/, '')}/verificar-reporte/${code}`,
      source: input.source,
    };
  }

  async verify(code: string) {
    const row = await this.database.db
      .selectFrom('report_log')
      .leftJoin('users', 'users.id', 'report_log.generated_by')
      .select(['report_log.code', 'report_log.kind', 'report_log.format', 'report_log.title', 'report_log.row_count', 'report_log.created_at', 'users.full_name'])
      .where('report_log.code', '=', code.toUpperCase())
      .executeTakeFirst();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'No existe un reporte con ese número');
    return {
      code: row.code,
      kind: kindLabel[row.kind as ReportKind] ?? row.kind,
      format: row.format,
      title: row.title,
      rows: row.row_count,
      generatedAt: row.created_at,
      generatedBy: row.full_name ? row.full_name.split(' ')[0] : 'Sistema',
    };
  }

  async history(viewer: { id: string; role: string }) {
    let query = this.database.db
      .selectFrom('report_log')
      .leftJoin('users', 'users.id', 'report_log.generated_by')
      .select(['report_log.id', 'report_log.code', 'report_log.kind', 'report_log.format', 'report_log.title', 'report_log.row_count', 'report_log.created_at', 'users.full_name'])
      .orderBy('report_log.seq', 'desc')
      .limit(40);
    if (!['admin', 'coordinator', 'rector'].includes(viewer.role)) query = query.where('report_log.generated_by', '=', viewer.id);
    return query.execute();
  }
}
