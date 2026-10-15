-- Banco de preguntas: una pregunta que ya está en evaluaciones o salas no se puede borrar sin romper
-- los intentos guardados; se archiva (sale del banco y deja de usarse) y las evaluaciones viejas siguen abriendo.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Laboratorio IA: historial de conversaciones con título puesto por la IA y orden por última actividad.
ALTER TABLE tutor_conversations ADD COLUMN IF NOT EXISTS title STRING NULL CHECK (title IS NULL OR length(title) <= 80);
ALTER TABLE tutor_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
