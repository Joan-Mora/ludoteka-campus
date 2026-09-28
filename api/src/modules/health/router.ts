import { Router } from "express";
import { pingDb } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res, next) => {
  try {
    const up = await pingDb();
    if (!up) throw new AppError(503, "DB_DOWN", "Base de datos no disponible.");
    res.json({ ok: true, db: "up" });
  } catch (err) {
    next(err);
  }
});