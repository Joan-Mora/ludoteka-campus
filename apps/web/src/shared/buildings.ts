import { BrainCircuit, ClipboardList, Compass, Database, Library, Megaphone, NotebookPen, School, Swords, Trophy, type LucideIcon } from 'lucide-react';

/* ---------- Buildings ---------- */

export type BuildingKey = 'aula' | 'biblioteca' | 'lab' | 'arena' | 'trofeos' | 'cartelera' | 'cuaderno' | 'ruta';
export type Shape = 'school' | 'library' | 'lab' | 'stadium' | 'hall' | 'board' | 'house' | 'tower';

export interface Building {
  key: BuildingKey;
  name: string;
  /** Follows the pending count: "3 avisos sin leer". */
  caption: string;
  /** Shown instead when nothing is pending. */
  idle: string;
  to: string;
  icon: LucideIcon;
  color: string;
  shape: Shape;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  voice: string[];
}

export const G = 14;

export const layout: Record<BuildingKey, Pick<Building, 'x' | 'y' | 'w' | 'd' | 'h' | 'shape' | 'color'>> = {
  biblioteca: { x: 1, y: 1, w: 2.5, d: 2.1, h: 1.8, shape: 'library', color: '#4f86f7' },
  lab: { x: 10.2, y: 1, w: 2.3, d: 2.3, h: 1.6, shape: 'lab', color: '#8b6cff' },
  cuaderno: { x: 1, y: 6.1, w: 1.8, d: 1.7, h: 1.2, shape: 'house', color: '#19c39c' },
  aula: { x: 5.6, y: 5.5, w: 2.6, d: 2.6, h: 2.2, shape: 'school', color: '#ff8a5c' },
  ruta: { x: 11.4, y: 6.3, w: 1, d: 1, h: 2.1, shape: 'tower', color: '#3ab8ff' },
  trofeos: { x: 1.2, y: 10.6, w: 2, d: 1.9, h: 1.4, shape: 'hall', color: '#ffc83d' },
  cartelera: { x: 6, y: 12.1, w: 1.9, d: 0.18, h: 1.1, shape: 'board', color: '#ff5d73' },
  arena: { x: 9.9, y: 9.9, w: 3, d: 3, h: 0.7, shape: 'stadium', color: '#ff5d73' },
};

export function buildingsFor(role: string | undefined, companionName = 'Luka'): Building[] {
  const student = role === 'student';
  const guardian = role === 'guardian';
  const rector = role === 'admin' || role === 'rector';
  const coordinator = role === 'coordinator';
  const list: Omit<Building, keyof (typeof layout)[BuildingKey]>[] = [
    {
      key: 'aula',
      name: guardian ? 'Familia' : 'Aula',
      caption: student ? 'pendientes esta semana' : role === 'teacher' ? 'entregas por calificar' : guardian ? 'por atender' : 'pendientes',
      idle: student ? 'al día esta semana' : role === 'teacher' ? 'sin entregas por calificar' : guardian ? 'todo al día' : 'cursos del colegio',
      to: guardian ? '/app/acudiente' : '/app/cursos',
      icon: School,
      voice: ['aula', 'cursos', 'mis cursos', 'clases', 'seguimiento'],
    },
    { key: 'biblioteca', name: 'Biblioteca', caption: 'recursos nuevos', idle: 'sin novedades desde tu visita', to: '/app/biblioteca', icon: Library, voice: ['biblioteca', 'libros', 'recursos', 'documentos'] },
    { key: 'lab', name: 'Laboratorio IA', caption: 'pendientes', idle: `pregúntale a ${companionName}`, to: '/app/tutor', icon: BrainCircuit, voice: ['laboratorio', 'tutor', 'inteligencia artificial', 'luka', 'luna', 'preguntar'] },
    { key: 'arena', name: 'Arena', caption: 'salas abiertas ahora', idle: 'sin salas abiertas', to: '/app/arena', icon: Swords, voice: ['arena', 'competencia', 'equipos', 'en vivo', 'jugar en equipo'] },
    {
      key: 'trofeos',
      name: student ? 'Sala de trofeos' : 'Certificados',
      caption: student ? 'insignias nuevas' : 'pendientes',
      idle: student ? 'todo visto' : 'certificados y reportes',
      to: student ? '/app/logros' : rector ? '/app/rectoria' : '/app/cursos',
      icon: Trophy,
      voice: ['trofeos', 'logros', 'insignias', 'certificados'],
    },
    { key: 'cartelera', name: 'Cartelera', caption: 'avisos sin leer', idle: 'todo leído', to: '/app/novedades', icon: Megaphone, voice: ['cartelera', 'novedades', 'noticias', 'avisos', 'anuncios', 'foros'] },
    student || guardian
      ? { key: 'cuaderno', name: 'Cuaderno', caption: 'tarjetas para repasar hoy', idle: 'nada para repasar hoy', to: '/app/cuaderno', icon: NotebookPen, voice: ['cuaderno', 'apuntes', 'notas', 'flashcards', 'tarjetas', 'repasar'] }
      : coordinator
        ? { key: 'cuaderno', name: 'Coordinación', caption: 'alertas abiertas', idle: 'sin alertas abiertas', to: '/app/coordinacion', icon: ClipboardList, voice: ['coordinacion', 'seguimiento', 'alertas', 'citaciones', 'asistencia'] }
        : role === 'rector'
          ? { key: 'cuaderno', name: 'Rectoría', caption: 'documentos por firmar', idle: 'nada por firmar', to: '/app/rectoria', icon: ClipboardList, voice: ['rectoria', 'tablero', 'firmas', 'indicadores'] }
          : { key: 'cuaderno', name: 'Taller docente', caption: 'pendientes', idle: 'banco y calificaciones', to: '/app/banco', icon: ClipboardList, voice: ['taller', 'banco', 'preguntas', 'calificaciones'] },
    student
      ? { key: 'ruta', name: 'Mi ruta', caption: 'retos pendientes', idle: 'sin retos pendientes', to: '/app/ruta', icon: Compass, voice: ['mi ruta', 'ruta', 'retos', 'ejercicios', 'practicar'] }
      : { key: 'ruta', name: 'Observatorio', caption: 'pendientes', idle: 'pregúntale a los datos', to: '/app/consultas', icon: Database, voice: ['observatorio', 'consultas', 'datos', 'estadisticas'] },
  ];
  return list.map((item) => ({ ...item, ...layout[item.key] })).filter((b) => !(guardian && (b.key === 'arena' || b.key === 'ruta')));
}

/* ---------- Materials ---------- */

/** What each building is made of; the page header (its facade) uses it as texture. See docs/diseno-campus.md. */
export type Material = 'papel' | 'pizarra' | 'cuadricula' | 'neon' | 'corcho' | 'rayado' | 'topografia' | 'laton';

export const materialOf: Record<BuildingKey, Material> = {
  biblioteca: 'papel',
  aula: 'pizarra',
  lab: 'cuadricula',
  arena: 'neon',
  cartelera: 'corcho',
  cuaderno: 'rayado',
  ruta: 'topografia',
  trofeos: 'laton',
};

/** Pages that live inside a building without being its front door. */
const insideOf: Record<string, BuildingKey> = {
  cursos: 'aula',
  lecciones: 'aula',
  calificaciones: 'aula',
  'en-vivo': 'aula',
  acudiente: 'aula',
  mensajes: 'aula',
  biblioteca: 'biblioteca',
  tutor: 'lab',
  aprender: 'lab',
  arena: 'arena',
  jugar: 'arena',
  logros: 'trofeos',
  novedades: 'cartelera',
  cuaderno: 'cuaderno',
  coordinacion: 'cuaderno',
  rectoria: 'cuaderno',
  banco: 'cuaderno',
  ruta: 'ruta',
  consultas: 'ruta',
};

/** The building a route belongs to for this role, or null for pages outside the campus (ajustes, notificaciones…). */
export function buildingForPath(path: string, buildings: Building[]): Building | null {
  const segment = path.replace(/^\/app\/?/, '').split(/[/?#]/)[0] ?? '';
  if (!segment) return null;
  const doors = buildings.filter((b) => b.to === `/app/${segment}`);
  const inside = insideOf[segment];
  return doors.find((b) => b.key === inside) ?? doors[0] ?? buildings.find((b) => b.key === inside) ?? null;
}
