-- Cartelera: los avisos también se dirigen a un grado completo (todos sus grupos).
ALTER TABLE news_audience DROP CONSTRAINT IF EXISTS check_kind;
