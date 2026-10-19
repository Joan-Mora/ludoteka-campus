-- Los juegos de la clase usan nombres nuevos (balanza, fichas, gauss, final…).
-- La lista válida vive en el servicio, no en un CHECK que haya que migrar en cada juego.
ALTER TABLE guest_sessions DROP CONSTRAINT IF EXISTS check_activity;
ALTER TABLE guest_runs DROP CONSTRAINT IF EXISTS check_game;
