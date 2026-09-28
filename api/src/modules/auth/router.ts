import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { query } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";
import { requireAuth, signToken } from "../../shared/middleware/auth";
import type { AuthUser, Role } from "../../shared/types";
import { config } from "../../shared/config";
import { sendResetEmail } from "./mail";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["student", "teacher", "admin"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(row: { id: string; email: string; name: string; role: string }): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
  };
}

authRouter.post("/auth/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const role: Role = body.role === "teacher" || body.role === "admin" ? "student" : "student";
    // Self-register always student (teachers/admins via seed)
    const email = body.email.toLowerCase().trim();
    const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) throw new AppError(409, "EMAIL_TAKEN", "El correo ya está registrado.");

    const password_hash = await argon2.hash(body.password);
    const inserted = await query<{ id: string; email: string; name: string; role: string }>(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, password_hash, body.name.trim(), role],
    );
    const user = publicUser(inserted.rows[0]);
    res.status(201).json({ accessToken: signToken(user), user });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, "INVALID_BODY", "Datos de registro inválidos."));
    next(err);
  }
});

authRouter.post("/auth/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const found = await query<{ id: string; email: string; name: string; role: string; password_hash: string }>(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
      [email],
    );
    if (!found.rowCount) throw new AppError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
    const row = found.rows[0];
    const ok = await argon2.verify(row.password_hash, body.password);
    if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
    const user = publicUser(row);
    res.json({ accessToken: signToken(user), user });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, "INVALID_BODY", "Datos de login inválidos."));
    next(err);
  }
});

authRouter.post("/auth/logout", requireAuth, (_req, res) => {
  res.status(204).send();
});

authRouter.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").toLowerCase().trim();
    if (email) {
      const found = await query<{ id: string; email: string }>(
        "SELECT id, email FROM users WHERE email = $1",
        [email],
      );
      if (found.rowCount) {
        const raw = randomBytes(32).toString("hex");
        const token_hash = createHash("sha256").update(raw).digest("hex");
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        await query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
          [found.rows[0].id, token_hash, expires.toISOString()],
        );
        const resetUrl = `${config.appPublicUrl}/reset-password?token=${raw}`;
        try {
          await sendResetEmail(found.rows[0].email, resetUrl);
        } catch {
          // No enumerar usuarios ni revelar fallo de correo al cliente.
          console.error("forgot-password: envío de correo falló (detalle omitido)");
        }
      }
    }
    res.status(204).send();
  } catch (err) {
    // Contrato: siempre 204 (anti-enumeración).
    console.error("forgot-password: error interno");
    res.status(204).send();
  }
});

authRouter.post("/auth/reset-password", async (req, res, next) => {
  try {
    const token = String(req.body?.token ?? "");
    const password = String(req.body?.password ?? req.body?.newPassword ?? "");
    if (!token) {
      throw new AppError(400, "INVALID_TOKEN", "Token inválido o expirado.");
    }
    if (password.length < 8) {
      throw new AppError(400, "WEAK_PASSWORD", "La contraseña debe tener al menos 8 caracteres.");
    }
    const token_hash = createHash("sha256").update(token).digest("hex");
    const found = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [token_hash],
    );
    if (!found.rowCount) throw new AppError(400, "INVALID_TOKEN", "Token inválido o expirado.");
    const password_hash = await argon2.hash(password);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, found.rows[0].user_id]);
    await query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [found.rows[0].id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
