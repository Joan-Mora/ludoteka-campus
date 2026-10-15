CREATE INDEX IF NOT EXISTS tutor_conversations_recent ON tutor_conversations (user_id, updated_at DESC);
