-- Seed: admin/teacher + banco mates sexto (password = Password123! hashed at runtime by seed script)
-- Prefer running api seed via npm; this SQL inserts questions assuming users exist.

INSERT INTO questions (prompt, options, correct_option_id, topic, difficulty)
SELECT * FROM (VALUES
  ('¿Cuánto es 3/4 + 1/4?', '[{"id":"a","label":"1"},{"id":"b","label":"1/2"},{"id":"c","label":"3/8"},{"id":"d","label":"2"}]'::JSONB, 'a', 'fracciones', 'easy'),
  ('¿Cuál es el perímetro de un cuadrado de lado 5 cm?', '[{"id":"a","label":"10 cm"},{"id":"b","label":"20 cm"},{"id":"c","label":"25 cm"},{"id":"d","label":"15 cm"}]'::JSONB, 'b', 'geometria', 'easy'),
  ('Resuelve: 12 × 8', '[{"id":"a","label":"88"},{"id":"b","label":"96"},{"id":"c","label":"108"},{"id":"d","label":"86"}]'::JSONB, 'b', 'multiplicacion', 'easy'),
  ('¿Qué fracción representa la mitad?', '[{"id":"a","label":"1/3"},{"id":"b","label":"2/4"},{"id":"c","label":"1/5"},{"id":"d","label":"3/5"}]'::JSONB, 'b', 'fracciones', 'easy'),
  ('Área de un rectángulo 6×4', '[{"id":"a","label":"10"},{"id":"b","label":"20"},{"id":"c","label":"24"},{"id":"d","label":"12"}]'::JSONB, 'c', 'geometria', 'medium'),
  ('¿Cuánto es 15% de 200?', '[{"id":"a","label":"20"},{"id":"b","label":"25"},{"id":"c","label":"30"},{"id":"d","label":"35"}]'::JSONB, 'c', 'porcentajes', 'medium'),
  ('MCM de 4 y 6', '[{"id":"a","label":"12"},{"id":"b","label":"24"},{"id":"c","label":"8"},{"id":"d","label":"2"}]'::JSONB, 'a', 'numeros', 'medium'),
  ('¿Cuántos grados suman los ángulos de un triángulo?', '[{"id":"a","label":"90"},{"id":"b","label":"180"},{"id":"c","label":"270"},{"id":"d","label":"360"}]'::JSONB, 'b', 'geometria', 'easy'),
  ('7² = ?', '[{"id":"a","label":"14"},{"id":"b","label":"49"},{"id":"c","label":"21"},{"id":"d","label":"77"}]'::JSONB, 'b', 'potencias', 'easy'),
  ('Promedio de 8, 10 y 12', '[{"id":"a","label":"9"},{"id":"b","label":"10"},{"id":"c","label":"11"},{"id":"d","label":"30"}]'::JSONB, 'b', 'estadistica', 'easy')
) AS v(prompt, options, correct_option_id, topic, difficulty)
WHERE NOT EXISTS (SELECT 1 FROM questions LIMIT 1);