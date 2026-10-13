import {
  BrainCircuit,
  Building2,
  CalendarClock,
  ClipboardList,
  Compass,
  Crown,
  FileSignature,
  FileText,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  Library,
  Lightbulb,
  Mail,
  Megaphone,
  NotebookPen,
  Radio,
  School,
  ShieldAlert,
  Swords,
  Telescope,
  Trophy,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@eduquest/contracts';

/* ---------- Buildings ---------- */

/** One building per module. Each role has its own campus, so a key appears at most once per map. */
export type BuildingKey =
  | 'aula' | 'ruta' | 'cuaderno' | 'espacio' | 'tutor' | 'envivo' | 'arena' | 'arcade' | 'trofeos'
  | 'biblioteca' | 'cartelera' | 'mensajes' | 'observatorio'
  | 'planilla' | 'banco'
  | 'alertas' | 'asistencia' | 'citaciones' | 'grupos'
  | 'tablero' | 'firmas' | 'reportes'
  | 'familia'
  | 'usuarios' | 'institucion';

export type Shape =
  | 'school' | 'library' | 'lab' | 'stadium' | 'hall' | 'board' | 'house' | 'tower'
  | 'post' | 'capitol' | 'arcade' | 'studio' | 'observatory' | 'office' | 'pavilion';

/** What each building is made of; the page header (its facade) uses it as texture. See docs/frontend.md. */
export type Material = 'papel' | 'pizarra' | 'cuadricula' | 'neon' | 'corcho' | 'rayado' | 'topografia' | 'laton';

export interface Building {
  key: BuildingKey;
  name: string;
  /** Follows the pending count: "3 avisos sin leer". */
  caption: string;
  /** Shown instead when nothing is pending. */
  idle: string;
  /** One line about what happens inside; Luka reads it in the guided tour. */
  about: string;
  to: string;
  icon: LucideIcon;
  color: string;
  shape: Shape;
  material: Material;
  /** Sidebar group. */
  district: string;
  voice: string[];
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
}

type Spec = Omit<Building, 'key' | 'district' | 'x' | 'y' | 'w' | 'd' | 'h'>;

const SIZE: Record<Shape, { w: number; d: number; h: number }> = {
  school: { w: 2.6, d: 2.6, h: 2.2 },
  library: { w: 2.5, d: 2.1, h: 1.8 },
  lab: { w: 2.3, d: 2.3, h: 1.6 },
  stadium: { w: 3, d: 3, h: 0.7 },
  hall: { w: 2.2, d: 2, h: 1.4 },
  board: { w: 2, d: 0.18, h: 1.1 },
  house: { w: 1.9, d: 1.8, h: 1.3 },
  tower: { w: 1.1, d: 1.1, h: 2.3 },
  post: { w: 2, d: 1.7, h: 1.4 },
  capitol: { w: 2.8, d: 2.3, h: 1.5 },
  arcade: { w: 2.3, d: 1.9, h: 1.5 },
  studio: { w: 2.6, d: 2.1, h: 1.6 },
  observatory: { w: 1.7, d: 1.7, h: 1.5 },
  office: { w: 1.8, d: 1.8, h: 2.9 },
  pavilion: { w: 2.2, d: 2.2, h: 1.2 },
};

/** Highest point of each drawing above its base height, used to rest the "you are here" pin on the roof. */
export function roofTop(b: Pick<Building, 'shape' | 'h'>) {
  const extra: Record<Shape, number> = {
    school: 1.5, library: 0.95, lab: 1.25, stadium: 0.9, hall: 0.95, board: 0.6, house: 0.85, tower: 1.05,
    post: 0.9, capitol: 1.55, arcade: 0.75, studio: 1.3, observatory: 1.2, office: 0.75, pavilion: 0.9,
  };
  return b.h + extra[b.shape];
}

function catalog(companion: string): Record<BuildingKey, Spec> {
  return {
    aula: { name: 'Mis cursos', caption: 'pendientes', idle: 'al día', about: 'Tus cursos con sus lecciones, tareas y evaluaciones.', to: '/app/cursos', icon: School, color: '#ff8a5c', shape: 'school', material: 'pizarra', voice: ['aula', 'cursos', 'mis cursos', 'clases'] },
    ruta: { name: 'Mi ruta', caption: 'retos pendientes', idle: 'sin retos pendientes', about: 'Retos que se ajustan a lo que ya dominas de cada tema.', to: '/app/ruta', icon: Compass, color: '#3ab8ff', shape: 'tower', material: 'topografia', voice: ['mi ruta', 'ruta', 'retos', 'ejercicios', 'practicar'] },
    cuaderno: { name: 'Cuaderno', caption: 'tarjetas para repasar hoy', idle: 'nada para repasar hoy', about: 'Tus apuntes y las tarjetas de repaso para no olvidar.', to: '/app/cuaderno', icon: NotebookPen, color: '#19c39c', shape: 'house', material: 'rayado', voice: ['cuaderno', 'apuntes', 'notas', 'flashcards', 'tarjetas', 'repasar'] },
    espacio: { name: 'Mi espacio', caption: 'novedades', idle: 'aprende a tu manera', about: 'Descubre cómo aprendes mejor y estudia con ese método.', to: '/app/aprender', icon: Lightbulb, color: '#b45cff', shape: 'pavilion', material: 'rayado', voice: ['mi espacio', 'como aprendo', 'metodo', 'estilo'] },
    tutor: { name: 'Laboratorio IA', caption: 'pendientes', idle: `pregúntale a ${companion}`, about: `${companion} te explica paso a paso, con pistas y sin darte la respuesta de una.`, to: '/app/tutor', icon: BrainCircuit, color: '#8b6cff', shape: 'lab', material: 'cuadricula', voice: ['laboratorio', 'tutor', 'inteligencia artificial', 'preguntar'] },
    envivo: { name: 'Sala en vivo', caption: 'salas abiertas', idle: 'sin salas abiertas', about: 'Quiz en tiempo real: todo el grupo responde a la vez.', to: '/app/en-vivo', icon: Radio, color: '#ff6b8b', shape: 'studio', material: 'neon', voice: ['sala en vivo', 'en vivo', 'quiz', 'tiempo real', 'codigo'] },
    arena: { name: 'Arena', caption: 'salas abiertas ahora', idle: 'sin salas abiertas', about: 'Competencias por equipos con código QR y podio.', to: '/app/arena', icon: Swords, color: '#ff5d73', shape: 'stadium', material: 'neon', voice: ['arena', 'competencia', 'equipos', 'jugar en equipo'] },
    arcade: { name: 'Arcade', caption: 'retos del día', idle: 'juegos para practicar', about: 'Juegos cortos ligados a tus temas y el reto diario.', to: '/app/jugar', icon: Gamepad2, color: '#ffb02e', shape: 'arcade', material: 'neon', voice: ['arcade', 'juegos', 'jugar', 'reto diario'] },
    trofeos: { name: 'Sala de trofeos', caption: 'insignias nuevas', idle: 'todo visto', about: 'Tu XP, rachas, insignias y certificados.', to: '/app/logros', icon: Trophy, color: '#ffc83d', shape: 'hall', material: 'laton', voice: ['trofeos', 'logros', 'insignias', 'nivel'] },
    biblioteca: { name: 'Biblioteca', caption: 'recursos nuevos', idle: 'sin novedades desde tu visita', about: 'Guías y lecturas del colegio con buscador y glosario.', to: '/app/biblioteca', icon: Library, color: '#4f86f7', shape: 'library', material: 'papel', voice: ['biblioteca', 'libros', 'recursos', 'documentos'] },
    cartelera: { name: 'Cartelera', caption: 'avisos sin leer', idle: 'todo leído', about: 'Novedades del colegio, foros y comunicados.', to: '/app/novedades', icon: Megaphone, color: '#ff5d73', shape: 'board', material: 'corcho', voice: ['cartelera', 'novedades', 'noticias', 'avisos', 'anuncios', 'foros'] },
    mensajes: { name: 'Mensajes', caption: 'mensajes sin leer', idle: 'sin mensajes nuevos', about: 'Conversaciones con nombre y rol de cada persona.', to: '/app/mensajes', icon: Mail, color: '#2bb3a3', shape: 'post', material: 'rayado', voice: ['mensajes', 'correo', 'escribir', 'chat'] },
    observatorio: { name: 'Observatorio', caption: 'pendientes', idle: 'pregúntale a los datos', about: 'Preguntas en lenguaje natural sobre los datos, solo lectura.', to: '/app/consultas', icon: Telescope, color: '#5b6cff', shape: 'observatory', material: 'cuadricula', voice: ['observatorio', 'consultas', 'datos', 'estadisticas'] },
    planilla: { name: 'Planilla de notas', caption: 'por revisar', idle: 'notas por curso', about: 'Calificaciones por categoría, rúbricas y definitivas.', to: '/app/calificaciones', icon: ClipboardList, color: '#f2994a', shape: 'office', material: 'cuadricula', voice: ['planilla', 'calificaciones', 'notas', 'rubricas'] },
    banco: { name: 'Banco de preguntas', caption: 'borradores', idle: 'crea y reutiliza preguntas', about: 'Preguntas reutilizables para quices, exámenes y la sala en vivo.', to: '/app/banco', icon: GraduationCap, color: '#7c5cff', shape: 'lab', material: 'cuadricula', voice: ['banco', 'preguntas', 'evaluaciones'] },
    alertas: { name: 'Alertas', caption: 'alertas abiertas', idle: 'sin alertas abiertas', about: 'Estudiantes en riesgo académico o de convivencia y su seguimiento.', to: '/app/coordinacion', icon: ShieldAlert, color: '#ff6f61', shape: 'tower', material: 'topografia', voice: ['alertas', 'seguimiento', 'coordinacion', 'riesgo'] },
    asistencia: { name: 'Asistencia', caption: 'sobre el umbral', idle: 'asistencia consolidada', about: 'Faltas y llegadas tarde por grupo y por estudiante.', to: '/app/coordinacion/asistencia', icon: UserCheck, color: '#19c39c', shape: 'house', material: 'rayado', voice: ['asistencia', 'faltas', 'llegadas tarde'] },
    citaciones: { name: 'Citaciones', caption: 'citaciones próximas', idle: 'sin citaciones próximas', about: 'Reuniones con acudientes: agenda, confirmación y acta.', to: '/app/coordinacion/citaciones', icon: CalendarClock, color: '#ffb02e', shape: 'pavilion', material: 'corcho', voice: ['citaciones', 'reuniones', 'citar', 'acudientes'] },
    grupos: { name: 'Grupos y cursos', caption: 'pendientes', idle: 'consulta de cursos', about: 'Todos los cursos del colegio en modo consulta.', to: '/app/cursos', icon: Users, color: '#ff8a5c', shape: 'school', material: 'pizarra', voice: ['grupos', 'cursos', 'clases'] },
    tablero: { name: 'Tablero', caption: 'pendientes', idle: 'indicadores del periodo', about: 'Indicadores por periodo, comparación entre grupos y comunicados oficiales.', to: '/app/rectoria', icon: Crown, color: '#ffc83d', shape: 'capitol', material: 'laton', voice: ['tablero', 'rectoria', 'indicadores', 'comunicados'] },
    firmas: { name: 'Sala de firmas', caption: 'documentos por firmar', idle: 'nada por firmar', about: 'Certificados y boletines que esperan tu firma.', to: '/app/rectoria/firmas', icon: FileSignature, color: '#c9a227', shape: 'hall', material: 'laton', voice: ['firmas', 'firmar', 'certificados', 'boletines'] },
    reportes: { name: 'Archivo de reportes', caption: 'nuevos', idle: 'reportes con código QR', about: 'Reportes institucionales numerados y verificables.', to: '/app/rectoria/reportes', icon: FileText, color: '#8a7cff', shape: 'office', material: 'papel', voice: ['reportes', 'archivo', 'informes'] },
    familia: { name: 'Mis hijos', caption: 'por atender', idle: 'todo al día', about: 'Notas, asistencia, alertas y citaciones de cada hijo.', to: '/app/acudiente', icon: HeartHandshake, color: '#ff8a5c', shape: 'house', material: 'rayado', voice: ['familia', 'mis hijos', 'seguimiento', 'acudiente'] },
    usuarios: { name: 'Usuarios', caption: 'solicitudes', idle: 'cuentas y roles', about: 'Cuentas, roles, importación masiva y solicitudes de datos.', to: '/app/admin/usuarios', icon: Users, color: '#3ab8ff', shape: 'tower', material: 'cuadricula', voice: ['usuarios', 'cuentas', 'roles'] },
    institucion: { name: 'Institución', caption: 'pendientes', idle: 'grados, grupos y asignaturas', about: 'Estructura del colegio: grados, grupos, asignaturas y carga docente.', to: '/app/admin', icon: Building2, color: '#7c5cff', shape: 'capitol', material: 'laton', voice: ['institucion', 'colegio', 'grados', 'asignaturas'] },
  };
}

/** Per role: districts (sidebar groups) and their buildings, most important first. */
const MAPS: Record<Role, [district: string, keys: BuildingKey[], names?: Partial<Record<BuildingKey, string>>][]> = {
  student: [
    ['Mi día', ['aula', 'ruta', 'cuaderno']],
    ['A mi manera', ['espacio', 'tutor']],
    ['Jugar', ['envivo', 'arena', 'arcade', 'trofeos']],
    ['Colegio', ['biblioteca', 'cartelera']],
  ],
  teacher: [
    ['Enseñar', ['aula', 'planilla', 'banco']],
    ['En clase', ['envivo', 'arena']],
    ['Comunicación', ['mensajes', 'cartelera']],
    ['Recursos', ['biblioteca', 'observatorio']],
  ],
  coordinator: [
    ['Seguimiento', ['alertas', 'asistencia', 'citaciones']],
    ['Académico', ['grupos', 'planilla', 'observatorio'], { planilla: 'Consolidado de notas' }],
    ['Comunicación', ['mensajes', 'cartelera', 'biblioteca']],
  ],
  rector: [
    ['Dirección', ['tablero', 'firmas', 'reportes']],
    ['Datos', ['observatorio']],
    ['Comunicación', ['mensajes', 'cartelera', 'biblioteca']],
  ],
  guardian: [
    ['Familia', ['familia', 'mensajes']],
    ['Colegio', ['cartelera', 'biblioteca']],
  ],
  admin: [
    ['Administración', ['usuarios', 'institucion']],
    ['Datos', ['observatorio']],
    ['Comunicación', ['mensajes', 'cartelera', 'biblioteca']],
  ],
};

/* ---------- Layout ---------- */

/** Each building gets a cell of the street grid; one extra cell is the plaza. The map grows with the number of modules. */
export const CELL = 4.4;
export const ROAD = 0.9;

export interface CampusLayout {
  buildings: Building[];
  /** Map size in grid units. */
  gx: number;
  gy: number;
  cols: number;
  rows: number;
  plaza: { x: number; y: number; size: number };
  trees: [number, number, 0 | 1][];
  lamps: [number, number][];
}

function seeded(n: number) {
  return ((n * 9301 + 49297) % 233280) / 233280;
}

export function campusFor(role: Role | undefined, companionName = 'Luka'): CampusLayout {
  const specs = catalog(companionName);
  const plan = MAPS[role ?? 'student'];
  const ordered = plan.flatMap(([district, keys, names]) => keys.map((key) => ({ key, district, name: names?.[key] })));
  const cells = ordered.length + 1;
  const cols = Math.ceil(Math.sqrt(cells));
  const rows = Math.ceil(cells / cols);
  const inner = CELL - ROAD;
  const origin = (c: number, r: number) => [ROAD + c * CELL, ROAD + r * CELL] as const;
  const plazaCell = { c: Math.floor((cols - 1) / 2), r: Math.floor((rows - 1) / 2) };
  const free: { c: number; r: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (c !== plazaCell.c || r !== plazaCell.r) free.push({ c, r });
  free.sort((a, b) => Math.hypot(a.c - plazaCell.c, a.r - plazaCell.r) - Math.hypot(b.c - plazaCell.c, b.r - plazaCell.r) || a.r - b.r || a.c - b.c);

  const trees: CampusLayout['trees'] = [];
  const buildings = ordered.map(({ key, district, name }, i) => {
    const spec = specs[key];
    const size = SIZE[spec.shape];
    const cell = free[i]!;
    const [x0, y0] = origin(cell.c, cell.r);
    const x = x0 + (inner - size.w) / 2;
    const y = spec.shape === 'board' ? y0 + inner - 0.9 : y0 + (inner - size.d) / 2;
    if (x - x0 > 0.55) trees.push([x0 + 0.3, y0 + 0.35, (i % 2) as 0 | 1]);
    if (x0 + inner - (x + size.w) > 0.55 && seeded(i + 3) > 0.35) trees.push([x0 + inner - 0.3, y0 + 0.4, ((i + 1) % 2) as 0 | 1]);
    return { ...spec, key, district, name: name ?? spec.name, x, y, ...size };
  });
  // Unused cells (the grid is rounded up) become small parks.
  for (const cell of free.slice(ordered.length)) {
    const [x0, y0] = origin(cell.c, cell.r);
    [[0.8, 0.9], [2.4, 0.7], [1.6, 2.2], [2.9, 2.7], [0.7, 2.9]].forEach(([dx, dy], k) => trees.push([x0 + dx!, y0 + dy!, (k % 2) as 0 | 1]));
  }
  const [px, py] = origin(plazaCell.c, plazaCell.r);
  trees.push([px + 0.3, py + 0.3, 1], [px + inner - 0.3, py + 0.3, 0], [px + 0.3, py + inner - 0.3, 0], [px + inner - 0.3, py + inner - 0.3, 1]);

  const gx = cols * CELL + ROAD;
  const gy = rows * CELL + ROAD;
  const lamps: [number, number][] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if ((r + c) % 2 === 0) lamps.push([c * CELL + ROAD + 0.1, r * CELL + ROAD + 0.1]);
    }
  }
  return { buildings, gx, gy, cols, rows, plaza: { x: px, y: py, size: inner }, trees, lamps };
}

export function buildingsFor(role: Role | undefined, companionName = 'Luka'): Building[] {
  return campusFor(role, companionName).buildings;
}

/* ---------- Routes ---------- */

/** Pages that live inside a building without being its front door, in order of preference. */
const insideOf: Record<string, BuildingKey[]> = {
  cursos: ['aula', 'grupos'],
  lecciones: ['aula', 'grupos'],
  integridad: ['aula', 'grupos'],
  reportes: ['aula', 'grupos', 'reportes'],
  calificaciones: ['planilla'],
  'en-vivo': ['envivo'],
  acudiente: ['familia'],
  mensajes: ['mensajes'],
  biblioteca: ['biblioteca'],
  tutor: ['tutor'],
  aprender: ['espacio'],
  arena: ['arena'],
  jugar: ['arcade'],
  logros: ['trofeos'],
  novedades: ['cartelera'],
  cuaderno: ['cuaderno'],
  coordinacion: ['alertas'],
  rectoria: ['tablero'],
  banco: ['banco'],
  ruta: ['ruta'],
  consultas: ['observatorio'],
  admin: ['institucion'],
};

/** The building a route belongs to for this role, or null for pages outside the campus (ajustes, notificaciones…). */
export function buildingForPath(path: string, buildings: Building[]): Building | null {
  const clean = path.split(/[?#]/)[0]!.replace(/\/$/, '');
  const door = buildings
    .filter((b) => clean === b.to || clean.startsWith(`${b.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (door) return door;
  const segment = clean.replace(/^\/app\/?/, '').split('/')[0] ?? '';
  for (const key of insideOf[segment] ?? []) {
    const found = buildings.find((b) => b.key === key);
    if (found) return found;
  }
  return null;
}

/** Districts of a role, for the sidebar. */
export function districtsOf(buildings: Building[]) {
  const map = new Map<string, Building[]>();
  for (const b of buildings) map.set(b.district, [...(map.get(b.district) ?? []), b]);
  return [...map.entries()].map(([label, items]) => ({ label, items }));
}
