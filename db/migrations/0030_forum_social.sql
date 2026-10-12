-- Foros vivos: reacciones, menciones, adjuntos de la biblioteca y resumen de Luka para el docente.

CREATE TABLE IF NOT EXISTS forum_reactions (
  post_id UUID NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind STRING NOT NULL CHECK (kind IN ('util', 'idea', 'gracias', 'duda')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS forum_mentions (
  post_id UUID NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- Un adjunto pertenece al tema (post_id nulo) o a una respuesta.
CREATE TABLE IF NOT EXISTS forum_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads (id) ON DELETE CASCADE,
  post_id UUID NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES library_items (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_attachments_thread ON forum_attachments (thread_id);

ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS summary STRING NULL;
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS summary_posts INT8 NULL;
ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS summary_at TIMESTAMPTZ NULL;
