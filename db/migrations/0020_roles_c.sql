-- Paso 3: el CHECK final ya no admite "directivo".
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_transition;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'coordinator', 'rector', 'teacher', 'student', 'guardian'));
