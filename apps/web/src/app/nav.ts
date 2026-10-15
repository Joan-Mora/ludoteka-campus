import { Bell, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';
import { ROLE_LABELS, ROLES, type Role } from '@eduquest/contracts';
import { buildingsFor, districtsOf, type BuildingKey } from '@/shared/buildings';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavSection { label: string; items: NavItem[] }

export const roleLabel: Record<Role, string> = ROLE_LABELS;

const ALL: readonly Role[] = ROLES;

/** Pages reached from inside a building (a course, a lesson, a room…); the building doors come from each role's campus. */
const INNER: Record<string, readonly Role[]> = {
  'cursos/:id': ['student', 'teacher', 'coordinator', 'rector', 'admin'],
  'cursos/:id/aula': ['teacher', 'coordinator', 'rector', 'admin'],
  'lecciones/:id': ['student', 'teacher', 'coordinator', 'admin'],
  'arena/:id': ['student', 'teacher'],
  'biblioteca/:id': ALL,
  'integridad/:id': ['teacher', 'coordinator', 'admin'],
  'reportes/:id': ['teacher', 'coordinator', 'rector', 'admin'],
  'rectoria/comunicados': ['rector'],
  rostro: ALL,
  ajustes: ALL,
  notificaciones: ALL,
};

function routeRoles() {
  const table: Record<string, Role[]> = {};
  for (const role of ROLES) {
    for (const b of buildingsFor(role)) {
      const path = b.to.replace(/^\/app\//, '');
      (table[path] ??= []).push(role);
    }
  }
  return { ...table, ...INNER } as Record<string, readonly Role[]>;
}

/**
 * Who can open each page. A module belongs to the roles whose campus has its building; the router shows
 * «no es para tu rol» to everyone else and the API validates the same on its side.
 */
export const ROUTE_ROLES: Record<string, readonly Role[]> = routeRoles();

export function canOpen(role: Role, to: string) {
  const path = to.replace(/^\/app\/?/, '').split('?')[0]!;
  if (!path) return true;
  const allowed = ROUTE_ROLES[path];
  return !allowed || allowed.includes(role);
}

const home: NavItem = { to: '/app', label: 'Inicio', icon: LayoutDashboard, end: true };
const account: NavSection = {
  label: 'Cuenta',
  items: [
    { to: '/app/notificaciones', label: 'Notificaciones', icon: Bell },
    { to: '/app/ajustes', label: 'Ajustes', icon: Settings },
  ],
};

/** The sidebar mirrors the role's campus: one entry per building, grouped by district, never repeated. */
export function navSections(role: Role, companionName: string): NavSection[] {
  const districts = districtsOf(buildingsFor(role, companionName)).map(({ label, items }) => ({
    label,
    items: items.map((b): NavItem => ({ to: b.to, label: b.name, icon: b.icon, end: true })),
  }));
  if (districts[0]) districts[0].items.unshift(home);
  return [...districts, account];
}

const TAB_LABEL: Partial<Record<BuildingKey, string>> = {
  aula: 'Cursos', ruta: 'Ruta', planilla: 'Notas', banco: 'Banco', firmas: 'Firmas', reportes: 'Reportes', grupos: 'Grupos', familia: 'Hijos',
};

/** Bottom tabs on phones: home plus the role's three main buildings (the last slot is always «Más»). */
export function mobileTabs(role: Role, companionName: string): NavItem[] {
  const main = buildingsFor(role, companionName).slice(0, 3).map((b): NavItem => ({ to: b.to, label: TAB_LABEL[b.key] ?? b.name, icon: b.icon }));
  return [home, ...main];
}
