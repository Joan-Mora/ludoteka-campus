-- Coordinación: bitácora de seguimiento de cada alerta de riesgo.
CREATE TABLE IF NOT EXISTS risk_alert_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES risk_alerts (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body STRING NOT NULL CHECK (length(body) BETWEEN 2 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_alert_notes_alert ON risk_alert_notes (alert_id, created_at);

-- Citaciones a acudientes: coordinación las crea, el acudiente confirma o declina.
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id UUID NULL REFERENCES courses (id) ON DELETE SET NULL,
  alert_id UUID NULL REFERENCES risk_alerts (id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  mode STRING NOT NULL DEFAULT 'presencial' CHECK (mode IN ('presencial', 'virtual')),
  place STRING NOT NULL DEFAULT '' CHECK (length(place) <= 200),
  reason STRING NOT NULL CHECK (length(reason) BETWEEN 3 AND 600),
  status STRING NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'declined', 'held', 'cancelled')),
  response_note STRING NULL CHECK (response_note IS NULL OR length(response_note) <= 400),
  responded_at TIMESTAMPTZ NULL,
  outcome STRING NULL CHECK (outcome IS NULL OR length(outcome) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_guardian ON meetings (guardian_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_student ON meetings (student_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_schedule ON meetings (scheduled_at DESC);

-- Mensajes entre acudiente y docente sobre un estudiante. Un hilo = (estudiante, acudiente, docente).
CREATE TABLE IF NOT EXISTS guardian_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body STRING NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (author_id = guardian_id OR author_id = teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_messages_thread ON guardian_messages (student_id, guardian_id, teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_guardian_messages_teacher ON guardian_messages (teacher_id, created_at DESC);

-- Rectoría firma certificados: los nuevos quedan pendientes; los ya emitidos se consideran firmados.
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS status STRING NOT NULL DEFAULT 'signed' CHECK (status IN ('pending_signature', 'signed', 'rejected'));
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS requested_by UUID NULL REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signed_by UUID NULL REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ NULL;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS decision_note STRING NULL;

-- Boletines oficiales: el docente o coordinación solicita, rectoría firma; el PDF firmado lleva el sello.
CREATE TABLE IF NOT EXISTS bulletin_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period_id UUID NULL REFERENCES periods (id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'pending_signature' CHECK (status IN ('pending_signature', 'signed', 'rejected')),
  signed_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ NULL,
  decision_note STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulletin_signatures_status ON bulletin_signatures (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bulletin_pending ON bulletin_signatures (student_id) WHERE status = 'pending_signature';

-- Comunicados oficiales de rectoría en la cartelera.
ALTER TABLE news ADD COLUMN IF NOT EXISTS official BOOL NOT NULL DEFAULT false;

-- Último resumen semanal enviado a cada acudiente.
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS weekly_digest BOOL NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ NULL;
