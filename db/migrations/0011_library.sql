-- Biblioteca: los archivos viven en Cloudinary; CockroachDB guarda metadatos, texto indexado y embeddings.
CREATE TABLE IF NOT EXISTS library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description STRING NOT NULL DEFAULT '',
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  grade_id UUID NULL REFERENCES grades (id) ON DELETE SET NULL,
  kind STRING NOT NULL CHECK (kind IN ('pdf', 'image', 'video', 'doc', 'link')),
  url STRING NOT NULL,
  cloudinary_public_id STRING NULL UNIQUE,
  resource_type STRING NULL,
  format STRING NULL,
  bytes INT8 NOT NULL DEFAULT 0 CHECK (bytes >= 0 AND bytes <= 52428800),
  pages INT NULL CHECK (pages IS NULL OR pages >= 0),
  checksum STRING NULL,
  visibility STRING NOT NULL DEFAULT 'institution' CHECK (visibility IN ('public', 'institution', 'course')),
  course_id UUID NULL REFERENCES courses (id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'published', 'failed', 'archived')),
  text_chars INT NOT NULL DEFAULT 0,
  uploaded_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (visibility <> 'course' OR course_id IS NOT NULL),
  CHECK (kind = 'link' OR cloudinary_public_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_library_items_subject ON library_items (subject_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_items_course ON library_items (course_id) WHERE course_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS library_tags (
  item_id UUID NOT NULL REFERENCES library_items (id) ON DELETE CASCADE,
  tag STRING NOT NULL CHECK (length(tag) BETWEEN 2 AND 40 AND tag = lower(tag)),
  PRIMARY KEY (item_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_library_tags_tag ON library_tags (tag);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES library_items (id) ON DELETE CASCADE,
  page INT NULL CHECK (page IS NULL OR page >= 1),
  note STRING NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS library_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES library_items (id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_views_item ON library_views (item_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  term STRING NOT NULL CHECK (length(term) BETWEEN 2 AND 80),
  definition STRING NOT NULL CHECK (length(definition) BETWEEN 5 AND 1200),
  example STRING NOT NULL DEFAULT '',
  source_item_id UUID NULL REFERENCES library_items (id) ON DELETE SET NULL,
  created_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_glossary_subject_term ON glossary_terms (subject_id, lower(term));

-- Fragmentos para el tutor con citas: texto con índice de búsqueda en español y embedding de 768 dimensiones.
CREATE TABLE IF NOT EXISTS library_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES library_items (id) ON DELETE CASCADE,
  ordinal INT NOT NULL CHECK (ordinal >= 0),
  page INT NULL,
  content STRING NOT NULL,
  tsv TSVECTOR AS (to_tsvector('spanish', content)) STORED,
  embedding VECTOR(768) NULL,
  UNIQUE (item_id, ordinal)
);

CREATE INVERTED INDEX IF NOT EXISTS idx_library_chunks_tsv ON library_chunks (tsv);
CREATE VECTOR INDEX IF NOT EXISTS idx_library_chunks_embedding ON library_chunks (embedding);
