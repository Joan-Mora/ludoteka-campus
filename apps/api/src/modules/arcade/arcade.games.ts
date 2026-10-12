import type { ArcadeGame, ArcadeUi } from '@eduquest/contracts';
import { formatNumber, gcd, templateExercise } from '../tutor/public-api';

/** Lo que el servidor guarda de cada pregunta. `publicItem` quita lo que no debe llegar al navegador. */
export interface ArcadeItem {
  ui: ArcadeUi;
  prompt: string;
  hint?: string;
  options?: string[];
  cards?: string[];
  steps?: string[];
  line?: { min: number; max: number; label: string };
  grid?: { max: number; target: 'area' | 'perimeter'; value: number };
  mask?: string;
  answer: string;
  explanation: string;
  pairs?: number[];
  word?: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export type Rnd = () => number;

export function seeded(seed: string): Rnd {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rnd: Rnd, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(rnd: Rnd, items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;
export function shuffle<T>(rnd: Rnd, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
const money = (v: number) => `$${formatNumber(v)}`;

/** Quita tildes para comparar letras; la ñ se conserva. */
export const plainLetter = (value: string) =>
  value
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ');

function unique<T>(rnd: Rnd, count: number, make: () => T, key: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let i = 0; i < count * 12 && out.length < count; i++) {
    const item = make();
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function carrera(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  return unique(rnd, rounds, (): ArcadeItem => {
    const hard = level >= 4 && rnd() < 0.5;
    if (!hard) {
      const top = level <= 2 ? 9 : 12;
      const [a, b] = [between(rnd, 2, top), between(rnd, 2, top)];
      return { ui: 'input', prompt: `${a} × ${b}`, answer: String(a * b), explanation: `${a} × ${b} = ${a * b}.` };
    }
    const [a, b, c] = [between(rnd, 2, 12), between(rnd, 2, 9), between(rnd, 2, 9)];
    const form = between(rnd, 1, 3);
    if (form === 1) return { ui: 'input', prompt: `${a} + ${b} × ${c}`, answer: String(a + b * c), explanation: `Primero ${b} × ${c} = ${b * c}; luego ${a} + ${b * c} = ${a + b * c}.` };
    if (form === 2) return { ui: 'input', prompt: `(${a} + ${b}) × ${c}`, answer: String((a + b) * c), explanation: `Primero el paréntesis: ${a + b}; luego × ${c} = ${(a + b) * c}.` };
    const minus = Math.min(c, a * b);
    return { ui: 'input', prompt: `${a} × ${b} − ${minus}`, answer: String(a * b - minus), explanation: `Primero ${a} × ${b} = ${a * b}; luego − ${minus} = ${a * b - minus}.` };
  }, (item) => item.prompt);
}

function fracciones(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  const maxDen = Math.min(12, 4 + level);
  return unique(rnd, rounds, (): ArcadeItem => {
    if (rnd() < 0.55) {
      let [a, b, c, d] = [0, 0, 0, 0];
      do {
        b = between(rnd, 2, maxDen);
        d = between(rnd, 2, maxDen);
        a = between(rnd, 1, b - 1);
        c = between(rnd, 1, d - 1);
      } while (a * d === c * b);
      const [left, right] = [`${a}/${b}`, `${c}/${d}`];
      const bigger = a * d > c * b ? left : right;
      return { ui: 'choice', prompt: '¿Cuál es mayor?', options: [left, right], answer: bigger, explanation: `${a}/${b} ≈ ${formatNumber(a / b)} y ${c}/${d} ≈ ${formatNumber(c / d)}.` };
    }
    const q = between(rnd, 2, Math.min(9, maxDen));
    let p = between(rnd, 1, q - 1);
    while (gcd(p, q) !== 1) p = between(rnd, 1, q - 1);
    const k = between(rnd, 2, level <= 3 ? 4 : 7);
    const right = `${p * k}/${q * k}`;
    const wrong = [`${p * k}/${q * k + 1}`, `${p + k}/${q + k}`, `${p * k + 1}/${q * k}`].filter((w) => {
      const [n, m] = w.split('/').map(Number);
      return n! * q !== m! * p && n! < m!;
    });
    const options = [right, ...wrong.slice(0, 2)];
    return { ui: 'choice', prompt: `¿Cuál equivale a ${p}/${q}?`, options: shuffle(rnd, options), answer: right, explanation: `${p}/${q} = ${p} × ${k} / ${q} × ${k} = ${right}.` };
  }, (item) => item.prompt + item.options?.join());
}

const MEMORY_VALUES: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10], [1, 20], [1, 8], [3, 20], [1, 25]];

function memoria(level: number, rnd: Rnd, pairs: number): ArcadeItem[] {
  const pool = level <= 3 ? MEMORY_VALUES.slice(0, 11) : MEMORY_VALUES;
  const chosen = shuffle(rnd, pool).slice(0, pairs);
  const forms = (n: number, d: number) => ({ f: `${n}/${d}`, dec: formatNumber(n / d), pct: `${formatNumber((n / d) * 100)}%` });
  const cards: { label: string; pair: number }[] = [];
  chosen.forEach(([n, d], i) => {
    const all = forms(n, d);
    const [x, y] = pick(rnd, [[all.f, all.dec], [all.f, all.pct], [all.dec, all.pct]] as const);
    cards.push({ label: x, pair: i }, { label: y, pair: i });
  });
  const order = shuffle(rnd, cards);
  return [{
    ui: 'memory',
    prompt: 'Une cada fracción con su decimal o su porcentaje.',
    cards: order.map((c) => c.label),
    pairs: order.map((c) => c.pair),
    answer: '',
    explanation: chosen.map(([n, d]) => `${n}/${d} = ${forms(n, d).dec} = ${forms(n, d).pct}`).join(' · '),
  }];
}

function recta(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  return unique(rnd, rounds, (): ArcadeItem => {
    if (level >= 4 && rnd() < 0.35) {
      const max = pick(rnd, [2, 10]);
      const value = max === 2 ? between(rnd, 1, 19) / 10 : between(rnd, 5, 95) / 10;
      return { ui: 'line', prompt: `Ubica ${formatNumber(value)}`, line: { min: 0, max, label: formatNumber(value) }, answer: String(value), explanation: `${formatNumber(value)} está a ${formatNumber((value / max) * 100)}% del camino entre 0 y ${max}.` };
    }
    if (rnd() < 0.5) {
      const d = pick(rnd, level <= 3 ? [2, 4, 5, 10] : [3, 4, 5, 6, 8, 10]);
      const n = between(rnd, 1, d - 1);
      return { ui: 'line', prompt: `Ubica ${n}/${d}`, line: { min: 0, max: 1, label: `${n}/${d}` }, answer: String(n / d), explanation: `${n}/${d} = ${formatNumber(n / d)}: divide la recta en ${d} partes y cuenta ${n}.` };
    }
    const value = level <= 3 ? between(rnd, 1, 9) / 10 : between(rnd, 1, 99) / 100;
    return { ui: 'line', prompt: `Ubica ${formatNumber(value)}`, line: { min: 0, max: 1, label: formatNumber(value) }, answer: String(value), explanation: `${formatNumber(value)} son ${Math.round(value * 100)} centésimas de la unidad.` };
  }, (item) => item.prompt);
}

function ordena(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  return unique(rnd, rounds, (): ArcadeItem => {
    const top = level <= 3 ? 9 : 15;
    const form = between(rnd, 1, 4);
    let expr = '';
    let steps: string[] = [];
    if (form === 1) {
      const [a, b, d] = [between(rnd, 2, top), between(rnd, 2, 9), between(rnd, 1, 8)];
      const c = d + between(rnd, 1, 8);
      const e = c - d;
      expr = `${a} + ${b} × (${c} − ${d})`;
      steps = [`${c} − ${d} = ${e}`, `${b} × ${e} = ${b * e}`, `${a} + ${b * e} = ${a + b * e}`];
    } else if (form === 2) {
      const [a, b, c] = [between(rnd, 2, top), between(rnd, 2, top), between(rnd, 2, 9)];
      const f = (a + b) * c;
      const d = between(rnd, 1, Math.min(f - 1, 30));
      expr = `(${a} + ${b}) × ${c} − ${d}`;
      steps = [`${a} + ${b} = ${a + b}`, `${a + b} × ${c} = ${f}`, `${f} − ${d} = ${f - d}`];
    } else if (form === 3) {
      const d = between(rnd, 2, 6);
      const q = between(rnd, 2, 9);
      const b = between(rnd, 1, d * q - 1);
      const c = d * q - b;
      const a = q + between(rnd, 1, 20);
      expr = `${a} − (${b} + ${c}) ÷ ${d}`;
      steps = [`${b} + ${c} = ${d * q}`, `${d * q} ÷ ${d} = ${q}`, `${a} − ${q} = ${a - q}`];
    } else {
      const [a, b, c, d] = [between(rnd, 2, 9), between(rnd, 2, 9), between(rnd, 1, top), between(rnd, 2, 5)];
      const e = a * b + c;
      expr = `(${a} × ${b} + ${c}) × ${d}`;
      steps = [`${a} × ${b} = ${a * b}`, `${a * b} + ${c} = ${e}`, `${e} × ${d} = ${e * d}`];
    }
    const order = shuffle(rnd, [0, 1, 2]);
    if (order.join() === '0,1,2') order.reverse();
    return {
      ui: 'order',
      prompt: expr,
      steps: order.map((i) => steps[i]!),
      answer: [0, 1, 2].map((step) => order.indexOf(step)).join(','),
      explanation: `Orden: ${steps.join(' → ')}.`,
    };
  }, (item) => item.prompt);
}

function torre(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  return unique(rnd, rounds, (): ArcadeItem => {
    const ex = templateExercise('gcd_lcm', Math.max(1, level), rnd);
    const { a, b, op } = ex.params as { a: number; b: number; op: string };
    return { ui: 'input', prompt: `${op === 'mcd' ? 'MCD' : 'MCM'} de ${a} y ${b}`, hint: ex.hint, answer: ex.answer, explanation: ex.explanation };
  }, (item) => item.prompt);
}

const PRODUCTS: [string, boolean][] = [['unas tenis', true], ['un balón', false], ['una camiseta', false], ['un libro', false], ['unos audífonos', true], ['una mochila', false], ['una lonchera', false], ['un juego de mesa', false]];
const capital = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;

function mercado(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  const rates = level <= 3 ? [10, 20, 25, 50] : [5, 10, 15, 20, 25, 30, 40, 50, 75];
  return unique(rnd, rounds, (): ArcadeItem => {
    const price = between(rnd, 2, level <= 3 ? 20 : 60) * (level <= 3 ? 5000 : 2000);
    const p = pick(rnd, rates);
    const [product, plural] = pick(rnd, PRODUCTS);
    const has = plural ? 'tienen' : 'tiene';
    const cut = (price * p) / 100;
    const mode = pick(rnd, level <= 2 ? ['paga', 'ahorra'] as const : ['paga', 'ahorra', 'sube'] as const);
    let answer: number;
    let prompt: string;
    let explanation: string;
    if (mode === 'paga') {
      answer = price - cut;
      prompt = `${capital(product)} de ${money(price)} ${has} ${p}% de descuento. ¿Cuánto pagas?`;
      explanation = `El ${p}% de ${money(price)} es ${money(cut)}; pagas ${money(price)} − ${money(cut)} = ${money(answer)}.`;
    } else if (mode === 'ahorra') {
      answer = cut;
      prompt = `${capital(product)} de ${money(price)} ${has} ${p}% de descuento. ¿Cuánto ahorras?`;
      explanation = `Ahorras el ${p}% de ${money(price)}: ${money(price)} × ${p} ÷ 100 = ${money(cut)}.`;
    } else {
      answer = price + cut;
      prompt = `El precio de ${product} (${money(price)}) sube ${p}%. ¿Cuánto ${plural ? 'cuestan' : 'cuesta'} ahora?`;
      explanation = `Sube ${money(cut)}: ${money(price)} + ${money(cut)} = ${money(answer)}.`;
    }
    const pool = [answer, mode === 'ahorra' ? price - cut : cut, price - p * 100, price + cut, price - cut, Math.round(price * (1 - p / 1000))]
      .filter((v) => v > 0 && Number.isInteger(v));
    const options = [...new Set([answer, ...shuffle(rnd, pool)])].slice(0, 4);
    while (options.length < 4) options.push(answer + 1000 * options.length);
    return { ui: 'choice', prompt, options: shuffle(rnd, options).map(money), answer: money(answer), explanation };
  }, (item) => item.prompt);
}

function area(level: number, rnd: Rnd, rounds: number): ArcadeItem[] {
  const max = level <= 3 ? 8 : level <= 6 ? 10 : 12;
  return unique(rnd, rounds, (): ArcadeItem => {
    const [b, h] = [between(rnd, 2, max), between(rnd, 2, max)];
    if (rnd() < (level <= 2 ? 0.25 : 0.4)) {
      const value = 2 * (b + h);
      return { ui: 'grid', prompt: `Construye un rectángulo con perímetro ${value} cm`, grid: { max, target: 'perimeter', value }, answer: `${b},${h}`, explanation: `Por ejemplo ${b} × ${h}: 2 × (${b} + ${h}) = ${value} cm.` };
    }
    const value = b * h;
    return { ui: 'grid', prompt: `Construye un rectángulo de ${value} cm²`, grid: { max, target: 'area', value }, answer: `${b},${h}`, explanation: `Por ejemplo ${b} × ${h} = ${value} cm².` };
  }, (item) => item.prompt);
}

/** Respaldo de matemáticas por si el glosario de la biblioteca todavía está corto. */
export const BASE_TERMS: GlossaryTerm[] = [
  { term: 'Fracción', definition: 'Número que expresa partes iguales de una unidad, escrito como numerador sobre denominador.' },
  { term: 'Numerador', definition: 'En una fracción, el número de arriba: cuántas partes se toman.' },
  { term: 'Denominador', definition: 'En una fracción, el número de abajo: en cuántas partes iguales se divide la unidad.' },
  { term: 'Porcentaje', definition: 'Cantidad expresada como partes de cada cien.' },
  { term: 'Promedio', definition: 'Resultado de sumar todos los datos y dividir entre la cantidad de datos.' },
  { term: 'Perímetro', definition: 'Suma de las longitudes de todos los lados de una figura.' },
  { term: 'Área', definition: 'Medida de la superficie que ocupa una figura, en unidades cuadradas.' },
  { term: 'Ángulo', definition: 'Abertura entre dos semirrectas que salen de un mismo punto.' },
  { term: 'Divisor', definition: 'Número que divide exactamente a otro, sin dejar residuo.' },
  { term: 'Múltiplo', definition: 'Resultado de multiplicar un número por un número entero.' },
  { term: 'Decimal', definition: 'Número con parte entera y parte decimal separadas por una coma.' },
  { term: 'Proporción', definition: 'Igualdad entre dos razones.' },
  { term: 'Razón', definition: 'Comparación entre dos cantidades por medio de una división.' },
  { term: 'Triángulo', definition: 'Polígono de tres lados cuyos ángulos interiores suman 180 grados.' },
  { term: 'Primo', definition: 'Número natural mayor que 1 que solo es divisible entre 1 y entre sí mismo.' },
  { term: 'Equivalente', definition: 'Dicho de dos fracciones que representan la misma cantidad.' },
  { term: 'Simplificar', definition: 'Dividir numerador y denominador entre un mismo número para obtener una fracción más sencilla.' },
  { term: 'Potencia', definition: 'Producto de un número multiplicado por sí mismo varias veces.' },
  { term: 'Rectángulo', definition: 'Cuadrilátero con cuatro ángulos rectos y lados opuestos iguales.' },
  { term: 'Diámetro', definition: 'Segmento que une dos puntos de una circunferencia pasando por su centro.' },
];

const hideTerm = (definition: string, term: string) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return definition.replace(new RegExp(escaped, 'gi'), '…').slice(0, 220);
};

function ahorcado(rnd: Rnd, rounds: number, terms: GlossaryTerm[]): ArcadeItem[] {
  const words = terms.filter((t) => /^[a-záéíóúüñ]{4,12}$/i.test(t.term.trim()));
  return shuffle(rnd, words).slice(0, rounds).map((t) => {
    const word = t.term.trim();
    return {
      ui: 'hangman',
      prompt: hideTerm(t.definition, word),
      mask: word.replace(/./g, '_'),
      word,
      answer: word,
      explanation: `${word}: ${t.definition}`,
    };
  });
}

function quiz(rnd: Rnd, rounds: number, terms: GlossaryTerm[]): ArcadeItem[] {
  const chosen = shuffle(rnd, terms).slice(0, rounds);
  return chosen.map((t) => {
    const others = shuffle(rnd, terms.filter((o) => o.term !== t.term)).slice(0, 3).map((o) => o.term);
    return { ui: 'choice', prompt: hideTerm(t.definition, t.term), options: shuffle(rnd, [t.term, ...others]), answer: t.term, explanation: `${t.term}: ${t.definition}` };
  });
}

export function buildItems(game: ArcadeGame, level: number, rnd: Rnd, rounds: number, terms: GlossaryTerm[]): ArcadeItem[] {
  switch (game) {
    case 'carrera': return carrera(level, rnd, rounds);
    case 'fracciones': return fracciones(level, rnd, rounds);
    case 'memoria': return memoria(level, rnd, rounds);
    case 'recta': return recta(level, rnd, rounds);
    case 'ordena': return ordena(level, rnd, rounds);
    case 'torre': return torre(level, rnd, rounds);
    case 'mercado': return mercado(level, rnd, rounds);
    case 'area': return area(level, rnd, rounds);
    case 'ahorcado': return ahorcado(rnd, rounds, terms);
    case 'quiz': return quiz(rnd, rounds, terms);
  }
}

/** Unidades que puntúan: parejas en Memoria, preguntas en el resto. */
export const unitsOf = (game: ArcadeGame, items: ArcadeItem[]) => (game === 'memoria' ? (items[0]?.cards?.length ?? 0) / 2 : items.length);

export function publicItem(item: ArcadeItem) {
  const { answer: _a, explanation: _e, pairs: _p, word: _w, ...rest } = item;
  return rest;
}

/** Puntos por cercanía en la recta: exacto o casi, 15; a un 5 % del largo, 10; a un 10 %, 4. */
export function linePoints(item: ArcadeItem, given: number) {
  const span = (item.line?.max ?? 1) - (item.line?.min ?? 0);
  const error = Math.abs(given - Number(item.answer)) / span;
  return { ok: error <= 0.05, points: error <= 0.02 ? 15 : error <= 0.05 ? 10 : error <= 0.1 ? 4 : 0 };
}

export function gridOk(item: ArcadeItem, given: string) {
  const match = /^(\d{1,2}),(\d{1,2})$/.exec(given);
  if (!match || !item.grid) return false;
  const [b, h] = [Number(match[1]), Number(match[2])];
  if (b < 1 || h < 1 || b > item.grid.max || h > item.grid.max) return false;
  return item.grid.target === 'area' ? b * h === item.grid.value : 2 * (b + h) === item.grid.value;
}