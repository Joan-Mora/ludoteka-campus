-- Destructivo: borra el prototipo de quizzes anterior.
-- Solo corre una vez (schema_migrations). En una base nueva no encuentra tablas.
DROP TABLE IF EXISTS attempt_answers CASCADE;
DROP TABLE IF EXISTS integrity_events CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS facial_embeddings CASCADE;
DROP TABLE IF EXISTS facial_consents CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quiz_session_questions CASCADE;
DROP TABLE IF EXISTS quiz_sessions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
