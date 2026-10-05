CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL UNIQUE,
  body_md STRING NOT NULL,
  active BOOL NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES courses (id) ON DELETE SET NULL,
  code STRING NOT NULL UNIQUE,
  title STRING NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title STRING NOT NULL,
  body STRING NOT NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email STRING NOT NULL,
  subject STRING NOT NULL,
  body STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'logged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
