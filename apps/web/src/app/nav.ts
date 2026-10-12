import {
  Bell,
  BookOpen,
  Building2,
  ClipboardList,
  Compass,
  Crown,
  Database,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Library,
  Lightbulb,
  Mail,
  Megaphone,
  NotebookPen,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABELS, type Role } from '@eduquest/contracts';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavSection { label: string; items: NavItem[] }

export const roleLabel: Record<Role, string> = ROLE_LABELS;

const ALL: readonly Role[] = ['admin', 'coordinator', 'rector', 'teacher', 'student', 'guardian'];
const SCHOOL: readonly Role[] = ['admin', 'coordinator', 'rector', 'teacher', 'student'];
const STAFF_READ: readonly Role[] = ['admin', 'coordinator', 'rector', 'teacher'];

/**
 * Quién puede abrir cada sección. El router la usa para mostrar «no es para tu rol» y el menú para
 * no ofrecer lo que no se puede abrir. La API valida lo mismo por su cuenta.
 */
export const ROUTE_ROLES: Record<string, readonly Role[]> = {
  cursos: SCHOOL,
  'cursos/:id': SCHOOL,
  'cursos/:id/aula': STAFF_READ,
  'lecciones/:id': SCHOOL,
  logros: ['student'],
  jugar: ['student'],
  ruta: ['student'],
  aprender: ['student'],
  cuaderno: ['student'],
  tutor: ALL,
  rostro: ALL,
  'en-vivo': ['student', 'teacher', 'admin'],
  arena: SCHOOL,
  'arena/:id': SCHOOL,
  banco: ['teacher', 'admin'],
  'integridad/:id': STAFF_READ,
  'reportes/:id': STAFF_READ,
  coordinacion: ['coordinator', 'admin'],
  rectoria: ['rector', 'admin'],
  mensajes: ['teacher', 'guardian'],
  admin: ['admin'],
  'admin/usuarios': ['admin'],
  novedades: ALL,
  acudiente: ['guardian'],
  biblioteca: ALL,
  'biblioteca/:id': ALL,
  consultas: STAFF_READ,
  calificaciones: STAFF_READ,
  ajustes: ALL,
  notificaciones: ALL,
};

export function canOpen(role: Role, to: string) {
  const path = to.replace(/^\/app\/?/, '').split('?')[0]!;
  if (!path) return true;
  const allowed = ROUTE_ROLES[path];
  return !allowed || allowed.includes(role);
}

const home: NavItem = { to: '/app', label: 'Inicio', icon: LayoutDashboard, end: true };

/** Every destination a role can reach, grouped as in the desktop sidebar. */
export function navSections(role: Role, companionName: string): NavSection[] {
  const student = role === 'student';
  const guardian = role === 'guardian';
  const oversight = role === 'coordinator' || role === 'rector';

  const learn: NavItem[] = guardian
    ? [
        home,
        { to: '/app/acudiente', label: 'Familia', icon: HeartHandshake },
        { to: '/app/mensajes', label: 'Mensajes', icon: Mail },
        { to: '/app/novedades', label: 'Cartelera', icon: Megaphone },
        { to: '/app/biblioteca', label: 'Biblioteca', icon: Library },
      ]
    : [
        home,
        { to: '/app/cursos', label: oversight ? 'Cursos' : 'Mis cursos', icon: BookOpen },
        { to: '/app/biblioteca', label: 'Biblioteca', icon: Library },
        { to: '/app/novedades', label: 'Cartelera', icon: Megaphone },
        { to: '/app/arena', label: 'Arena', icon: Swords },
        { to: '/app/en-vivo', label: 'Sala en vivo', icon: Radio },
      ];
  const play: NavItem[] = student
    ? [
        { to: '/app/aprender', label: 'Mi espacio', icon: Lightbulb },
        { to: '/app/ruta', label: 'Mi ruta', icon: Compass },
        { to: '/app/cuaderno', label: 'Cuaderno', icon: NotebookPen },
        { to: '/app/logros', label: 'Logros', icon: Trophy },
        { to: '/app/jugar', label: 'Arcade', icon: Gamepad2 },
        { to: '/app/tutor', label: companionName, icon: Sparkles },
      ]
    : [];
  const manage: NavItem[] = [
    { to: '/app/coordinacion', label: 'Coordinación', icon: ShieldCheck },
    { to: '/app/rectoria', label: 'Rectoría', icon: Crown },
    { to: '/app/calificaciones', label: 'Calificaciones', icon: ClipboardList },
    { to: '/app/mensajes', label: 'Mensajes', icon: Mail },
    { to: '/app/banco', label: 'Banco de preguntas', icon: GraduationCap },
    { to: '/app/consultas', label: 'Observatorio', icon: Database },
    { to: '/app/admin/usuarios', label: 'Usuarios', icon: Users },
    { to: '/app/admin', label: 'Institución', icon: Building2, end: true },
    ...(!student ? [{ to: '/app/tutor', label: companionName, icon: Sparkles }] : []),
  ].filter((item) => !guardian || item.to === '/app/tutor');
  const account: NavItem[] = [
    { to: '/app/notificaciones', label: 'Notificaciones', icon: Bell },
    { to: '/app/ajustes', label: 'Ajustes', icon: Settings },
  ];

  return [
    { label: guardian ? 'Familia' : 'Aprender', items: learn },
    { label: 'Jugar', items: play },
    { label: 'Gestión', items: manage },
    { label: 'Cuenta', items: account },
  ]
    .map((section) => ({ ...section, items: section.items.filter((item) => canOpen(role, item.to)) }))
    .filter((section) => section.items.length > 0);
}

/** Bottom tabs on phones (the last slot is always «Más»). */
export function mobileTabs(role: Role, companionName: string): NavItem[] {
  const tutor: NavItem = { to: '/app/tutor', label: companionName, icon: Sparkles };
  switch (role) {
    case 'student':
      return [home, { to: '/app/cursos', label: 'Cursos', icon: BookOpen }, tutor, { to: '/app/arena', label: 'Arena', icon: Swords }];
    case 'teacher':
      return [home, { to: '/app/cursos', label: 'Cursos', icon: BookOpen }, { to: '/app/calificaciones', label: 'Notas', icon: ClipboardList }, { to: '/app/mensajes', label: 'Mensajes', icon: Mail }];
    case 'coordinator':
      return [home, { to: '/app/coordinacion', label: 'Seguimiento', icon: ShieldCheck }, { to: '/app/calificaciones', label: 'Notas', icon: ClipboardList }, { to: '/app/novedades', label: 'Cartelera', icon: Megaphone }];
    case 'rector':
      return [home, { to: '/app/rectoria', label: 'Rectoría', icon: Crown }, { to: '/app/consultas', label: 'Observatorio', icon: Database }, { to: '/app/novedades', label: 'Cartelera', icon: Megaphone }];
    case 'guardian':
      return [home, { to: '/app/acudiente', label: 'Familia', icon: HeartHandshake }, { to: '/app/mensajes', label: 'Mensajes', icon: Mail }, { to: '/app/novedades', label: 'Cartelera', icon: Megaphone }];
    case 'admin':
      return [home, { to: '/app/admin/usuarios', label: 'Usuarios', icon: Users }, { to: '/app/admin', label: 'Institución', icon: Building2, end: true }];
  }
}
