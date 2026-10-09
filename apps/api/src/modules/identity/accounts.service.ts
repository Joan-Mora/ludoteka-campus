import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Transaction } from 'kysely';
import type { Role } from '@eduquest/contracts';
import { DatabaseService } from '../../core/database/database.service';
import type { Database } from '../../core/database/database.types';
import { Env } from '../../core/config/config.module';
import { ApiError } from '../../core/errors/api-error';
import { temporaryPassword } from '../../core/common/crypto';
import { Mailer } from '../../core/mail/mailer';
import type { AuthUser } from '../../core/auth/auth.decorators';
import { IdentityService } from './identity.service';
import {
  columns,
  DEFAULT_SUBJECTS,
  gradeName,
  groupLabel,
  parseBool,
  parseGroup,
  parseRole,
  readSheet,
  structureTemplate,
  usersTemplate,
} from './accounts.sheet';

export interface AccountInput {
  fullName: string;
  email: string;
  role: Role;
  group?: string;
  isMinor?: boolean;
  guardianOf?: string[];
}

export interface PreviewRow extends Partial<AccountInput> {
  line: number;
  errors: string[];
  warnings: string[];
}

interface Welcome {
  to: string;
  email: string;
  fullName: string;
  password: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Resend allows about two requests per second on the plans the school uses. */
const MAIL_GAP_MS = 600;
const HASH_BATCH = 8;

function groupKey(value?: string) {
  if (!value?.trim()) return undefined;
  const group = parseGroup(value);
  return group ? `${group.level}${group.name}` : value.trim();
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly identity: IdentityService,
    private readonly mailer: Mailer,
    private readonly env: Env,
  ) {}

  private async audit(actorId: string, action: string, entityId: string | null, meta?: Record<string, unknown>, entity = 'users') {
    await this.database.db
      .insertInto('audit_log')
      .values({ actor_id: actorId, action, entity, entity_id: entityId, meta: meta ? JSON.stringify(meta) : null })
      .execute();
  }

  private currentYear() {
    return this.database.db.selectFrom('academic_years').select(['id', 'name']).where('is_current', '=', true).executeTakeFirst();
  }

  /** Current-year groups keyed as "6A", plus the readable labels for templates. */
  private async groupMap() {
    const year = await this.currentYear();
    if (!year) return { year, byKey: new Map<string, string>(), labels: [] as string[] };
    const rows = await this.database.db
      .selectFrom('groups_class')
      .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select(['groups_class.id', 'groups_class.name', 'grades.level'])
      .where('groups_class.academic_year_id', '=', year.id)
      .orderBy('grades.level')
      .orderBy('groups_class.name')
      .execute();
    const byKey = new Map(rows.map((g) => [groupLabel(g.level, g.name), g.id]));
    return { year, byKey, labels: rows.map((g) => groupLabel(g.level, g.name)) };
  }

  /* ---------- Listado ---------- */

  async list(filters: { q?: string; role?: string; groupId?: string; status?: string }) {
    const year = await this.currentYear();
    let query = this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('enrollments', (join) =>
        join
          .onRef('enrollments.user_id', '=', 'users.id')
          .on('enrollments.status', '=', 'active')
          .on('enrollments.academic_year_id', '=', year?.id ?? '00000000-0000-0000-0000-000000000000'),
      )
      .leftJoin('groups_class', 'groups_class.id', 'enrollments.group_id')
      .leftJoin('grades', 'grades.id', 'groups_class.grade_id')
      .select([
        'users.id',
        'users.email',
        'users.full_name',
        'users.is_minor',
        'users.status',
        'users.must_change_password',
        'users.last_login_at',
        'users.locked_until',
        'users.created_at',
        'user_roles.role',
        'groups_class.id as group_id',
        'groups_class.name as group_name',
        'grades.level as grade_level',
      ])
      .orderBy('users.full_name')
      .limit(2000);
    if (filters.role) query = query.where('user_roles.role', '=', filters.role);
    if (filters.status) query = query.where('users.status', '=', filters.status);
    if (filters.groupId) query = query.where('groups_class.id', '=', filters.groupId);
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim().toLowerCase()}%`;
      query = query.where((eb) => eb.or([eb(eb.fn('lower', ['users.full_name']), 'like', q), eb('users.email', 'like', q)]));
    }
    const rows = await query.execute();
    const links = rows.length
      ? await this.database.db
          .selectFrom('guardian_links')
          .innerJoin('users as g', 'g.id', 'guardian_links.guardian_id')
          .innerJoin('users as s', 's.id', 'guardian_links.student_id')
          .select(['guardian_links.guardian_id', 'guardian_links.student_id', 'g.full_name as guardian_name', 's.full_name as student_name'])
          .where('guardian_links.status', '=', 'active')
          .execute()
      : [];
    const linked = new Map<string, string[]>();
    for (const link of links) {
      linked.set(link.guardian_id, [...(linked.get(link.guardian_id) ?? []), link.student_name]);
      linked.set(link.student_id, [...(linked.get(link.student_id) ?? []), link.guardian_name]);
    }
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role as Role,
      isMinor: row.is_minor,
      status: row.status as 'active' | 'disabled',
      mustChangePassword: row.must_change_password,
      lastLoginAt: row.last_login_at,
      lockedUntil: row.locked_until && row.locked_until.getTime() > Date.now() ? row.locked_until : null,
      createdAt: row.created_at,
      groupId: row.group_id,
      group: row.group_name && row.grade_level != null ? groupLabel(row.grade_level, row.group_name) : null,
      linked: linked.get(row.id) ?? [],
    }));
  }

  async activity(userId: string) {
    return this.database.db
      .selectFrom('audit_log')
      .leftJoin('users as actor', 'actor.id', 'audit_log.actor_id')
      .select(['audit_log.id', 'audit_log.action', 'audit_log.meta', 'audit_log.created_at', 'actor.full_name as actor_name'])
      .where('audit_log.entity_id', '=', userId)
      .orderBy('audit_log.created_at', 'desc')
      .limit(30)
      .execute();
  }

  /* ---------- Alta ---------- */

  private welcomeBody(fullName: string, email: string, password: string, forLab: boolean) {
    const url = this.env.values.APP_PUBLIC_URL.replace(/\/$/, '');
    return [
      `Hola ${fullName}.`,
      '',
      'El Colegio Francisco Arango creó tu cuenta en Ludoteka Campus.',
      '',
      `Entra en: ${url}/ingresar`,
      `Correo: ${email}`,
      `Clave temporal: ${password}`,
      '',
      'Al entrar te enviaremos un código de 6 dígitos a este correo y después elegirás tu propia contraseña.',
      'La clave temporal deja de servir en cuanto la cambies.',
      forLab ? `Cuenta de laboratorio: ${email}.` : '',
      '',
      'Si no esperabas este correo, avisa a la secretaría del colegio.',
    ].join('\n');
  }

  private async sendWelcome(item: Welcome) {
    await this.mailer.send(
      item.to,
      item.to === item.email ? 'Tu cuenta de Ludoteka Campus' : `Cuenta de Ludoteka Campus para ${item.email}`,
      this.welcomeBody(item.fullName, item.email, item.password, item.to !== item.email),
      { sensitive: true },
    );
  }

  /** Bulk welcomes go out after the response, paced to stay under the mail provider's rate limit. */
  private deliverLater(items: Welcome[]) {
    if (!items.length) return;
    void (async () => {
      for (const item of items) {
        await this.sendWelcome(item).catch((error: unknown) => this.logger.error(`bienvenida no enviada: ${error instanceof Error ? error.message : error}`));
        await new Promise((resolve) => setTimeout(resolve, MAIL_GAP_MS));
      }
    })();
  }

  private async insertAccount(
    trx: Transaction<Database>,
    actorId: string,
    input: { email: string; fullName: string; role: Role; isMinor: boolean; passwordHash: string; groupId?: string; yearId?: string; studentIds?: string[] },
  ) {
    const user = await trx
      .insertInto('users')
      .values({ email: input.email, password_hash: input.passwordHash, full_name: input.fullName, is_minor: input.isMinor, must_change_password: true })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    await trx.insertInto('user_roles').values({ user_id: user.id, role: input.role }).execute();
    if (input.groupId && input.yearId && input.role === 'student') {
      await trx.insertInto('enrollments').values({ user_id: user.id, group_id: input.groupId, academic_year_id: input.yearId }).execute();
    }
    for (const studentId of input.studentIds ?? []) {
      await trx
        .insertInto('guardian_links')
        .values({ guardian_id: user.id, student_id: studentId, relationship: 'otro', created_by: actorId })
        .onConflict((oc) => oc.columns(['guardian_id', 'student_id']).doUpdateSet({ status: 'active' }))
        .execute();
    }
    await trx
      .insertInto('audit_log')
      .values({
        actor_id: actorId,
        action: 'user.create',
        entity: 'users',
        entity_id: user.id,
        meta: JSON.stringify({ role: input.role, groupId: input.groupId ?? null, guardianOf: input.studentIds?.length ?? 0 }),
      })
      .execute();
    return user.id;
  }

  async create(actor: AuthUser, input: { email: string; fullName: string; role: Role; isMinor?: boolean; groupId?: string; guardianOf?: string[] }) {
    const email = input.email.trim().toLowerCase();
    const taken = await this.database.db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (taken) throw new ApiError(409, 'EMAIL_TAKEN', 'Ese correo ya tiene cuenta');
    const year = await this.currentYear();
    if (input.groupId) {
      const group = await this.database.db.selectFrom('groups_class').select('academic_year_id').where('id', '=', input.groupId).executeTakeFirst();
      if (!group || group.academic_year_id !== year?.id) throw new ApiError(400, 'GROUP_NOT_FOUND', 'El grupo no existe en el año actual');
    }
    let studentIds: string[] = [];
    if (input.role === 'guardian' && input.guardianOf?.length) {
      const wanted = [...new Set(input.guardianOf.map((e) => e.trim().toLowerCase()))];
      const students = await this.database.db
        .selectFrom('users')
        .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
        .select(['users.id', 'users.email'])
        .where('users.email', 'in', wanted)
        .where('user_roles.role', '=', 'student')
        .execute();
      const missing = wanted.filter((e) => !students.some((s) => s.email === e));
      if (missing.length) throw new ApiError(400, 'STUDENT_NOT_FOUND', `No hay estudiantes con: ${missing.join(', ')}`);
      studentIds = students.map((s) => s.id);
    }
    const password = temporaryPassword();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const id = await this.database.withTx((trx) =>
      this.insertAccount(trx, actor.id, {
        email,
        fullName: input.fullName.trim(),
        role: input.role,
        isMinor: input.isMinor ?? input.role === 'student',
        passwordHash,
        groupId: input.groupId,
        yearId: year?.id,
        studentIds,
      }),
    );
    const to = this.identity.deliveryAddress(email);
    await this.sendWelcome({ to, email, fullName: input.fullName.trim(), password });
    return { id, sentTo: to };
  }

  /* ---------- Acciones sobre una cuenta ---------- */

  private async target(id: string) {
    const user = await this.database.db
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .select(['users.id', 'users.email', 'users.full_name', 'users.status', 'user_roles.role'])
      .where('users.id', '=', id)
      .executeTakeFirst();
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado');
    return user;
  }

  async update(actor: AuthUser, id: string, patch: { fullName?: string; role?: Role; isMinor?: boolean; status?: 'active' | 'disabled' }) {
    const user = await this.target(id);
    if (id === actor.id && (patch.status === 'disabled' || (patch.role && patch.role !== 'admin'))) {
      throw new ApiError(400, 'SELF_LOCKOUT', 'No puedes desactivar tu propia cuenta ni quitarte el rol de administrador');
    }
    await this.database.withTx(async (trx) => {
      const set: { full_name?: string; is_minor?: boolean; status?: string; updated_at: Date; failed_logins?: number; locked_until?: null } = { updated_at: new Date() };
      if (patch.fullName) set.full_name = patch.fullName.trim();
      if (patch.isMinor !== undefined) set.is_minor = patch.isMinor;
      if (patch.status) set.status = patch.status;
      if (patch.status === 'active') Object.assign(set, { failed_logins: 0, locked_until: null });
      await trx.updateTable('users').set(set).where('id', '=', id).execute();
      if (patch.role && patch.role !== user.role) await trx.updateTable('user_roles').set({ role: patch.role }).where('user_id', '=', id).execute();
    });
    if (patch.status === 'disabled') await this.identity.revokeAll(id);
    const action = patch.status === 'disabled' ? 'user.disable' : patch.status === 'active' && user.status !== 'active' ? 'user.enable' : 'user.update';
    await this.audit(actor.id, action, id, { ...patch, previousRole: patch.role ? user.role : undefined });
    return { ok: true };
  }

  async resendAccess(actor: AuthUser, id: string) {
    const user = await this.target(id);
    if (user.status !== 'active') throw new ApiError(400, 'ACCOUNT_DISABLED', 'Reactiva la cuenta antes de reenviar el acceso');
    const password = temporaryPassword();
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    await this.database.db
      .updateTable('users')
      .set({ password_hash, must_change_password: true, failed_logins: 0, locked_until: null, updated_at: new Date() })
      .where('id', '=', id)
      .execute();
    await this.identity.revokeAll(id);
    const to = this.identity.deliveryAddress(user.email);
    await this.sendWelcome({ to, email: user.email, fullName: user.full_name, password });
    await this.audit(actor.id, 'user.resend_access', id);
    return { sentTo: to };
  }

  async forcePasswordChange(actor: AuthUser, id: string) {
    await this.target(id);
    await this.database.db.updateTable('users').set({ must_change_password: true, updated_at: new Date() }).where('id', '=', id).execute();
    await this.identity.revokeAll(id);
    await this.audit(actor.id, 'user.force_password', id);
    return { ok: true };
  }

  async revokeSessions(actor: AuthUser, id: string) {
    await this.target(id);
    await this.identity.revokeAll(id);
    await this.audit(actor.id, 'session.revoke_all', id);
    return { ok: true };
  }

  /* ---------- Importación masiva ---------- */

  async usersTemplate() {
    const { labels } = await this.groupMap();
    return usersTemplate(labels);
  }

  structureTemplate() {
    return structureTemplate();
  }

  private async check(candidates: (Partial<AccountInput> & { line: number; errors?: string[] })[]): Promise<PreviewRow[]> {
    const { year, byKey } = await this.groupMap();
    const emails = new Set<string>();
    for (const c of candidates) {
      if (c.email) emails.add(c.email);
      c.guardianOf?.forEach((e) => emails.add(e));
    }
    const existing = emails.size
      ? await this.database.db
          .selectFrom('users')
          .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
          .select(['users.email', 'user_roles.role'])
          .where('users.email', 'in', [...emails])
          .execute()
      : [];
    const existingRole = new Map(existing.map((e) => [e.email, e.role]));
    const inFile = new Map<string, number>();
    const fileRole = new Map<string, Role | undefined>();
    for (const c of candidates) if (c.email && !fileRole.has(c.email)) fileRole.set(c.email, c.role);

    const checked = candidates.map((c) => {
      const errors = [...(c.errors ?? [])];
      const warnings: string[] = [];
      if (!c.fullName || c.fullName.length < 2) errors.push('Falta el nombre');
      if (!c.email) errors.push('Falta el correo');
      else if (!EMAIL.test(c.email)) errors.push('Correo inválido');
      else if (existingRole.has(c.email)) errors.push('Ya existe una cuenta con ese correo');
      else if (inFile.has(c.email)) errors.push(`Correo repetido (fila ${inFile.get(c.email)})`);
      if (c.email && !inFile.has(c.email)) inFile.set(c.email, c.line);
      if (!c.role && !errors.some((e) => e.startsWith('Rol'))) errors.push('Falta el rol');

      if (c.role === 'student') {
        if (!c.group) warnings.push('Sin grupo: quedará sin matricular');
        else if (!year) errors.push('No hay año académico actual para matricular');
        else if (!byKey.has(c.group)) errors.push(`El grupo ${c.group} no existe en ${year.name}`);
      } else if (c.group) {
        warnings.push('El grupo solo aplica a estudiantes; se ignora');
      }
      if (c.guardianOf?.length) {
        if (c.role !== 'guardian') warnings.push('"acudiente_de" solo aplica a acudientes; se ignora');
        else {
          for (const target of c.guardianOf) {
            const role = existingRole.get(target) ?? fileRole.get(target);
            if (!role) errors.push(`No hay estudiante con el correo ${target}`);
            else if (role !== 'student') errors.push(`${target} no es estudiante`);
          }
        }
      } else if (c.role === 'guardian') {
        warnings.push('Acudiente sin estudiantes vinculados');
      }
      const isMinor = c.isMinor ?? c.role === 'student';
      if (c.role !== 'student' && isMinor) warnings.push('Marcado como menor sin ser estudiante');
      return {
        line: c.line,
        fullName: c.fullName,
        email: c.email,
        role: c.role,
        group: c.role === 'student' ? c.group : undefined,
        isMinor,
        guardianOf: c.role === 'guardian' ? c.guardianOf : undefined,
        errors,
        warnings,
      };
    });
    const accepted = new Set(checked.filter((r) => !r.errors.length).map((r) => r.email));
    const rejected = new Set(checked.filter((r) => r.errors.length && r.email && !accepted.has(r.email)).map((r) => r.email!));
    for (const row of checked) {
      for (const target of row.guardianOf ?? []) {
        if (rejected.has(target) && !existingRole.has(target)) row.errors.push(`La fila del estudiante ${target} tiene errores`);
      }
    }
    return checked;
  }

  async previewUsers(buffer: Buffer, fileName: string) {
    if (!buffer?.length) throw new ApiError(400, 'EMPTY_FILE', 'El archivo está vacío');
    const sheet = await readSheet(buffer, fileName, 'Usuarios').catch(() => {
      throw new ApiError(400, 'BAD_FILE', 'No pudimos leer el archivo. Usa la plantilla en Excel (.xlsx) o un CSV.');
    });
    const headerIndex = sheet.findIndex((row) => row.some((cell) => cell.trim()));
    if (headerIndex < 0) throw new ApiError(400, 'EMPTY_FILE', 'El archivo está vacío');
    const col = columns(sheet[headerIndex]!, {
      fullName: ['nombre completo', 'nombre', 'nombres', 'full name', 'name'],
      email: ['correo', 'correo electronico', 'email', 'e mail'],
      role: ['rol', 'role', 'perfil'],
      group: ['grupo', 'curso', 'group'],
      isMinor: ['menor de edad', 'menor', 'is minor'],
      guardianOf: ['acudiente de', 'estudiantes', 'hijos', 'guardian of'],
    });
    const missing = (['fullName', 'email', 'role'] as const).filter((key) => col[key] < 0);
    if (missing.length) {
      throw new ApiError(400, 'BAD_HEADERS', 'Faltan columnas obligatorias: nombre_completo, correo y rol. Descarga la plantilla para ver el formato.');
    }
    const body = sheet.slice(headerIndex + 1);
    if (body.length > 2000) throw new ApiError(400, 'TOO_MANY_ROWS', 'Máximo 2000 filas por archivo');
    const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');
    const candidates = body
      .map((row, i) => ({ row, line: headerIndex + i + 2 }))
      .filter(({ row }) => row.some((value) => value.trim()))
      .map(({ row, line }) => {
        const errors: string[] = [];
        const roleText = cell(row, col.role);
        const role = roleText ? parseRole(roleText) : null;
        if (roleText && !role) errors.push(`Rol "${roleText}" no reconocido`);
        const groupText = cell(row, col.group);
        const group = groupText && parseGroup(groupText) ? groupKey(groupText) : undefined;
        if (groupText && !group) errors.push(`Grupo "${groupText}" con formato inválido (usa 6A, 10B…)`);
        const minorText = cell(row, col.isMinor);
        const isMinor = parseBool(minorText);
        if (minorText && isMinor === undefined) errors.push(`"${minorText}" no es si/no`);
        const guardianOf = cell(row, col.guardianOf)
          .split(/[;,\s]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        return {
          line,
          errors,
          fullName: cell(row, col.fullName).replace(/\s+/g, ' ') || undefined,
          email: cell(row, col.email).toLowerCase() || undefined,
          role: role ?? undefined,
          group,
          isMinor,
          guardianOf: guardianOf.length ? guardianOf : undefined,
        };
      });
    if (!candidates.length) throw new ApiError(400, 'EMPTY_FILE', 'La plantilla no tiene filas con datos');
    const rows = await this.check(candidates);
    return { fileName, rows, valid: rows.filter((r) => !r.errors.length).length, invalid: rows.filter((r) => r.errors.length).length };
  }

  async commitUsers(actor: AuthUser, input: { fileName: string; rows: AccountInput[]; sendEmails?: boolean }) {
    const checked = await this.check(
      input.rows.map((row, i) => ({
        ...row,
        line: i + 1,
        email: row.email.trim().toLowerCase(),
        group: groupKey(row.group),
        guardianOf: row.guardianOf?.map((e) => e.trim().toLowerCase()),
      })),
    );
    const valid = checked.filter((r) => !r.errors.length) as (PreviewRow & AccountInput)[];
    const { year, byKey } = await this.groupMap();

    const passwords = new Map<string, { password: string; hash: string }>();
    for (let i = 0; i < valid.length; i += HASH_BATCH) {
      await Promise.all(
        valid.slice(i, i + HASH_BATCH).map(async (row) => {
          const password = temporaryPassword();
          passwords.set(row.email, { password, hash: await argon2.hash(password, { type: argon2.argon2id }) });
        }),
      );
    }

    const ids = new Map<string, string>();
    const order = [...valid.filter((r) => r.role !== 'guardian'), ...valid.filter((r) => r.role === 'guardian')];
    await this.database.withTx(async (trx) => {
      for (const row of order) {
        let studentIds: string[] = [];
        if (row.role === 'guardian' && row.guardianOf?.length) {
          const fromFile = row.guardianOf.map((e) => ids.get(e)).filter((id): id is string => Boolean(id));
          const elsewhere = row.guardianOf.filter((e) => !ids.has(e));
          const existing = elsewhere.length
            ? await trx.selectFrom('users').select('id').where('email', 'in', elsewhere).execute()
            : [];
          studentIds = [...fromFile, ...existing.map((s) => s.id)];
        }
        const id = await this.insertAccount(trx, actor.id, {
          email: row.email,
          fullName: row.fullName,
          role: row.role,
          isMinor: row.isMinor ?? row.role === 'student',
          passwordHash: passwords.get(row.email)!.hash,
          groupId: row.group ? byKey.get(row.group) : undefined,
          yearId: year?.id,
          studentIds,
        });
        ids.set(row.email, id);
      }
      await trx
        .insertInto('account_imports')
        .values({
          actor_id: actor.id,
          kind: 'users',
          file_name: input.fileName.slice(0, 200),
          total_rows: input.rows.length,
          created_count: valid.length,
          skipped_count: checked.length - valid.length,
          errors: JSON.stringify(checked.filter((r) => r.errors.length).map((r) => ({ line: r.line, email: r.email, errors: r.errors }))),
        })
        .execute();
    });

    const welcomes = valid.map((row) => ({ to: this.identity.deliveryAddress(row.email), email: row.email, fullName: row.fullName, password: passwords.get(row.email)!.password }));
    if (input.sendEmails !== false) this.deliverLater(welcomes);
    await this.audit(actor.id, 'users.import', null, { fileName: input.fileName, created: valid.length, skipped: checked.length - valid.length }, 'account_imports');
    return {
      created: valid.length,
      skipped: checked.length - valid.length,
      errors: checked.filter((r) => r.errors.length).map((r) => ({ line: r.line, email: r.email ?? null, errors: r.errors })),
      emailsQueued: input.sendEmails !== false ? welcomes.length : 0,
      /** Only returned when the admin chose not to email them, so the passwords can be handed out on paper. */
      credentials: input.sendEmails === false ? welcomes.map(({ email, fullName, password }) => ({ email, fullName, password })) : undefined,
    };
  }

  async imports() {
    return this.database.db
      .selectFrom('account_imports')
      .leftJoin('users', 'users.id', 'account_imports.actor_id')
      .select([
        'account_imports.id',
        'account_imports.kind',
        'account_imports.file_name',
        'account_imports.total_rows',
        'account_imports.created_count',
        'account_imports.skipped_count',
        'account_imports.created_at',
        'users.full_name as actor_name',
      ])
      .orderBy('account_imports.created_at', 'desc')
      .limit(20)
      .execute();
  }

  /* ---------- Estructura académica ---------- */

  /** Creates the missing grades, current-year groups and subjects from the structure workbook; existing ones are kept. */
  async importStructure(actor: AuthUser, buffer: Buffer | undefined, fileName: string, dryRun: boolean) {
    const year = await this.currentYear();
    if (!year) throw new ApiError(400, 'NO_YEAR', 'Primero crea el año académico actual');
    let groups: { level: number; name: string }[] = [];
    let subjects: [string, string, string][] = [];
    if (buffer?.length) {
      const groupSheet = await readSheet(buffer, fileName, 'Grupos').catch(() => {
        throw new ApiError(400, 'BAD_FILE', 'No pudimos leer el archivo de estructura');
      });
      const gCol = columns(groupSheet[0] ?? [], { level: ['grado', 'grade', 'nivel'], name: ['grupo', 'group', 'nombre'] });
      groups = groupSheet
        .slice(1)
        .map((row) => ({ level: Number(row[gCol.level] ?? ''), name: (row[gCol.name] ?? '').trim().toUpperCase() }))
        .filter((g) => Number.isInteger(g.level) && g.level >= 1 && g.level <= 11 && /^[A-Z]{1,3}$/.test(g.name));
      if (!/\.csv$/i.test(fileName)) {
        const subjectSheet = await readSheet(buffer, fileName, 'Materias');
        const sCol = columns(subjectSheet[0] ?? [], { code: ['codigo', 'code'], name: ['nombre', 'materia', 'name'], area: ['area'] });
        if (sCol.code >= 0 && sCol.name >= 0) {
          subjects = subjectSheet
            .slice(1)
            .map((row) => [(row[sCol.code] ?? '').trim().toUpperCase(), (row[sCol.name] ?? '').trim(), (row[sCol.area] ?? row[sCol.name] ?? '').trim()] as [string, string, string])
            .filter(([code, name]) => code && name);
        }
      }
    } else {
      for (let level = 6; level <= 11; level++) for (const name of ['A', 'B']) groups.push({ level, name });
      subjects = DEFAULT_SUBJECTS;
    }

    const [grades, currentGroups, currentSubjects] = await Promise.all([
      this.database.db.selectFrom('grades').select(['id', 'level']).execute(),
      this.database.db
        .selectFrom('groups_class')
        .innerJoin('grades', 'grades.id', 'groups_class.grade_id')
        .select(['grades.level', 'groups_class.name'])
        .where('groups_class.academic_year_id', '=', year.id)
        .execute(),
      this.database.db.selectFrom('subjects').select('code').execute(),
    ]);
    const haveGrade = new Set(grades.map((g) => g.level));
    const haveGroup = new Set(currentGroups.map((g) => groupLabel(g.level, g.name)));
    const haveSubject = new Set(currentSubjects.map((s) => s.code.toUpperCase()));
    const newGrades = [...new Set(groups.map((g) => g.level))].filter((level) => !haveGrade.has(level));
    const newGroups = groups.filter((g, i, all) => !haveGroup.has(`${g.level}${g.name}`) && all.findIndex((o) => o.level === g.level && o.name === g.name) === i);
    const newSubjects = subjects.filter(([code], i, all) => !haveSubject.has(code) && all.findIndex(([other]) => other === code) === i);
    const summary = {
      year: year.name,
      grades: newGrades.map(gradeName),
      groups: newGroups.map((g) => `${g.level}${g.name}`),
      subjects: newSubjects.map(([, name]) => name),
    };
    if (dryRun) return { ...summary, applied: false };

    await this.database.withTx(async (trx) => {
      for (const level of newGrades) await trx.insertInto('grades').values({ level, name: gradeName(level) }).execute();
      const gradeIds = new Map((await trx.selectFrom('grades').select(['id', 'level']).execute()).map((g) => [g.level, g.id]));
      for (const g of newGroups) {
        await trx.insertInto('groups_class').values({ grade_id: gradeIds.get(g.level)!, academic_year_id: year.id, name: groupLabel(g.level, g.name) }).execute();
      }
      for (const [code, name, area] of newSubjects) await trx.insertInto('subjects').values({ code, name, area }).execute();
      await trx
        .insertInto('account_imports')
        .values({
          actor_id: actor.id,
          kind: 'structure',
          file_name: (buffer?.length ? fileName : 'estructura-base').slice(0, 200),
          total_rows: groups.length + subjects.length,
          created_count: newGrades.length + newGroups.length + newSubjects.length,
          skipped_count: groups.length + subjects.length - newGroups.length - newSubjects.length,
          errors: JSON.stringify([]),
        })
        .execute();
    });
    await this.audit(actor.id, 'structure.import', null, summary, 'account_imports');
    return { ...summary, applied: true };
  }
}
