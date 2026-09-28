import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../errors";
import type { AuthUser, Role } from "../types";

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "Token requerido."));
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch {
    next(new AppError(401, "UNAUTHORIZED", "Token inválido o expirado."));
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Token requerido."));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "No tienes permiso para esta acción."));
    }
    next();
  };
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: "7d" });
}