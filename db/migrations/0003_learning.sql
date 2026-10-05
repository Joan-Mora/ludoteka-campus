CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id),
  group_id UUID NOT NULL REFERENCES groups_class (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users (id),
  academic_year_id UUID NOT NULL REFERENCES academic_years (id),
  title STRING NOT NULL,
  description STRING NOT NULL DEFAULT '',
  published BOOL NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, group_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title STRING NOT NULL,
  summary STRING NOT NULL DEFAULT '',
  position INT NOT NULL,
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units (id) ON DELETE CASCADE,
  title STRING NOT NULL,
  body_md STRING NOT NULL DEFAULT '',
  estimated_min INT NOT NULL DEFAULT 15,
  position INT NOT NULL,
  published BOOL NOT NULL DEFAULT true,
  UNIQUE (unit_id, position)
);

CREATE TABLE IF NOT EXISTS lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  kind STRING NOT NULL CHECK (kind IN ('link', 'note', 'video')),
  title STRING NOT NULL,
  url STRING NULL,
  position INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  status STRING NOT NULL CHECK (status IN ('started', 'completed')),
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  lesson_id UUID NULL REFERENCES lessons (id) ON DELETE SET NULL,
  title STRING NOT NULL,
  instructions STRING NOT NULL,
  due_at TIMESTAMPTZ NULL,
  max_score INT NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
  score INT NULL,
  feedback STRING NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ NULL,
  UNIQUE (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users (id),
  title STRING NOT NULL,
  body STRING NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title STRING NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NULL,
  kind STRING NOT NULL DEFAULT 'class' CHECK (kind IN ('class', 'exam', 'task', 'event'))
);

CREATE INDEX IF NOT EXISTS idx_units_course ON units (course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons (unit_id);
CREATE INDEX IF NOT EXISTS idx_assign_course ON assignments (course_id);
