-- EduQuest schema (Cockroach / Postgres wire)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email STRING NOT NULL UNIQUE,
  password_hash STRING NOT NULL,
  name STRING NOT NULL,
  role STRING NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash STRING NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt STRING NOT NULL,
  options JSONB NOT NULL,
  correct_option_id STRING NOT NULL,
  topic STRING NULL,
  difficulty STRING NULL,
  active BOOL NOT NULL DEFAULT true,
  created_by UUID NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id),
  title STRING NULL,
  code STRING NOT NULL UNIQUE,
  status STRING NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'live', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS quiz_session_questions (
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  position INT NOT NULL,
  PRIMARY KEY (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  score INT NOT NULL DEFAULT 0,
  status STRING NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  option_id STRING NULL,
  value STRING NULL,
  correct BOOL NOT NULL DEFAULT false,
  points INT NOT NULL DEFAULT 0,
  elapsed_ms INT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  type STRING NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  code STRING NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_meta JSONB NULL
);
CREATE TABLE IF NOT EXISTS facial_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_version STRING NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facial_consents_user ON facial_consents (user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS facial_embeddings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id STRING NOT NULL,
  vector JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, model_id)
);
