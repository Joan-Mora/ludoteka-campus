-- Un PDF puede quedarse en su sitio oficial (sin copia en Cloudinary) si se registra la fuente.
ALTER TABLE library_items DROP CONSTRAINT IF EXISTS check_kind_cloudinary_public_id;
ALTER TABLE library_items ADD CONSTRAINT check_library_file_origin CHECK (kind = 'link' OR cloudinary_public_id IS NOT NULL OR source_url IS NOT NULL);
