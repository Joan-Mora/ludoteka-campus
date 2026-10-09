import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@eduquest/contracts';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PENDING = 'allowPendingPassword';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Reachable while the account still has to replace its temporary password. */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING, true);

export type AuthMethod = 'password' | 'otp' | 'trusted_device' | 'passkey' | 'facial';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  isMinor: boolean;
  /** How this session was opened. Passkeys and facial can only be enrolled from a verified session. */
  amr: AuthMethod;
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
