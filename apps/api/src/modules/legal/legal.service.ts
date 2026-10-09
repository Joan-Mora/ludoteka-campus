import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { currentDocuments, pendingWards } from './legal.status';

/** Never part of an export: credentials, one-time codes, biometric templates and vectors. */
const EXCLUDED_TABLES = new Set(['refresh_tokens', 'password_reset_tokens', 'login_challenges', 'webauthn_challenges', 'face_templates', 'email_outbox', 'ai_usage']);
const SECRET_COLUMN = /hash|token|secret|public_key|embedding|template|vector|descriptor/i;

@Injectable()
export class LegalService {
  constructor(private readonly database: DatabaseService) {}

  private async audit(actorId: string, action: string, entityId: string, meta?: Record<string, unknown>) {
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: actorId, action, entity: 'users', entity_id: entityId, meta: meta ? JSON.stringify(meta) : null })
      .execute();
  }

  async documents() {
    const docs = await currentDocuments(this.database);
    return docs.map((d) => ({ kind: d.kind, version: d.version, title: d.title, publishedAt: d.published_at }));
  }

  private async guardianLinked(studentId: string) {
    const link = await this.database.db
      .selectFrom('guardian_links')
      .innerJoin('users', 'users.id', 'guardian_links.guardian_id')
      .select('guardian_links.id')
      .where('guardian_links.student_id', '=', studentId)
      .where('guardian_links.status', '=', 'active')
      .where('users.status', '=', 'active')
      .executeTakeFirst();
    return Boolean(link);
  }

  async status(user: AuthUser) {
    const docs = await currentDocuments(this.database);
    const ids = docs.map((d) => d.id);
    const accepted = ids.length
      ? await this.database.db
          .selectFrom('legal_acceptances')
          .leftJoin('users as by', 'by.id', 'legal_acceptances.accepted_by')
          .select(['legal_acceptances.document_id', 'legal_acceptances.accepted_at', 'legal_acceptances.accepted_by', 'by.full_name as accepted_by_name'])
          .where('legal_acceptances.user_id', '=', user.id)
          .where('legal_acceptances.document_id', 'in', ids)
          .execute()
      : [];
    const byDoc = new Map(accepted.map((a) => [a.document_id, a]));
    const ownPending = docs.some((d) => !byDoc.has(d.id));
    const wards = user.role === 'guardian' ? await pendingWards(this.database, user.id, ids) : [];
    const needsGuardian = user.isMinor && ownPending && (await this.guardianLinked(user.id));
    return {
      documents: docs.map((d) => {
        const a = byDoc.get(d.id);
        return {
          id: d.id,
          kind: d.kind,
          version: d.version,
          title: d.title,
          acceptedAt: a?.accepted_at ?? null,
          acceptedBy: a && a.accepted_by !== user.id ? a.accepted_by_name : null,
        };
      }),
      pending: ownPending || wards.length > 0,
      ownPending,
      /** A minor with an active guardian waits for that guardian; without one, the minor declares the guardian read it with them. */
      needsGuardian,
      wards,
    };
  }

  private async acceptFor(userId: string, acceptedBy: string, documentIds: string[], ip: string | null) {
    for (const documentId of documentIds) {
      await this.database.db
        .insertInto('legal_acceptances')
        .values({ user_id: userId, document_id: documentId, accepted_by: acceptedBy, ip })
        .onConflict((oc) => oc.columns(['user_id', 'document_id']).doNothing())
        .execute();
    }
  }

  async accept(user: AuthUser, input: { wards?: string[]; guardianPresent?: boolean }, ip: string | null) {
    const docs = await currentDocuments(this.database);
    const ids = docs.map((d) => d.id);
    const versions = Object.fromEntries(docs.map((d) => [d.kind, d.version]));
    if (user.isMinor) {
      if (await this.guardianLinked(user.id)) {
        throw new ApiError(403, 'GUARDIAN_MUST_ACCEPT', 'Tu acudiente debe aceptar estos documentos desde su cuenta de Ludoteka.');
      }
      if (!input.guardianPresent) {
        throw new ApiError(400, 'GUARDIAN_DECLARATION', 'Confirma que tu acudiente leyó los documentos contigo.');
      }
    }
    await this.acceptFor(user.id, user.id, ids, ip);
    await this.audit(user.id, 'legal.accept', user.id, { versions, guardianPresent: user.isMinor ? true : undefined });
    if (user.role === 'guardian' && input.wards?.length) {
      const allowed = new Set((await pendingWards(this.database, user.id, ids)).map((w) => w.id));
      for (const ward of input.wards) {
        if (!allowed.has(ward)) continue;
        await this.acceptFor(ward, user.id, ids, ip);
        await this.audit(user.id, 'legal.accept_for_minor', ward, { versions });
      }
    }
    return this.status(user);
  }

  /* ---------- Habeas data ---------- */

  async myRequests(user: AuthUser) {
    return this.database.db
      .selectFrom('data_requests')
      .select(['id', 'kind', 'status', 'reason', 'created_at', 'resolved_at'])
      .where('user_id', '=', user.id)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async requestDeletion(user: AuthUser, reason?: string) {
    const open = await this.database.db
      .selectFrom('data_requests')
      .select('id')
      .where('user_id', '=', user.id)
      .where('kind', '=', 'delete')
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (open) throw new ApiError(409, 'REQUEST_OPEN', 'Ya tienes una solicitud de eliminación en revisión');
    await this.database.db.insertInto('data_requests').values({ user_id: user.id, kind: 'delete', reason: reason?.trim().slice(0, 500) || null }).execute();
    await this.audit(user.id, 'data.delete_request', user.id);
    return this.myRequests(user);
  }

  /** Everything stored about the user, minus credentials and biometric templates. */
  async export(user: AuthUser) {
    const columns = await sql<{ table_name: string; column_name: string }>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
    `.execute(this.database.db);
    const byTable = new Map<string, string[]>();
    for (const c of columns.rows) byTable.set(c.table_name, [...(byTable.get(c.table_name) ?? []), c.column_name]);

    const profile = await this.database.db
      .selectFrom('users')
      .select(['id', 'email', 'full_name', 'is_minor', 'guardian_consent_at', 'status', 'last_login_at', 'created_at', 'updated_at'])
      .where('id', '=', user.id)
      .executeTakeFirstOrThrow();
    const data: Record<string, unknown[]> = {};
    for (const [table, cols] of [...byTable.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (EXCLUDED_TABLES.has(table) || table === 'users') continue;
      const owner = ['user_id', 'student_id', 'guardian_id', 'author_id'].filter((c) => cols.includes(c));
      if (!owner.length) continue;
      const visible = cols.filter((c) => !SECRET_COLUMN.test(c));
      const where = sql.join(owner.map((c) => sql`${sql.ref(c)} = ${user.id}`), sql` OR `);
      const rows = await sql<Record<string, unknown>>`
        SELECT ${sql.join(visible.map((c) => sql.ref(c)))} FROM ${sql.table(table)} WHERE ${where} LIMIT 5000
      `.execute(this.database.db);
      if (rows.rows.length) data[table] = rows.rows;
    }
    const conversations = (data.tutor_conversations ?? []) as { id: string }[];
    if (conversations.length) {
      data.tutor_messages = await this.database.db
        .selectFrom('tutor_messages')
        .select(['conversation_id', 'role', 'content', 'created_at'])
        .where('conversation_id', 'in', conversations.map((c) => c.id))
        .orderBy('created_at')
        .execute();
    }
    const face = await this.database.db.selectFrom('face_templates').select(['created_at']).where('user_id', '=', user.id).executeTakeFirst().catch(() => undefined);
    await this.database.db.insertInto('data_requests').values({ user_id: user.id, kind: 'export', status: 'done', resolved_at: new Date() }).execute();
    await this.audit(user.id, 'data.export', user.id, { tables: Object.keys(data).length });
    return {
      generatedAt: new Date().toISOString(),
      controller: 'Colegio Francisco Arango',
      note: 'Copia de tus datos en Ludoteka Campus (Ley 1581 de 2012). No incluye contraseñas, códigos de acceso ni el patrón facial cifrado.',
      profile: { ...profile, role: user.role },
      facialTemplate: face ? { stored: true, createdAt: face.created_at } : { stored: false },
      data,
    };
  }

  async adminRequests() {
    return this.database.db
      .selectFrom('data_requests')
      .innerJoin('users', 'users.id', 'data_requests.user_id')
      .select(['data_requests.id', 'data_requests.kind', 'data_requests.status', 'data_requests.reason', 'data_requests.created_at', 'data_requests.resolved_at', 'users.full_name', 'users.email'])
      .where('data_requests.kind', '=', 'delete')
      .orderBy('data_requests.created_at', 'desc')
      .limit(100)
      .execute();
  }

  async resolve(actor: AuthUser, id: string, status: 'done' | 'rejected') {
    const updated = await this.database.db
      .updateTable('data_requests')
      .set({ status, resolved_by: actor.id, resolved_at: new Date() })
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .returning(['user_id'])
      .executeTakeFirst();
    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'La solicitud no existe o ya se atendió');
    await this.audit(actor.id, `data.delete_${status}`, updated.user_id, { request: id });
    return this.adminRequests();
  }
}
