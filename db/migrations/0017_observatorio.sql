-- Observatorio: consultas en lenguaje natural convertidas a SQL de solo lectura.
-- El modelo solo conoce estas vistas v_* (columnas en español). Cada vista expone group_id
-- para que el servidor limite a un docente a sus grupos con un CTE que la reemplaza.
-- Las consultas corren con SET LOCAL ROLE ludoteka_reader, que solo tiene SELECT sobre v_*.

CREATE OR REPLACE VIEW v_estudiantes AS
SELECT u.id AS estudiante_id, u.full_name AS estudiante, gc.name AS grupo, gr.name AS grado, y.name AS anio,
       e.status AS estado_matricula, u.is_minor AS es_menor, e.group_id
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN groups_class gc ON gc.id = e.group_id
JOIN grades gr ON gr.id = gc.grade_id
JOIN academic_years y ON y.id = e.academic_year_id;

CREATE OR REPLACE VIEW v_cursos AS
SELECT c.id AS curso_id, c.title AS curso, s.name AS materia, gc.name AS grupo, u.full_name AS docente,
       c.published AS publicado, c.group_id
FROM courses c
JOIN subjects s ON s.id = c.subject_id
JOIN groups_class gc ON gc.id = c.group_id
JOIN users u ON u.id = c.teacher_id;

CREATE OR REPLACE VIEW v_evaluaciones AS
SELECT a.id AS evaluacion_id, a.code AS codigo, a.title AS evaluacion, a.kind AS tipo, a.status AS estado,
       c.id AS curso_id, c.title AS curso, c.group_id,
       (SELECT count(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) AS preguntas,
       a.created_at AS creada_en
FROM assessments a
JOIN courses c ON c.id = a.course_id;

CREATE OR REPLACE VIEW v_intentos AS
SELECT t.id AS intento_id, t.user_id AS estudiante_id, u.full_name AS estudiante,
       a.id AS evaluacion_id, a.title AS evaluacion, a.kind AS tipo, c.id AS curso_id, c.title AS curso, c.group_id,
       t.status AS estado, t.score AS puntaje, t.max_score AS puntaje_max,
       CASE WHEN t.max_score > 0 THEN round(t.score * 100.0 / t.max_score, 1) END AS porcentaje,
       coalesce(f.flagged, false) AS marcado, coalesce(f.violation_count, 0) AS infracciones,
       t.started_at AS iniciado_en, t.submitted_at AS enviado_en
FROM attempts t
JOIN users u ON u.id = t.user_id
JOIN assessments a ON a.id = t.assessment_id
JOIN courses c ON c.id = a.course_id
LEFT JOIN attempt_flags f ON f.attempt_id = t.id;

CREATE OR REPLACE VIEW v_respuestas AS
SELECT aa.attempt_id AS intento_id, t.user_id AS estudiante_id, u.full_name AS estudiante, c.group_id,
       a.title AS evaluacion, q.code AS pregunta_codigo, q.prompt AS pregunta, tp.name AS tema,
       q.difficulty AS dificultad, aa.correct AS correcta, aa.elapsed_ms AS tiempo_ms, aa.answered_at AS respondida_en
FROM attempt_answers aa
JOIN attempts t ON t.id = aa.attempt_id
JOIN users u ON u.id = t.user_id
JOIN assessments a ON a.id = t.assessment_id
JOIN courses c ON c.id = a.course_id
JOIN questions q ON q.id = aa.question_id
LEFT JOIN question_topics qt ON qt.question_id = q.id
LEFT JOIN topics tp ON tp.id = qt.topic_id;

CREATE OR REPLACE VIEW v_tareas AS
SELECT s.id AS entrega_id, asg.title AS tarea, c.title AS curso, c.group_id,
       s.user_id AS estudiante_id, u.full_name AS estudiante, s.status AS estado,
       s.score AS puntaje, asg.max_score AS puntaje_max, asg.due_at AS fecha_limite,
       s.submitted_at AS entregada_en, s.graded_at AS calificada_en
FROM submissions s
JOIN assignments asg ON asg.id = s.assignment_id
JOIN courses c ON c.id = asg.course_id
JOIN users u ON u.id = s.user_id;

CREATE OR REPLACE VIEW v_lecciones AS
SELECT lp.user_id AS estudiante_id, u.full_name AS estudiante, c.group_id, c.title AS curso,
       un.title AS unidad, l.title AS leccion, lp.status AS estado, lp.completed_at AS completada_en
FROM lesson_progress lp
JOIN users u ON u.id = lp.user_id
JOIN lessons l ON l.id = lp.lesson_id
JOIN units un ON un.id = l.unit_id
JOIN courses c ON c.id = un.course_id;

CREATE OR REPLACE VIEW v_integridad AS
SELECT ie.id AS evento_id, ie.attempt_id AS intento_id, ie.user_id AS estudiante_id, u.full_name AS estudiante,
       c.group_id, a.title AS evaluacion, ie.type AS tipo, ie.at AS ocurrido_en
FROM integrity_events ie
JOIN users u ON u.id = ie.user_id
JOIN attempts t ON t.id = ie.attempt_id
JOIN assessments a ON a.id = t.assessment_id
JOIN courses c ON c.id = a.course_id;

CREATE OR REPLACE VIEW v_xp AS
SELECT e.user_id AS estudiante_id, u.full_name AS estudiante, e.group_id,
       (SELECT coalesce(sum(x.amount), 0) FROM xp_ledger x WHERE x.user_id = e.user_id) AS xp_total,
       coalesce(st.current_count, 0) AS racha_actual, coalesce(st.best_count, 0) AS mejor_racha,
       (SELECT count(*) FROM user_badges b WHERE b.user_id = e.user_id) AS insignias
FROM enrollments e
JOIN academic_years y ON y.id = e.academic_year_id AND y.is_current
JOIN users u ON u.id = e.user_id
LEFT JOIN streaks st ON st.user_id = e.user_id;

CREATE OR REPLACE VIEW v_maestria AS
SELECT m.user_id AS estudiante_id, u.full_name AS estudiante, e.group_id, t.name AS tema, t.code AS tema_codigo,
       m.level AS nivel, m.correct_count AS aciertos, m.attempt_count AS intentos, m.updated_at AS actualizado_en
FROM topic_mastery m
JOIN users u ON u.id = m.user_id
JOIN topics t ON t.id = m.topic_id
JOIN enrollments e ON e.user_id = m.user_id
JOIN academic_years y ON y.id = e.academic_year_id AND y.is_current;

CREATE OR REPLACE VIEW v_ruta AS
SELECT r.id AS reto_id, r.user_id AS estudiante_id, u.full_name AS estudiante, e.group_id, t.name AS tema,
       r.level AS nivel, r.status AS estado, r.source AS origen, r.verification AS verificacion,
       r.created_at AS creado_en, r.answered_at AS respondido_en
FROM route_items r
JOIN users u ON u.id = r.user_id
JOIN topics t ON t.id = r.topic_id
JOIN enrollments e ON e.user_id = r.user_id
JOIN academic_years y ON y.id = e.academic_year_id AND y.is_current;

CREATE OR REPLACE VIEW v_biblioteca AS
SELECT li.id AS recurso_id, li.title AS titulo, li.kind AS tipo, s.name AS materia, li.visibility AS visibilidad,
       li.status AS estado, c.group_id,
       (SELECT count(*) FROM library_views v WHERE v.item_id = li.id) AS vistas,
       (SELECT count(*) FROM bookmarks b WHERE b.item_id = li.id) AS guardados,
       li.created_at AS creado_en
FROM library_items li
JOIN subjects s ON s.id = li.subject_id
LEFT JOIN courses c ON c.id = li.course_id;

CREATE ROLE IF NOT EXISTS ludoteka_reader;

GRANT SELECT ON TABLE v_estudiantes, v_cursos, v_evaluaciones, v_intentos, v_respuestas, v_tareas, v_lecciones,
  v_integridad, v_xp, v_maestria, v_ruta, v_biblioteca TO ludoteka_reader;

CREATE TABLE IF NOT EXISTS nl_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question STRING NOT NULL CHECK (length(question) BETWEEN 5 AND 400),
  sql_text STRING NULL,
  status STRING NOT NULL CHECK (status IN ('ok', 'rejected', 'error', 'no_model')),
  reason STRING NULL,
  row_count INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  duration_ms INT NULL CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nl_queries_user ON nl_queries (user_id, created_at DESC);
