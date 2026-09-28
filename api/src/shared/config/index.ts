import dotenv from "dotenv";

dotenv.config();

const WEAK_JWT = new Set(["", "change-me-in-production", "dev-insecure-secret"]);

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET?.trim() ?? "";
  const isProd = process.env.NODE_ENV === "production";
  if (WEAK_JWT.has(raw) || WEAK_JWT.has(raw.toLowerCase())) {
    if (isProd) {
      throw new Error(
        "JWT_SECRET débil o ausente: define un secreto fuerte en producción.",
      );
    }
    if (!raw) {
      console.warn(
        "[seguridad] JWT_SECRET ausente; usando secreto de desarrollo inseguro.",
      );
      return "dev-insecure-secret";
    }
    console.warn(
      "[seguridad] JWT_SECRET débil; cámbialo antes de desplegar a Render.",
    );
  }
  return raw || "dev-insecure-secret";
}

export const config = {
  port: Number(process.env.PORT ?? 3000) || 3000,
  databaseUrl: process.env.DATABASE_URL?.trim() ?? "",
  jwtSecret: resolveJwtSecret(),
  corsOrigin: process.env.CORS_ORIGIN?.trim() || "http://localhost:5173",
  appPublicUrl: process.env.APP_PUBLIC_URL?.trim() || "http://localhost:5173",
  integritySuspendAfter: Number(process.env.INTEGRITY_SUSPEND_AFTER ?? 2) || 2,
  facialMatchThreshold: Number(process.env.FACIAL_MATCH_THRESHOLD ?? 0.6) || 0.6,
  facialPolicyVersion: process.env.FACIAL_POLICY_VERSION?.trim() || "2026-09-28",
  facialEmbeddingDim: Number(process.env.FACIAL_EMBEDDING_DIM ?? 128) || 128,
  facialRetentionDays: Number(process.env.FACIAL_RETENTION_DAYS ?? 0) || 0,
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  smtp: {
    host: process.env.SMTP_HOST?.trim() ?? "",
    port: Number(process.env.SMTP_PORT ?? 587) || 587,
    user: process.env.SMTP_USER?.trim() ?? "",
    pass: process.env.SMTP_PASS?.trim() ?? "",
    from: process.env.SMTP_FROM?.trim() || "EduQuest <noreply@eduquest.local>",
  },
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? "",
};