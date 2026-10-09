import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@eduquest/contracts';
import { ApiError } from '../errors/api-error';
import { ALLOW_PENDING, AuthUser, IS_PUBLIC, ROLES_KEY, type AuthMethod } from './auth.decorators';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  fullName: string;
  isMinor: boolean;
  amr?: AuthMethod;
  mcp?: boolean;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      if (isPublic) return true;
      throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión');
    }
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      if (isPublic) return true;
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sesión vencida');
    }
    const user: AuthUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
      isMinor: Boolean(payload.isMinor),
      amr: payload.amr ?? 'password',
      mustChangePassword: Boolean(payload.mcp),
    };
    req.user = user;
    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, [ctx.getHandler(), ctx.getClass()]);
    if (user.mustChangePassword && !allowPending && !isPublic) {
      throw new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Primero cambia tu contraseña temporal');
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión');
    if (!roles.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'No tienes permiso para esta acción');
    }
    return true;
  }
}
