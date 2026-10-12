-- Cursos de demostración por grado y materia: reparten la biblioteca por curso y se listan después de los reales.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_demo BOOL NOT NULL DEFAULT false;
