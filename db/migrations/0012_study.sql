-- Cuaderno de estudio: apuntes con resumen IA, tarjetas con repetición espaciada (SM-2),
-- metas personales y sesiones de enfoque.

CREATE TABLE IF NOT EXISTS notebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES courses (id) ON DELETE SET NULL,
  title STRING NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  body STRING NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
  summary STRING NULL CHECK (summary IS NULL OR length(summary) <= 4000),
  key_points JSONB NULL,
  summary_source STRING NULL CHECK (summary_source IS NULL OR summary_source IN ('ia', 'local')),
  summarized_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((summary IS NULL) = (summarized_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_notebook_pages_user ON notebook_pages (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  page_id UUID NULL REFERENCES notebook_pages (id) ON DELETE SET NULL,
  front STRING NOT NULL CHECK (length(front) BETWEEN 1 AND 300),
  back STRING NOT NULL CHECK (length(back) BETWEEN 1 AND 600),
  source STRING NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ia', 'local')),
  -- SM-2: factor de facilidad (mínimo 1.3), intervalo en días y repeticiones exitosas seguidas.
  ease DECIMAL(4, 2) NOT NULL DEFAULT 2.5 CHECK (ease BETWEEN 1.3 AND 5.0),
  interval_days INT NOT NULL DEFAULT 0 CHECK (interval_days BETWEEN 0 AND 3650),
  repetitions INT NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards (user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_page ON flashcards (page_id);

CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES flashcards (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  grade INT NOT NULL CHECK (grade BETWEEN 0 AND 5),
  interval_days INT NOT NULL CHECK (interval_days >= 0),
  ease DECIMAL(4, 2) NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user ON flashcard_reviews (user_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind STRING NOT NULL CHECK (kind IN ('flashcards', 'focus_minutes', 'lessons', 'route')),
  period STRING NOT NULL CHECK (period IN ('daily', 'weekly')),
  target INT NOT NULL CHECK (target BETWEEN 1 AND 1000),
  active BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_goals_active ON goals (user_id, kind, period) WHERE active;

CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  page_id UUID NULL REFERENCES notebook_pages (id) ON DELETE SET NULL,
  planned_min INT NOT NULL CHECK (planned_min BETWEEN 5 AND 120),
  status STRING NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'abandoned')),
  actual_sec INT NULL CHECK (actual_sec IS NULL OR actual_sec >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  CHECK ((status = 'running') = (ended_at IS NULL)),
  CHECK ((status = 'running') = (actual_sec IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions (user_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_focus_running ON focus_sessions (user_id) WHERE status = 'running';
