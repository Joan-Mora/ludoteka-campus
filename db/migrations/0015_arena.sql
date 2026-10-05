-- Arena por equipos: salas con código, equipos de hasta 5, candados por pregunta y resultados finales.
-- El estado vivo (votos, capitanes, cronómetro) se guarda con retraso en arena_rooms.snapshot
-- para recuperarse tras un reinicio del servidor sin depender de Redis.

CREATE TABLE IF NOT EXISTS arena_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'),
  host_id UUID NOT NULL REFERENCES users (id),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  question_ids UUID[] NOT NULL CHECK (array_length(question_ids, 1) BETWEEN 1 AND 30),
  team_size INT NOT NULL DEFAULT 5 CHECK (team_size BETWEEN 2 AND 5),
  question_sec INT NOT NULL DEFAULT 45 CHECK (question_sec BETWEEN 15 AND 180),
  status STRING NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'question', 'vote', 'feedback', 'table', 'podium', 'ended')),
  current_index INT NOT NULL DEFAULT -1 CHECK (current_index >= -1),
  snapshot JSONB NULL,
  snapshot_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  CHECK ((status = 'ended') = (ended_at IS NOT NULL)),
  CHECK (status = 'lobby' OR started_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_arena_rooms_course ON arena_rooms (course_id, status);
CREATE INDEX IF NOT EXISTS idx_arena_rooms_host ON arena_rooms (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arena_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES arena_rooms (id) ON DELETE CASCADE,
  name STRING NOT NULL CHECK (length(name) BETWEEN 2 AND 40),
  color STRING NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  position INT NOT NULL CHECK (position > 0),
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0),
  UNIQUE (room_id, position),
  UNIQUE (room_id, name)
);

CREATE TABLE IF NOT EXISTS arena_members (
  room_id UUID NOT NULL REFERENCES arena_rooms (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES arena_teams (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_arena_members_team ON arena_members (team_id);
CREATE INDEX IF NOT EXISTS idx_arena_members_user ON arena_members (user_id, joined_at DESC);

-- Un candado por equipo y pregunta. option_id NULL = el tiempo se agotó sin cerrar.
CREATE TABLE IF NOT EXISTS arena_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES arena_rooms (id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES arena_teams (id) ON DELETE CASCADE,
  question_index INT NOT NULL CHECK (question_index >= 0),
  question_id UUID NOT NULL REFERENCES questions (id),
  option_id UUID NULL REFERENCES question_options (id),
  locked_by UUID NULL REFERENCES users (id),
  votes JSONB NOT NULL DEFAULT '{}',
  elapsed_ms INT NOT NULL CHECK (elapsed_ms >= 0),
  correct BOOL NOT NULL DEFAULT false,
  points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  -- Orden en que se abren los candados en la fase de votación; lo decide el servidor.
  reveal_order INT NOT NULL CHECK (reveal_order > 0),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, team_id, question_index),
  UNIQUE (room_id, question_index, reveal_order),
  CHECK (option_id IS NOT NULL OR (locked_by IS NULL AND NOT correct AND points = 0)),
  CHECK (correct OR points = 0)
);

CREATE TABLE IF NOT EXISTS arena_results (
  room_id UUID NOT NULL REFERENCES arena_rooms (id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES arena_teams (id) ON DELETE CASCADE,
  rank INT NOT NULL CHECK (rank > 0),
  score INT NOT NULL CHECK (score >= 0),
  correct_count INT NOT NULL CHECK (correct_count >= 0),
  PRIMARY KEY (room_id, team_id)
);
