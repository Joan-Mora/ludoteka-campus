-- Libro de calificaciones: categorías ponderadas (la suma de 100 % la valida el servicio,
-- porque un CHECK no puede mirar otras filas), rúbricas, asistencia y alertas de riesgo.

CREATE TABLE IF NOT EXISTS grade_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  name STRING NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  source STRING NOT NULL CHECK (source IN ('exam', 'practice', 'live', 'assignment', 'rubric', 'attendance')),
  weight DECIMAL(5, 2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  position INT NOT NULL CHECK (position > 0),
  UNIQUE (course_id, name),
  UNIQUE (course_id, source),
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  assignment_id UUID NULL REFERENCES assignments (id) ON DELETE SET NULL,
  title STRING NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  created_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubrics_course ON rubrics (course_id);

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES rubrics (id) ON DELETE CASCADE,
  name STRING NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  description STRING NOT NULL DEFAULT '' CHECK (length(description) <= 400),
  max_points INT NOT NULL CHECK (max_points BETWEEN 1 AND 100),
  position INT NOT NULL CHECK (position > 0),
  UNIQUE (rubric_id, position)
);

-- Puntaje de un estudiante en un criterio; que no supere max_points lo valida el servicio.
CREATE TABLE IF NOT EXISTS rubric_scores (
  criterion_id UUID NOT NULL REFERENCES rubric_criteria (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES rubrics (id) ON DELETE CASCADE,
  points INT NOT NULL CHECK (points >= 0),
  comment STRING NOT NULL DEFAULT '' CHECK (length(comment) <= 400),
  graded_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (criterion_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_rubric_scores_rubric ON rubric_scores (rubric_id, student_id);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_on DATE NOT NULL,
  status STRING NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  note STRING NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  recorded_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id, session_on)
);

CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance (course_id, session_on DESC);

CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  kind STRING NOT NULL CHECK (kind IN ('low_grade', 'absences', 'integrity', 'inactivity')),
  level STRING NOT NULL CHECK (level IN ('media', 'alta')),
  detail STRING NOT NULL CHECK (length(detail) BETWEEN 3 AND 300),
  status STRING NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);

-- Una sola alerta viva por estudiante, curso y tipo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_alerts_live ON risk_alerts (student_id, course_id, kind) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS idx_risk_alerts_course ON risk_alerts (course_id, status);
