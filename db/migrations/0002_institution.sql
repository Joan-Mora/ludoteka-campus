CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name STRING NOT NULL UNIQUE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  is_current BOOL NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
  name STRING NOT NULL,
  position INT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  UNIQUE (academic_year_id, position)
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INT NOT NULL UNIQUE,
  name STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS groups_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES grades (id),
  academic_year_id UUID NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
  name STRING NOT NULL,
  UNIQUE (grade_id, academic_year_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE,
  name STRING NOT NULL,
  area STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups_class (id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
  status STRING NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  UNIQUE (user_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS teaching_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects (id),
  group_id UUID NOT NULL REFERENCES groups_class (id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years (id) ON DELETE CASCADE,
  UNIQUE (teacher_id, subject_id, group_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_enroll_group ON enrollments (group_id);
CREATE INDEX IF NOT EXISTS idx_teach_teacher ON teaching_assignments (teacher_id);
