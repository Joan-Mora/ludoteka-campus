/**
 * Catálogo de insignias. Cada una mide un contador (`metric`) y sube de nivel al cruzar sus umbrales:
 * uno = una sola medalla; tres = bronce, plata y oro. Las de temporada se cuentan solo dentro del periodo actual.
 */
export type BadgeCategory = 'constancia' | 'dominio' | 'exploracion' | 'colaboracion' | 'arcade' | 'biblioteca' | 'perfil' | 'temporada';

export type Metric =
  | 'streak_best' | 'full_weeks' | 'early' | 'xp' | 'missions'
  | 'lessons' | 'submissions' | 'exams' | 'perfect_exams' | 'stars' | 'bosses' | 'route_correct' | 'topics_max' | 'topics_touched' | 'fraction_gold'
  | 'buildings' | 'reviews' | 'focus_min' | 'tutor' | 'methods_tried'
  | 'forum_posts' | 'best_answers' | 'arena_games' | 'arena_locks' | 'live'
  | 'arcade' | 'arcade_perfect' | 'daily' | 'arcade_games' | 'memory_perfect' | 'hangman_clean'
  | 'library_views' | 'videos' | 'bookmarks' | 'glossary_hits'
  | 'profiles' | 'own_method' | 'methods_mastered'
  | 'season_xp' | 'season_days' | 'season_arcade';

export interface BadgeDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  metric: Metric;
  thresholds: number[];
  unit: string;
  hidden?: boolean;
  seasonal?: boolean;
}

export const BADGES: BadgeDef[] = [
  // Constancia
  { code: 'racha-3', name: 'Racha encendida', description: 'Días seguidos aprendiendo (tu mejor racha).', icon: 'flame', category: 'constancia', metric: 'streak_best', thresholds: [3, 7, 21], unit: 'días' },
  { code: 'semana-completa', name: 'Semana completa', description: 'Semanas con actividad en al menos cinco días distintos.', icon: 'calendar', category: 'constancia', metric: 'full_weeks', thresholds: [1, 4, 10], unit: 'semanas' },
  { code: 'xp-total', name: 'Coleccionista de XP', description: 'XP acumulada en todo el campus.', icon: 'zap', category: 'constancia', metric: 'xp', thresholds: [500, 2000, 6000], unit: 'XP' },
  { code: 'misiones', name: 'Misión cumplida', description: 'Misiones semanales completadas.', icon: 'target', category: 'constancia', metric: 'missions', thresholds: [1, 5, 15], unit: 'misiones' },
  { code: 'madrugador', name: 'Madrugador', description: 'Sumaste XP antes de las 7 de la mañana.', icon: 'sunrise', category: 'constancia', metric: 'early', thresholds: [3], unit: 'veces', hidden: true },

  // Dominio
  { code: 'primera-leccion', name: 'Lector constante', description: 'Lecciones completadas en tus cursos.', icon: 'book', category: 'dominio', metric: 'lessons', thresholds: [1, 10, 40], unit: 'lecciones' },
  { code: 'tareas', name: 'Tareas al día', description: 'Tareas entregadas y calificadas.', icon: 'clipboard', category: 'dominio', metric: 'submissions', thresholds: [1, 10, 30], unit: 'tareas' },
  { code: 'evaluado', name: 'Sin miedo al examen', description: 'Evaluaciones terminadas.', icon: 'file-check', category: 'dominio', metric: 'exams', thresholds: [1, 5, 15], unit: 'evaluaciones' },
  { code: 'examen-perfecto', name: 'Sin fallos', description: 'Evaluaciones con puntaje perfecto.', icon: 'star', category: 'dominio', metric: 'perfect_exams', thresholds: [1, 3, 8], unit: 'evaluaciones' },
  { code: 'estrellas', name: 'Cazador de estrellas', description: 'Estrellas del sendero de Mi ruta (una al nivel 4, dos al 7 y tres al 10).', icon: 'stars', category: 'dominio', metric: 'stars', thresholds: [3, 10, 25], unit: 'estrellas' },
  { code: 'matajefes', name: 'Matajefes', description: 'Retos jefe vencidos en Mi ruta.', icon: 'crown', category: 'dominio', metric: 'bosses', thresholds: [1, 5, 10], unit: 'jefes' },
  { code: 'paso-a-paso', name: 'Paso a paso', description: 'Retos de Mi ruta resueltos.', icon: 'footprints', category: 'dominio', metric: 'route_correct', thresholds: [10, 50, 150], unit: 'retos' },
  { code: 'explorador-temas', name: 'Explorador de temas', description: 'Temas distintos con al menos un reto resuelto.', icon: 'compass', category: 'dominio', metric: 'topics_touched', thresholds: [3, 6, 10], unit: 'temas' },
  { code: 'maestro', name: 'Maestro de un tema', description: 'Temas llevados al nivel 10.', icon: 'graduation', category: 'dominio', metric: 'topics_max', thresholds: [1, 3, 6], unit: 'temas' },
  { code: 'fracciones-oro', name: 'Fracciones de oro', description: 'Nivel 7 o más en los dos temas de fracciones.', icon: 'pie', category: 'dominio', metric: 'fraction_gold', thresholds: [2], unit: 'temas', hidden: true },

  // Exploración de edificios
  { code: 'explorador-campus', name: 'Explorador del campus', description: 'Edificios del campus que ya usaste: aula, biblioteca, Mi ruta, Cuaderno, Arcade, Arena, Luka y foros.', icon: 'map', category: 'exploracion', metric: 'buildings', thresholds: [3, 5, 8], unit: 'edificios' },
  { code: 'memoria-elefante', name: 'Memoria de elefante', description: 'Tarjetas repasadas en el Cuaderno.', icon: 'layers', category: 'exploracion', metric: 'reviews', thresholds: [10, 100, 400], unit: 'repasos' },
  { code: 'modo-enfoque', name: 'Modo enfoque', description: 'Minutos de sesiones de enfoque terminadas.', icon: 'timer', category: 'exploracion', metric: 'focus_min', thresholds: [25, 150, 600], unit: 'minutos' },
  { code: 'tutor-curioso', name: 'Pregunté antes de rendirme', description: 'Preguntas al tutor IA.', icon: 'message', category: 'exploracion', metric: 'tutor', thresholds: [1, 15, 50], unit: 'preguntas' },
  { code: 'probador-metodos', name: 'Probador de métodos', description: 'Formas de aprender que abriste en Mi espacio.', icon: 'lightbulb', category: 'exploracion', metric: 'methods_tried', thresholds: [2, 4, 6], unit: 'métodos' },

  // Colaboración
  { code: 'voz-del-foro', name: 'Voz del foro', description: 'Mensajes publicados en los foros de tus cursos.', icon: 'messages', category: 'colaboracion', metric: 'forum_posts', thresholds: [1, 10, 30], unit: 'mensajes' },
  { code: 'respuesta-estrella', name: 'Respuesta estrella', description: 'Respuestas tuyas marcadas como la mejor.', icon: 'award', category: 'colaboracion', metric: 'best_answers', thresholds: [1, 3, 10], unit: 'respuestas' },
  { code: 'gladiador', name: 'Gladiador', description: 'Partidas de Arena por equipos jugadas.', icon: 'swords', category: 'colaboracion', metric: 'arena_games', thresholds: [1, 5, 15], unit: 'partidas' },
  { code: 'capitan-certero', name: 'Capitán certero', description: 'Respuestas correctas que bloqueaste como capitán en la Arena.', icon: 'shield', category: 'colaboracion', metric: 'arena_locks', thresholds: [3, 15, 50], unit: 'respuestas' },
  { code: 'en-vivo', name: 'En vivo', description: 'Quices en vivo en los que participaste.', icon: 'radio', category: 'colaboracion', metric: 'live', thresholds: [1, 5, 15], unit: 'quices' },

  // Arcade
  { code: 'jugador-arcade', name: 'Jugador del Arcade', description: 'Partidas terminadas en el Arcade.', icon: 'gamepad', category: 'arcade', metric: 'arcade', thresholds: [5, 25, 75], unit: 'partidas' },
  { code: 'partida-perfecta', name: 'Partida perfecta', description: 'Partidas del Arcade sin un solo error.', icon: 'sparkles', category: 'arcade', metric: 'arcade_perfect', thresholds: [1, 5, 20], unit: 'partidas' },
  { code: 'reto-diario', name: 'Fiel al reto del día', description: 'Retos del día jugados.', icon: 'calendar-check', category: 'arcade', metric: 'daily', thresholds: [1, 7, 30], unit: 'retos' },
  { code: 'coleccion-juegos', name: 'Coleccionista de juegos', description: 'Juegos distintos del Arcade que ya probaste.', icon: 'grid', category: 'arcade', metric: 'arcade_games', thresholds: [3, 6, 10], unit: 'juegos' },
  { code: 'memoria-fotografica', name: 'Memoria fotográfica', description: 'Memoria de equivalencias con puntaje máximo.', icon: 'brain', category: 'arcade', metric: 'memory_perfect', thresholds: [1], unit: 'partidas', hidden: true },
  { code: 'sin-rasguno', name: 'Sin un rasguño', description: 'Ahorcado del glosario sin perder una sola vida.', icon: 'heart', category: 'arcade', metric: 'hangman_clean', thresholds: [1], unit: 'partidas', hidden: true },

  // Biblioteca
  { code: 'raton-biblioteca', name: 'Ratón de biblioteca', description: 'Documentos abiertos en la biblioteca.', icon: 'library', category: 'biblioteca', metric: 'library_views', thresholds: [1, 15, 50], unit: 'lecturas' },
  { code: 'cinefilo', name: 'Cinéfilo', description: 'Videos de la biblioteca vistos.', icon: 'video', category: 'biblioteca', metric: 'videos', thresholds: [1, 5, 15], unit: 'videos' },
  { code: 'separador', name: 'Separador de páginas', description: 'Marcadores guardados en documentos.', icon: 'bookmark', category: 'biblioteca', metric: 'bookmarks', thresholds: [1, 5, 20], unit: 'marcadores' },
  { code: 'diccionario', name: 'Diccionario andante', description: 'Términos del glosario acertados en el Quiz relámpago y el Ahorcado.', icon: 'spell', category: 'biblioteca', metric: 'glossary_hits', thresholds: [10, 50, 150], unit: 'términos' },

  // Perfil de aprendizaje
  { code: 'me-conozco', name: 'Me conozco', description: 'Veces que respondiste «Descubre cómo aprendes» (una por periodo).', icon: 'user-check', category: 'perfil', metric: 'profiles', thresholds: [1, 2, 3], unit: 'cuestionarios' },
  { code: 'fiel-a-mi-estilo', name: 'Fiel a mi estilo', description: 'Retos resueltos en tu forma de aprender principal.', icon: 'heart-handshake', category: 'perfil', metric: 'own_method', thresholds: [10, 40, 100], unit: 'retos' },
  { code: 'multimetodo', name: 'Multimétodo', description: 'Formas de aprender en las que ya resolviste al menos tres retos.', icon: 'shuffle', category: 'perfil', metric: 'methods_mastered', thresholds: [2, 4, 6], unit: 'métodos' },

  // Temporada (se reinicia cada periodo)
  { code: 'estrella-temporada', name: 'Estrella de la temporada', description: 'XP sumada en este periodo.', icon: 'trophy', category: 'temporada', metric: 'season_xp', thresholds: [300, 1000, 2500], unit: 'XP', seasonal: true },
  { code: 'constancia-temporada', name: 'Constancia de temporada', description: 'Días con actividad en este periodo.', icon: 'calendar-days', category: 'temporada', metric: 'season_days', thresholds: [10, 25, 45], unit: 'días', seasonal: true },
  { code: 'campeon-temporada', name: 'Campeón del Arcade', description: 'Partidas del Arcade en este periodo.', icon: 'medal', category: 'temporada', metric: 'season_arcade', thresholds: [10, 30, 60], unit: 'partidas', seasonal: true },
];

export const tierFor = (thresholds: number[], value: number) => thresholds.filter((t) => value >= t).length;
