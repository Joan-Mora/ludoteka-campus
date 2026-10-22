-- El Arcade vuelve a listar los diez juegos. La migración 0035 los había dejado inactivos.
UPDATE arcade_games SET active = true
WHERE code IN ('carrera', 'fracciones', 'memoria', 'recta', 'ordena', 'torre', 'mercado', 'area', 'ahorcado', 'quiz');
