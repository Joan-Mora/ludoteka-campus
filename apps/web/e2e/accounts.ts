import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Sessions are kept per target so local and production cookies never mix. */
export const authDir = path.join(here, '.auth', process.env.E2E_TARGET ?? 'local');
export const shotsDir = path.join(here, 'shots');

export const ROLES = ['student', 'teacher', 'coordinator', 'rector', 'guardian', 'admin'] as const;
export type E2ERole = (typeof ROLES)[number];

export const accounts: Record<E2ERole, string> = {
  student: 'estudiante@eduquest.local',
  teacher: 'docente@eduquest.local',
  coordinator: 'coordinacion@eduquest.local',
  rector: 'rectoria@eduquest.local',
  guardian: 'acudiente@eduquest.local',
  admin: 'admin@eduquest.local',
};

export const publicRoutes = ['/', '/ingresar', '/recuperar', '/legal/terminos', '/legal/privacidad', '/legal/cookies'];

export const routesByRole: Record<E2ERole, string[]> = {
  student: ['/app', '/app/cursos', '/app/ruta', '/app/cuaderno', '/app/aprender', '/app/tutor', '/app/en-vivo', '/app/arena', '/app/jugar', '/app/logros', '/app/biblioteca', '/app/novedades', '/app/ajustes'],
  teacher: ['/app', '/app/cursos', '/app/calificaciones', '/app/banco', '/app/en-vivo', '/app/arena', '/app/mensajes', '/app/novedades', '/app/biblioteca', '/app/consultas', '/app/ajustes'],
  coordinator: ['/app', '/app/coordinacion', '/app/coordinacion/asistencia', '/app/coordinacion/citaciones', '/app/cursos', '/app/calificaciones', '/app/consultas', '/app/mensajes', '/app/novedades', '/app/biblioteca', '/app/ajustes'],
  rector: ['/app', '/app/rectoria', '/app/rectoria/firmas', '/app/rectoria/reportes', '/app/consultas', '/app/mensajes', '/app/novedades', '/app/biblioteca', '/app/ajustes'],
  guardian: ['/app', '/app/acudiente', '/app/mensajes', '/app/novedades', '/app/biblioteca', '/app/ajustes'],
  admin: ['/app', '/app/admin/usuarios', '/app/admin', '/app/cursos', '/app/banco', '/app/calificaciones', '/app/coordinacion', '/app/coordinacion/asistencia', '/app/coordinacion/citaciones', '/app/rectoria', '/app/rectoria/reportes', '/app/consultas', '/app/mensajes', '/app/novedades', '/app/biblioteca', '/app/ajustes'],
};

/** Routes each role must not open: the router shows «Esta sección no es para tu rol». */
export const forbiddenByRole: Record<E2ERole, string[]> = {
  student: ['/app/calificaciones', '/app/banco', '/app/coordinacion', '/app/rectoria', '/app/admin', '/app/acudiente', '/app/mensajes', '/app/consultas'],
  teacher: ['/app/coordinacion', '/app/rectoria', '/app/admin', '/app/acudiente', '/app/ruta', '/app/aprender', '/app/tutor', '/app/jugar', '/app/logros', '/app/cuaderno'],
  coordinator: ['/app/rectoria', '/app/banco', '/app/admin', '/app/en-vivo', '/app/arena', '/app/tutor', '/app/acudiente', '/app/logros'],
  rector: ['/app/coordinacion', '/app/cursos', '/app/calificaciones', '/app/banco', '/app/admin', '/app/en-vivo', '/app/tutor', '/app/acudiente'],
  guardian: ['/app/cursos', '/app/calificaciones', '/app/coordinacion', '/app/rectoria', '/app/admin', '/app/arena', '/app/jugar', '/app/aprender', '/app/tutor', '/app/en-vivo', '/app/consultas'],
  admin: ['/app/acudiente', '/app/ruta', '/app/tutor', '/app/en-vivo', '/app/arena', '/app/logros', '/app/rectoria/firmas'],
};

export function storageFor(role: E2ERole) {
  return path.join(authDir, `${role}.json`);
}

/** Lab password: E2E_PASSWORD, or SEED_PASSWORD from apps/api/.env. Never logged. */
export function labPassword(): string {
  if (process.env.E2E_PASSWORD) return process.env.E2E_PASSWORD;
  const file = path.join(here, '..', '..', 'api', '.env');
  if (existsSync(file)) {
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith('SEED_PASSWORD='));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }
  return 'EduQuest2026!';
}

export function slug(route: string) {
  return route === '/' ? 'inicio' : route.replace(/^\//, '').replace(/\//g, '_');
}
