import { Router } from "express";
import { z } from "zod";
import { query } from "../../shared/db/pool";
import { AppError } from "../../shared/errors";
import { requireAuth, signToken, type AuthedRequest } from "../../shared/middleware/auth";
import { config } from "../../shared/config";
import type { AuthUser, Role } from "../../shared/types";

export const facialRouter = Router();

const IMAGE_FIELD_KEYS = new Set(["image", "photo", "blob", "file", "dataurl"]);

/** RNF-F01: reject raw image fields before validating a facial request body. */
function rejectImageFields(body: unknown): void {
  if (!body || typeof body !== "object" || Array.isArray(body)) return;
  if (Object.keys(body as Record<string, unknown>).some((key) => IMAGE_FIELD_KEYS.has(key.toLowerCase()))) {
    throw new AppError(400, "IMAGE_NOT_ALLOWED", "No se permiten imágenes; solo el embedding on-device.");
  }
}

const consentBody = z.object({
  policyVersion: z.string().min(1),
  accepted: z.literal(true),
});

const embeddingBody = z.object({
  embedding: z.array(z.number()).min(16).max(512),
  modelId: z.string().min(1).max(128),
});

const loginBody = embeddingBody.extend({
  email: z.string().email(),
});

function publicUser(row: { id: string; email: string; name: string; role: string }): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
  };
}

function assertValidEmbedding(embedding: number[], modelId: string) {
  if (modelId.trim().length === 0) {
    throw new AppError(400, "INVALID_EMBEDDING", "modelId inválido.");
  }
  if (embedding.length !== config.facialEmbeddingDim) {
    throw new AppError(
      400,
      "INVALID_EMBEDDING",
      `Embedding debe tener dimensión ${config.facialEmbeddingDim}.`,
    );
  }
  if (!embedding.every((n) => Number.isFinite(n))) {
    throw new AppError(400, "INVALID_EMBEDDING", "Embedding contiene valores no finitos.");
  }
}

/** Cosine similarity; for L2-normalized vectors equals the dot product. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

function parseVector(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      /* fall through */
    }
  }
  return [];
}

facialRouter.post("/facial/consent", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    rejectImageFields(req.body);
    const body = consentBody.parse(req.body);
    if (body.policyVersion !== config.facialPolicyVersion) {
      throw new AppError(
        400,
        "INVALID_BODY",
        `policyVersion debe ser ${config.facialPolicyVersion}.`,
      );
    }
    await query(
      `INSERT INTO facial_consents (user_id, policy_version) VALUES ($1, $2)`,
      [req.user!.id, body.policyVersion],
    );
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, "INVALID_BODY", "Consentimiento inválido."));
    }
    next(err);
  }
});

facialRouter.get("/facial/consent", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const found = await query<{ policy_version: string; accepted_at: Date }>(
      `SELECT policy_version, accepted_at
       FROM facial_consents
       WHERE user_id = $1
       ORDER BY accepted_at DESC
       LIMIT 1`,
      [req.user!.id],
    );
    const policyCurrent = config.facialPolicyVersion;
    if (!found.rowCount) {
      res.json({
        accepted: false,
        policyVersion: null,
        acceptedAt: null,
        policyCurrent,
        needsReconsent: true,
      });
      return;
    }
    const row = found.rows[0];
    const needsReconsent = row.policy_version !== policyCurrent;
    res.json({
      accepted: !needsReconsent,
      policyVersion: row.policy_version,
      acceptedAt: row.accepted_at.toISOString(),
      policyCurrent,
      needsReconsent,
    });
  } catch (err) {
    next(err);
  }
});

async function hasCurrentConsent(userId: string): Promise<boolean> {
  const found = await query(
    `SELECT 1 FROM facial_consents
     WHERE user_id = $1 AND policy_version = $2
     LIMIT 1`,
    [userId, config.facialPolicyVersion],
  );
  return Boolean(found.rowCount);
}

facialRouter.post("/facial/enroll", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    rejectImageFields(req.body);
    const body = embeddingBody.parse(req.body);
    assertValidEmbedding(body.embedding, body.modelId);
    if (!(await hasCurrentConsent(req.user!.id))) {
      throw new AppError(403, "CONSENT_REQUIRED", "Debes aceptar el consentimiento facial.");
    }
    await query(
      `INSERT INTO facial_embeddings (user_id, model_id, vector, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (user_id, model_id)
       DO UPDATE SET vector = EXCLUDED.vector, updated_at = now()`,
      [req.user!.id, body.modelId, JSON.stringify(body.embedding)],
    );
    res.status(201).json({ enrolled: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, "INVALID_EMBEDDING", "Embedding inválido."));
    }
    next(err);
  }
});

facialRouter.post("/facial/login", async (req, res, next) => {
  try {
    rejectImageFields(req.body);
    const body = loginBody.parse(req.body);
    assertValidEmbedding(body.embedding, body.modelId);
    const email = body.email.toLowerCase().trim();
    const found = await query<{ id: string; email: string; name: string; role: string }>(
      `SELECT id, email, name, role FROM users WHERE email = $1`,
      [email],
    );
    if (!found.rowCount) {
      throw new AppError(401, "NO_MATCH", "No hay coincidencia facial.");
    }
    const userRow = found.rows[0];
    const emb = await query<{ vector: unknown }>(
      `SELECT vector FROM facial_embeddings WHERE user_id = $1 AND model_id = $2`,
      [userRow.id, body.modelId],
    );
    if (!emb.rowCount) {
      throw new AppError(401, "NOT_ENROLLED", "Usuario sin enroll facial.");
    }
    const stored = parseVector(emb.rows[0].vector);
    if (stored.length !== body.embedding.length) {
      throw new AppError(401, "NO_MATCH", "No hay coincidencia facial.");
    }
    const score = cosineSimilarity(stored, body.embedding);
    if (score < config.facialMatchThreshold) {
      throw new AppError(401, "NO_MATCH", "No hay coincidencia facial.");
    }
    const user = publicUser(userRow);
    res.json({ accessToken: signToken(user), user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(400, "INVALID_BODY", "Datos de login facial inválidos."));
    }
    next(err);
  }
});

facialRouter.delete("/facial/enroll", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await query(`DELETE FROM facial_embeddings WHERE user_id = $1`, [req.user!.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
