/**
 * Static validation of model-generated SQL for the Observatorio. It is the first barrier;
 * the second is the database itself (READ ONLY transaction + role with SELECT on v_* only).
 */

export interface ViewDoc {
  name: string;
  description: string;
  columns: [string, string][];
}

export const VIEWS: ViewDoc[] = [
  { name: 'v_estudiantes', description: 'Estudiantes matriculados por grupo', columns: [['estudiante_id', 'uuid'], ['estudiante', 'nombre completo'], ['grupo', 'ej. 6A'], ['grado', 'ej. Sexto'], ['anio', 'año lectivo'], ['estado_matricula', 'active | withdrawn'], ['es_menor', 'bool'], ['group_id', 'uuid']] },
  { name: 'v_cursos', description: 'Cursos con materia, grupo y docente', columns: [['curso_id', 'uuid'], ['curso', 'título'], ['materia', 'texto'], ['grupo', 'texto'], ['docente', 'nombre'], ['publicado', 'bool'], ['group_id', 'uuid']] },
  { name: 'v_evaluaciones', description: 'Evaluaciones de cada curso', columns: [['evaluacion_id', 'uuid'], ['codigo', 'texto'], ['evaluacion', 'título'], ['tipo', 'practice | exam | live'], ['estado', 'draft | published | closed'], ['curso_id', 'uuid'], ['curso', 'título'], ['group_id', 'uuid'], ['preguntas', 'int'], ['creada_en', 'timestamptz']] },
  { name: 'v_intentos', description: 'Intentos de evaluaciones con puntaje', columns: [['intento_id', 'uuid'], ['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['evaluacion_id', 'uuid'], ['evaluacion', 'título'], ['tipo', 'practice | exam | live'], ['curso_id', 'uuid'], ['curso', 'título'], ['group_id', 'uuid'], ['estado', 'active | completed | suspended'], ['puntaje', 'int'], ['puntaje_max', 'int'], ['porcentaje', 'numeric 0-100'], ['marcado', 'bool, revisión de integridad'], ['infracciones', 'int'], ['iniciado_en', 'timestamptz'], ['enviado_en', 'timestamptz']] },
  { name: 'v_respuestas', description: 'Cada respuesta a una pregunta de evaluación', columns: [['intento_id', 'uuid'], ['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['group_id', 'uuid'], ['evaluacion', 'título'], ['pregunta_codigo', 'texto'], ['pregunta', 'enunciado'], ['tema', 'tema de Mi ruta o null'], ['dificultad', 'baja | media | alta'], ['correcta', 'bool'], ['tiempo_ms', 'int'], ['respondida_en', 'timestamptz']] },
  { name: 'v_tareas', description: 'Entregas de tareas', columns: [['entrega_id', 'uuid'], ['tarea', 'título'], ['curso', 'título'], ['group_id', 'uuid'], ['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['estado', 'submitted | graded'], ['puntaje', 'int o null'], ['puntaje_max', 'int'], ['fecha_limite', 'timestamptz'], ['entregada_en', 'timestamptz'], ['calificada_en', 'timestamptz']] },
  { name: 'v_lecciones', description: 'Avance de lecciones', columns: [['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['group_id', 'uuid'], ['curso', 'título'], ['unidad', 'título'], ['leccion', 'título'], ['estado', 'started | completed'], ['completada_en', 'timestamptz']] },
  { name: 'v_integridad', description: 'Eventos de integridad en exámenes (salir de pantalla completa, cambiar de pestaña...)', columns: [['evento_id', 'uuid'], ['intento_id', 'uuid'], ['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['group_id', 'uuid'], ['evaluacion', 'título'], ['tipo', 'texto'], ['ocurrido_en', 'timestamptz']] },
  { name: 'v_xp', description: 'Experiencia, racha e insignias por estudiante (año actual)', columns: [['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['group_id', 'uuid'], ['xp_total', 'int'], ['racha_actual', 'int días'], ['mejor_racha', 'int días'], ['insignias', 'int']] },
  { name: 'v_maestria', description: 'Nivel de maestría 1-10 por estudiante y tema', columns: [['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['group_id', 'uuid'], ['tema', 'nombre del tema'], ['tema_codigo', 'texto'], ['nivel', 'int 1-10'], ['aciertos', 'int'], ['intentos', 'int'], ['actualizado_en', 'timestamptz']] },
  { name: 'v_ruta', description: 'Retos de Mi ruta generados y respondidos', columns: [['reto_id', 'uuid'], ['estudiante_id', 'uuid'], ['estudiante', 'nombre'], ['group_id', 'uuid'], ['tema', 'texto'], ['nivel', 'int'], ['estado', 'pending | correct | wrong | skipped'], ['origen', 'ia | plantilla'], ['verificacion', 'verified | corrected | template'], ['creado_en', 'timestamptz'], ['respondido_en', 'timestamptz']] },
  { name: 'v_biblioteca', description: 'Recursos de la biblioteca con vistas y guardados', columns: [['recurso_id', 'uuid'], ['titulo', 'texto'], ['tipo', 'pdf | image | video | doc | link'], ['materia', 'texto'], ['visibilidad', 'public | institution | course'], ['estado', 'texto'], ['group_id', 'uuid o null si no es de un curso'], ['vistas', 'int'], ['guardados', 'int'], ['creado_en', 'timestamptz']] },
];

export const VIEW_NAMES = new Set(VIEWS.map((v) => v.name));
export const MAX_ROWS = 200;

const FORBIDDEN_WORDS = /\b(insert|update|delete|upsert|merge|drop|alter|create|grant|revoke|truncate|set|reset|show|explain|copy|import|export|backup|restore|begin|commit|rollback|savepoint|prepare|execute|deallocate|declare|fetch|call|do|listen|notify|lock|vacuum|analyze|cancel|pause|resume|comment|discard|refresh|into|returning|recursive|lateral)\b/i;
const FORBIDDEN_FUNCTIONS = /\b(pg_sleep|crdb_internal|pg_catalog|information_schema|current_setting|set_config|pg_read_file|generate_series|crdb_internal|system)\b/i;
const SCHEMAS = ['public', 'pg_catalog', 'information_schema', 'crdb_internal', 'system', 'pg_extension'];

export type Validation = { ok: true; sql: string; views: string[] } | { ok: false; reason: string };

/** Replaces string literals and quoted identifiers so keywords inside them are not analysed. */
function mask(sql: string) {
  return sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '"q"');
}

export function validateSql(raw: string, databaseName?: string): Validation {
  let sql = raw.trim().replace(/;+\s*$/, '').trim();
  if (!sql) return { ok: false, reason: 'La consulta está vacía' };
  if (sql.length > 4000) return { ok: false, reason: 'La consulta es demasiado larga' };
  if (/--|\/\*/.test(sql)) return { ok: false, reason: 'No se permiten comentarios en el SQL' };
  if (/\$|\\|\bE'/i.test(sql)) return { ok: false, reason: 'No se permiten parámetros, escapes ni cadenas con $' };
  if (/"\s*\.|\.\s*"/.test(sql)) return { ok: false, reason: 'No se permiten nombres calificados entre comillas' };
  const masked = mask(sql);
  if (masked.includes(';')) return { ok: false, reason: 'Solo se permite una sentencia' };
  if (!/^\s*(select|with)\b/i.test(masked)) return { ok: false, reason: 'Solo se permiten consultas SELECT' };
  const word = FORBIDDEN_WORDS.exec(masked);
  if (word) return { ok: false, reason: `Palabra no permitida: ${word[1]!.toUpperCase()}` };
  const fn = FORBIDDEN_FUNCTIONS.exec(masked);
  if (fn) return { ok: false, reason: `Función o catálogo no permitido: ${fn[1]}` };
  const qualifiers = [...SCHEMAS, ...(databaseName ? [databaseName.toLowerCase()] : [])];
  const qualified = new RegExp(`\\b(${qualifiers.join('|')})\\s*\\.`, 'i').exec(masked);
  if (qualified) return { ok: false, reason: `No se permite el esquema ${qualified[1]}` };

  const ctes = new Set([...masked.matchAll(/(?:\bwith|,)\s*([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((m) => m[1]!.toLowerCase()));
  for (const cte of ctes) if (VIEW_NAMES.has(cte)) return { ok: false, reason: `No se puede redefinir la vista ${cte}` };
  const relations = masked.replace(/\b(extract|substring|trim|overlay)\s*\([^()]*\)/gi, 'f()');
  const targets = [...relations.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_.]*)/gi)].map((m) => m[1]!.toLowerCase());
  const fromLists = relations.matchAll(/\bfrom\s+([^()]*?)(?=\b(?:where|group|order|limit|offset|join|inner|left|right|full|cross|natural|on|using|union|except|intersect|having|window)\b|[()]|$)/gi);
  for (const list of fromLists) {
    for (const piece of list[1]!.split(',').slice(1)) {
      const name = /^\s*([a-z_][a-z0-9_.]*)/i.exec(piece)?.[1];
      if (name) targets.push(name.toLowerCase());
    }
  }
  for (const target of targets) {
    if (!VIEW_NAMES.has(target) && !ctes.has(target)) return { ok: false, reason: `Solo se pueden consultar las vistas v_*: ${target} no está permitida` };
  }
  const views = [...new Set([...masked.matchAll(/\bv_[a-z_]+\b/gi)].map((m) => m[0].toLowerCase()))];
  const unknown = views.find((v) => !VIEW_NAMES.has(v));
  if (unknown) return { ok: false, reason: `La vista ${unknown} no existe` };
  if (!views.length) return { ok: false, reason: 'La consulta debe usar al menos una vista v_*' };

  const limit = /\blimit\s+(\d+)(\s+offset\s+\d+)?\s*$/i.exec(sql);
  sql = limit
    ? `${sql.slice(0, limit.index)}LIMIT ${Math.min(Number(limit[1]), MAX_ROWS + 1)}${limit[2] ?? ''}`
    : `${sql}\nLIMIT ${MAX_ROWS + 1}`;
  return { ok: true, sql, views };
}

/** Prepends CTEs that shadow each referenced view with the rows of the teacher's groups. */
export function scopeToGroups(sql: string, views: string[]) {
  const ctes = views.map((view) =>
    view === 'v_biblioteca'
      ? `${view} AS (SELECT * FROM public.${view} WHERE group_id IS NULL OR group_id = ANY($1::UUID[]))`
      : `${view} AS (SELECT * FROM public.${view} WHERE group_id = ANY($1::UUID[]))`,
  );
  const body = sql.replace(/^\s*with\s+/i, '');
  const hadWith = body !== sql;
  return `WITH ${ctes.join(',\n')}${hadWith ? ',\n' : '\n'}${body}`;
}
