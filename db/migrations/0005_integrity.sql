CREATE TABLE IF NOT EXISTS integrity_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL UNIQUE,
  max_violations INT NOT NULL DEFAULT 3,
  is_default BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type STRING NOT NULL,
  meta JSONB NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempt_flags (
  attempt_id UUID PRIMARY KEY REFERENCES attempts (id) ON DELETE CASCADE,
  violation_count INT NOT NULL DEFAULT 0,
  flagged BOOL NOT NULL DEFAULT false,
  suspended BOOL NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_integrity_attempt ON integrity_events (attempt_id, at);
