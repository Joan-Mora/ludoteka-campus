-- Acceso facial v2: descriptor face-api de 128 dimensiones cifrado con AES-256-GCM.
-- Los vectores del modelo anterior (puntos MediaPipe) no son comparables, así que se descartan.
DROP TABLE IF EXISTS facial_embeddings;

CREATE TABLE IF NOT EXISTS face_templates (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  model_id STRING NOT NULL,
  ciphertext BYTES NOT NULL,
  iv BYTES NOT NULL,
  tag BYTES NOT NULL,
  samples INT NOT NULL CHECK (samples BETWEEN 3 AND 10),
  spread FLOAT8 NOT NULL CHECK (spread >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS face_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users (id) ON DELETE CASCADE,
  email_hash STRING NULL,
  ip STRING NULL,
  mode STRING NOT NULL CHECK (mode IN ('verify', 'identify', 'enroll')),
  success BOOL NOT NULL,
  reason STRING NOT NULL CHECK (reason IN (
    'ok', 'unknown_email', 'no_template', 'no_consent', 'guardian_required',
    'locked', 'liveness', 'challenge', 'distance', 'ambiguous', 'quality'
  )),
  distance FLOAT8 NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_attempts_user ON face_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_attempts_ip ON face_attempts (ip, created_at DESC);

-- Consecutivo de reportes: LK-<año>-<seq>.
CREATE SEQUENCE IF NOT EXISTS report_seq START 1;

CREATE TABLE IF NOT EXISTS report_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq INT8 NOT NULL UNIQUE,
  code STRING NOT NULL UNIQUE,
  kind STRING NOT NULL CHECK (kind IN ('boletin', 'curso', 'evaluacion', 'integridad', 'uso', 'usuarios', 'certificado', 'calificaciones')),
  format STRING NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  title STRING NOT NULL,
  generated_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  params JSONB NULL,
  row_count INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_log_created ON report_log (created_at DESC);

-- Uso de IA por funcionalidad (sin contenido de los mensajes).
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  feature STRING NOT NULL,
  model STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage (user_id, created_at DESC);
