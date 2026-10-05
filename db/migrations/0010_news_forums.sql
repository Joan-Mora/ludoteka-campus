-- Cartelera institucional: novedades con audiencia, fijado, programación y confirmación de lectura.
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  body STRING NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  category STRING NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'academico', 'evento', 'convivencia', 'urgente')),
  pinned BOOL NOT NULL DEFAULT false,
  requires_ack BOOL NOT NULL DEFAULT false,
  publish_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > publish_at)
);

CREATE INDEX IF NOT EXISTS idx_news_publish ON news (publish_at DESC);

-- Una novedad puede dirigirse a todos, a un rol, a un grupo o a un curso. value guarda el rol o el UUID.
CREATE TABLE IF NOT EXISTS news_audience (
  news_id UUID NOT NULL REFERENCES news (id) ON DELETE CASCADE,
  kind STRING NOT NULL CHECK (kind IN ('all', 'role', 'group', 'course')),
  value STRING NOT NULL DEFAULT '',
  PRIMARY KEY (news_id, kind, value),
  CHECK ((kind = 'all' AND value = '') OR (kind <> 'all' AND value <> ''))
);

CREATE INDEX IF NOT EXISTS idx_news_audience_value ON news_audience (kind, value);

CREATE TABLE IF NOT EXISTS news_reads (
  news_id UUID NOT NULL REFERENCES news (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ NULL,
  PRIMARY KEY (news_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_news_reads_user ON news_reads (user_id);

-- Foros por curso.
CREATE TABLE IF NOT EXISTS forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  body STRING NOT NULL CHECK (length(body) BETWEEN 1 AND 6000),
  pinned BOOL NOT NULL DEFAULT false,
  locked BOOL NOT NULL DEFAULT false,
  posts_count INT NOT NULL DEFAULT 0 CHECK (posts_count >= 0),
  last_post_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_course ON forum_threads (course_id, pinned DESC, last_post_at DESC);

CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body STRING NOT NULL CHECK (length(body) BETWEEN 1 AND 6000),
  is_answer BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts (thread_id, created_at);
