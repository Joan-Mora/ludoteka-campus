import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import type { Role } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { passwordIsStrong, randomToken, sha256 } from '../../core/common/crypto';
import { DomainEvents } from '../../core/events/domain-events';
import type { AuthUser } from '../../core/auth/auth.decorators';

const REFRESH_DAYS = 14;

@Injectable()
export class IdentityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly env: Env,
    private readonly events: EventEmitter2,
  ) {}

  private async roleOf(userId: string): Promise<Role> {
    const row = await this.database.db
      .selectFrom('user_roles')
      .select('role')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!row) throw new ApiError(403, 'NO_ROLE', 'La cuenta no tiene rol');
    return row.role as Role;
  }

  toPublic(row: {
    id: string;
    email: string;
    full_name: string;
    is_minor: boolean;
    guardian_consent_at: Date | null;
  }, role: Role) {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role,
      isMinor: row.is_minor,
      guardianConsent: Boolean(row.guardian_consent_at),
    };
  }

  private async signAccess(user: {
    id: string;
    email: string;
    full_name: string;
    is_minor: boolean;
  }, role: Role) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role,
      fullName: user.full_name,
      isMinor: user.is_minor,
    });
  }

  async issueSession(userId: string) {
    const user = await this.database.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    const role = await this.roleOf(user.id);
    const accessToken = await this.signAccess(user, role);
    const refreshToken = randomToken();
    const expires = new Date(Date.now() + REFRESH_DAYS * 86400000);
    await this.database.db
      .insertInto('refresh_tokens')
      .values({ user_id: user.id, token_hash: sha256(refreshToken), expires_at: expires })
      .execute();
    return { accessToken, refreshToken, user: this.toPublic(user, role) };
  }

  async register(input: { email: string; password: string; fullName: string }) {
    if (!passwordIsStrong(input.password)) {
      throw new ApiError(400, 'WEAK_PASSWORD', 'La contraseña necesita 8 caracteres, una letra y un número');
    }
    const email = input.email.trim().toLowerCase();
    const taken = await this.database.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (taken) throw new ApiError(409, 'EMAIL_TAKEN', 'Ese correo ya tiene cuenta');
    const password_hash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.database.withTx(async (trx) => {
      const created = await trx
        .insertInto('users')
        .values({ email, password_hash, full_name: input.fullName.trim() })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto('user_roles').values({ user_id: created.id, role: 'student' }).execute();
      return created;
    });
    return this.issueSession(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.database.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.trim().toLowerCase())
      .executeTakeFirst();
    const valid = user ? await argon2.verify(user.password_hash, password).catch(() => false) : false;
    if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: user.id, action: 'login', entity: 'users', entity_id: user.id, meta: null })
      .execute();
    return this.issueSession(user.id);
  }

  async refresh(rawToken: string | undefined) {
    if (!rawToken) throw new ApiError(401, 'UNAUTHENTICATED', 'No hay sesión para renovar');
    const row = await this.database.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', sha256(rawToken))
      .executeTakeFirst();
    if (!row || row.revoked_at || row.expires_at.getTime() < Date.now()) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'La sesión expiró');
    }
    await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('id', '=', row.id)
      .execute();
    return this.issueSession(row.user_id);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('token_hash', '=', sha256(rawToken))
      .execute();
  }

  async forgot(email: string) {
    const user = await this.database.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.trim().toLowerCase())
      .executeTakeFirst();
    if (!user) return;
    const token = randomToken();
    await this.database.db
      .insertInto('password_reset_tokens')
      .values({
        user_id: user.id,
        token_hash: sha256(token),
        expires_at: new Date(Date.now() + 3600_000),
      })
      .execute();
    const link = `${this.env.values.APP_PUBLIC_URL.replace(/\/$/, '')}/restablecer?token=${token}`;
    this.events.emit(DomainEvents.PasswordReset, {
      email: user.email,
      fullName: user.full_name,
      link,
    });
  }

  async reset(token: string, password: string) {
    if (!passwordIsStrong(password)) {
      throw new ApiError(400, 'WEAK_PASSWORD', 'La contraseña necesita 8 caracteres, una letra y un número');
    }
    const row = await this.database.db
      .selectFrom('password_reset_tokens')
      .selectAll()
      .where('token_hash', '=', sha256(token))
      .executeTakeFirst();
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new ApiError(400, 'INVALID_TOKEN', 'El enlace no sirve o ya venció');
    }
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    await this.database.withTx(async (trx) => {
      await trx.updateTable('users').set({ password_hash, updated_at: new Date() }).where('id', '=', row.user_id).execute();
      await trx.updateTable('password_reset_tokens').set({ used_at: new Date() }).where('id', '=', row.id).execute();
      await trx.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('user_id', '=', row.user_id).execute();
    });
  }

  async me(userId: string) {
    const user = await this.database.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    const role = await this.roleOf(user.id);
    return this.toPublic(user, role);
  }

  async listUsers() {
    const rows = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.id', 'users.email', 'users.full_name', 'users.is_minor', 'users.guardian_consent_at', 'user_roles.role'])
      .orderBy('users.full_name')
      .execute();
    return rows.map((row) => this.toPublic(row, row.role as Role));
  }

  async createUser(actor: AuthUser, input: { email: string; password: string; fullName: string; role: Role; isMinor?: boolean }) {
    if (!passwordIsStrong(input.password)) {
      throw new ApiError(400, 'WEAK_PASSWORD', 'La contraseña necesita 8 caracteres, una letra y un número');
    }
    const email = input.email.trim().toLowerCase();
    const taken = await this.database.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (taken) throw new ApiError(409, 'EMAIL_TAKEN', 'Ese correo ya tiene cuenta');
    const password_hash = await argon2.hash(input.password, { type: argon2.argon2id });
    const created = await this.database.withTx(async (trx) => {
      const user = await trx
        .insertInto('users')
        .values({
          email,
          password_hash,
          full_name: input.fullName.trim(),
          is_minor: Boolean(input.isMinor),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto('user_roles').values({ user_id: user.id, role: input.role }).execute();
      await trx
        .insertInto('audit_log')
        .values({
          actor_id: actor.id,
          action: 'user.create',
          entity: 'users',
          entity_id: user.id,
          meta: JSON.stringify({ role: input.role }),
        })
        .execute();
      return user;
    });
    return this.toPublic(created, input.role);
  }

  async setGuardianConsent(userId: string, actorId: string) {
    const updated = await this.database.db
      .updateTable('users')
      .set({ guardian_consent_at: new Date(), updated_at: new Date() })
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    await this.database.db
      .insertInto('audit_log')
      .values({
        actor_id: actorId,
        action: 'guardian.consent',
        entity: 'users',
        entity_id: userId,
        meta: null,
      })
      .execute();
    const role = await this.roleOf(userId);
    return this.toPublic(updated, role);
  }
}
