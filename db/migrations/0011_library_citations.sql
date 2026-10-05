-- Las respuestas del tutor guardan las fuentes de la biblioteca que citó.
ALTER TABLE tutor_messages ADD COLUMN IF NOT EXISTS citations JSONB NULL;
