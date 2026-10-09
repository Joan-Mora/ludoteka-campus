import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { ApiError } from '../../core/errors/api-error';
import { sha256 } from '../../core/common/crypto';
import { deviceLabel } from '../../core/common/device';
import type { AuthUser } from '../../core/auth/auth.decorators';

const METHOD_NAME: Record<string, string> = {
  password: 'Contraseña',
  otp: 'Contraseña y código',
  trusted_device: 'Dispositivo de confianza',
  passkey: 'Llave de acceso',
  facial: 'Reconocimiento facial',
};

@Injectable()
export class SettingsService {
  constructor(private readonly database: DatabaseService) {}

  async preferences(user: AuthUser) {
    const row = await this.database.db.selectFrom('user_preferences').select(['companion', 'theme']).where('user_id', '=', user.id).executeTakeFirst();
    return { companion: (row?.companion ?? 'luka') as 'luka' | 'luna', theme: (row?.theme ?? 'system') as 'light' | 'dark' | 'system' };
  }

  async savePreferences(user: AuthUser, patch: { companion?: 'luka' | 'luna'; theme?: 'light' | 'dark' | 'system' }) {
    const current = await this.preferences(user);
    const next = { ...current, ...patch };
    await this.database.db
      .insertInto('user_preferences')
      .values({ user_id: user.id, companion: next.companion, theme: next.theme, updated_at: new Date() })
      .onConflict((oc) => oc.column('user_id').doUpdateSet({ companion: next.companion, theme: next.theme, updated_at: new Date() }))
      .execute();
    return next;
  }

  /** One entry per session family (a login and its rotations); the current one is marked so it is not closed by mistake. */
  async sessions(user: AuthUser, currentRefresh?: string) {
    const rows = await this.database.db
      .selectFrom('refresh_tokens')
      .select(['id', 'family_id', 'auth_method', 'user_agent', 'ip', 'created_at', 'token_hash'])
      .where('user_id', '=', user.id)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .execute();
    const currentHash = currentRefresh ? sha256(currentRefresh) : null;
    const families = new Map<string, (typeof rows)[number] & { started: Date; current: boolean }>();
    for (const row of rows) {
      const key = row.family_id ?? row.id;
      const existing = families.get(key);
      if (!existing) families.set(key, { ...row, started: row.created_at, current: row.token_hash === currentHash });
      else if (row.token_hash === currentHash) existing.current = true;
    }
    const familyIds = [...families.values()].map((f) => f.family_id).filter((id): id is string => Boolean(id));
    const starts = familyIds.length
      ? await this.database.db
          .selectFrom('refresh_tokens')
          .select((eb) => ['family_id', eb.fn.min('created_at').as('started')])
          .where('family_id', 'in', familyIds)
          .groupBy('family_id')
          .execute()
      : [];
    for (const start of starts) {
      const family = start.family_id ? families.get(start.family_id) : undefined;
      if (family && start.started) family.started = new Date(start.started as unknown as string);
    }
    return [...families.entries()].map(([id, row]) => ({
      id,
      device: deviceLabel(row.user_agent),
      method: METHOD_NAME[row.auth_method ?? 'password'] ?? 'Contraseña',
      ip: row.ip,
      startedAt: row.started,
      lastActiveAt: row.created_at,
      current: row.current,
    }));
  }

  async closeSession(user: AuthUser, familyId: string) {
    const result = await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', user.id)
      .where((eb) => eb.or([eb('family_id', '=', familyId), eb('id', '=', familyId)]))
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (!Number(result.numUpdatedRows)) throw new ApiError(404, 'NOT_FOUND', 'La sesión ya estaba cerrada');
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: user.id, action: 'session.revoke', entity: 'users', entity_id: user.id, meta: JSON.stringify({ family: familyId }) })
      .execute();
    return { ok: true };
  }

  async devices(user: AuthUser) {
    const rows = await this.database.db
      .selectFrom('trusted_devices')
      .select(['id', 'label', 'created_at', 'last_used_at', 'expires_at'])
      .where('user_id', '=', user.id)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at, expiresAt: r.expires_at }));
  }

  async forgetDevice(user: AuthUser, id: string) {
    const result = await this.database.db
      .updateTable('trusted_devices')
      .set({ revoked_at: new Date() })
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (!Number(result.numUpdatedRows)) throw new ApiError(404, 'NOT_FOUND', 'El dispositivo no existe');
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: user.id, action: 'device.forget', entity: 'users', entity_id: user.id, meta: JSON.stringify({ device: id }) })
      .execute();
    return this.devices(user);
  }
}
