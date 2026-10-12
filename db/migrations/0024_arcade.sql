-- Arcade verificado: el catálogo reemplaza el CHECK fijo de minigame_runs y cada partida vive en el servidor.
CREATE TABLE IF NOT EXISTS arcade_games (
  code STRING PRIMARY KEY CHECK (code ~ '^[a-z]{3,20}$'),
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 60),
  generator STRING NULL,
  rounds INT8 NOT NULL CHECK (rounds BETWEEN 1 AND 20),
  seconds INT8 NOT NULL CHECK (seconds BETWEEN 20 AND 600),
  position INT8 NOT NULL,
  active BOOL NOT NULL DEFAULT true
);

-- Las preguntas y respuestas quedan aquí; el cliente solo recibe los enunciados.
CREATE TABLE IF NOT EXISTS arcade_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game STRING NOT NULL REFERENCES arcade_games (code),
  topic_id UUID NULL REFERENCES topics (id) ON DELETE SET NULL,
  level INT8 NOT NULL CHECK (level BETWEEN 1 AND 10),
  daily_on DATE NULL,
  items JSONB NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  total INT8 NOT NULL CHECK (total > 0),
  correct INT8 NULL CHECK (correct IS NULL OR correct BETWEEN 0 AND total),
  score INT8 NULL CHECK (score IS NULL OR score >= 0),
  xp_awarded INT8 NULL CHECK (xp_awarded IS NULL OR xp_awarded BETWEEN 0 AND 60),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS arcade_sessions_user_idx ON arcade_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS arcade_sessions_daily_idx ON arcade_sessions (daily_on, game) WHERE daily_on IS NOT NULL;

ALTER TABLE minigame_runs DROP CONSTRAINT IF EXISTS check_game;
ALTER TABLE minigame_runs ADD COLUMN IF NOT EXISTS session_id UUID NULL REFERENCES arcade_sessions (id) ON DELETE SET NULL;
ALTER TABLE minigame_runs ADD COLUMN IF NOT EXISTS daily BOOL NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS minigame_runs_user_idx ON minigame_runs (user_id, played_at DESC);

INSERT INTO arcade_games (code, title, generator, rounds, seconds, position) VALUES
  ('carrera', 'Carrera numérica', 'order_ops', 8, 60, 1),
  ('fracciones', 'Fracciones al blanco', 'simplify', 8, 75, 2),
  ('memoria', 'Memoria de equivalencias', 'percent', 6, 120, 3),
  ('recta', 'Recta numérica', 'decimal', 8, 90, 4),
  ('ordena', 'Ordena la operación', 'order_ops', 6, 120, 5),
  ('torre', 'Torre MCD/MCM', 'gcd_lcm', 8, 120, 6),
  ('mercado', 'Mercado de porcentajes', 'percent', 8, 120, 7),
  ('area', 'Construye el área', 'area', 6, 150, 8),
  ('ahorcado', 'Ahorcado del glosario', NULL, 4, 240, 9),
  ('quiz', 'Quiz relámpago', NULL, 8, 75, 10)
ON CONFLICT (code) DO NOTHING;
