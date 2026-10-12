-- Mensajes entre el personal del colegio (docentes, coordinación, rectoría y administración).
-- Estudiantes y acudientes no participan: las familias siguen usando guardian_messages.

CREATE TABLE IF NOT EXISTS staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body STRING NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_messages_pair ON staff_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_messages_inbox ON staff_messages (recipient_id, read_at, created_at DESC);
