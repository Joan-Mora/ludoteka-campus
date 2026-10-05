-- Mi ruta: temas con generador verificable, maestría 1-10 por estudiante y retos generados.
-- Los temas y su vínculo con el banco de preguntas los asegura el servicio al arrancar
-- (las materias se siembran después de las migraciones en una base nueva).

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  grade_id UUID NULL REFERENCES grades (id),
  code STRING NOT NULL UNIQUE CHECK (code = upper(code)),
  name STRING NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  generator STRING NOT NULL CHECK (generator IN (
    'order_ops', 'simplify', 'frac_add', 'gcd_lcm', 'decimal', 'percent', 'proportion', 'triangle', 'area', 'mean'
  )),
  position INT NOT NULL CHECK (position > 0),
  UNIQUE (subject_id, position)
);

CREATE TABLE IF NOT EXISTS question_topics (
  question_id UUID PRIMARY KEY REFERENCES questions (id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_topics_topic ON question_topics (topic_id);

CREATE TABLE IF NOT EXISTS topic_mastery (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  -- Positivo: aciertos seguidos; negativo: fallos seguidos. Dos seguidos mueven el nivel.
  streak INT NOT NULL DEFAULT 0 CHECK (streak BETWEEN -2 AND 2),
  correct_count INT NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id),
  CHECK (correct_count <= attempt_count)
);

CREATE TABLE IF NOT EXISTS route_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 10),
  generator STRING NOT NULL,
  params JSONB NOT NULL,
  prompt STRING NOT NULL CHECK (length(prompt) BETWEEN 10 AND 600),
  hint STRING NOT NULL DEFAULT '',
  -- Respuesta calculada por el servidor a partir de params; nunca se envía antes de responder.
  answer STRING NOT NULL,
  answer_kind STRING NOT NULL CHECK (answer_kind IN ('integer', 'decimal', 'fraction', 'irreducible')),
  explanation STRING NOT NULL DEFAULT '',
  source STRING NOT NULL CHECK (source IN ('ia', 'plantilla')),
  ai_answer STRING NULL,
  verification STRING NOT NULL CHECK (verification IN ('verified', 'corrected', 'template')),
  status STRING NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'correct', 'wrong', 'skipped')),
  given STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ NULL,
  CHECK ((status = 'pending') = (answered_at IS NULL)),
  CHECK (source = 'ia' OR verification = 'template')
);

CREATE INDEX IF NOT EXISTS idx_route_items_user ON route_items (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_items_topic ON route_items (topic_id, created_at DESC);
