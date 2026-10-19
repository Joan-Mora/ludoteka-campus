import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import type { Role } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { hmac, otpCode, passwordIsStrong, randomToken, safeEqual, sha256 } from '../../core/common/crypto';
import { deviceLabel, maskEmail } from '../../core/common/device';
import { DomainEvents } from '../../core/events/domain-events';
import { Mailer } from '../../core/mail/mailer';
import { loginCodeEmail } from '../../core/mail/templates';
import type { AuthMethod, AuthUser } from '../../core/auth/auth.decorators';
import { legalPending } from '../legal/public-api';

const REFRESH_DAYS = 14;
export const TRUSTED_DAYS = 30;
const OTP_MINUTES = 10;
const OTP_RESEND_SECONDS = 30;
const LOCK_AFTER = 5;
const LOCK_MAX_MINUTES = 60;
/** A rotated refresh token presented again within this window is a race between tabs, not theft. */
const ROTATION_GRACE_MS = 30_000;

export interface ClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  is_minor: boolean;
  is_guest?: boolean;
  guest_grade?: number | null;
  guest_group?: string | null;
  guardian_consent_at: Date | null;
  status: string;
  must_change_password: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<IdentityService['toPublic']>;
}

export type LoginResult =
  | { kind: 'session'; session: Session }
  | { kind: 'otp'; otp: { challengeId: string; maskedEmail: string; devCode?: string } };

const weakPassword = () => new ApiError(400, 'WEAK_PASSWORD', 'La contraseña necesita 8 caracteres, una letra y un número');

@Injectable()
export class IdentityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly env: Env,
    private readonly events: EventEmitter2,
    private readonly mailer: Mailer,
  ) {}

  private async roleOf(userId: string): Promise<Role> {
    const row = await this.database.db.selectFrom('user_roles').select('role').where('user_id', '=', userId).executeTakeFirst();
    if (!row) throw new ApiError(403, 'NO_ROLE', 'La cuenta no tiene rol');
    return row.role as Role;
  }

  private async companionOf(userId: string): Promise<'luka' | 'luna'> {
    const row = await this.database.db.selectFrom('user_preferences').select('companion').where('user_id', '=', userId).executeTakeFirst();
    return row?.companion === 'luna' ? 'luna' : 'luka';
  }

  toPublic(row: Pick<UserRow, 'id' | 'email' | 'full_name' | 'is_minor' | 'guardian_consent_at'> & Partial<Pick<UserRow, 'status' | 'must_change_password' | 'is_guest' | 'guest_grade' | 'guest_group'>>, role: Role, companion: 'luka' | 'luna' = 'luka', pendingLegal = false) {
    const gradeNames: Record<number, string> = { 6: 'Sexto', 7: 'Séptimo', 8: 'Octavo', 9: 'Noveno', 10: 'Décimo', 11: 'Undécimo' };
    const guest = Boolean(row.is_guest);
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role,
      isMinor: row.is_minor,
      guardianConsent: Boolean(row.guardian_consent_at),
      mustChangePassword: guest ? false : Boolean(row.must_change_password),
      companion,
      legalPending: guest ? false : pendingLegal,
      isGuest: guest,
      guestGrade: guest ? Number(row.guest_grade ?? 0) : null,
      guestGroup: guest ? row.guest_group ?? null : null,
      guestLabel: guest ? `Estudiante (Invitado - ${gradeNames[Number(row.guest_grade)] ?? 'grado'})` : null,
    };
  }

  private async findByEmail(email: string) {
    return this.database.db.selectFrom('users').selectAll().where('email', '=', email.trim().toLowerCase()).executeTakeFirst();
  }

  private async audit(actorId: string | null, action: string, entityId: string | null, meta?: Record<string, unknown>) {
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: actorId, action, entity: 'users', entity_id: entityId, meta: meta ? JSON.stringify(meta) : null })
      .execute();
  }

  /** Opens a session. `familyId` keeps a rotated chain together so reuse of an old link can be traced. */
  async issueSession(userId: string, method: AuthMethod, client: ClientInfo = {}, familyId?: string): Promise<Session> {
    const user = await this.database.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', 'Tu cuenta está desactivada. Comunícate con el colegio.');
    const [role, companion] = await Promise.all([this.roleOf(user.id), this.companionOf(user.id)]);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role,
      fullName: user.full_name,
      isMinor: user.is_minor,
      amr: method,
      ...(user.must_change_password ? { mcp: true } : {}),
    });
    const refreshToken = randomToken();
    await this.database.db
      .insertInto('refresh_tokens')
      .values({
        user_id: user.id,
        token_hash: sha256(refreshToken),
        expires_at: new Date(Date.now() + REFRESH_DAYS * 86400000),
        family_id: familyId ?? randomUUID(),
        auth_method: method,
        user_agent: client.userAgent?.slice(0, 400) ?? null,
        ip: client.ip ?? null,
      })
      .execute();
    if (!familyId) {
      await this.database.db.updateTable('users').set({ last_login_at: new Date() }).where('id', '=', user.id).execute();
    }
    return { accessToken, refreshToken, user: this.toPublic(user, role, companion, await legalPending(this.database, user.id, role)) };
  }

  /* ---------- Paso 1: contraseña ---------- */

  async login(email: string, password: string, client: ClientInfo, trustedTokens: string[] = [], browserSession?: string): Promise<LoginResult> {
    const user = await this.findByEmail(email);
    if (user?.locked_until && user.locked_until.getTime() > Date.now()) {
      const minutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
      throw new ApiError(429, 'ACCOUNT_LOCKED', `Demasiados intentos fallidos. Intenta de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`);
    }
    const valid = user ? await argon2.verify(user.password_hash, password).catch(() => false) : false;
    if (!user || !valid) {
      if (user) await this.registerFailure(user.id, user.failed_logins + 1, client);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
    }
    if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', 'Tu cuenta está desactivada. Comunícate con el colegio.');
    await this.assertBrowserAccount(browserSession, user.id);
    if (user.failed_logins > 0 || user.locked_until) {
      await this.database.db.updateTable('users').set({ failed_logins: 0, locked_until: null }).where('id', '=', user.id).execute();
    }

    if (trustedTokens.length && (await this.useTrustedDevice(user.id, trustedTokens))) {
      await this.audit(user.id, 'login', user.id, { method: 'trusted_device' });
      return { kind: 'session', session: await this.issueSession(user.id, 'trusted_device', client) };
    }
    return { kind: 'otp', otp: await this.createChallenge(user, client) };
  }

  private async registerFailure(userId: string, failures: number, client: ClientInfo) {
    const lockMinutes = failures >= LOCK_AFTER ? Math.min(LOCK_MAX_MINUTES, 2 ** (failures - LOCK_AFTER)) : 0;
    await this.database.db
      .updateTable('users')
      .set({ failed_logins: failures, locked_until: lockMinutes ? new Date(Date.now() + lockMinutes * 60000) : null })
      .where('id', '=', userId)
      .execute();
    await this.audit(null, lockMinutes ? 'login.locked' : 'login.failed', userId, { failures, lockMinutes, ip: client.ip ?? null });
  }

  /* ---------- Paso 2: código de un solo uso ---------- */

  private otpHash(challengeId: string, code: string) {
    return hmac(this.env.values.JWT_SECRET, `otp:${challengeId}:${code}`);
  }

  deliveryAddress(email: string) {
    return this.mailer.deliveryAddress(email);
  }

  private async createChallenge(user: Pick<UserRow, 'id' | 'email' | 'full_name'>, client: ClientInfo) {
    const code = otpCode();
    const id = randomUUID();
    await this.database.db
      .updateTable('login_challenges')
      .set({ used_at: new Date() })
      .where('user_id', '=', user.id)
      .where('used_at', 'is', null)
      .execute();
    await this.database.db
      .insertInto('login_challenges')
      .values({ id, user_id: user.id, code_hash: this.otpHash(id, code), expires_at: new Date(Date.now() + OTP_MINUTES * 60000), ip: client.ip ?? null })
      .execute();
    const to = this.deliveryAddress(user.email);
    const forLab = to !== user.email;
    await this.mailer.send(
      to,
      loginCodeEmail({ baseUrl: this.env.values.APP_PUBLIC_URL, fullName: user.full_name, account: user.email, code, minutes: OTP_MINUTES, forLab }),
      { sensitive: true },
    );
    return {
      challengeId: id,
      maskedEmail: maskEmail(to),
      ...(this.env.values.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  async resendOtp(challengeId: string, client: ClientInfo) {
    const row = await this.database.db.selectFrom('login_challenges').selectAll().where('id', '=', challengeId).executeTakeFirst();
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new ApiError(400, 'OTP_EXPIRED', 'El código venció. Vuelve a ingresar tu contraseña.');
    }
    const wait = OTP_RESEND_SECONDS * 1000 - (Date.now() - row.created_at.getTime());
    if (wait > 0) throw new ApiError(429, 'OTP_WAIT', `Espera ${Math.ceil(wait / 1000)} segundos para pedir otro código.`);
    const user = await this.database.db.selectFrom('users').select(['id', 'email', 'full_name']).where('id', '=', row.user_id).executeTakeFirstOrThrow();
    return this.createChallenge(user, client);
  }

  async verifyOtp(challengeId: string, code: string, client: ClientInfo, browserSession?: string) {
    const row = await this.database.db.selectFrom('login_challenges').selectAll().where('id', '=', challengeId).executeTakeFirst();
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new ApiError(400, 'OTP_EXPIRED', 'El código venció o ya se usó. Vuelve a ingresar tu contraseña.');
    }
    await this.assertBrowserAccount(browserSession, row.user_id);
    if (row.attempts >= row.max_attempts) {
      throw new ApiError(429, 'OTP_LOCKED', 'Superaste los intentos. Vuelve a ingresar tu contraseña para recibir otro código.');
    }
    if (!safeEqual(row.code_hash, this.otpHash(row.id, code))) {
      const attempts = row.attempts + 1;
      await this.database.db
        .updateTable('login_challenges')
        .set({ attempts, ...(attempts >= row.max_attempts ? { used_at: new Date() } : {}) })
        .where('id', '=', row.id)
        .execute();
      const left = row.max_attempts - attempts;
      if (left <= 0) throw new ApiError(429, 'OTP_LOCKED', 'Superaste los intentos. Vuelve a ingresar tu contraseña para recibir otro código.');
      throw new ApiError(400, 'OTP_INVALID', `Código incorrecto. Te ${left === 1 ? 'queda 1 intento' : `quedan ${left} intentos`}.`);
    }
    const consumed = await this.database.db
      .updateTable('login_challenges')
      .set({ used_at: new Date() })
      .where('id', '=', row.id)
      .where('used_at', 'is', null)
      .executeTakeFirst();
    if (!Number(consumed.numUpdatedRows)) throw new ApiError(400, 'OTP_EXPIRED', 'El código ya se usó.');
    await this.audit(row.user_id, 'login', row.user_id, { method: 'otp' });
    return { userId: row.user_id, session: await this.issueSession(row.user_id, 'otp', client) };
  }

  /* ---------- Dispositivos de confianza ---------- */

  async trustDevice(userId: string, client: ClientInfo) {
    const token = randomToken();
    await this.database.db
      .insertInto('trusted_devices')
      .values({ user_id: userId, token_hash: sha256(token), label: deviceLabel(client.userAgent), expires_at: new Date(Date.now() + TRUSTED_DAYS * 86400000) })
      .execute();
    return token;
  }

  private async useTrustedDevice(userId: string, tokens: string[]) {
    const row = await this.database.db
      .selectFrom('trusted_devices')
      .select(['id', 'expires_at', 'revoked_at'])
      .where('token_hash', 'in', tokens.map(sha256))
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
    if (!row) return false;
    await this.database.db.updateTable('trusted_devices').set({ last_used_at: new Date() }).where('id', '=', row.id).execute();
    return true;
  }

  /* ---------- Renovación y cierre ---------- */

  async refresh(rawToken: string | undefined, client: ClientInfo) {
    if (!rawToken) throw new ApiError(401, 'UNAUTHENTICATED', 'No hay sesión para renovar');
    const row = await this.database.db.selectFrom('refresh_tokens').selectAll().where('token_hash', '=', sha256(rawToken)).executeTakeFirst();
    if (!row || row.expires_at.getTime() < Date.now()) throw new ApiError(401, 'UNAUTHENTICATED', 'La sesión expiró');
    if (row.revoked_at) {
      if (row.replaced_at && Date.now() - row.replaced_at.getTime() < ROTATION_GRACE_MS) {
        throw new ApiError(401, 'SESSION_RACE', 'La sesión se renovó en otra pestaña');
      }
      if (row.replaced_at) {
        await this.revokeAll(row.user_id);
        await this.audit(null, 'session.reuse_detected', row.user_id, { ip: client.ip ?? null, family: row.family_id });
        throw new ApiError(401, 'SESSION_REUSED', 'Por seguridad cerramos tu sesión en todos los dispositivos. Vuelve a ingresar.');
      }
      throw new ApiError(401, 'UNAUTHENTICATED', 'La sesión se cerró');
    }
    const rotated = await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date(), replaced_at: new Date() })
      .where('id', '=', row.id)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();
    if (!Number(rotated.numUpdatedRows)) throw new ApiError(401, 'SESSION_RACE', 'La sesión se renovó en otra pestaña');
    return this.issueSession(row.user_id, (row.auth_method as AuthMethod | null) ?? 'password', client, row.family_id ?? undefined);
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const row = await this.database.db.selectFrom('refresh_tokens').select(['family_id', 'user_id']).where('token_hash', '=', sha256(rawToken)).executeTakeFirst();
    if (!row) return;
    let query = this.database.db.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('revoked_at', 'is', null);
    query = row.family_id ? query.where('family_id', '=', row.family_id) : query.where('token_hash', '=', sha256(rawToken));
    await query.execute();
  }

  /**
   * One account per browser: every tab shares the refresh cookie, so a second login with another
   * account would silently take over the session the other tabs are still showing.
   */
  async assertBrowserAccount(rawToken: string | undefined, userId: string) {
    if (!rawToken) return;
    const owner = await this.database.db
      .selectFrom('refresh_tokens as t')
      .innerJoin('users as u', 'u.id', 't.user_id')
      .select(['u.id', 'u.full_name'])
      .where('t.token_hash', '=', sha256(rawToken))
      .where('t.revoked_at', 'is', null)
      .where('t.expires_at', '>', new Date())
      .where('u.status', '=', 'active')
      .executeTakeFirst();
    if (owner && owner.id !== userId) {
      throw new ApiError(409, 'SESSION_ACTIVE', `Este navegador ya tiene abierta la sesión de ${owner.full_name}. Ciérrala antes de entrar con otra cuenta.`);
    }
  }

  /** For sign-ins that only reveal the account after verifying it (passkey, face): undo the new session if it collides. */
  async keepBrowserAccount(rawToken: string | undefined, session: Session) {
    try {
      await this.assertBrowserAccount(rawToken, session.user.id);
    } catch (error) {
      await this.logout(session.refreshToken);
      throw error;
    }
  }

  /** Closes every session and forgets every trusted device of the user. */
  async revokeAll(userId: string) {
    const now = new Date();
    await this.database.db.updateTable('refresh_tokens').set({ revoked_at: now }).where('user_id', '=', userId).where('revoked_at', 'is', null).execute();
    await this.database.db.updateTable('trusted_devices').set({ revoked_at: now }).where('user_id', '=', userId).where('revoked_at', 'is', null).execute();
  }

  async logoutEverywhere(user: AuthUser) {
    await this.revokeAll(user.id);
    await this.audit(user.id, 'session.revoke_all', user.id);
  }

  /* ---------- Contraseñas ---------- */

  async changePassword(user: AuthUser, current: string, next: string, client: ClientInfo) {
    if (!passwordIsStrong(next)) throw weakPassword();
    const row = await this.database.db.selectFrom('users').select(['password_hash']).where('id', '=', user.id).executeTakeFirstOrThrow();
    const valid = await argon2.verify(row.password_hash, current).catch(() => false);
    if (!valid) throw new ApiError(400, 'INVALID_PASSWORD', 'La contraseña actual no coincide');
    if (current === next) throw new ApiError(400, 'SAME_PASSWORD', 'La nueva contraseña debe ser distinta a la actual');
    const password_hash = await argon2.hash(next, { type: argon2.argon2id });
    await this.database.withTx(async (trx) => {
      await trx.updateTable('users').set({ password_hash, must_change_password: false, updated_at: new Date() }).where('id', '=', user.id).execute();
      await trx.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('user_id', '=', user.id).where('revoked_at', 'is', null).execute();
    });
    await this.audit(user.id, 'password.change', user.id);
    return this.issueSession(user.id, user.amr, client);
  }

  async forgot(email: string) {
    const user = await this.findByEmail(email);
    if (!user || user.status !== 'active') return;
    const token = randomToken();
    await this.database.db
      .insertInto('password_reset_tokens')
      .values({ user_id: user.id, token_hash: sha256(token), expires_at: new Date(Date.now() + 3600_000) })
      .execute();
    const link = `${this.env.values.APP_PUBLIC_URL.replace(/\/$/, '')}/restablecer?token=${token}`;
    this.events.emit(DomainEvents.PasswordReset, { email: this.deliveryAddress(user.email), fullName: user.full_name, link });
  }

  async reset(token: string, password: string) {
    if (!passwordIsStrong(password)) throw weakPassword();
    const row = await this.database.db.selectFrom('password_reset_tokens').selectAll().where('token_hash', '=', sha256(token)).executeTakeFirst();
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new ApiError(400, 'INVALID_TOKEN', 'El enlace no sirve o ya venció');
    }
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    await this.database.withTx(async (trx) => {
      await trx
        .updateTable('users')
        .set({ password_hash, must_change_password: false, failed_logins: 0, locked_until: null, updated_at: new Date() })
        .where('id', '=', row.user_id)
        .execute();
      await trx.updateTable('password_reset_tokens').set({ used_at: new Date() }).where('id', '=', row.id).execute();
      await trx.updateTable('refresh_tokens').set({ revoked_at: new Date() }).where('user_id', '=', row.user_id).execute();
    });
    await this.audit(row.user_id, 'password.reset', row.user_id);
  }

  async me(userId: string) {
    const user = await this.database.db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    if (user.status !== 'active') throw new ApiError(401, 'ACCOUNT_DISABLED', 'Tu cuenta está desactivada');
    const [role, companion] = await Promise.all([this.roleOf(user.id), this.companionOf(user.id)]);
    return this.toPublic(user, role, companion, await legalPending(this.database, user.id, role));
  }

  async setGuardianConsent(userId: string, actorId: string) {
    const updated = await this.database.db
      .updateTable('users')
      .set({ guardian_consent_at: new Date(), updated_at: new Date() })
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    await this.audit(actorId, 'guardian.consent', userId);
    const role = await this.roleOf(userId);
    return this.toPublic(updated, role);
  }
}
