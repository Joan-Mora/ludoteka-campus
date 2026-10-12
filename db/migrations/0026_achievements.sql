-- Catálogo de insignias con categoría, niveles (bronce, plata, oro), ocultas y de temporada.
-- Las filas las mantiene la API al arrancar desde el catálogo en código (gamification/badges.ts).
ALTER TABLE badges ADD COLUMN IF NOT EXISTS category STRING NOT NULL DEFAULT 'constancia'
  CHECK (category IN ('constancia', 'dominio', 'exploracion', 'colaboracion', 'arcade', 'biblioteca', 'perfil', 'temporada'));
ALTER TABLE badges ADD COLUMN IF NOT EXISTS thresholds JSONB NOT NULL DEFAULT '[1]';
ALTER TABLE badges ADD COLUMN IF NOT EXISTS hidden BOOL NOT NULL DEFAULT false;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS seasonal BOOL NOT NULL DEFAULT false;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS position INT8 NOT NULL DEFAULT 0;
ALTER TABLE badges ADD COLUMN IF NOT EXISTS active BOOL NOT NULL DEFAULT true;

-- Nivel alcanzado por insignia y temporada ('siempre' o el id del periodo). user_badges sigue
-- registrando la primera vez que se gana cada insignia, que es lo que cuentan los tableros.
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  season STRING NOT NULL DEFAULT 'siempre' CHECK (length(season) BETWEEN 1 AND 40),
  tier INT8 NOT NULL CHECK (tier BETWEEN 1 AND 3),
  progress INT8 NOT NULL DEFAULT 0 CHECK (progress >= 0),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  upgraded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, badge_id, season)
);
CREATE INDEX IF NOT EXISTS user_achievements_unseen_idx ON user_achievements (user_id) WHERE seen_at IS NULL;

-- La racha deja de contar si pasó más de un día sin actividad (antes se mostraba congelada).
CREATE OR REPLACE VIEW v_xp AS
SELECT e.user_id AS estudiante_id, u.full_name AS estudiante, e.group_id,
       (SELECT coalesce(sum(x.amount), 0) FROM xp_ledger x WHERE x.user_id = e.user_id) AS xp_total,
       CASE WHEN st.last_activity_on >= (now() AT TIME ZONE 'America/Bogota')::DATE - 1 THEN coalesce(st.current_count, 0) ELSE 0 END AS racha_actual,
       coalesce(st.best_count, 0) AS mejor_racha,
       (SELECT count(*) FROM user_badges b WHERE b.user_id = e.user_id) AS insignias
FROM enrollments e
JOIN academic_years y ON y.id = e.academic_year_id AND y.is_current
JOIN users u ON u.id = e.user_id
LEFT JOIN streaks st ON st.user_id = e.user_id;
