INSERT INTO academic_years (name, starts_on, ends_on, is_current)
VALUES ('2026', '2026-01-15', '2026-11-30', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO periods (academic_year_id, name, position, starts_on, ends_on)
SELECT id, 'Periodo 1', 1, '2026-01-15', '2026-04-30' FROM academic_years WHERE name = '2026'
AND NOT EXISTS (
  SELECT 1 FROM periods p WHERE p.academic_year_id = academic_years.id AND p.position = 1
);

INSERT INTO grades (level, name) VALUES
  (6, 'Sexto'), (7, 'Séptimo'), (8, 'Octavo'), (9, 'Noveno'), (10, 'Décimo'), (11, 'Undécimo')
ON CONFLICT (level) DO NOTHING;

INSERT INTO groups_class (grade_id, academic_year_id, name)
SELECT g.id, y.id, '6A'
FROM grades g, academic_years y
WHERE g.level = 6 AND y.name = '2026'
AND NOT EXISTS (
  SELECT 1 FROM groups_class gc
  WHERE gc.grade_id = g.id AND gc.academic_year_id = y.id AND gc.name = '6A'
);

INSERT INTO subjects (code, name, area)
VALUES ('MAT', 'Matemáticas', 'Núcleo lógico')
ON CONFLICT (code) DO NOTHING;

INSERT INTO enrollments (user_id, group_id, academic_year_id)
SELECT u.id, gc.id, y.id
FROM users u, groups_class gc, grades g, academic_years y
WHERE u.email IN ('estudiante@eduquest.local', 'estudiante2@eduquest.local')
  AND gc.name = '6A' AND g.id = gc.grade_id AND g.level = 6
  AND y.id = gc.academic_year_id AND y.name = '2026'
ON CONFLICT (user_id, academic_year_id) DO NOTHING;

INSERT INTO teaching_assignments (teacher_id, subject_id, group_id, academic_year_id)
SELECT u.id, s.id, gc.id, y.id
FROM users u, subjects s, groups_class gc, grades g, academic_years y
WHERE u.email = 'docente@eduquest.local' AND s.code = 'MAT'
  AND gc.name = '6A' AND g.id = gc.grade_id AND g.level = 6
  AND y.id = gc.academic_year_id AND y.name = '2026'
ON CONFLICT (teacher_id, subject_id, group_id, academic_year_id) DO NOTHING;

DELETE FROM courses
WHERE subject_id = (SELECT id FROM subjects WHERE code = 'MAT')
  AND group_id IN (
    SELECT gc.id FROM groups_class gc
    JOIN grades g ON g.id = gc.grade_id
    JOIN academic_years y ON y.id = gc.academic_year_id
    WHERE g.level = 6 AND gc.name = '6A' AND y.name = '2026'
  );

DELETE FROM questions WHERE code LIKE 'MAT6-%';
DELETE FROM competencies WHERE code = 'MAT6-NUM';

INSERT INTO competencies (subject_id, grade_id, code, name)
SELECT s.id, g.id, 'MAT6-NUM', 'Resuelve problemas numéricos y geométricos de sexto'
FROM subjects s, grades g WHERE s.code = 'MAT' AND g.level = 6;

INSERT INTO courses (subject_id, group_id, teacher_id, academic_year_id, title, description, published)
SELECT s.id, gc.id, u.id, y.id,
  'Matemáticas 6° — Aventura lógica',
  'El aula de sexto: seis estaciones para pensar números, forma y datos. Cada lección deja una pista para el mapa.',
  true
FROM subjects s, groups_class gc, grades g, academic_years y, users u
WHERE s.code = 'MAT' AND gc.name = '6A' AND g.id = gc.grade_id AND g.level = 6
  AND y.id = gc.academic_year_id AND y.name = '2026' AND u.email = 'docente@eduquest.local';

INSERT INTO units (course_id, title, summary, position)
SELECT c.id, v.title, v.summary, v.position
FROM courses c
JOIN (VALUES
  (1, 'Números naturales', 'Valor posicional y el orden de las operaciones.'),
  (2, 'Fracciones', 'Equivalencias y operaciones con el mismo sentido.'),
  (3, 'Decimales y porcentajes', 'La recta y el tanto por ciento de la vida diaria.'),
  (4, 'Razones y proporciones', 'Comparar cantidades y la regla de tres.'),
  (5, 'Geometría plana', 'Ángulos, perímetro y área.'),
  (6, 'Estadística básica', 'Leer datos y resumirlos.')
) AS v(position, title, summary) ON true
WHERE c.title = 'Matemáticas 6° — Aventura lógica';

INSERT INTO lessons (unit_id, title, body_md, estimated_min, position, published)
SELECT u.id, v.title, v.body, 18, v.position, true
FROM units u
JOIN courses c ON c.id = u.course_id
JOIN (VALUES
  (1, 1, 'El sistema decimal', $md$En 4.352 el 4 vale cuatro mil, el 3 vale trescientos, el 5 vale cincuenta y el 2 vale dos. El lugar del dígito decide su valor.

Cuando compares números grandes, alinea las posiciones. Si una cifra de la izquierda es mayor, el número completo es mayor, sin mirar el resto.

Prueba con 7.804 y 7.840: las centenas deciden.$md$),
  (1, 2, 'Operaciones combinadas', $md$Primero lo que está entre paréntesis, luego multiplicaciones y divisiones de izquierda a derecha, y al final sumas y restas.

En 24 + 18 × 2 no se suma primero. 18 × 2 es 36, y 24 + 36 es 60.

Escribe el paso que hiciste. Si el resultado "se siente" raro, revisa el orden, no la calculadora.$md$),
  (2, 1, 'Fracciones equivalentes', $md$1/2 y 3/6 nombran la misma parte. Multiplica o divide el numerador y el denominador por el mismo número distinto de cero.

Para saber si dos fracciones son equivalentes, cruza: 1×6 y 2×3. Si los productos coinciden, son equivalentes.

Dibuja la unidad antes de operar. Una fracción sin dibujo se vuelve un truco.$md$),
  (2, 2, 'Sumar fracciones', $md$Si el denominador es el mismo, suma los numeradores y conserva el piso. 1/4 + 1/2 necesita un piso común: 1/4 + 2/4 = 3/4.

No sumes los denominadores. El denominador dice en cuántas partes está partida la unidad, no es otra cantidad para acumular.$md$),
  (3, 1, 'Decimales en la recta', $md$0,5 es la mitad. 0,25 es la cuarta parte. 0,5 + 0,25 = 0,75, tres cuartos del camino entre 0 y 1.

Alinea las comas al sumar. El lugar de las décimas se suma con las décimas.$md$),
  (3, 2, 'Porcentajes', $md$20% es 20 de cada 100, o 1/5. El 20% de 80 es 16, porque 80 ÷ 5 = 16.

Un porcentaje siempre es "de algo". Sin esa cantidad de referencia, el porcentaje no tiene tamaño.$md$),
  (4, 1, 'Razones', $md$Una razón 2:3 dice que por cada 2 de la primera cantidad hay 3 de la segunda. Si la primera pasa a 4, la segunda pasa a 6: se duplicó la pareja, no un solo lado.

Simplifica la razón dividiendo ambos números por el mismo factor.$md$),
  (4, 2, 'Regla de tres simple', $md$Si 3 cuadernos cuestan 6.000, un cuaderno cuesta 2.000 y cinco cuestan 10.000. Es una proporción directa: más cuadernos, más dinero, al mismo precio.

Si el enunciado dice que al aumentar una cosa la otra disminuye, la proporción es inversa y este atajo no sirve.$md$),
  (5, 1, 'Ángulos y polígonos', $md$Los ángulos interiores de un triángulo suman 180°. Si ya conoces 50° y 60°, el tercero es 70°.

Un cuadrilátero suma 360°. Antes de calcular, nombra la figura: no todo polígono se comporta igual.$md$),
  (5, 2, 'Perímetro y área', $md$El perímetro es el borde. El área es la superficie. En un rectángulo de 5 por 3, el perímetro es 16 y el área es 15.

No mezcles las unidades: el borde se mide en longitud y la superficie en unidades cuadradas.$md$),
  (6, 1, 'Tablas y gráficas', $md$Una tabla ordena categorías y frecuencias. Una gráfica de barras muestra esa frecuencia como altura. Lee primero el eje, no el dibujo bonito.

Si la escala no empieza en cero, la diferencia se ve más grande de lo que es.$md$),
  (6, 2, 'Promedio, mediana y moda', $md$El promedio de 4, 6 y 8 es 6: suma 18, divide entre 3. La moda es el dato que más se repite. En 2, 2, 3, 5 la moda es 2.

El promedio se mueve con un dato extremo. La mediana, el del centro ya ordenado, se queda más quieta.$md$)
) AS v(unit_pos, position, title, body)
  ON u.position = v.unit_pos
WHERE c.title = 'Matemáticas 6° — Aventura lógica';

INSERT INTO lesson_resources (lesson_id, kind, title, url, position)
SELECT l.id, 'note', 'Bitácora de la estación', NULL, 1
FROM lessons l
JOIN units u ON u.id = l.unit_id
JOIN courses c ON c.id = u.course_id
WHERE c.title = 'Matemáticas 6° — Aventura lógica' AND l.position = 1;

INSERT INTO assignments (course_id, title, instructions, due_at, max_score)
SELECT c.id,
  'Bitácora de problemas',
  'Elige un problema de la estación de fracciones y escribe cómo lo pensaste, no solo el número final. Incluye un dibujo descrito con palabras.',
  now() + interval '14 days',
  100
FROM courses c WHERE c.title = 'Matemáticas 6° — Aventura lógica';

INSERT INTO announcements (course_id, author_id, title, body)
SELECT c.id, c.teacher_id, 'Bienvenida al mapa',
  'Esta semana abrimos las dos primeras estaciones. El examen del periodo usa kiosco: pantalla completa y sin tutor. La práctica sí deja pedir pistas.'
FROM courses c WHERE c.title = 'Matemáticas 6° — Aventura lógica';

INSERT INTO calendar_events (course_id, title, starts_at, kind)
SELECT c.id, 'Examen del periodo', now() + interval '21 days', 'exam'
FROM courses c WHERE c.title = 'Matemáticas 6° — Aventura lógica';

INSERT INTO questions (code, subject_id, grade_id, competency_id, prompt, difficulty, explanation, active, created_by)
SELECT v.code, s.id, g.id, c.id, v.prompt, v.difficulty, v.explanation, true, u.id
FROM subjects s, grades g, competencies c, users u,
(VALUES
  ('MAT6-01', 'baja', 'En el número 4.352, ¿qué valor posicional tiene el dígito 3?', 'Está en las centenas: vale 300.'),
  ('MAT6-02', 'media', '¿Cuánto es 24 + 18 × 2?', 'Primero 18 × 2 = 36 y luego 24 + 36 = 60.'),
  ('MAT6-03', 'baja', '¿Cuál fracción es equivalente a 1/2?', '1×6 = 2×3, así que 3/6 equivale a 1/2.'),
  ('MAT6-04', 'media', '¿Cuánto es 1/4 + 1/2?', '1/2 = 2/4, y 1/4 + 2/4 = 3/4.'),
  ('MAT6-05', 'baja', '¿Cuánto es 0,5 + 0,25?', 'Media más un cuarto es 0,75.'),
  ('MAT6-06', 'media', '¿Cuál es el 20% de 80?', '20% es un quinto. 80 ÷ 5 = 16.'),
  ('MAT6-07', 'media', 'Si la razón es 2:3 y el primer término pasa a 4, ¿cuál es el segundo?', 'La pareja se duplica: 4:6.'),
  ('MAT6-08', 'media', '3 cuadernos cuestan 6.000. ¿Cuánto cuestan 5 al mismo precio?', 'Cada uno vale 2.000, cinco valen 10.000.'),
  ('MAT6-09', 'baja', 'Un triángulo tiene ángulos de 50° y 60°. ¿Cuánto mide el tercero?', '180 − 50 − 60 = 70.'),
  ('MAT6-10', 'baja', 'Un rectángulo mide 5 por 3. ¿Cuál es su área?', 'Base por altura: 15 unidades cuadradas.'),
  ('MAT6-11', 'baja', 'En los datos 2, 2, 3 y 5, ¿cuál es la moda?', 'El 2 aparece dos veces y es el más frecuente.'),
  ('MAT6-12', 'media', '¿Cuál es el promedio de 4, 6 y 8?', '(4+6+8) / 3 = 6.')
) AS v(code, difficulty, prompt, explanation)
WHERE s.code = 'MAT' AND g.level = 6 AND c.code = 'MAT6-NUM' AND u.email = 'docente@eduquest.local';

INSERT INTO question_options (question_id, label, text, is_correct, position)
SELECT q.id, o.label, o.text, o.correct, o.position
FROM questions q
JOIN (VALUES
  ('MAT6-01', 'A', 'Unidades', false, 1),
  ('MAT6-01', 'B', 'Decenas', false, 2),
  ('MAT6-01', 'C', 'Centenas', true, 3),
  ('MAT6-01', 'D', 'Millares', false, 4),
  ('MAT6-02', 'A', '84', false, 1),
  ('MAT6-02', 'B', '60', true, 2),
  ('MAT6-02', 'C', '44', false, 3),
  ('MAT6-02', 'D', '42', false, 4),
  ('MAT6-03', 'A', '2/3', false, 1),
  ('MAT6-03', 'B', '3/6', true, 2),
  ('MAT6-03', 'C', '1/3', false, 3),
  ('MAT6-03', 'D', '3/5', false, 4),
  ('MAT6-04', 'A', '2/6', false, 1),
  ('MAT6-04', 'B', '1/6', false, 2),
  ('MAT6-04', 'C', '3/4', true, 3),
  ('MAT6-04', 'D', '2/4', false, 4),
  ('MAT6-05', 'A', '0,75', true, 1),
  ('MAT6-05', 'B', '0,55', false, 2),
  ('MAT6-05', 'C', '0,30', false, 3),
  ('MAT6-05', 'D', '0,7', false, 4),
  ('MAT6-06', 'A', '8', false, 1),
  ('MAT6-06', 'B', '20', false, 2),
  ('MAT6-06', 'C', '16', true, 3),
  ('MAT6-06', 'D', '40', false, 4),
  ('MAT6-07', 'A', '5', false, 1),
  ('MAT6-07', 'B', '6', true, 2),
  ('MAT6-07', 'C', '8', false, 3),
  ('MAT6-07', 'D', '3', false, 4),
  ('MAT6-08', 'A', '8.000', false, 1),
  ('MAT6-08', 'B', '9.000', false, 2),
  ('MAT6-08', 'C', '10.000', true, 3),
  ('MAT6-08', 'D', '12.000', false, 4),
  ('MAT6-09', 'A', '70°', true, 1),
  ('MAT6-09', 'B', '80°', false, 2),
  ('MAT6-09', 'C', '90°', false, 3),
  ('MAT6-09', 'D', '110°', false, 4),
  ('MAT6-10', 'A', '16', false, 1),
  ('MAT6-10', 'B', '8', false, 2),
  ('MAT6-10', 'C', '15', true, 3),
  ('MAT6-10', 'D', '30', false, 4),
  ('MAT6-11', 'A', '5', false, 1),
  ('MAT6-11', 'B', '3', false, 2),
  ('MAT6-11', 'C', '2', true, 3),
  ('MAT6-11', 'D', '4', false, 4),
  ('MAT6-12', 'A', '18', false, 1),
  ('MAT6-12', 'B', '8', false, 2),
  ('MAT6-12', 'C', '6', true, 3),
  ('MAT6-12', 'D', '4', false, 4)
) AS o(code, label, text, correct, position) ON o.code = q.code;

INSERT INTO assessments (code, course_id, title, kind, status, time_limit_sec, created_by)
SELECT v.code, c.id, v.title, v.kind, 'published', v.seconds, c.teacher_id
FROM courses c
JOIN (VALUES
  ('MAT6-PRACTICA', 'Práctica: números y fracciones', 'practice', 480),
  ('MAT6-EXAMEN', 'Examen del periodo', 'exam', 900),
  ('MAT6-VIVO', 'Reto en vivo del aula', 'live', 30)
) AS v(code, title, kind, seconds) ON true
WHERE c.title = 'Matemáticas 6° — Aventura lógica';

INSERT INTO assessment_questions (assessment_id, question_id, position, points)
SELECT a.id, q.id, l.position, 10
FROM assessments a
JOIN questions q ON true
JOIN (VALUES
  ('MAT6-PRACTICA', 'MAT6-01', 1),
  ('MAT6-PRACTICA', 'MAT6-02', 2),
  ('MAT6-PRACTICA', 'MAT6-03', 3),
  ('MAT6-PRACTICA', 'MAT6-04', 4),
  ('MAT6-EXAMEN', 'MAT6-05', 1),
  ('MAT6-EXAMEN', 'MAT6-06', 2),
  ('MAT6-EXAMEN', 'MAT6-07', 3),
  ('MAT6-EXAMEN', 'MAT6-08', 4),
  ('MAT6-EXAMEN', 'MAT6-09', 5),
  ('MAT6-EXAMEN', 'MAT6-10', 6),
  ('MAT6-EXAMEN', 'MAT6-11', 7),
  ('MAT6-EXAMEN', 'MAT6-12', 8),
  ('MAT6-VIVO', 'MAT6-01', 1),
  ('MAT6-VIVO', 'MAT6-03', 2),
  ('MAT6-VIVO', 'MAT6-06', 3),
  ('MAT6-VIVO', 'MAT6-09', 4)
) AS l(assessment_code, question_code, position)
  ON l.assessment_code = a.code AND l.question_code = q.code;

INSERT INTO levels (level, min_xp, title) VALUES
  (1, 0, 'Aprendiz'),
  (2, 100, 'Explorador'),
  (3, 250, 'Estratega'),
  (4, 500, 'Analista'),
  (5, 900, 'Mentor')
ON CONFLICT (level) DO NOTHING;

INSERT INTO badges (code, name, description, icon) VALUES
  ('primera-leccion', 'Primera estación', 'Completaste tu primera lección del mapa.', 'flag'),
  ('racha-3', 'Tres días en el aula', 'Volviste tres días seguidos.', 'flame'),
  ('examen-perfecto', 'Sin fallos', 'Un examen o práctica en el puntaje máximo.', 'star'),
  ('tutor-curioso', 'Pregunté antes de rendirme', 'Usaste el tutor de práctica.', 'message')
ON CONFLICT (code) DO NOTHING;

INSERT INTO missions (code, title, description, goal_type, goal_count, xp_reward, active) VALUES
  ('m-lecciones', 'Dos estaciones', 'Completa 2 lecciones esta semana.', 'lessons', 2, 30, true),
  ('m-xp', 'Cincuenta de experiencia', 'Reúne 50 XP esta semana.', 'xp', 50, 20, true),
  ('m-juego', 'Un refuerzo', 'Juega un minijuego de matemáticas.', 'minigame', 1, 15, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO integrity_policies (name, max_violations, is_default)
VALUES ('Aula CFA', 3, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO certificate_templates (name, body_md, active)
VALUES ('Competencias lógicas', 'Certificado del Colegio Francisco Arango por el recorrido en EduQuest.', true)
ON CONFLICT (name) DO NOTHING;
