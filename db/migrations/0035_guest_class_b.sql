-- La clase de hoy solo usa los temas de octavo. Lo demás se despublica; los archivos de Cloudinary se conservan.
UPDATE arcade_games SET active = false
WHERE code IN ('carrera', 'fracciones', 'memoria', 'recta', 'ordena', 'torre', 'mercado', 'area', 'ahorcado', 'quiz');

UPDATE questions SET active = false, archived_at = coalesce(archived_at, now())
WHERE archived_at IS NULL;

UPDATE library_items SET status = 'archived', updated_at = now()
WHERE status = 'published';

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT
  'Factorización en octavo',
  'Guía corta para la clase: factor común, diferencia de cuadrados, trinomio cuadrado perfecto y trinomio de la forma x² + bx + c. El texto de clase es propio. La fuente para ampliar es los Derechos Básicos de Aprendizaje de Matemáticas (grado 8.°) del Ministerio de Educación Nacional.',
  s.id, g.id, 'link',
  'https://www.colombiaaprende.edu.co/recurso-coleccion/derechos-basicos-de-aprendizaje-en-todas-las-areas',
  'institution', 'published', 420
FROM subjects s, grades g
WHERE s.code = 'MAT' AND g.level = 8
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Factorización en octavo');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT
  'Fracciones algebraicas en octavo',
  'Guía corta para la clase: simplificar y operar fracciones algebraicas, sin copiar el libro. Para leer el desarrollo completo, OpenStax Intermediate Algebra (licencia CC BY): capítulo de factorización y capítulo de expresiones racionales.',
  s.id, g.id, 'link',
  'https://openstax.org/books/intermediate-algebra-2e/pages/7-introduction',
  'institution', 'published', 380
FROM subjects s, grades g
WHERE s.code = 'MAT' AND g.level = 8
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Fracciones algebraicas en octavo');
