-- Preferencias por usuario: compañero IA (Luka o Luna) y tema.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  companion STRING NOT NULL DEFAULT 'luka' CHECK (companion IN ('luka', 'luna')),
  theme STRING NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documentos legales versionados (Ley 1581 de 2012 y Decreto 1377 de 2013).
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind STRING NOT NULL CHECK (kind IN ('terminos', 'privacidad', 'cookies')),
  version STRING NOT NULL,
  title STRING NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, version)
);

-- Aceptación de cada versión. Para un menor, acepta su acudiente (accepted_by) en nombre del estudiante (user_id).
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES legal_documents (id) ON DELETE CASCADE,
  accepted_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ip STRING NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);

-- Solicitudes de habeas data: exportar o eliminar datos. El admin las atiende.
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind STRING NOT NULL CHECK (kind IN ('export', 'delete')),
  status STRING NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'rejected')),
  reason STRING NULL,
  resolved_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests (status, created_at DESC);

INSERT INTO legal_documents (kind, version, title) VALUES
  ('terminos', '2026-10-09', 'Términos y condiciones de uso'),
  ('privacidad', '2026-10-09', 'Política de tratamiento de datos personales'),
  ('cookies', '2026-10-09', 'Aviso de cookies y almacenamiento local')
ON CONFLICT (kind, version) DO NOTHING;
