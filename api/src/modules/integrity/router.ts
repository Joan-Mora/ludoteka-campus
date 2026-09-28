import { Router } from "express";
import { config } from "../../shared/config";
import { query } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";
import { requireAuth, type AuthedRequest } from "../../shared/middleware/auth";

const ALLOWED = new Set(["blur", "visibility", "escape", "fullscreen_exit"]);

export const integrityRouter = Router();

integrityRouter.post("/attempts/:id/integrity-events", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const type = String(req.body?.type ?? "");
    if (!ALLOWED.has(type)) throw new AppError(400, "INVALID_TYPE", "Tipo de integridad inválido.");

    const attempt = await query<{ id: string; user_id: string; status: string }>(
      `SELECT id, user_id, status FROM quiz_attempts WHERE id = $1`,
      [req.params.id],
    );
    if (!attempt.rowCount) throw new AppError(404, "NOT_FOUND", "Intento no encontrado.");
    if (attempt.rows[0].user_id !== req.user!.id) throw new AppError(403, "FORBIDDEN", "No es tu intento.");

    const at = req.body?.at ? new Date(String(req.body.at)) : new Date();
    await query(
      `INSERT INTO integrity_events (attempt_id, type, at) VALUES ($1, $2, $3)`,
      [attempt.rows[0].id, type, at.toISOString()],
    );

    const count = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM integrity_events WHERE attempt_id = $1`,
      [attempt.rows[0].id],
    );
    const n = Number(count.rows[0].c);
    let status = attempt.rows[0].status;
    if (status === "active" && n >= config.integritySuspendAfter) {
      await query(`UPDATE quiz_attempts SET status = 'suspended' WHERE id = $1`, [attempt.rows[0].id]);
      status = "suspended";
    }

    res.status(201).json({ recorded: true, integrityCount: n, status });
  } catch (err) {
    next(err);
  }
});