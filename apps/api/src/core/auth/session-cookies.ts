import type { Request, Response } from 'express';
import type { AppEnv } from '../config/env';
import { ApiError } from '../errors/api-error';
import type { AuthUser } from './auth.decorators';

export const REFRESH_COOKIE = 'eq_refresh';
export const DEVICE_COOKIE = 'lk_device';
const AUTH_PATH = '/api/auth';

function base(env: AppEnv) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env.NODE_ENV === 'production', path: AUTH_PATH };
}

export function setRefreshCookie(res: Response, env: AppEnv, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...base(env), maxAge: 14 * 86400000 });
}

export function clearRefreshCookie(res: Response, env: AppEnv) {
  res.clearCookie(REFRESH_COOKIE, base(env));
}

export function setDeviceCookie(res: Response, env: AppEnv, token: string, days: number) {
  res.cookie(DEVICE_COOKIE, token, { ...base(env), maxAge: days * 86400000 });
}

export function clearDeviceCookie(res: Response, env: AppEnv) {
  res.clearCookie(DEVICE_COOKIE, base(env));
}

export function clientInfo(req: Request) {
  return { ip: req.ip || req.socket.remoteAddress || null, userAgent: req.get('user-agent') ?? null };
}

/** Second factors (passkeys, facial) can only be added from a session that already proved access to the mailbox or a device. */
export function requireVerifiedSession(user: AuthUser) {
  if (!['otp', 'trusted_device', 'passkey'].includes(user.amr)) {
    throw new ApiError(403, 'STEP_UP_REQUIRED', 'Por seguridad, cierra sesión y vuelve a entrar con tu contraseña y el código del correo para registrar este acceso.');
  }
}
