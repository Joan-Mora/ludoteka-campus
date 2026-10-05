CREATE TABLE IF NOT EXISTS competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  grade_id UUID NULL REFERENCES grades (id),
  code STRING NOT NULL UNIQUE,
  name STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE,
  subject_id UUID NOT NULL REFERENCES subjects (id),
  grade_id UUID NULL REFERENCES grades (id),
  competency_id UUID NULL REFERENCES competencies (id) ON DELETE SET NULL,
  prompt STRING NOT NULL,
  difficulty STRING NOT NULL DEFAULT 'media' CHECK (difficulty IN ('baja', 'media', 'alta')),
  explanation STRING NOT NULL DEFAULT '',
  created_by UUID NULL REFERENCES users (id) ON DELETE SET NULL,
  active BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  label STRING NOT NULL,
  text STRING NOT NULL,
  is_correct BOOL NOT NULL DEFAULT false,
  position INT NOT NULL,
  UNIQUE (question_id, label)
);

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE,
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title STRING NOT NULL,
  kind STRING NOT NULL CHECK (kind IN ('practice', 'exam', 'live')),
  status STRING NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  time_limit_sec INT NOT NULL DEFAULT 600,
  created_by UUID NULL REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_questions (
  assessment_id UUID NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id),
  position INT NOT NULL,
  points INT NOT NULL DEFAULT 100,
  PRIMARY KEY (assessment_id, question_id)
);

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'suspended')),
  score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS attempts_one_active
  ON attempts (user_id, assessment_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id),
  option_id UUID NULL REFERENCES question_options (id),
  correct BOOL NOT NULL DEFAULT false,
  points INT NOT NULL DEFAULT 0,
  elapsed_ms INT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES users (id),
  code STRING NOT NULL UNIQUE,
  status STRING NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'live', 'ended')),
  current_position INT NOT NULL DEFAULT 0,
  question_started_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_participants (
  session_id UUID NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  attempt_id UUID NULL REFERENCES attempts (id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
