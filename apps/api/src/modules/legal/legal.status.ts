import { sql } from 'kysely';
import type { DatabaseService } from '../../core/database/database.service';

export interface LegalDocument {
  id: string;
  kind: 'terminos' | 'privacidad' | 'cookies';
  version: string;
  title: string;
  published_at: Date;
}

/** The latest published version of each document; a new version makes everyone accept again. */
export async function currentDocuments(database: DatabaseService) {
  const rows = await sql<LegalDocument>`
    SELECT DISTINCT ON (kind) id, kind, version, title, published_at
    FROM legal_documents
    WHERE published_at <= now()
    ORDER BY kind, published_at DESC
  `.execute(database.db);
  return rows.rows;
}

async function acceptedCount(database: DatabaseService, userId: string, documentIds: string[]) {
  if (!documentIds.length) return 0;
  const rows = await database.db.selectFrom('legal_acceptances').select('document_id').where('user_id', '=', userId).where('document_id', 'in', documentIds).execute();
  return rows.length;
}

/** Linked minors whose current documents still need the guardian's acceptance. */
export async function pendingWards(database: DatabaseService, guardianId: string, documentIds: string[]) {
  const wards = await database.db
    .selectFrom('guardian_links')
    .innerJoin('users', 'users.id', 'guardian_links.student_id')
    .select(['users.id', 'users.full_name'])
    .where('guardian_links.guardian_id', '=', guardianId)
    .where('guardian_links.status', '=', 'active')
    .where('users.is_minor', '=', true)
    .where('users.status', '=', 'active')
    .execute();
  const pending: { id: string; fullName: string }[] = [];
  for (const ward of wards) {
    if ((await acceptedCount(database, ward.id, documentIds)) < documentIds.length) pending.push({ id: ward.id, fullName: ward.full_name });
  }
  return pending;
}

/** Whether the user must go through the acceptance screen before using the campus. */
export async function legalPending(database: DatabaseService, userId: string, role: string) {
  const docs = await currentDocuments(database);
  const ids = docs.map((d) => d.id);
  if ((await acceptedCount(database, userId, ids)) < ids.length) return true;
  if (role === 'guardian') return (await pendingWards(database, userId, ids)).length > 0;
  return false;
}
