import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Sessions are kept per target so local and production cookies never mix. */
export const authDir = path.join(here, '.auth', process.env.E2E_TARGET ?? 'local');
export const shotsDir = path.join(here, 'shots');

export const ROLES = ['student', 'teacher', 'directivo', 'guardian', 'admin'] as const;
export type E2ERole = (typeof ROLES)[number];

export const accounts: Record<E2ERole, string> = {
  student: 'estudiante@eduquest.local',
  teacher: 'docente@eduquest.local',
  directivo: 'coordinacion@eduquest.local',
  guardian: 'acudiente@eduquest.local',
  admin: 'admin@eduquest.local',
};

export const publicRoutes = ['/', '/ingresar', '/recuperar', '/legal/terminos', '/legal/privacidad', '/legal/cookies'];

export const routesByRole: Record<E2ERole, string[]> = {
  student: ['/app', '/app/cursos', '/app/biblioteca', '/app/novedades', '/app/arena', '/app/ruta', '/app/cuaderno', '/app/logros', '/app/jugar', '/app/tutor', '/app/en-vivo', '/app/ajustes'],
  teacher: ['/app', '/app/cursos', '/app/calificaciones', '/app/banco', '/app/consultas', '/app/arena', '/app/novedades', '/app/ajustes'],
  directivo: ['/app', '/app/rectoria', '/app/consultas', '/app/calificaciones', '/app/novedades'],
  guardian: ['/app', '/app/acudiente', '/app/novedades', '/app/biblioteca', '/app/ajustes'],
  admin: ['/app', '/app/admin/usuarios', '/app/admin', '/app/rectoria', '/app/consultas', '/app/ajustes'],
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
