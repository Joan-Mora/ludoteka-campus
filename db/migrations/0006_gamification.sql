CREATE TABLE IF NOT EXISTS levels (
  level INT PRIMARY KEY,
  min_xp INT NOT NULL,
  title STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason STRING NOT NULL,
  source_type STRING NOT NULL,
  source_id STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE,
  name STRING NOT NULL,
  description STRING NOT NULL,
  icon STRING NOT NULL DEFAULT 'medal'
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS streaks (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  current_count INT NOT NULL DEFAULT 0,
  best_count INT NOT NULL DEFAULT 0,
  last_activity_on DATE NULL
);

CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code STRING NOT NULL UNIQUE,
  title STRING NOT NULL,
  description STRING NOT NULL,
  goal_type STRING NOT NULL CHECK (goal_type IN ('lessons', 'xp', 'minigame')),
  goal_count INT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 20,
  active BOOL NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS mission_progress (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions (id) ON DELETE CASCADE,
  week_key STRING NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, mission_id, week_key)
);

CREATE TABLE IF NOT EXISTS minigame_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game STRING NOT NULL CHECK (game IN ('carrera', 'fracciones')),
  score INT NOT NULL,
  xp_awarded INT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups_class (id) ON DELETE CASCADE,
  week_key STRING NOT NULL,
  ranks JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, week_key)
);

CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_ledger (user_id, created_at);
