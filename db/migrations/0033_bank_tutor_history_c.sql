-- Las conversaciones existentes quedan ordenadas por su último mensaje.
UPDATE tutor_conversations c
SET updated_at = m.last_at
FROM (SELECT conversation_id, max(created_at) AS last_at FROM tutor_messages GROUP BY conversation_id) m
WHERE m.conversation_id = c.id;
