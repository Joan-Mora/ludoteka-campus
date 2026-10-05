CREATE TABLE IF NOT EXISTS tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES courses (id) ON DELETE SET NULL,
  lesson_id UUID NULL REFERENCES lessons (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES tutor_conversations (id) ON DELETE CASCADE,
  role STRING NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users (id),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users (id),
  body STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facial_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  policy_version STRING NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facial_consents_user ON facial_consents (user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS facial_embeddings (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  model_id STRING NOT NULL,
  vector JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, model_id)
);
