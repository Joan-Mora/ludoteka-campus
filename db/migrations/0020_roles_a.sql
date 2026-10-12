-- Coordinación y Rectoría dejan de compartir el rol "directivo". Paso 1: el CHECK admite ambos esquemas.
-- Va en archivos separados porque CockroachDB no permite un cambio de esquema después de escribir datos en la misma transacción.
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS check_role;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_transition CHECK (role IN ('admin', 'directivo', 'coordinator', 'rector', 'teacher', 'student', 'guardian'));
