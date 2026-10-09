import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { sql } from 'kysely';
import { FACE_MODEL_ID, LIVENESS_ACTIONS, type LivenessAction } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { decryptVector, deriveKey, encryptVector, sha256 } from '../../core/common/crypto';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { DomainEvents, type GuardianFacialRevokedEvent } from '../../core/events/domain-events';
import { IdentityService } from '../identity/public-api';

type Reason =
  | 'ok' | 'unknown_email' | 'no_template' | 'no_consent' | 'guardian_required'
  | 'locked' | 'liveness' | 'challenge' | 'distance' | 'ambiguous' | 'quality';

interface Challenge {
  action: LivenessAction;
  expiresAt: number;
  used: boolean;
}

const CHALLENGE_TTL_MS = 90_000;
/** Max distance between each enrollment sample and their mean; above this the capture is too noisy to trust. */
const MAX_SAMPLE_SPREAD = 0.42;
/** In identification mode the best match must beat the runner-up by this margin. */
const IDENTIFY_MARGIN = 0.08;

export function euclidean(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function meanVector(samples: number[][]) {
  const dim = samples[0]?.length ?? 0;
  const out = new Array<number>(dim).fill(0);
  for (const sample of samples) for (let i = 0; i < dim; i++) out[i]! += sample[i]! / samples.length;
  return out;
}

@Injectable()
export class BiometricsService {
  private readonly challenges = new Map<string, Challenge>();
  private readonly key: Buffer;

  constructor(
    private readonly database: DatabaseService,
    private readonly env: Env,
    private readonly identity: IdentityService,
  ) {
    this.key = deriveKey(env.values.FACIAL_ENC_KEY || `facial:${env.values.JWT_SECRET}`);
  }

  issueChallenge() {
    const now = Date.now();
    for (const [id, challenge] of this.challenges) if (challenge.expiresAt < now) this.challenges.delete(id);
    const action = LIVENESS_ACTIONS[Math.floor(Math.random() * LIVENESS_ACTIONS.length)]!;
    const challengeId = randomUUID();
    this.challenges.set(challengeId, { action, expiresAt: now + CHALLENGE_TTL_MS, used: false });
    return { challengeId, action, expiresAt: new Date(now + CHALLENGE_TTL_MS).toISOString() };
  }

  private consumeChallenge(challengeId: string) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.used || challenge.expiresAt < Date.now()) return false;
    challenge.used = true;
    return true;
  }

  private async log(entry: { userId?: string | null; email?: string; ip?: string; mode: 'verify' | 'identify' | 'enroll'; success: boolean; reason: Reason; distance?: number | null }) {
    await this.database.db
      .insertInto('face_attempts')
      .values({
        user_id: entry.userId ?? null,
        email_hash: entry.email ? sha256(entry.email) : null,
        ip: entry.ip ?? null,
        mode: entry.mode,
        success: entry.success,
        reason: entry.reason,
        distance: entry.distance == null ? null : Number(entry.distance.toFixed(4)),
      })
      .execute();
  }

  private async failuresSince(filter: { userId?: string; ip?: string }) {
    const window = new Date(Date.now() - this.env.values.FACIAL_LOCK_MINUTES * 60_000);
    let query = this.database.db
      .selectFrom('face_attempts')
      .select(['success', 'created_at'])
      .where('created_at', '>', window)
      .where('mode', '!=', 'enroll')
      .orderBy('created_at', 'desc')
      .limit(20);
    if (filter.userId) query = query.where('user_id', '=', filter.userId);
    else if (filter.ip) query = query.where('ip', '=', filter.ip).where('mode', '=', 'identify');
    const rows = await query.execute();
    const failures: Date[] = [];
    for (const row of rows) {
      if (row.success) break;
      failures.push(new Date(row.created_at));
    }
    return failures;
  }

  private async lockState(filter: { userId?: string; ip?: string }) {
    const failures = await this.failuresSince(filter);
    const limit = this.env.values.FACIAL_LOCK_ATTEMPTS;
    if (failures.length < limit) return { locked: false as const, remaining: limit - failures.length, until: null };
    const oldestCounted = failures[limit - 1]!;
    const until = new Date(oldestCounted.getTime() + this.env.values.FACIAL_LOCK_MINUTES * 60_000);
    return { locked: true as const, remaining: 0, until };
  }

  private async consentProblem(userId: string): Promise<Reason | null> {
    const user = await this.database.db.selectFrom('users').select(['is_minor', 'guardian_consent_at']).where('id', '=', userId).executeTakeFirst();
    if (!user) return 'unknown_email';
    if (user.is_minor && !user.guardian_consent_at) return 'guardian_required';
    const consent = await this.database.db
      .selectFrom('facial_consents')
      .select('id')
      .where('user_id', '=', userId)
      .where('policy_version', '=', this.env.values.FACIAL_POLICY_VERSION)
      .executeTakeFirst();
    return consent ? null : 'no_consent';
  }

  private async template(userId: string) {
    const row = await this.database.db.selectFrom('face_templates').selectAll().where('user_id', '=', userId).executeTakeFirst();
    if (!row || row.model_id !== FACE_MODEL_ID) return null;
    return decryptVector(this.key, row, row.user_id);
  }

  async status(userId: string) {
    const consent = await this.database.db
      .selectFrom('facial_consents')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('accepted_at', 'desc')
      .executeTakeFirst();
    const template = await this.database.db
      .selectFrom('face_templates')
      .select(['model_id', 'samples', 'spread', 'updated_at'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    const user = await this.database.db.selectFrom('users').select(['is_minor', 'guardian_consent_at']).where('id', '=', userId).executeTakeFirst();
    const current = consent?.policy_version === this.env.values.FACIAL_POLICY_VERSION;
    const lock = await this.lockState({ userId });
    return {
      policyVersion: this.env.values.FACIAL_POLICY_VERSION,
      consented: Boolean(current),
      needsReconsent: Boolean(consent) && !current,
      guardianRequired: Boolean(user?.is_minor && !user.guardian_consent_at),
      enrolled: Boolean(template && template.model_id === FACE_MODEL_ID),
      samples: template?.samples ?? 0,
      quality: template ? Math.max(0, Math.round((1 - template.spread / MAX_SAMPLE_SPREAD) * 100)) : null,
      enrolledAt: template?.updated_at ?? null,
      maxDistance: this.env.values.FACIAL_MAX_DISTANCE,
      lockedUntil: lock.until,
      remainingAttempts: lock.remaining,
    };
  }

  async consent(user: AuthUser) {
    await this.database.db
      .insertInto('facial_consents')
      .values({ user_id: user.id, policy_version: this.env.values.FACIAL_POLICY_VERSION })
      .execute();
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: user.id, action: 'facial.consent', entity: 'facial_consents', entity_id: user.id, meta: JSON.stringify({ policy: this.env.values.FACIAL_POLICY_VERSION }) })
      .execute();
    return this.status(user.id);
  }

  async enroll(user: AuthUser, input: { samples: number[][]; challengeId: string }, ip?: string) {
    const problem = await this.consentProblem(user.id);
    if (problem === 'guardian_required') {
      throw new ApiError(403, 'GUARDIAN_CONSENT_REQUIRED', 'Un menor necesita la autorización del acudiente antes del registro facial');
    }
    if (problem) throw new ApiError(403, 'CONSENT_REQUIRED', 'Falta aceptar la política de datos biométricos vigente');
    if (!this.consumeChallenge(input.challengeId)) {
      await this.log({ userId: user.id, ip, mode: 'enroll', success: false, reason: 'liveness' });
      throw new ApiError(400, 'LIVENESS', 'La prueba de vida venció o ya se usó. Repite el gesto.');
    }
    const mean = meanVector(input.samples);
    const spread = Math.max(...input.samples.map((sample) => euclidean(sample, mean)));
    if (spread > MAX_SAMPLE_SPREAD) {
      await this.log({ userId: user.id, ip, mode: 'enroll', success: false, reason: 'quality', distance: spread });
      throw new ApiError(400, 'QUALITY', 'Las muestras no se parecen entre sí. Busca buena luz, quédate quieto y repite.');
    }
    const sealed = encryptVector(this.key, mean, user.id);
    const now = new Date();
    await this.database.db
      .insertInto('face_templates')
      .values({ user_id: user.id, model_id: FACE_MODEL_ID, ...sealed, samples: input.samples.length, spread, updated_at: now })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({ model_id: FACE_MODEL_ID, ...sealed, samples: input.samples.length, spread, updated_at: now }),
      )
      .execute();
    await this.log({ userId: user.id, ip, mode: 'enroll', success: true, reason: 'ok', distance: spread });
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: user.id, action: 'facial.enroll', entity: 'face_templates', entity_id: user.id, meta: JSON.stringify({ samples: input.samples.length, spread }) })
      .execute();
    return this.status(user.id);
  }

  async remove(userId: string) {
    await this.database.db.deleteFrom('face_templates').where('user_id', '=', userId).execute();
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: userId, action: 'facial.delete', entity: 'face_templates', entity_id: userId, meta: null })
      .execute();
    return { ok: true };
  }

  @OnEvent(DomainEvents.GuardianFacialRevoked)
  async onGuardianRevoked(event: GuardianFacialRevokedEvent) {
    await this.database.db.deleteFrom('face_templates').where('user_id', '=', event.studentId).execute();
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: event.guardianId, action: 'facial.delete', entity: 'face_templates', entity_id: event.studentId, meta: JSON.stringify({ reason: 'guardian_revoked' }) })
      .execute();
  }

  async attempts(userId: string) {
    return this.database.db
      .selectFrom('face_attempts')
      .select(['id', 'mode', 'success', 'reason', 'distance', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(15)
      .execute();
  }

  async login(input: { email?: string; descriptor: number[]; challengeId: string }, ip?: string) {
    if (input.email) return this.verify(input.email.trim().toLowerCase(), input.descriptor, input.challengeId, ip);
    return this.identify(input.descriptor, input.challengeId, ip);
  }

  private async verify(email: string, descriptor: number[], challengeId: string, ip?: string) {
    const user = await this.database.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (!user) {
      await this.log({ email, ip, mode: 'verify', success: false, reason: 'unknown_email' });
      throw new ApiError(401, 'NO_MATCH', 'No reconocimos el rostro. Usa tu contraseña.');
    }
    const lock = await this.lockState({ userId: user.id });
    if (lock.locked) {
      await this.log({ userId: user.id, email, ip, mode: 'verify', success: false, reason: 'locked' });
      throw new ApiError(423, 'FACE_LOCKED', `Acceso facial bloqueado por intentos fallidos. Intenta después de las ${lock.until.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })} o usa tu contraseña.`);
    }
    if (!this.consumeChallenge(challengeId)) {
      await this.log({ userId: user.id, email, ip, mode: 'verify', success: false, reason: 'liveness' });
      throw new ApiError(400, 'LIVENESS', 'La prueba de vida venció. Repite el gesto.');
    }
    const problem = await this.consentProblem(user.id);
    if (problem) {
      await this.log({ userId: user.id, email, ip, mode: 'verify', success: false, reason: problem });
      throw new ApiError(403, 'FACE_UNAVAILABLE', problem === 'guardian_required' ? 'Esta cuenta necesita autorización del acudiente.' : 'Esta cuenta no tiene acceso facial activo. Usa tu contraseña.');
    }
    const stored = await this.template(user.id);
    if (!stored) {
      await this.log({ userId: user.id, email, ip, mode: 'verify', success: false, reason: 'no_template' });
      throw new ApiError(401, 'NO_TEMPLATE', 'No hay un rostro registrado para esta cuenta. Usa tu contraseña.');
    }
    const distance = euclidean(descriptor, stored);
    if (distance > this.env.values.FACIAL_MAX_DISTANCE) {
      await this.log({ userId: user.id, email, ip, mode: 'verify', success: false, reason: 'distance', distance });
      const after = await this.lockState({ userId: user.id });
      throw new ApiError(401, 'NO_MATCH', after.locked
        ? 'No coincidió y el acceso facial quedó bloqueado. Usa tu contraseña.'
        : `No reconocimos el rostro. Te quedan ${after.remaining} intentos antes del bloqueo.`);
    }
    await this.log({ userId: user.id, email, ip, mode: 'verify', success: true, reason: 'ok', distance });
    return { ...(await this.identity.issueSession(user.id, 'facial', { ip })), distance };
  }

  private async identify(descriptor: number[], challengeId: string, ip?: string) {
    const lock = await this.lockState({ ip });
    if (lock.locked) {
      await this.log({ ip, mode: 'identify', success: false, reason: 'locked' });
      throw new ApiError(423, 'FACE_LOCKED', 'Demasiados intentos desde este equipo. Escribe tu correo o usa la contraseña.');
    }
    if (!this.consumeChallenge(challengeId)) {
      await this.log({ ip, mode: 'identify', success: false, reason: 'liveness' });
      throw new ApiError(400, 'LIVENESS', 'La prueba de vida venció. Repite el gesto.');
    }
    const rows = await this.database.db
      .selectFrom('face_templates')
      .innerJoin('users', 'users.id', 'face_templates.user_id')
      .select(['face_templates.user_id', 'face_templates.ciphertext', 'face_templates.iv', 'face_templates.tag'])
      .where('face_templates.model_id', '=', FACE_MODEL_ID)
      .where(sql<boolean>`(users.is_minor = false OR users.guardian_consent_at IS NOT NULL)`)
      .where(({ exists, selectFrom }) =>
        exists(
          selectFrom('facial_consents')
            .select('facial_consents.id')
            .whereRef('facial_consents.user_id', '=', 'face_templates.user_id')
            .where('facial_consents.policy_version', '=', this.env.values.FACIAL_POLICY_VERSION),
        ),
      )
      .execute();
    const scored = rows
      .map((row) => ({ userId: row.user_id, distance: euclidean(descriptor, decryptVector(this.key, row, row.user_id)) }))
      .sort((a, b) => a.distance - b.distance);
    const best = scored[0];
    const second = scored[1];
    if (!best || best.distance > this.env.values.FACIAL_MAX_DISTANCE) {
      await this.log({ ip, mode: 'identify', success: false, reason: 'distance', distance: best?.distance ?? null });
      throw new ApiError(401, 'NO_MATCH', 'No encontramos un rostro registrado que coincida. Escribe tu correo o usa la contraseña.');
    }
    if (second && second.distance - best.distance < IDENTIFY_MARGIN) {
      await this.log({ ip, mode: 'identify', success: false, reason: 'ambiguous', distance: best.distance });
      throw new ApiError(401, 'AMBIGUOUS', 'El rostro se parece a más de una cuenta. Escribe tu correo para confirmar.');
    }
    await this.log({ userId: best.userId, ip, mode: 'identify', success: true, reason: 'ok', distance: best.distance });
    return { ...(await this.identity.issueSession(best.userId, 'facial', { ip })), distance: best.distance };
  }

  async purgeExpired() {
    const days = this.env.values.FACIAL_RETENTION_DAYS;
    if (days <= 0) return 0;
    const result = await this.database.db
      .deleteFrom('face_templates')
      .where('updated_at', '<', new Date(Date.now() - days * 86400000))
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}
