import { Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { deviceLabel } from '../../core/common/device';
import { requireVerifiedSession } from '../../core/auth/session-cookies';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { IdentityService, type ClientInfo } from './identity.service';

const CHALLENGE_MINUTES = 5;
const MAX_PASSKEYS = 10;

const expired = () => new ApiError(400, 'PASSKEY_EXPIRED', 'La solicitud venció. Inténtalo de nuevo.');

@Injectable()
export class PasskeysService {
  constructor(
    private readonly database: DatabaseService,
    private readonly identity: IdentityService,
    private readonly env: Env,
  ) {}

  /** The relying party is the public web origin; the API is served from the same host. */
  private get rp() {
    const publicUrl = new URL(this.env.values.APP_PUBLIC_URL);
    const origins = new Set([publicUrl.origin]);
    for (const origin of this.env.values.CORS_ORIGIN.split(',')) {
      const trimmed = origin.trim();
      if (!trimmed) continue;
      try {
        const url = new URL(trimmed);
        if (url.hostname === publicUrl.hostname) origins.add(url.origin);
      } catch {
        /* entradas que no son URL se ignoran */
      }
    }
    return { id: publicUrl.hostname, origins: [...origins] };
  }

  private async saveChallenge(challenge: string, kind: 'register' | 'login', userId: string | null) {
    const row = await this.database.db
      .insertInto('webauthn_challenges')
      .values({ user_id: userId, challenge, kind, expires_at: new Date(Date.now() + CHALLENGE_MINUTES * 60000) })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    return row.id;
  }

  /** Marks the challenge as used exactly once; a replayed or stale challenge fails. */
  private async consumeChallenge(id: string, kind: 'register' | 'login', userId: string | null) {
    const row = await this.database.db.selectFrom('webauthn_challenges').selectAll().where('id', '=', id).where('kind', '=', kind).executeTakeFirst();
    if (!row || row.used_at || row.expires_at.getTime() < Date.now() || (userId && row.user_id !== userId)) throw expired();
    const used = await this.database.db
      .updateTable('webauthn_challenges')
      .set({ used_at: new Date() })
      .where('id', '=', id)
      .where('used_at', 'is', null)
      .executeTakeFirst();
    if (!Number(used.numUpdatedRows)) throw expired();
    return row.challenge;
  }

  private async audit(actorId: string, action: string, entityId: string, meta?: Record<string, unknown>) {
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: actorId, action, entity: 'users', entity_id: entityId, meta: meta ? JSON.stringify(meta) : null })
      .execute();
  }

  async list(user: AuthUser) {
    const rows = await this.database.db
      .selectFrom('webauthn_credentials')
      .select(['id', 'label', 'device_type', 'backed_up', 'created_at', 'last_used_at'])
      .where('user_id', '=', user.id)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((r) => ({ id: r.id, label: r.label, synced: r.backed_up, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
  }

  async registerOptions(user: AuthUser) {
    requireVerifiedSession(user);
    const existing = await this.database.db
      .selectFrom('webauthn_credentials')
      .select(['credential_id', 'transports'])
      .where('user_id', '=', user.id)
      .execute();
    if (existing.length >= MAX_PASSKEYS) throw new ApiError(400, 'PASSKEY_LIMIT', `Puedes registrar hasta ${MAX_PASSKEYS} llaves de acceso`);
    const options = await generateRegistrationOptions({
      rpName: 'Ludoteka Campus',
      rpID: this.rp.id,
      userName: user.email,
      userDisplayName: user.fullName,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: c.transports ? (JSON.parse(c.transports) as string[]) : undefined })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    const challengeId = await this.saveChallenge(options.challenge, 'register', user.id);
    return { challengeId, options };
  }

  async registerVerify(user: AuthUser, challengeId: string, response: RegistrationResponseJSON, client: ClientInfo) {
    requireVerifiedSession(user);
    const expectedChallenge = await this.consumeChallenge(challengeId, 'register', user.id);
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.rp.origins,
      expectedRPID: this.rp.id,
      requireUserVerification: true,
    }).catch(() => null);
    if (!result?.verified || !result.registrationInfo) {
      throw new ApiError(400, 'PASSKEY_INVALID', 'No pudimos verificar la llave de acceso. Inténtalo de nuevo.');
    }
    const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
    const taken = await this.database.db.selectFrom('webauthn_credentials').select('id').where('credential_id', '=', credential.id).executeTakeFirst();
    if (taken) throw new ApiError(409, 'PASSKEY_EXISTS', 'Esta llave de acceso ya está registrada');
    const row = await this.database.db
      .insertInto('webauthn_credentials')
      .values({
        user_id: user.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ? JSON.stringify(credential.transports) : null,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        label: deviceLabel(client.userAgent),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    await this.audit(user.id, 'passkey.register', user.id, { credential: row.id, synced: credentialBackedUp });
    return this.list(user);
  }

  async rename(user: AuthUser, id: string, label: string) {
    const updated = await this.database.db
      .updateTable('webauthn_credentials')
      .set({ label: label.trim().slice(0, 60) || 'Llave de acceso' })
      .where('id', '=', id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!Number(updated.numUpdatedRows)) throw new ApiError(404, 'NOT_FOUND', 'La llave no existe');
    return this.list(user);
  }

  async remove(user: AuthUser, id: string) {
    const deleted = await this.database.db.deleteFrom('webauthn_credentials').where('id', '=', id).where('user_id', '=', user.id).executeTakeFirst();
    if (!Number(deleted.numDeletedRows)) throw new ApiError(404, 'NOT_FOUND', 'La llave no existe');
    await this.audit(user.id, 'passkey.remove', user.id, { credential: id });
    return this.list(user);
  }

  /** Discoverable-credential login: the authenticator tells us who the user is. */
  async loginOptions() {
    const options = await generateAuthenticationOptions({ rpID: this.rp.id, userVerification: 'required' });
    const challengeId = await this.saveChallenge(options.challenge, 'login', null);
    return { challengeId, options };
  }

  async loginVerify(challengeId: string, response: AuthenticationResponseJSON, client: ClientInfo) {
    const expectedChallenge = await this.consumeChallenge(challengeId, 'login', null);
    const stored = await this.database.db.selectFrom('webauthn_credentials').selectAll().where('credential_id', '=', response.id).executeTakeFirst();
    if (!stored) throw new ApiError(401, 'PASSKEY_UNKNOWN', 'Esta llave de acceso no está registrada en Ludoteka. Entra con tu contraseña y regístrala en Ajustes.');
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.rp.origins,
      expectedRPID: this.rp.id,
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports ? (JSON.parse(stored.transports) as never) : undefined,
      },
    }).catch(() => null);
    if (!result?.verified) throw new ApiError(401, 'PASSKEY_INVALID', 'No pudimos verificar tu llave de acceso');
    const user = await this.database.db.selectFrom('users').select(['status', 'locked_until']).where('id', '=', stored.user_id).executeTakeFirstOrThrow();
    if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', 'Tu cuenta está desactivada. Comunícate con el colegio.');
    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      throw new ApiError(429, 'ACCOUNT_LOCKED', 'La cuenta está bloqueada temporalmente por intentos fallidos.');
    }
    await this.database.db
      .updateTable('webauthn_credentials')
      .set({ counter: result.authenticationInfo.newCounter, last_used_at: new Date() })
      .where('id', '=', stored.id)
      .execute();
    await this.audit(stored.user_id, 'login', stored.user_id, { method: 'passkey' });
    return this.identity.issueSession(stored.user_id, 'passkey', client);
  }
}
