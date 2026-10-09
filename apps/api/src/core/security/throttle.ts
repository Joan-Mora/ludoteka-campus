import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { ApiError } from '../errors/api-error';

type Req = { ip?: string; body?: Record<string, unknown> };

/** Who is being targeted: the account for password and recovery, the challenge for codes and passkeys. */
function subject(req: Req) {
  const body = req.body ?? {};
  const value = body.email ?? body.challengeId ?? '';
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 200) : '';
}

/**
 * Two windows. `ip` is generous because a whole classroom shares the school's public IP;
 * `subject` is tight and keyed by IP plus account or challenge, so one person cannot hammer one target.
 */
export const throttlerModule = ThrottlerModule.forRoot({
  throttlers: [
    { name: 'ip', ttl: 15 * 60_000, limit: 300, getTracker: (req: Req) => req.ip ?? 'unknown' },
    { name: 'subject', ttl: 5 * 60_000, limit: 10, getTracker: (req: Req) => `${req.ip ?? 'unknown'}|${subject(req)}` },
  ],
});

/** Applied with `@UseGuards` only on login, codes, recovery, facial and passkey routes. */
@Injectable()
export class AuthThrottleGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(_context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire || detail.timeToExpire));
    throw new ApiError(429, 'TOO_MANY_REQUESTS', `Demasiados intentos. Espera ${seconds > 90 ? `${Math.ceil(seconds / 60)} minutos` : `${seconds} segundos`} y vuelve a intentarlo.`, { retryAfter: seconds });
  }
}
