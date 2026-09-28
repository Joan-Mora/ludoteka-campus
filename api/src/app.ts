import express from "express";
import cors from "cors";
import { config } from "./shared/config";
import { errorHandler } from "./shared/errors";
import { healthRouter } from "./modules/health/router";
import { authRouter } from "./modules/auth/router";
import { quizzesRouter } from "./modules/quizzes/router";
import { integrityRouter } from "./modules/integrity/router";
import { reportsRouter } from "./modules/reports/router";
import { facialRouter } from "./modules/facial/router";
import { practiceRouter } from "./modules/practice/router";
import { rateLimit } from "./shared/middleware/rateLimit";

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  const api = express.Router();
  api.use(
    "/auth/login",
    rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "auth-login" }),
  );
  api.use(
    "/auth/register",
    rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "auth-register" }),
  );
  api.use(
    "/facial/login",
    rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "facial-login" }),
  );
  api.use(healthRouter);
  api.use(authRouter);
  api.use(quizzesRouter);
  api.use(integrityRouter);
  api.use(reportsRouter);
  api.use(facialRouter);
  api.use(practiceRouter);

  app.use("/api", api);
  app.use(errorHandler);
  return app;
}