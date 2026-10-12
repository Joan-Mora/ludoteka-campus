-- Calendario académico completo: cuatro periodos por año (antes solo existía el primero).
INSERT INTO periods (academic_year_id, name, position, starts_on, ends_on)
SELECT y.id, v.name, v.position, v.starts_on::DATE, v.ends_on::DATE
FROM academic_years y
CROSS JOIN (VALUES
  ('Periodo 2', 2, '2026-05-01', '2026-07-15'),
  ('Periodo 3', 3, '2026-07-16', '2026-09-30'),
  ('Periodo 4', 4, '2026-10-01', '2026-11-30')
) AS v (name, position, starts_on, ends_on)
WHERE y.name = '2026'
  AND NOT EXISTS (SELECT 1 FROM periods p WHERE p.academic_year_id = y.id AND p.position = v.position);
