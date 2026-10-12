-- Paso 2: rectoria@ pasa a rector; cualquier otro directivo pasa a coordinación.
UPDATE user_roles SET role = 'rector'
WHERE role = 'directivo' AND user_id IN (SELECT id FROM users WHERE email = 'rectoria@eduquest.local');

UPDATE user_roles SET role = 'coordinator' WHERE role = 'directivo';

-- Las circulares dirigidas a "directivo" llegan ahora a coordinación y a rectoría.
INSERT INTO news_audience (news_id, kind, value)
SELECT news_id, 'role', 'rector' FROM news_audience WHERE kind = 'role' AND value = 'directivo'
ON CONFLICT DO NOTHING;

UPDATE news_audience SET value = 'coordinator' WHERE kind = 'role' AND value = 'directivo';
