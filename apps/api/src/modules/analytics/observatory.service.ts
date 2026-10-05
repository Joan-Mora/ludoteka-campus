import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { AiService } from '../../core/ai/ai.service';
import { MAX_ROWS, VIEWS, scopeToGroups, validateSql } from './observatory.sql';

const READER_ROLE = 'ludoteka_reader';
const TIMEOUT_MS = 5000;
const NUMERIC_OID = 1700;

export const EXAMPLES: { question: string; sql: string; chart: 'barras' | 'linea' | 'ninguno' }[] = [
  {
    question: '¿Cuál es el promedio de cada estudiante en las evaluaciones?',
    sql: `SELECT estudiante AS "Estudiante", round(avg(porcentaje), 1) AS "Promedio %", count(*) AS "Intentos"
FROM v_intentos WHERE estado = 'completed' GROUP BY estudiante ORDER BY "Promedio %" DESC`,
    chart: 'barras',
  },
  {
    question: '¿Qué temas tienen la maestría más baja en promedio?',
    sql: `SELECT tema AS "Tema", round(avg(nivel), 1) AS "Nivel promedio", count(*) AS "Estudiantes"
FROM v_maestria GROUP BY tema ORDER BY "Nivel promedio" ASC`,
    chart: 'barras',
  },
  {
    question: '¿Qué preguntas se fallan más?',
    sql: `SELECT pregunta_codigo AS "Pregunta", tema AS "Tema", count(*) FILTER (WHERE NOT correcta) AS "Fallos", count(*) AS "Respuestas"
FROM v_respuestas GROUP BY pregunta_codigo, tema ORDER BY "Fallos" DESC`,
    chart: 'barras',
  },
  {
    question: '¿Cuántos eventos de integridad hubo por tipo en los últimos 30 días?',
    sql: `SELECT tipo AS "Tipo", count(*) AS "Eventos"
FROM v_integridad WHERE ocurrido_en > now() - INTERVAL '30 days' GROUP BY tipo ORDER BY "Eventos" DESC`,
    chart: 'barras',
  },
  {
    question: '¿Quiénes tienen más experiencia acumulada?',
    sql: `SELECT estudiante AS "Estudiante", xp_total AS "XP", racha_actual AS "Racha", insignias AS "Insignias"
FROM v_xp ORDER BY xp_total DESC`,
    chart: 'barras',
  },
  {
    question: '¿Qué recursos de la biblioteca se consultan más?',
    sql: `SELECT titulo AS "Recurso", tipo AS "Tipo", vistas AS "Vistas", guardados AS "Guardados"
FROM v_biblioteca ORDER BY vistas DESC`,
    chart: 'barras',
  },
];

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class ObservatoryService {
  private databaseName: string | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly ai: AiService,
  ) {}

  schema() {
    return { views: VIEWS, examples: EXAMPLES.map((e) => e.question), maxRows: MAX_ROWS, timeoutMs: TIMEOUT_MS, aiEnabled: this.ai.enabled };
  }

  /** Groups a teacher can see; null means no restriction (coordination and admin). */
  private async scopeFor(user: AuthUser): Promise<string[] | null> {
    if (user.role === 'admin' || user.role === 'directivo') return null;
    const rows = await sql<{ group_id: string }>`
      SELECT group_id FROM courses WHERE teacher_id = ${user.id}
      UNION SELECT group_id FROM teaching_assignments WHERE teacher_id = ${user.id}
    `.execute(this.database.db);
    return rows.rows.map((r) => r.group_id);
  }

  /**
   * Student names typed in the question are replaced by ESTUDIANTE_n before calling the model,
   * so no minor's personal data leaves the server; the real names go back into the SQL literals.
   */
  private async anonymize(question: string, groups: string[] | null) {
    const names = await sql<{ full_name: string }>`
      SELECT DISTINCT u.full_name FROM enrollments e JOIN users u ON u.id = e.user_id
      ${groups ? sql`WHERE e.group_id = ANY(${groups}::UUID[])` : sql``}
    `.execute(this.database.db);
    const mapping = new Map<string, string>();
    let text = question;
    for (const { full_name } of names.rows.sort((a, b) => b.full_name.length - a.full_name.length)) {
      const words = full_name.trim().split(/\s+/);
      const variants = [full_name, words.length > 2 ? `${words[0]} ${words[2]}` : null].filter(Boolean) as string[];
      for (const variant of variants) {
        const pattern = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'gi');
        if (pattern.test(text)) {
          const token = mapping.get(full_name) ?? `ESTUDIANTE_${mapping.size + 1}`;
          mapping.set(full_name, token);
          text = text.replace(pattern, token);
        }
      }
    }
    return { text, mapping };
  }

  async ask(user: AuthUser, question: string) {
    const groups = await this.scopeFor(user);
    if (groups && !groups.length) throw new ApiError(403, 'NO_GROUPS', 'No tienes grupos asignados para consultar');
    const started = Date.now();

    const example = EXAMPLES.find((e) => normalize(e.question) === normalize(question));
    let generated: { sql: string | null; explanation: string; chart: string; source: 'ia' | 'ejemplo' };
    if (example) {
      generated = { sql: example.sql, explanation: 'Consulta de ejemplo del Observatorio.', chart: example.chart, source: 'ejemplo' };
    } else {
      const { text, mapping } = await this.anonymize(question, groups);
      const reply = await this.ai.chatJson<{ sql?: string | null; explicacion?: string; grafico?: string }>(
        [
          { role: 'system', content: this.systemPrompt() },
          { role: 'user', content: text },
        ],
        { feature: 'observatorio.nl2sql', userId: user.id, smart: true, temperature: 0 },
      );
      if (!reply) {
        await this.log(user.id, question, null, 'no_model', 'El modelo no respondió', 0, Date.now() - started);
        throw new ApiError(503, 'NO_MODEL', 'El modelo de IA no está disponible. Prueba con una de las preguntas de ejemplo.');
      }
      let query = typeof reply.sql === 'string' ? reply.sql : null;
      for (const [name, token] of mapping) query = query?.replaceAll(token, name.replace(/'/g, "''")) ?? null;
      generated = { sql: query, explanation: reply.explicacion ?? '', chart: reply.grafico ?? 'ninguno', source: 'ia' };
    }

    if (!generated.sql) {
      await this.log(user.id, question, null, 'rejected', generated.explanation || 'Sin SQL', 0, Date.now() - started);
      throw new ApiError(422, 'NOT_ANSWERABLE', generated.explanation || 'Esa pregunta no se puede responder con los datos del Observatorio.');
    }
    const validation = validateSql(generated.sql, await this.dbName());
    if (!validation.ok) {
      await this.log(user.id, question, generated.sql, 'rejected', validation.reason, 0, Date.now() - started);
      throw new ApiError(400, 'SQL_REJECTED', validation.reason, { sql: generated.sql });
    }
    const finalSql = groups ? scopeToGroups(validation.sql, validation.views) : validation.sql;
    try {
      const result = await this.database.readOnly({ role: READER_ROLE, timeoutMs: TIMEOUT_MS }, (client) =>
        client.query(finalSql, groups ? [groups] : []),
      );
      const numeric = new Set(result.fields.filter((f) => f.dataTypeID === NUMERIC_OID).map((f) => f.name));
      const rows = (result.rows as Record<string, unknown>[]).slice(0, MAX_ROWS).map((row) => {
        for (const key of numeric) if (row[key] !== null && row[key] !== undefined) row[key] = Number(row[key]);
        return row;
      });
      const ms = Date.now() - started;
      await this.log(user.id, question, generated.sql, 'ok', null, rows.length, ms);
      return {
        question,
        sql: validation.sql,
        executed: finalSql,
        scoped: Boolean(groups),
        explanation: generated.explanation,
        chart: generated.chart,
        source: generated.source,
        columns: result.fields.map((f) => f.name),
        rows,
        truncated: result.rows.length > MAX_ROWS,
        ms,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const timeout = /statement timeout|query execution canceled/i.test(message);
      await this.log(user.id, question, generated.sql, 'error', message.slice(0, 300), 0, Date.now() - started);
      throw new ApiError(timeout ? 408 : 400, timeout ? 'SQL_TIMEOUT' : 'SQL_ERROR', timeout ? `La consulta superó ${TIMEOUT_MS / 1000} s` : `La base de datos rechazó la consulta: ${message}`, { sql: validation.sql });
    }
  }

  history(user: AuthUser) {
    return this.database.db
      .selectFrom('nl_queries')
      .select(['id', 'question', 'sql_text', 'status', 'reason', 'row_count', 'duration_ms', 'created_at'])
      .where('user_id', '=', user.id)
      .orderBy('created_at', 'desc')
      .limit(12)
      .execute();
  }

  private systemPrompt() {
    const catalog = VIEWS.map((v) => `- ${v.name}: ${v.description}. Columnas: ${v.columns.map(([c, t]) => `${c} (${t})`).join(', ')}`).join('\n');
    return [
      'Eres el analista de datos del Colegio Francisco Arango en Ludoteka Campus.',
      'Conviertes una pregunta en español en UNA consulta SELECT para CockroachDB (dialecto PostgreSQL).',
      `Solo puedes usar estas vistas:\n${catalog}`,
      'Reglas: solo SELECT o WITH ... SELECT; sin punto y coma, sin comentarios, sin esquemas ni otras tablas.',
      'Usa alias en español entre comillas dobles para las columnas del resultado. Redondea promedios con round(x, 1).',
      'No pongas LIMIT salvo que pidan un top N. Para fechas usa now() e INTERVAL. Los nombres anonimizados ESTUDIANTE_n van como texto entre comillas simples tal cual.',
      'Si la pregunta no se puede responder con estas vistas, devuelve sql null y explica por qué.',
      'Responde solo JSON: {"sql":"...","explicacion":"una frase de lo que calcula","grafico":"barras|linea|ninguno"}',
    ].join('\n');
  }

  private async dbName() {
    if (this.databaseName === null) {
      const row = await sql<{ db: string }>`SELECT current_database() AS db`.execute(this.database.db);
      this.databaseName = row.rows[0]?.db ?? '';
    }
    return this.databaseName || undefined;
  }

  private async log(userId: string, question: string, sqlText: string | null, status: string, reason: string | null, rows: number, ms: number) {
    await this.database.db
      .insertInto('nl_queries')
      .values({ user_id: userId, question: question.slice(0, 400), sql_text: sqlText?.slice(0, 4000) ?? null, status, reason, row_count: rows, duration_ms: ms })
      .execute()
      .catch(() => undefined);
  }
}
