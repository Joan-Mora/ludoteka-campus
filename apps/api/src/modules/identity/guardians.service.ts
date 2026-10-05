import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'kysely';
import type { GuardianScope } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents, type GuardianFacialRevokedEvent } from '../../core/events/domain-events';

export const GUARDIAN_POLICY_VERSION = 'CFA-1581-2026.1';

const SCOPE_LABEL: Record<GuardianScope, string> = {
  facial: 'Acceso con reconocimiento facial',
  ai_tutor: 'Uso del tutor con inteligencia artificial',
  data_processing: 'Tratamiento de datos académicos',
};

@Injectable()
export class GuardiansService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  /** Latest decision per (link, scope); absence means the guardian has not decided yet. */
  private async latestDecisions(linkIds: string[]) {
    if (!linkIds.length) return new Map<string, { granted: boolean; at: Date; version: string }>();
    const rows = await sql<{ link_id: string; scope: string; granted: boolean; created_at: Date; policy_version: string }>`
      SELECT DISTINCT ON (link_id, scope) link_id, scope, granted, created_at, policy_version
      FROM guardian_authorizations
      WHERE link_id IN (${sql.join(linkIds)})
      ORDER BY link_id, scope, created_at DESC
    `.execute(this.database.db);
    return new Map(rows.rows.map((r) => [`${r.link_id}:${r.scope}`, { granted: r.granted, at: r.created_at, version: r.policy_version }]));
  }

  async myStudents(guardian: AuthUser) {
    const links = await this.database.db
      .selectFrom('guardian_links')
      .innerJoin('users', 'users.id', 'guardian_links.student_id')
      .leftJoin('enrollments', (join) => join.onRef('enrollments.user_id', '=', 'users.id').on('enrollments.status', '=', 'active'))
      .leftJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .leftJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select([
        'guardian_links.id as link_id',
        'guardian_links.relationship',
        'users.id',
        'users.full_name',
        'users.is_minor',
        'users.guardian_consent_at',
        'groups_class.name as group_name',
        'grades.name as grade_name',
      ])
      .where('guardian_links.guardian_id', '=', guardian.id)
      .where('guardian_links.status', '=', 'active')
      .orderBy('users.full_name')
      .execute();
    const decisions = await this.latestDecisions(links.map((l) => l.link_id));
    return {
      policyVersion: GUARDIAN_POLICY_VERSION,
      students: links.map((link) => ({
        id: link.id,
        fullName: link.full_name,
        relationship: link.relationship,
        isMinor: link.is_minor,
        group: link.group_name ? `${link.grade_name} · ${link.group_name}` : null,
        authorizations: (Object.keys(SCOPE_LABEL) as GuardianScope[]).map((scope) => {
          const decision = decisions.get(`${link.link_id}:${scope}`);
          return { scope, label: SCOPE_LABEL[scope], granted: decision?.granted ?? null, decidedAt: decision?.at ?? null, version: decision?.version ?? null };
        }),
      })),
    };
  }

  async authorize(guardian: AuthUser, input: { studentId: string; scope: GuardianScope; granted: boolean }, ip: string | null) {
    const link = await this.database.db
      .selectFrom('guardian_links')
      .select(['id'])
      .where('guardian_id', '=', guardian.id)
      .where('student_id', '=', input.studentId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!link) throw new ApiError(403, 'FORBIDDEN', 'No eres acudiente de este estudiante');
    await this.database.withTx(async (trx) => {
      await trx
        .insertInto('guardian_authorizations')
        .values({ link_id: link.id, scope: input.scope, policy_version: GUARDIAN_POLICY_VERSION, granted: input.granted, ip })
        .execute();
      if (input.scope === 'facial') {
        await trx
          .updateTable('users')
          .set({ guardian_consent_at: input.granted ? new Date() : null, updated_at: new Date() })
          .where('id', '=', input.studentId)
          .execute();
      }
      await trx
        .insertInto('audit_log')
        .values({
          actor_id: guardian.id,
          action: input.granted ? 'guardian.grant' : 'guardian.revoke',
          entity: 'users',
          entity_id: input.studentId,
          meta: JSON.stringify({ scope: input.scope, version: GUARDIAN_POLICY_VERSION }),
        })
        .execute();
    });
    if (input.scope === 'facial' && !input.granted) {
      const event: GuardianFacialRevokedEvent = { studentId: input.studentId, guardianId: guardian.id };
      this.events.emit(DomainEvents.GuardianFacialRevoked, event);
    }
    return this.myStudents(guardian);
  }

  /**
   * Whether a minor may use a feature. Adults always may; a minor needs at least one active
   * guardian whose latest decision for the scope is a grant.
   */
  async isAuthorized(studentId: string, scope: GuardianScope) {
    const user = await this.database.db.selectFrom('users').select('is_minor').where('id', '=', studentId).executeTakeFirst();
    if (!user?.is_minor) return true;
    const links = await this.database.db.selectFrom('guardian_links').select('id').where('student_id', '=', studentId).where('status', '=', 'active').execute();
    const decisions = await this.latestDecisions(links.map((l) => l.id));
    return links.some((l) => decisions.get(`${l.id}:${scope}`)?.granted === true);
  }

  async listLinks() {
    return this.database.db
      .selectFrom('guardian_links')
      .innerJoin('users as g', 'g.id', 'guardian_links.guardian_id')
      .innerJoin('users as s', 's.id', 'guardian_links.student_id')
      .select([
        'guardian_links.id',
        'guardian_links.relationship',
        'guardian_links.status',
        'guardian_links.created_at',
        'g.full_name as guardian_name',
        'g.email as guardian_email',
        's.full_name as student_name',
        's.email as student_email',
        's.is_minor',
      ])
      .orderBy('s.full_name')
      .execute();
  }

  async createLink(actor: AuthUser, input: { guardianEmail: string; studentEmail: string; relationship: string }) {
    const people = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.id', 'users.email', 'user_roles.role'])
      .where('users.email', 'in', [input.guardianEmail.trim().toLowerCase(), input.studentEmail.trim().toLowerCase()])
      .execute();
    const guardian = people.find((p) => p.email === input.guardianEmail.trim().toLowerCase());
    const student = people.find((p) => p.email === input.studentEmail.trim().toLowerCase());
    if (!guardian || guardian.role !== 'guardian') throw new ApiError(400, 'NOT_GUARDIAN', 'El primer correo debe ser una cuenta de acudiente');
    if (!student || student.role !== 'student') throw new ApiError(400, 'NOT_STUDENT', 'El segundo correo debe ser una cuenta de estudiante');
    const link = await this.database.db
      .insertInto('guardian_links')
      .values({ guardian_id: guardian.id, student_id: student.id, relationship: input.relationship, created_by: actor.id })
      .onConflict((oc) => oc.columns(['guardian_id', 'student_id']).doUpdateSet({ status: 'active', relationship: input.relationship }))
      .returning(['id'])
      .executeTakeFirstOrThrow();
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: actor.id, action: 'guardian.link', entity: 'guardian_links', entity_id: link.id, meta: JSON.stringify({ relationship: input.relationship }) })
      .execute();
    return { id: link.id };
  }

  async revokeLink(actor: AuthUser, id: string) {
    const updated = await this.database.db
      .updateTable('guardian_links')
      .set({ status: 'revoked' })
      .where('id', '=', id)
      .returning(['id'])
      .executeTakeFirst();
    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'El vínculo no existe');
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: actor.id, action: 'guardian.unlink', entity: 'guardian_links', entity_id: id, meta: null })
      .execute();
    return { ok: true };
  }
}
