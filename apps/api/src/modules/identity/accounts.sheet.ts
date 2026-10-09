import ExcelJS from 'exceljs';
import type { Role } from '@eduquest/contracts';

/** Spreadsheet helpers for bulk account and structure imports: templates, Excel/CSV reading and header matching. */

export const ROLE_LABELS: Record<Role, string> = {
  student: 'estudiante',
  teacher: 'docente',
  directivo: 'directivo',
  guardian: 'acudiente',
  admin: 'administrador',
};

const ROLE_ALIASES: Record<string, Role> = {
  estudiante: 'student', alumno: 'student', alumna: 'student', student: 'student',
  docente: 'teacher', profesor: 'teacher', profesora: 'teacher', teacher: 'teacher',
  directivo: 'directivo', coordinador: 'directivo', coordinadora: 'directivo', coordinacion: 'directivo', rector: 'directivo', rectora: 'directivo', rectoria: 'directivo',
  acudiente: 'guardian', padre: 'guardian', madre: 'guardian', tutor: 'guardian', guardian: 'guardian',
  administrador: 'admin', administradora: 'admin', admin: 'admin',
};

export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function parseRole(value: string): Role | null {
  return ROLE_ALIASES[normalize(value)] ?? null;
}

export function parseBool(value: string): boolean | undefined {
  const v = normalize(value);
  if (!v) return undefined;
  if (['si', 'sí', 'yes', 'true', '1', 'x'].includes(v)) return true;
  if (['no', 'false', '0'].includes(v)) return false;
  return undefined;
}

/** "6A", "6 A", "6°A", "6-B" → { level: 6, name: "A" }. */
export function parseGroup(value: string): { level: number; name: string } | null {
  const match = /^(\d{1,2})\s*[°º-]?\s*([a-z]{1,3})$/i.exec(value.trim());
  if (!match) return null;
  return { level: Number(match[1]), name: match[2]!.toUpperCase() };
}

/** Groups may be stored as "A" or as "6A"; both read as "6A". */
export function groupLabel(level: number, name: string) {
  const upper = name.trim().toUpperCase();
  return upper.startsWith(String(level)) ? upper : `${level}${upper}`;
}

export type Sheet = string[][];

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value as unknown;
  if (value == null) return '';
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (v.richText) return v.richText.map((part) => part.text).join('');
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }
  return String(value);
}

function parseCsv(text: string): Sheet {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: Sheet = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Reads the first sheet (or the named one) of an .xlsx, or a CSV with comma or semicolon. */
export async function readSheet(buffer: Buffer, fileName: string, preferred?: string): Promise<Sheet> {
  if (/\.csv$/i.test(fileName) || !buffer.subarray(0, 2).equals(Buffer.from('PK'))) {
    return parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  }
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = (preferred && book.getWorksheet(preferred)) || book.worksheets[0];
  if (!sheet) return [];
  const rows: Sheet = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const out: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) out.push(cellText(row.getCell(c)).trim());
    rows.push(out);
  });
  return rows;
}

/** Maps each wanted column to its index by matching normalized header aliases. */
export function columns<K extends string>(header: string[], wanted: Record<K, string[]>): Record<K, number> {
  const normalized = header.map((h) => normalize(h).replace(/[^a-z0-9]+/g, ' ').trim());
  const out = {} as Record<K, number>;
  for (const key of Object.keys(wanted) as K[]) {
    out[key] = normalized.findIndex((h) => wanted[key].some((alias) => h === alias || h.startsWith(`${alias} `)));
  }
  return out;
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6A45F0' } };
  header.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function usersTemplate(groups: string[]) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Ludoteka Campus';
  const sheet = book.addWorksheet('Usuarios');
  sheet.columns = [
    { header: 'nombre_completo', key: 'name', width: 34 },
    { header: 'correo', key: 'email', width: 34 },
    { header: 'rol', key: 'role', width: 16 },
    { header: 'grupo', key: 'group', width: 10 },
    { header: 'menor_de_edad', key: 'minor', width: 16 },
    { header: 'acudiente_de', key: 'guardianOf', width: 44 },
  ];
  styleHeader(sheet);
  sheet.addRows([
    { name: 'Ana María Pérez Gómez', email: 'ana.perez@colegio.edu.co', role: 'estudiante', group: groups[0] ?? '6A', minor: 'si', guardianOf: '' },
    { name: 'Luis Pérez', email: 'luis.perez@correo.com', role: 'acudiente', group: '', minor: 'no', guardianOf: 'ana.perez@colegio.edu.co' },
    { name: 'Marta Ruiz', email: 'marta.ruiz@colegio.edu.co', role: 'docente', group: '', minor: 'no', guardianOf: '' },
  ]);
  const roles = `"${Object.values(ROLE_LABELS).join(',')}"`;
  for (let r = 2; r <= 1000; r++) {
    sheet.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [roles] };
    sheet.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"si,no"'] };
  }
  const help = book.addWorksheet('Instrucciones');
  help.columns = [{ width: 110 }];
  [
    'Cómo llenar la plantilla de usuarios',
    '',
    '1. Una fila por persona. No cambies los nombres de las columnas.',
    `2. rol: ${Object.values(ROLE_LABELS).join(', ')}.`,
    `3. grupo: solo para estudiantes, con el formato grado + letra. Grupos del año actual: ${groups.join(', ') || 'aún no hay grupos'}.`,
    '4. menor_de_edad: si o no. Para estudiantes, si se deja vacío se asume "si".',
    '5. acudiente_de: solo para acudientes. Correos de sus estudiantes separados por punto y coma (;). El estudiante puede venir en este mismo archivo.',
    '6. Ludoteka genera una clave temporal por persona y la envía a su correo. En el primer ingreso se pide un código de 6 dígitos y el cambio de clave.',
    '7. Antes de crear las cuentas verás una vista previa con los errores de cada fila.',
  ].forEach((line, i) => {
    const row = help.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 14 };
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}

export const DEFAULT_SUBJECTS: [string, string, string][] = [
  ['MAT', 'Matemáticas', 'Matemáticas'],
  ['ESP', 'Lengua castellana', 'Humanidades'],
  ['ING', 'Inglés', 'Humanidades'],
  ['CNA', 'Ciencias naturales', 'Ciencias naturales'],
  ['SOC', 'Ciencias sociales', 'Ciencias sociales'],
  ['TEC', 'Tecnología e informática', 'Tecnología'],
  ['ART', 'Educación artística', 'Artística'],
  ['EDF', 'Educación física', 'Educación física'],
  ['ETI', 'Ética y valores', 'Ética'],
  ['REL', 'Educación religiosa', 'Religión'],
];

const GRADE_NAMES: Record<number, string> = { 6: 'Sexto', 7: 'Séptimo', 8: 'Octavo', 9: 'Noveno', 10: 'Décimo', 11: 'Undécimo' };
export const gradeName = (level: number) => GRADE_NAMES[level] ?? `Grado ${level}`;

export async function structureTemplate() {
  const book = new ExcelJS.Workbook();
  book.creator = 'Ludoteka Campus';
  const groups = book.addWorksheet('Grupos');
  groups.columns = [{ header: 'grado', key: 'level', width: 10 }, { header: 'grupo', key: 'name', width: 10 }];
  styleHeader(groups);
  for (let level = 6; level <= 11; level++) for (const name of ['A', 'B']) groups.addRow({ level, name });
  const subjects = book.addWorksheet('Materias');
  subjects.columns = [{ header: 'codigo', key: 'code', width: 10 }, { header: 'nombre', key: 'name', width: 30 }, { header: 'area', key: 'area', width: 24 }];
  styleHeader(subjects);
  DEFAULT_SUBJECTS.forEach(([code, name, area]) => subjects.addRow({ code, name, area }));
  return Buffer.from(await book.xlsx.writeBuffer());
}
