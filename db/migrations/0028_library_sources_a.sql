-- Procedencia de los recursos de la biblioteca: quién lo publica, dónde está el original y bajo qué licencia.
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS source_name STRING NULL CHECK (source_name IS NULL OR length(source_name) BETWEEN 2 AND 120);
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS source_url STRING NULL CHECK (source_url IS NULL OR (source_url LIKE 'https://%' AND length(source_url) <= 500));
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS license STRING NULL CHECK (license IS NULL OR length(license) BETWEEN 2 AND 120);
