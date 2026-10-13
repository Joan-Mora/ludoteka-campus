-- Portada de los recursos que Cloudinary no puede previsualizar (PDF externos y enlaces).
-- NULL: falta generarla; cadena vacía: se intentó y no hubo portada.
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS cover_url STRING NULL CHECK (cover_url IS NULL OR cover_url = '' OR (cover_url LIKE 'https://%' AND length(cover_url) <= 600));
