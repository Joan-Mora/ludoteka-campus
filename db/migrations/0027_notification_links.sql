-- Notificaciones navegables: tipo, destino en la app, edificio del campus y entidad que las originó.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind STRING NOT NULL DEFAULT 'aviso'
  CHECK (kind IN ('aviso', 'cartelera', 'foro', 'logro', 'integridad', 'seguimiento', 'citacion', 'mensaje', 'firma', 'certificado'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link STRING NULL CHECK (link IS NULL OR (link LIKE '/app%' AND length(link) <= 300));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS building STRING NULL
  CHECK (building IS NULL OR building IN ('aula', 'biblioteca', 'lab', 'arena', 'trofeos', 'cartelera', 'cuaderno', 'ruta'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications (user_id, entity_id) WHERE entity_id IS NOT NULL;

-- Última visita a la Biblioteca: el mapa cuenta los recursos visibles publicados después.
CREATE TABLE IF NOT EXISTS library_visits (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
