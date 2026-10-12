-- Va aparte de 0024: CockroachDB no admite un cambio de esquema después de escribir filas en la misma transacción.
ALTER TABLE minigame_runs ADD CONSTRAINT minigame_runs_game_fkey FOREIGN KEY (game) REFERENCES arcade_games (code);
