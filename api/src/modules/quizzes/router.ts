import { randomBytes } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { query } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";
import { requireAuth, requireRoles, type AuthedRequest } from "../../shared/middleware/auth";

export const quizzesRouter = Router();

function sessionCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

quizzesRouter.get("/questions", requireAuth, requireRoles("teacher", "admin"), async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, prompt, options, correct_option_id AS "correctOptionId", topic, difficulty, active
       FROM questions WHERE active = true ORDER BY created_at`,
    );
    res.json({ items: rows.rows });
  } catch (err) {
    next(err);
  }
});

const questionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
  correctOptionId: z.string(),
  topic: z.string().optional(),
  difficulty: z.string().optional(),
});

quizzesRouter.post("/questions", requireAuth, requireRoles("teacher", "admin"), async (req: AuthedRequest, res, next) => {
  try {
    const body = questionSchema.parse(req.body);
    const inserted = await query(
      `INSERT INTO questions (prompt, options, correct_option_id, topic, difficulty, created_by)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6)
       RETURNING id, prompt, options, correct_option_id AS "correctOptionId", topic, difficulty`,
      [body.prompt, JSON.stringify(body.options), body.correctOptionId, body.topic ?? null, body.difficulty ?? null, req.user!.id],
    );
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, "INVALID_BODY", "Pregunta inválida."));
    next(err);
  }
});

quizzesRouter.patch("/questions/:id", requireAuth, requireRoles("teacher", "admin"), async (req, res, next) => {
  try {
    const body = questionSchema.partial().parse(req.body);
    const updated = await query(
      `UPDATE questions SET
         prompt = COALESCE($2, prompt),
         options = COALESCE($3::jsonb, options),
         correct_option_id = COALESCE($4, correct_option_id),
         topic = COALESCE($5, topic),
         difficulty = COALESCE($6, difficulty)
       WHERE id = $1
       RETURNING id, prompt, options, correct_option_id AS "correctOptionId", topic, difficulty`,
      [
        req.params.id,
        body.prompt ?? null,
        body.options ? JSON.stringify(body.options) : null,
        body.correctOptionId ?? null,
        body.topic ?? null,
        body.difficulty ?? null,
      ],
    );
    if (!updated.rowCount) throw new AppError(404, "NOT_FOUND", "Pregunta no encontrada.");
    res.json(updated.rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, "INVALID_BODY", "Pregunta inválida."));
    next(err);
  }
});

quizzesRouter.delete("/questions/:id", requireAuth, requireRoles("teacher", "admin"), async (req, res, next) => {
  try {
    const updated = await query(`UPDATE questions SET active = false WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!updated.rowCount) throw new AppError(404, "NOT_FOUND", "Pregunta no encontrada.");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

quizzesRouter.post("/sessions", requireAuth, requireRoles("teacher", "admin"), async (req: AuthedRequest, res, next) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title : null;
    let code = sessionCode();
    for (let i = 0; i < 5; i++) {
      const clash = await query(`SELECT 1 FROM quiz_sessions WHERE code = $1`, [code]);
      if (!clash.rowCount) break;
      code = sessionCode();
    }
    const session = await query<{ id: string; code: string; status: string; title: string | null }>(
      `INSERT INTO quiz_sessions (teacher_id, title, code, status)
       VALUES ($1, $2, $3, 'lobby')
       RETURNING id, code, status, title`,
      [req.user!.id, title, code],
    );
    const qs = await query<{ id: string }>(`SELECT id FROM questions WHERE active = true ORDER BY random() LIMIT 10`);
    let pos = 1;
    for (const q of qs.rows) {
      await query(
        `INSERT INTO quiz_session_questions (session_id, question_id, position) VALUES ($1, $2, $3)`,
        [session.rows[0].id, q.id, pos++],
      );
    }
    res.status(201).json(session.rows[0]);
  } catch (err) {
    next(err);
  }
});

quizzesRouter.post("/sessions/:code/join", requireAuth, requireRoles("student", "teacher", "admin"), async (req: AuthedRequest, res, next) => {
  try {
    const code = String(req.params.code ?? "").toUpperCase();
    const session = await query<{ id: string; status: string }>(
      `SELECT id, status FROM quiz_sessions WHERE code = $1`,
      [code],
    );
    if (!session.rowCount) throw new AppError(404, "SESSION_NOT_FOUND", "Sesión no encontrada.");
    if (session.rows[0].status === "ended") throw new AppError(409, "SESSION_ENDED", "La sesión ya terminó.");
    const existing = await query<{ id: string }>(
      `SELECT id FROM quiz_attempts WHERE session_id = $1 AND user_id = $2`,
      [session.rows[0].id, req.user!.id],
    );
    if (existing.rowCount) {
      res.json({ attemptId: existing.rows[0].id, sessionId: session.rows[0].id });
      return;
    }
    const attempt = await query<{ id: string }>(
      `INSERT INTO quiz_attempts (session_id, user_id, status) VALUES ($1, $2, 'active') RETURNING id`,
      [session.rows[0].id, req.user!.id],
    );
    res.status(201).json({ attemptId: attempt.rows[0].id, sessionId: session.rows[0].id });
  } catch (err) {
    next(err);
  }
});

quizzesRouter.post("/sessions/:id/start", requireAuth, requireRoles("teacher", "admin"), async (req: AuthedRequest, res, next) => {
  try {
    const updated = await query(
      `UPDATE quiz_sessions SET status = 'live', started_at = now()
       WHERE id = $1 AND teacher_id = $2 AND status = 'lobby'
       RETURNING id`,
      [req.params.id, req.user!.id],
    );
    if (!updated.rowCount && req.user!.role !== "admin") {
      throw new AppError(404, "NOT_FOUND", "Sesión no encontrada o no está en lobby.");
    }
    if (!updated.rowCount) {
      await query(`UPDATE quiz_sessions SET status = 'live', started_at = now() WHERE id = $1 AND status = 'lobby'`, [req.params.id]);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

quizzesRouter.post("/sessions/:id/end", requireAuth, requireRoles("teacher", "admin"), async (req: AuthedRequest, res, next) => {
  try {
    await query(
      `UPDATE quiz_sessions SET status = 'ended', ended_at = now() WHERE id = $1`,
      [req.params.id],
    );
    await query(
      `UPDATE quiz_attempts SET status = 'completed' WHERE session_id = $1 AND status = 'active'`,
      [req.params.id],
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

quizzesRouter.get("/sessions/:id", requireAuth, requireRoles("teacher", "admin"), async (req: AuthedRequest, res, next) => {
  try {
    const session = await query(
      `SELECT id, code, status, title, teacher_id AS "teacherId", created_at AS "createdAt"
       FROM quiz_sessions WHERE id = $1`,
      [req.params.id],
    );
    if (!session.rowCount) throw new AppError(404, "NOT_FOUND", "Sesión no encontrada.");
    const ranking = await query(
      `SELECT a.id AS "attemptId", u.name, u.email, a.score, a.status,
              (SELECT COUNT(*)::int FROM integrity_events ie WHERE ie.attempt_id = a.id) AS "integrityCount"
       FROM quiz_attempts a
       JOIN users u ON u.id = a.user_id
       WHERE a.session_id = $1
       ORDER BY a.score DESC, a.joined_at`,
      [req.params.id],
    );
    const questions = await query(
      `SELECT q.id, q.prompt, q.options, sq.position
       FROM quiz_session_questions sq
       JOIN questions q ON q.id = sq.question_id
       WHERE sq.session_id = $1
       ORDER BY sq.position`,
      [req.params.id],
    );
    res.json({ ...session.rows[0], ranking: ranking.rows, questions: questions.rows });
  } catch (err) {
    next(err);
  }
});

quizzesRouter.get("/attempts/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const attempt = await query<{
      id: string; session_id: string; user_id: string; score: number; status: string; teacher_id: string;
    }>(
      `SELECT a.id, a.session_id, a.user_id, a.score, a.status, s.teacher_id
       FROM quiz_attempts a
       JOIN quiz_sessions s ON s.id = a.session_id
       WHERE a.id = $1`,
      [req.params.id],
    );
    if (!attempt.rowCount) throw new AppError(404, "NOT_FOUND", "Intento no encontrado.");
    const row = attempt.rows[0];
    const allowed =
      row.user_id === req.user!.id ||
      row.teacher_id === req.user!.id ||
      req.user!.role === "admin";
    if (!allowed) throw new AppError(403, "FORBIDDEN", "No puedes ver este intento.");

    const questions = await query(
      `SELECT q.id, q.prompt, q.options, sq.position
       FROM quiz_session_questions sq
       JOIN questions q ON q.id = sq.question_id
       WHERE sq.session_id = $1
       ORDER BY sq.position`,
      [row.session_id],
    );
    const answers = await query(
      `SELECT question_id AS "questionId", option_id AS "optionId", correct, points
       FROM attempt_answers WHERE attempt_id = $1`,
      [row.id],
    );
    res.json({
      id: row.id,
      sessionId: row.session_id,
      score: row.score,
      status: row.status,
      questions: questions.rows,
      answers: answers.rows,
    });
  } catch (err) {
    next(err);
  }
});

quizzesRouter.post("/attempts/:id/answers", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const attempt = await query<{ id: string; user_id: string; status: string; session_id: string; score: number }>(
      `SELECT id, user_id, status, session_id, score FROM quiz_attempts WHERE id = $1`,
      [req.params.id],
    );
    if (!attempt.rowCount) throw new AppError(404, "NOT_FOUND", "Intento no encontrado.");
    const a = attempt.rows[0];
    if (a.user_id !== req.user!.id) throw new AppError(403, "FORBIDDEN", "No es tu intento.");
    if (a.status !== "active") throw new AppError(409, "ATTEMPT_LOCKED", "El intento no está activo.");

    const questionId = String(req.body?.questionId ?? "");
    const optionId = req.body?.optionId != null ? String(req.body.optionId) : null;
    const value = req.body?.value != null ? String(req.body.value) : null;
    const elapsedMs = typeof req.body?.elapsedMs === "number" ? req.body.elapsedMs : null;
    if (!questionId) throw new AppError(400, "INVALID_BODY", "questionId requerido.");

    const q = await query<{ correct_option_id: string }>(
      `SELECT q.correct_option_id
       FROM quiz_session_questions sq
       JOIN questions q ON q.id = sq.question_id
       WHERE sq.session_id = $1 AND q.id = $2`,
      [a.session_id, questionId],
    );
    if (!q.rowCount) throw new AppError(404, "QUESTION_NOT_IN_SESSION", "Pregunta no pertenece a la sesión.");

    const correct = optionId != null && optionId === q.rows[0].correct_option_id;
    const points = correct ? 1000 : 0;
    await query(
      `INSERT INTO attempt_answers (attempt_id, question_id, option_id, value, correct, points, elapsed_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (attempt_id, question_id) DO UPDATE SET
         option_id = EXCLUDED.option_id,
         value = EXCLUDED.value,
         correct = EXCLUDED.correct,
         points = EXCLUDED.points,
         elapsed_ms = EXCLUDED.elapsed_ms,
         answered_at = now()`,
      [a.id, questionId, optionId, value, correct, points, elapsedMs],
    );
    const sum = await query<{ total: string }>(
      `SELECT COALESCE(SUM(points),0)::text AS total FROM attempt_answers WHERE attempt_id = $1`,
      [a.id],
    );
    const score = Number(sum.rows[0].total);
    await query(`UPDATE quiz_attempts SET score = $2 WHERE id = $1`, [a.id, score]);
    // AUTO_COMPLETE_ATTEMPT: marca completed cuando respondió todas las preguntas de la sesión
    const totals = await query<{ q: string; a: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM quiz_session_questions WHERE session_id = $1) AS q,
         (SELECT COUNT(*)::text FROM attempt_answers WHERE attempt_id = $2) AS a`,
      [a.session_id, a.id],
    );
    if (Number(totals.rows[0]?.q ?? 0) > 0 && Number(totals.rows[0]?.q) === Number(totals.rows[0]?.a)) {
      await query(`UPDATE quiz_attempts SET status = 'completed' WHERE id = $1 AND status = 'active'`, [a.id]);
    }
    res.json({ correct, points, score });
  } catch (err) {
    next(err);
  }
});
