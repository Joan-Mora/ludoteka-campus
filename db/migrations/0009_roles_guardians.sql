-- Acudientes: vínculo con cada estudiante y autorizaciones versionadas (Ley 1581, tratamiento de datos de menores).
CREATE TABLE IF NOT EXISTS guardian_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  relationship STRING NOT NULL CHECK (relationship IN ('madre', 'padre', 'tutor', 'abuelo', 'otro')),
  status STRING NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  created_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, student_id),
  CHECK (guardian_id <> student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_student ON guardian_links (student_id);

CREATE TABLE IF NOT EXISTS guardian_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES guardian_links (id) ON DELETE CASCADE,
  scope STRING NOT NULL CHECK (scope IN ('facial', 'ai_tutor', 'data_processing')),
  policy_version STRING NOT NULL,
  granted BOOL NOT NULL,
  ip STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_auth_link ON guardian_authorizations (link_id, scope, created_at DESC);

-- La estudiante de laboratorio 2 es menor de edad para demostrar el flujo de autorización del acudiente.
UPDATE users SET is_minor = true WHERE email = 'estudiante2@eduquest.local' AND is_minor = false;
