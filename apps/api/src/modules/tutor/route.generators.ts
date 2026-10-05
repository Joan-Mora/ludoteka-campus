/**
 * Generators for "Mi ruta". Each one knows how to pick parameters for a mastery level,
 * validate parameters proposed by the model and compute the true answer, so the stored
 * answer never depends on the model.
 */

export const GENERATORS = ['order_ops', 'simplify', 'frac_add', 'gcd_lcm', 'decimal', 'percent', 'proportion', 'triangle', 'area', 'mean'] as const;
export type GeneratorKey = (typeof GENERATORS)[number];
export type AnswerKind = 'integer' | 'decimal' | 'fraction' | 'irreducible';
export type Params = Record<string, number | string | number[]>;

export interface Solution {
  answer: string;
  kind: AnswerKind;
  explanation: string;
}

export interface Exercise extends Solution {
  params: Params;
  prompt: string;
  hint: string;
}

interface Generator {
  /** Parameter shape and ranges described for the model. */
  schema: (level: number) => string;
  pick: (level: number, rnd: () => number) => Params;
  /** Returns null when params are out of range or inconsistent. */
  solve: (params: Params) => Solution | null;
  prompt: (params: Params) => string;
  hint: (params: Params) => string;
  /** Numbers that must appear in the statement. */
  numbers: (params: Params) => number[];
}

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inRange = (v: unknown, min: number, max: number) => int(v) && v >= min && v <= max;
const decimals = (v: number) => (String(v).split('.')[1] ?? '').length;
const between = (rnd: () => number, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const choice = <T>(rnd: () => number, items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;
const scale = (level: number, low: number, high: number) => Math.round(low + ((high - low) * (level - 1)) / 9);

/** Colombian notation: thousands with dot, decimals with comma. */
export function formatNumber(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  const [whole, frac] = Math.abs(rounded).toString().split('.');
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}${grouped}${frac ? `,${frac}` : ''}`;
}

function fraction(n: number, d: number) {
  const g = gcd(n, d);
  const [p, q] = [n / g, d / g];
  return q === 1 ? String(p) : `${p}/${q}`;
}

const generators: Record<GeneratorKey, Generator> = {
  order_ops: {
    schema: (l) => `{"form":1|2|3|4,"a":int,"b":int,"c":int} con a,b,c entre 1 y ${scale(l, 12, 60)}. form 1: a + b × c; form 2: (a + b) × c; form 3: a × b − c (resultado ≥ 0); form 4: a × (b − c) con b > c`,
    pick: (l, rnd) => {
      const max = scale(l, 12, 60);
      const form = l <= 2 ? choice(rnd, [1, 3]) : choice(rnd, [1, 2, 3, 4]);
      let [a, b, c] = [between(rnd, 2, max), between(rnd, 2, Math.min(max, 15)), between(rnd, 2, Math.min(max, 12))];
      if (form === 3 && a * b < c) [a, c] = [c, a];
      if (form === 4 && b <= c) [b, c] = [c + 1, b];
      return { form, a, b, c };
    },
    solve: ({ form, a, b, c }) => {
      if (![1, 2, 3, 4].includes(form as number) || !inRange(a, 1, 500) || !inRange(b, 1, 500) || !inRange(c, 1, 500)) return null;
      const [x, y, z] = [a as number, b as number, c as number];
      const steps: Record<number, [number, string]> = {
        1: [x + y * z, `Primero la multiplicación: ${y} × ${z} = ${y * z}. Luego ${x} + ${y * z} = ${x + y * z}.`],
        2: [(x + y) * z, `Primero el paréntesis: ${x} + ${y} = ${x + y}. Luego ${x + y} × ${z} = ${(x + y) * z}.`],
        3: [x * y - z, `Primero la multiplicación: ${x} × ${y} = ${x * y}. Luego ${x * y} − ${z} = ${x * y - z}.`],
        4: [x * (y - z), `Primero el paréntesis: ${y} − ${z} = ${y - z}. Luego ${x} × ${y - z} = ${x * (y - z)}.`],
      };
      const [value, explanation] = steps[form as number]!;
      if (value < 0) return null;
      return { answer: String(value), kind: 'integer', explanation };
    },
    prompt: ({ form, a, b, c }) => {
      const expr = { 1: `${a} + ${b} × ${c}`, 2: `(${a} + ${b}) × ${c}`, 3: `${a} × ${b} − ${c}`, 4: `${a} × (${b} − ${c})` }[form as 1 | 2 | 3 | 4];
      return `Resuelve respetando el orden de las operaciones: ${expr}`;
    },
    hint: ({ form }) => (form === 2 || form === 4 ? 'Lo que está entre paréntesis va primero.' : 'La multiplicación se hace antes que la suma o la resta.'),
    numbers: ({ a, b, c }) => [a as number, b as number, c as number],
  },

  simplify: {
    schema: (l) => `{"n":int,"d":int} fracción n/d que se pueda simplificar (mcd(n,d) > 1), con d hasta ${scale(l, 24, 180)} y n distinto de d`,
    pick: (l, rnd) => {
      const q = between(rnd, 2, scale(l, 5, 13));
      let p = between(rnd, 1, q - 1);
      while (gcd(p, q) !== 1) p = between(rnd, 1, q - 1);
      const k = between(rnd, 2, scale(l, 4, 14));
      return { n: p * k, d: q * k };
    },
    solve: ({ n, d }) => {
      if (!inRange(n, 1, 2000) || !inRange(d, 2, 2000) || n === d || gcd(n as number, d as number) === 1) return null;
      const g = gcd(n as number, d as number);
      return { answer: fraction(n as number, d as number), kind: 'irreducible', explanation: `El MCD de ${n} y ${d} es ${g}. ${n} ÷ ${g} = ${(n as number) / g} y ${d} ÷ ${g} = ${(d as number) / g}.` };
    },
    prompt: ({ n, d }) => `Simplifica la fracción ${n}/${d} hasta su forma irreducible.`,
    hint: () => 'Busca el número más grande que divida al numerador y al denominador.',
    numbers: ({ n, d }) => [n as number, d as number],
  },

  frac_add: {
    schema: (l) => `{"a":int,"b":int,"c":int,"d":int,"op":"+"|"-"} para a/b op c/d, denominadores entre 2 y ${scale(l, 6, 15)}; si op es "-", a/b ≥ c/d`,
    pick: (l, rnd) => {
      const maxDen = scale(l, 6, 15);
      const b = between(rnd, 2, maxDen);
      const d = l <= 3 ? b : between(rnd, 2, maxDen);
      let a = between(rnd, 1, b - 1);
      let c = between(rnd, 1, d - 1);
      const op = l <= 2 ? '+' : choice(rnd, ['+', '-']);
      if (op === '-' && a * d < c * b) [a, c] = [Math.min(c, b), Math.min(a, d)];
      if (op === '-' && a * d < c * b) return { a, b, c, d, op: '+' };
      return { a, b, c, d, op };
    },
    solve: ({ a, b, c, d, op }) => {
      if (!inRange(a, 0, 100) || !inRange(b, 2, 60) || !inRange(c, 0, 100) || !inRange(d, 2, 60) || (op !== '+' && op !== '-')) return null;
      const [x, y, z, w] = [a as number, b as number, c as number, d as number];
      const den = lcm(y, w);
      const left = x * (den / y);
      const right = z * (den / w);
      const top = op === '+' ? left + right : left - right;
      if (top < 0) return null;
      return {
        answer: fraction(top, den),
        kind: 'fraction',
        explanation: `Denominador común ${den}: ${x}/${y} = ${left}/${den} y ${z}/${w} = ${right}/${den}. ${left} ${op} ${right} = ${top}, queda ${top}/${den} = ${fraction(top, den)}.`,
      };
    },
    prompt: ({ a, b, c, d, op }) => `Calcula ${a}/${b} ${op === '-' ? '−' : '+'} ${c}/${d} y simplifica el resultado.`,
    hint: ({ b, d }) => (b === d ? 'Con el mismo denominador, opera solo los numeradores.' : 'Busca un denominador común (el MCM de los denominadores).'),
    numbers: ({ a, b, c, d }) => [a as number, b as number, c as number, d as number],
  },

  gcd_lcm: {
    schema: (l) => `{"a":int,"b":int,"op":"mcd"|"mcm"} con a y b entre 2 y ${scale(l, 20, 120)}`,
    pick: (l, rnd) => {
      const base = between(rnd, 2, scale(l, 4, 12));
      return { a: base * between(rnd, 1, 6), b: base * between(rnd, 2, 7), op: choice(rnd, ['mcd', 'mcm']) };
    },
    solve: ({ a, b, op }) => {
      if (!inRange(a, 2, 500) || !inRange(b, 2, 500) || (op !== 'mcd' && op !== 'mcm')) return null;
      const [x, y] = [a as number, b as number];
      return op === 'mcd'
        ? { answer: String(gcd(x, y)), kind: 'integer', explanation: `El mayor número que divide a ${x} y a ${y} es ${gcd(x, y)}.` }
        : { answer: String(lcm(x, y)), kind: 'integer', explanation: `El menor múltiplo común de ${x} y ${y} es ${lcm(x, y)} (= ${x} × ${y} ÷ ${gcd(x, y)}).` };
    },
    prompt: ({ a, b, op }) => (op === 'mcd' ? `¿Cuál es el máximo común divisor (MCD) de ${a} y ${b}?` : `¿Cuál es el mínimo común múltiplo (MCM) de ${a} y ${b}?`),
    hint: ({ op }) => (op === 'mcd' ? 'Descompón ambos en factores primos y toma los comunes con el menor exponente.' : 'Escribe los múltiplos de cada uno hasta encontrar el primero que se repite.'),
    numbers: ({ a, b }) => [a as number, b as number],
  },

  decimal: {
    schema: (l) => `{"a":number,"b":number,"op":"+"|"-"|"×"} con máximo 2 decimales, valores hasta ${scale(l, 20, 500)}; en "×" máximo 1 decimal; en "-" a ≥ b`,
    pick: (l, rnd) => {
      const max = scale(l, 20, 500);
      const op = l <= 3 ? choice(rnd, ['+', '-']) : choice(rnd, ['+', '-', '×']);
      const places = op === '×' ? 1 : l <= 5 ? 1 : 2;
      const f = 10 ** places;
      let a = between(rnd, f, (op === '×' ? 20 : max) * f) / f;
      let b = between(rnd, f, (op === '×' ? 9 : max) * f) / f;
      if (op === '-' && a < b) [a, b] = [b, a];
      return { a, b, op };
    },
    solve: ({ a, b, op }) => {
      if (!num(a) || !num(b) || a < 0 || b < 0 || a > 10000 || b > 10000 || decimals(a) > 2 || decimals(b) > 2) return null;
      if (op !== '+' && op !== '-' && op !== '×') return null;
      const [x, y] = [Math.round((a as number) * 100), Math.round((b as number) * 100)];
      let value: number;
      if (op === '+') value = (x + y) / 100;
      else if (op === '-') value = (x - y) / 100;
      else value = (x * y) / 10000;
      if (value < 0) return null;
      const sign = op === '×' ? '×' : op === '-' ? '−' : '+';
      return {
        answer: formatNumber(value),
        kind: 'decimal',
        explanation: op === '×'
          ? `Multiplica sin la coma y luego cuenta las cifras decimales: ${formatNumber(a as number)} × ${formatNumber(b as number)} = ${formatNumber(value)}.`
          : `Alinea las comas y opera cifra por cifra: ${formatNumber(a as number)} ${sign} ${formatNumber(b as number)} = ${formatNumber(value)}.`,
      };
    },
    prompt: ({ a, b, op }) => `Calcula ${formatNumber(a as number)} ${op === '×' ? '×' : op === '-' ? '−' : '+'} ${formatNumber(b as number)}.`,
    hint: ({ op }) => (op === '×' ? 'Multiplica como si no hubiera comas y al final pon tantos decimales como sumen los dos factores.' : 'Escribe un número debajo del otro con las comas alineadas.'),
    numbers: ({ a, b }) => [a as number, b as number],
  },

  percent: {
    schema: (l) => `{"p":int,"n":int} el p% de n, p entre 1 y 100, n hasta ${scale(l, 200, 20000)}`,
    pick: (l, rnd) => {
      const p = l <= 3 ? choice(rnd, [10, 25, 50]) : l <= 6 ? choice(rnd, [5, 10, 20, 25, 50, 75]) : choice(rnd, [5, 12, 15, 20, 30, 35, 40, 60, 75, 80]);
      const step = 100 / gcd(p, 100);
      return { p, n: step * between(rnd, 1, Math.max(2, Math.floor(scale(l, 200, 20000) / step))) };
    },
    solve: ({ p, n }) => {
      if (!inRange(p, 1, 100) || !inRange(n, 1, 1_000_000)) return null;
      const value = ((p as number) * (n as number)) / 100;
      return { answer: formatNumber(value), kind: Number.isInteger(value) ? 'integer' : 'decimal', explanation: `${p}% de ${formatNumber(n as number)} = ${formatNumber(n as number)} × ${p} ÷ 100 = ${formatNumber(value)}.` };
    },
    prompt: ({ p, n }) => `¿Cuánto es el ${p}% de ${formatNumber(n as number)}?`,
    hint: ({ p }) => (p === 50 ? 'El 50% es la mitad.' : p === 25 ? 'El 25% es la cuarta parte.' : p === 10 ? 'El 10% es dividir entre 10.' : 'Multiplica por el porcentaje y divide entre 100.'),
    numbers: ({ p, n }) => [p as number, n as number],
  },

  proportion: {
    schema: (l) => `{"a":int,"b":int,"c":int} "si a unidades cuestan b, ¿cuánto cuestan c?"; b debe ser múltiplo de a, a entre 2 y ${scale(l, 5, 12)}, c entre 2 y ${scale(l, 10, 40)}`,
    pick: (l, rnd) => {
      const a = between(rnd, 2, scale(l, 5, 12));
      const unit = choice(rnd, [500, 800, 1000, 1200, 1500, 2000, 2500, 3000]);
      let c = between(rnd, 2, scale(l, 10, 40));
      if (c === a) c += 1;
      return { a, b: a * unit, c };
    },
    solve: ({ a, b, c }) => {
      if (!inRange(a, 1, 100) || !inRange(b, 1, 10_000_000) || !inRange(c, 1, 1000) || (b as number) % (a as number) !== 0) return null;
      const unit = (b as number) / (a as number);
      return { answer: String(unit * (c as number)), kind: 'integer', explanation: `Una unidad vale ${formatNumber(b as number)} ÷ ${a} = ${formatNumber(unit)}. Entonces ${c} valen ${formatNumber(unit)} × ${c} = ${formatNumber(unit * (c as number))}.` };
    },
    prompt: ({ a, b, c }) => `Si ${a} cuadernos cuestan $${formatNumber(b as number)}, ¿cuánto cuestan ${c} cuadernos al mismo precio?`,
    hint: () => 'Averigua primero cuánto vale una sola unidad.',
    numbers: ({ a, b, c }) => [a as number, b as number, c as number],
  },

  triangle: {
    schema: () => '{"x":int,"y":int} dos ángulos de un triángulo en grados, x + y < 180',
    pick: (l, rnd) => {
      const x = l <= 4 ? choice(rnd, [30, 40, 45, 50, 60, 70, 80, 90]) : between(rnd, 15, 110);
      return { x, y: between(rnd, 10, 170 - x) };
    },
    solve: ({ x, y }) => {
      if (!inRange(x, 1, 178) || !inRange(y, 1, 178) || (x as number) + (y as number) >= 180) return null;
      const z = 180 - (x as number) - (y as number);
      return { answer: String(z), kind: 'integer', explanation: `Los ángulos de un triángulo suman 180°: 180 − ${x} − ${y} = ${z}°.` };
    },
    prompt: ({ x, y }) => `Un triángulo tiene dos ángulos de ${x}° y ${y}°. ¿Cuánto mide el tercer ángulo?`,
    hint: () => 'Los tres ángulos de cualquier triángulo suman 180°.',
    numbers: ({ x, y }) => [x as number, y as number],
  },

  area: {
    schema: (l) => `{"shape":"rect_area"|"rect_perimeter"|"square_area"|"triangle_area","b":int,"h":int} medidas en cm entre 1 y ${scale(l, 12, 60)} (en square_area se usa solo b)`,
    pick: (l, rnd) => {
      const max = scale(l, 12, 60);
      const shape = l <= 3 ? choice(rnd, ['rect_area', 'rect_perimeter', 'square_area']) : choice(rnd, ['rect_area', 'rect_perimeter', 'square_area', 'triangle_area']);
      return { shape, b: between(rnd, 2, max), h: between(rnd, 2, max) };
    },
    solve: ({ shape, b, h }) => {
      if (!inRange(b, 1, 1000) || !inRange(h, 1, 1000)) return null;
      const [x, y] = [b as number, h as number];
      switch (shape) {
        case 'rect_area': return { answer: String(x * y), kind: 'integer', explanation: `Área = base × altura = ${x} × ${y} = ${x * y} cm².` };
        case 'rect_perimeter': return { answer: String(2 * (x + y)), kind: 'integer', explanation: `Perímetro = 2 × (${x} + ${y}) = ${2 * (x + y)} cm.` };
        case 'square_area': return { answer: String(x * x), kind: 'integer', explanation: `Área = lado × lado = ${x} × ${x} = ${x * x} cm².` };
        case 'triangle_area': {
          const value = (x * y) / 2;
          return { answer: formatNumber(value), kind: Number.isInteger(value) ? 'integer' : 'decimal', explanation: `Área = base × altura ÷ 2 = ${x} × ${y} ÷ 2 = ${formatNumber(value)} cm².` };
        }
        default: return null;
      }
    },
    prompt: ({ shape, b, h }) => ({
      rect_area: `Un rectángulo mide ${b} cm de base y ${h} cm de altura. ¿Cuál es su área en cm²?`,
      rect_perimeter: `Un rectángulo mide ${b} cm de base y ${h} cm de altura. ¿Cuál es su perímetro en cm?`,
      square_area: `Un cuadrado tiene lados de ${b} cm. ¿Cuál es su área en cm²?`,
      triangle_area: `Un triángulo tiene ${b} cm de base y ${h} cm de altura. ¿Cuál es su área en cm²?`,
    })[shape as string] ?? '',
    hint: ({ shape }) => (shape === 'rect_perimeter' ? 'El perímetro es la suma de todos los lados.' : shape === 'triangle_area' ? 'Es la mitad del rectángulo que lo contiene.' : 'El área cuenta los cuadritos de 1 cm² que caben dentro.'),
    numbers: ({ shape, b, h }) => (shape === 'square_area' ? [b as number] : [b as number, h as number]),
  },

  mean: {
    schema: (l) => `{"values":[int,...]} entre ${l <= 4 ? 3 : 4} y ${l <= 4 ? 4 : 6} datos enteros entre 0 y ${scale(l, 20, 100)}`,
    pick: (l, rnd) => {
      const count = between(rnd, l <= 4 ? 3 : 4, l <= 4 ? 4 : 6);
      const max = scale(l, 20, 100);
      const values = Array.from({ length: count }, () => between(rnd, 1, max));
      if (l <= 6) {
        const rest = values.reduce((s, v) => s + v, 0) % count;
        values[0] = values[0]! + (rest ? count - rest : 0);
      }
      return { values };
    },
    solve: ({ values }) => {
      if (!Array.isArray(values) || values.length < 2 || values.length > 8 || !values.every((v) => inRange(v, 0, 10000))) return null;
      const sum = values.reduce((s, v) => s + v, 0);
      const value = Math.round((sum / values.length) * 100) / 100;
      return { answer: formatNumber(value), kind: Number.isInteger(value) ? 'integer' : 'decimal', explanation: `Suma ${values.join(' + ')} = ${sum} y divide entre ${values.length}: ${formatNumber(value)}.` };
    },
    prompt: ({ values }) => `Calcula el promedio (media) de estos datos: ${(values as number[]).join(', ')}.`,
    hint: () => 'Suma todos los datos y divide entre la cantidad de datos.',
    numbers: ({ values }) => values as number[],
  },
};

export const isGenerator = (key: string): key is GeneratorKey => (GENERATORS as readonly string[]).includes(key);
export const schemaFor = (key: GeneratorKey, level: number) => generators[key].schema(level);
export const solve = (key: GeneratorKey, params: Params) => generators[key].solve(params);

export function templateExercise(key: GeneratorKey, level: number, rnd: () => number = Math.random): Exercise {
  const g = generators[key];
  for (let i = 0; i < 20; i++) {
    const params = g.pick(level, rnd);
    const solution = g.solve(params);
    if (solution) return { ...solution, params, prompt: g.prompt(params), hint: g.hint(params) };
  }
  throw new Error(`El generador ${key} no produjo un ejercicio válido`);
}

export const defaultHint = (key: GeneratorKey, params: Params) => generators[key].hint(params);
export const templatePrompt = (key: GeneratorKey, params: Params) => generators[key].prompt(params);

/** The statement must quote every number of the parameters (in plain or Colombian notation). */
export function mentionsAll(key: GeneratorKey, params: Params, prompt: string) {
  const text = prompt.replace(/\s+/g, ' ');
  return generators[key].numbers(params).every((n) => {
    const forms = new Set([String(n), formatNumber(n), String(n).replace('.', ',')]);
    return [...forms].some((form) => new RegExp(`(^|[^\\d.,])${form.replace(/[.]/g, '\\.')}($|[^\\d]|[.,](?!\\d))`).test(text));
  });
}

/** Parses "1.200", "3,5", "3.5", "-2" or a fraction "3/4" into a list of candidate values. */
function parseCandidates(raw: string): number[] {
  const cleaned = raw.replace(/[−–]/g, '-').replace(/[^\d.,/-]/g, '');
  if (!cleaned) return [];
  if (cleaned.includes('/')) {
    const [n, d] = cleaned.split('/');
    const top = Number(n?.replace(',', '.'));
    const bottom = Number(d?.replace(',', '.'));
    return Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0 ? [top / bottom] : [];
  }
  const out = new Set<number>();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) out.add(Number(cleaned.replace(/\./g, '').replace(',', '.')));
  if (cleaned.includes(',')) out.add(Number(cleaned.replace(/\./g, '').replace(',', '.')));
  else out.add(Number(cleaned));
  return [...out].filter(Number.isFinite);
}

export function checkAnswer(kind: AnswerKind, expected: string, given: string) {
  const target = parseCandidates(expected)[0];
  if (target === undefined) return false;
  const value = given.trim();
  if (!value) return false;
  if (kind === 'irreducible') {
    const match = /^\s*(-?\d+)\s*\/\s*(\d+)\s*$/.exec(value);
    if (match) {
      const [n, d] = [Number(match[1]), Number(match[2])];
      return d !== 0 && gcd(n, d) === 1 && Math.abs(n / d - target) < 1e-9;
    }
    return /^-?\d+$/.test(value) && Number(value) === target;
  }
  return parseCandidates(value).some((candidate) => Math.abs(candidate - target) < 1e-6);
}
