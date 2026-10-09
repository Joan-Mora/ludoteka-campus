import {
  BookOpen,
  Building2,
  ClipboardList,
  Compass,
  Database,
  FileBarChart,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  Library,
  Megaphone,
  NotebookPen,
  Radio,
  Settings,
  Sparkles,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@eduquest/contracts';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavSection { label: string; items: NavItem[] }

export const roleLabel: Record<Role, string> = {
  student: 'Estudiante',
  teacher: 'Docente',
  admin: 'Administración',
  directivo: 'Directivo',
  guardian: 'Acudiente',
};

const home: NavItem = { to: '/app', label: 'Inicio', icon: LayoutDashboard, end: true };

/** Every destination a role can reach, grouped as in the desktop sidebar. */
export function navSections(role: Role, companionName: string): NavSection[] {
  const student = role === 'student';
  const guardian = role === 'guardian';
  const staff = role === 'teacher' || role === 'admin';
  const board = role === 'admin' || role === 'directivo';

  const learn: NavItem[] = guardian
    ? [
        home,
        { to: '/app/acudiente', label: 'Seguimiento', icon: HeartHandshake },
        { to: '/app/novedades', label: 'Cartelera', icon: Megaphone },
        { to: '/app/biblioteca', label: 'Biblioteca', icon: Library },
      ]
    : [
        home,
        { to: '/app/cursos', label: 'Mis cursos', icon: BookOpen },
        { to: '/app/biblioteca', label: 'Biblioteca', icon: Library },
        { to: '/app/novedades', label: 'Cartelera', icon: Megaphone },
        { to: '/app/arena', label: 'Arena', icon: Swords },
        { to: '/app/en-vivo', label: 'Sala en vivo', icon: Radio },
      ];
  const play: NavItem[] = student
    ? [
        { to: '/app/ruta', label: 'Mi ruta', icon: Compass },
        { to: '/app/cuaderno', label: 'Cuaderno', icon: NotebookPen },
        { to: '/app/logros', label: 'Logros', icon: Trophy },
        { to: '/app/jugar', label: 'Arcade', icon: Gamepad2 },
        { to: '/app/tutor', label: companionName, icon: Sparkles },
      ]
    : [];
  const manage: NavItem[] = [
    ...(staff || board ? [{ to: '/app/calificaciones', label: 'Calificaciones', icon: ClipboardList }] : []),
    ...(staff ? [{ to: '/app/banco', label: 'Banco de preguntas', icon: GraduationCap }] : []),
    ...(staff || board ? [{ to: '/app/consultas', label: 'Observatorio', icon: Database }] : []),
    ...(board ? [{ to: '/app/rectoria', label: 'Reportes', icon: FileBarChart }] : []),
    ...(role === 'admin' ? [{ to: '/app/admin/usuarios', label: 'Usuarios', icon: Users }, { to: '/app/admin', label: 'Institución', icon: Building2, end: true }] : []),
    ...(!student ? [{ to: '/app/tutor', label: companionName, icon: Sparkles }] : []),
  ];
  const account: NavItem[] = [{ to: '/app/ajustes', label: 'Ajustes', icon: Settings }];

  return [
    { label: 'Aprender', items: learn },
    { label: 'Jugar', items: play },
    { label: 'Gestión', items: manage },
    { label: 'Cuenta', items: account },
  ].filter((section) => section.items.length > 0);
}

/** Bottom tabs on phones (the last slot is always «Más»). */
export function mobileTabs(role: Role, companionName: string): NavItem[] {
  const tutor: NavItem = { to: '/app/tutor', label: companionName, icon: Sparkles };
  switch (role) {
    case 'student':
      return [home, { to: '/app/cursos', label: 'Cursos', icon: BookOpen }, tutor, { to: '/app/arena', label: 'Arena', icon: Swords }];
    case 'teacher':
      return [home, { to: '/app/cursos', label: 'Cursos', icon: BookOpen }, { to: '/app/calificaciones', label: 'Notas', icon: ClipboardList }, { to: '/app/arena', label: 'Arena', icon: Swords }];
    case 'directivo':
      return [home, { to: '/app/consultas', label: 'Observatorio', icon: Database }, { to: '/app/rectoria', label: 'Reportes', icon: FileBarChart }, { to: '/app/novedades', label: 'Cartelera', icon: Megaphone }];
    case 'guardian':
      return [home, { to: '/app/acudiente', label: 'Seguimiento', icon: HeartHandshake }, { to: '/app/novedades', label: 'Cartelera', icon: Megaphone }];
    case 'admin':
      return [home, { to: '/app/admin/usuarios', label: 'Usuarios', icon: Users }, { to: '/app/admin', label: 'Institución', icon: Building2, end: true }];
  }
}
