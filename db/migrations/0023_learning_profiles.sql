-- «Descubre cómo aprendes»: un perfil por estudiante y periodo, con los puntajes de los seis métodos.
CREATE TABLE IF NOT EXISTS learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period_id UUID NULL REFERENCES periods (id) ON DELETE SET NULL,
  version INT8 NOT NULL DEFAULT 1 CHECK (version > 0),
  answers JSONB NOT NULL,
  scores JSONB NOT NULL,
  primary_method STRING NOT NULL CHECK (primary_method IN ('teoria', 'ejemplos', 'juegos', 'practica', 'visual', 'conversacion')),
  secondary_method STRING NULL CHECK (secondary_method IS NULL OR secondary_method IN ('teoria', 'ejemplos', 'juegos', 'practica', 'visual', 'conversacion')),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (secondary_method IS NULL OR secondary_method <> primary_method)
);
CREATE INDEX IF NOT EXISTS learning_profiles_user_idx ON learning_profiles (user_id, taken_at DESC);

-- Recursos que el estudiante abre en «Mi espacio», por método y tema.
CREATE TABLE IF NOT EXISTS learning_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  method STRING NOT NULL CHECK (method IN ('teoria', 'ejemplos', 'juegos', 'practica', 'visual', 'conversacion')),
  topic_id UUID NULL REFERENCES topics (id) ON DELETE SET NULL,
  resource STRING NOT NULL DEFAULT '' CHECK (length(resource) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_activity_user_idx ON learning_activity (user_id, created_at DESC);

-- Cada reto de Mi ruta recuerda en qué formato se presentó y si movió el nivel, para medir qué método rinde más.
ALTER TABLE route_items ADD COLUMN IF NOT EXISTS method STRING NULL CHECK (method IS NULL OR method IN ('teoria', 'ejemplos', 'juegos', 'practica', 'visual', 'conversacion'));
ALTER TABLE route_items ADD COLUMN IF NOT EXISTS level_change INT8 NULL CHECK (level_change IS NULL OR level_change BETWEEN -1 AND 1);
-- Reto jefe del sendero: dos niveles por encima; si se vence, el tema sube un nivel y gana la corona.
ALTER TABLE route_items ADD COLUMN IF NOT EXISTS boss BOOL NOT NULL DEFAULT false;
