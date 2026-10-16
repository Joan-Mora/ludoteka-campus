-- Sesiones de invitados: el estudiante entra con un QR, deja su nombre y su grupo, y la sesión no se borra.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOL NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_grade INT8 NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_group STRING NULL;

CREATE TABLE IF NOT EXISTS guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE CHECK (length(code) BETWEEN 4 AND 12),
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  grade INT8 NOT NULL CHECK (grade BETWEEN 6 AND 11),
  group_code STRING NOT NULL CHECK (length(group_code) BETWEEN 2 AND 4),
  activity STRING NOT NULL DEFAULT 'diagnostico' CHECK (activity IN ('diagnostico', 'fabrica', 'elementos', 'casos')),
  status STRING NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by UUID NOT NULL REFERENCES users (id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS guest_sessions_open_idx ON guest_sessions (status, opened_at DESC);

CREATE TABLE IF NOT EXISTS guest_joins (
  session_id UUID NOT NULL REFERENCES guest_sessions (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS guest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES guest_sessions (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game STRING NOT NULL CHECK (game IN ('diagnostico', 'fabrica', 'elementos', 'casos')),
  state JSONB NOT NULL DEFAULT '{}',
  score INT8 NOT NULL DEFAULT 0 CHECK (score >= 0),
  correct INT8 NOT NULL DEFAULT 0 CHECK (correct >= 0),
  total INT8 NOT NULL DEFAULT 0 CHECK (total >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  UNIQUE (session_id, user_id, game)
);

CREATE TABLE IF NOT EXISTS guest_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES guest_sessions (id) ON DELETE CASCADE,
  user_a UUID NOT NULL REFERENCES users (id),
  user_b UUID NULL REFERENCES users (id),
  gate INT8 NOT NULL DEFAULT 0 CHECK (gate >= 0),
  total INT8 NOT NULL DEFAULT 6 CHECK (total > 0),
  state JSONB NOT NULL DEFAULT '{}',
  score_a INT8 NOT NULL DEFAULT 0 CHECK (score_a >= 0),
  score_b INT8 NOT NULL DEFAULT 0 CHECK (score_b >= 0),
  finished_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
