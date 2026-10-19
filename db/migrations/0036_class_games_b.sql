-- Fuentes reales, una por tema. Enlaces a libros abiertos (CC BY) y a los DBA del Ministerio.
INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Ecuaciones lineales · Preálgebra',
  'OpenStax Prealgebra 2e, sección 8.1: resolver ecuaciones con las propiedades de la igualdad. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/prealgebra-2e/pages/8-1-solve-equations-using-the-subtraction-and-addition-properties-of-equality',
  'institution', 'published', 180
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 6
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Ecuaciones lineales · Preálgebra');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Fracciones · Preálgebra',
  'OpenStax Prealgebra 2e, sección 4.1: visualizar fracciones. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/prealgebra-2e/pages/4-1-visualize-fractions',
  'institution', 'published', 160
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 6
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Fracciones · Preálgebra');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Regla de tres · Preálgebra',
  'OpenStax Prealgebra 2e, sección 6.5: resolver proporciones y sus aplicaciones. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/prealgebra-2e/pages/6-5-solve-proportions-and-their-applications',
  'institution', 'published', 140
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 6
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Regla de tres · Preálgebra');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Estadística introductoria',
  'OpenStax Introductory Statistics 2e: cómo se recogen y se leen los datos. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/introductory-statistics-2e/pages/1-introduction',
  'institution', 'published', 140
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 6
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Estadística introductoria');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Áreas · Preálgebra',
  'OpenStax Prealgebra 2e, sección 9.5: aplicaciones de geometría, círculos y figuras. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/prealgebra-2e/pages/9-5-solve-geometry-applications-circles-and-irregular-figures',
  'institution', 'published', 150
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 7
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Áreas · Preálgebra');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Ecuaciones lineales · Álgebra elemental',
  'OpenStax Elementary Algebra 2e, capítulo 2: resolver ecuaciones lineales. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/elementary-algebra-2e/pages/2-introduction',
  'institution', 'published', 140
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 7
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Ecuaciones lineales · Álgebra elemental');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Proporcionalidad · Preálgebra',
  'OpenStax Prealgebra 2e, sección 6.5: proporciones. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/prealgebra-2e/pages/6-5-solve-proportions-and-their-applications',
  'institution', 'published', 120
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 7
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Proporcionalidad · Preálgebra');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Polinomios · Álgebra elemental',
  'OpenStax Elementary Algebra 2e, capítulo 6: sumar, restar y multiplicar polinomios. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/elementary-algebra-2e/pages/6-introduction',
  'institution', 'published', 140
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 7
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Polinomios · Álgebra elemental');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Casos de factorización · Álgebra elemental',
  'OpenStax Elementary Algebra 2e, capítulo 7: factor común, diferencia de cuadrados y trinomios. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/elementary-algebra-2e/pages/7-introduction',
  'institution', 'published', 150
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 8
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Casos de factorización · Álgebra elemental');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Fracciones algebraicas · Álgebra elemental',
  'OpenStax Elementary Algebra 2e, capítulo 8: expresiones racionales. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/elementary-algebra-2e/pages/8-introduction',
  'institution', 'published', 140
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 8
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Fracciones algebraicas · Álgebra elemental');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Sistemas de ecuaciones · Álgebra elemental',
  'OpenStax Elementary Algebra 2e, capítulo 5: sistemas 2×2 por gráfica, sustitución y eliminación. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/elementary-algebra-2e/pages/5-introduction',
  'institution', 'published', 160
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 9
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Sistemas de ecuaciones · Álgebra elemental');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Sistemas con tres variables',
  'OpenStax College Algebra 2e, sección 7.2: sistemas lineales de tres variables. Licencia CC BY.',
  s.id, g.id, 'link',
  'https://openstax.org/books/college-algebra-2e/pages/7-2-systems-of-linear-equations-three-variables',
  'institution', 'published', 150
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 9
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Sistemas con tres variables');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Gauss-Jordan · College Algebra',
  'OpenStax College Algebra 2e, sección 7.6: eliminación de Gauss. Licencia CC BY. La herramienta de la clase hace los pasos sobre la matriz del estudiante.',
  s.id, g.id, 'link',
  'https://openstax.org/books/college-algebra-2e/pages/7-6-solving-systems-with-gaussian-elimination',
  'institution', 'published', 180
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 9
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Gauss-Jordan · College Algebra');

INSERT INTO library_items (title, description, subject_id, grade_id, kind, url, visibility, status, text_chars)
SELECT 'Derechos Básicos de Aprendizaje · Matemáticas',
  'Ministerio de Educación Nacional. DBA de matemáticas para contrastar los temas de sexto a noveno.',
  s.id, g.id, 'link',
  'https://www.colombiaaprende.edu.co/recurso-coleccion/derechos-basicos-de-aprendizaje-en-todas-las-areas',
  'institution', 'published', 160
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 6
  AND NOT EXISTS (SELECT 1 FROM library_items WHERE title = 'Derechos Básicos de Aprendizaje · Matemáticas');
