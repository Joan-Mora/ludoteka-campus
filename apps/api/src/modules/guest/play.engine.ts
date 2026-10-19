/** Juegos de manipulación. El servidor genera el reto y decide si el movimiento es válido. */

export interface Move { action?: string; n?: number; index?: number; tile?: string; cells?: number[][]; grid?: string[]; matrix?: unknown }

type Rnd = () => number;

function hash(seed: string): Rnd {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const between = (rnd: Rnd, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

export type Q = [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const q = (n: number, d = 1): Q => {
  if (d === 0) return [n, 1];
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return [(s * n) / g, (s * d) / g];
};
const qadd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qmul = (a: Q, k: Q): Q => q(a[0] * k[0], a[1] * k[1]);
const qeq = (a: Q, b: Q) => a[0] === b[0] && a[1] === b[1];
export const qtext = (a: Q) => (a[1] === 1 ? String(a[0]) : `${a[0]}/${a[1]}`);

function term(coef: number, body: string) {
  if (coef === 0) return '';
  const sign = coef < 0 ? '−' : '+';
  const abs = Math.abs(coef);
  const shown = body ? (abs === 1 ? body : `${abs}${body}`) : String(abs);
  return `${sign} ${shown}`;
}

export function equationText(a: number, b: number, c: number) {
  const left = [`${a === 1 ? '' : a === -1 ? '−' : a}x`, term(b, '')].filter(Boolean).join(' ').replace(/^\+ /, '');
  return `${left || '0'} = ${c}`;
}

interface Eq { a: number; b: number; c: number; x: number }
function makeEq(rnd: Rnd): Eq {
  const a = between(rnd, 2, 6);
  const x = between(rnd, 2, 9);
  const b = between(rnd, 1, 12);
  return { a, b, c: a * x + b, x };
}

interface Balanza { kind: 'balanza'; round: number; rounds: number; eq: Eq; steps: number; score: number; log: string[] }
interface Barras { kind: 'barras'; n1: number; d1: number; n2: number; d2: number; pieces: number; shaded: number; solved: boolean; score: number }
interface Fichas { kind: 'fichas'; p: number; q: number; grid: string[]; rows: number; cols: number; score: number; solved: boolean; scene?: string }
interface Areas { kind: 'areas'; target: number; rows: number; cols: number; on: boolean[]; score: number; solved: boolean }
interface Proporcion { kind: 'proporcion'; basePeople: number; baseMilk: number; target: number; milk: number; round: number; rounds: number; score: number }
interface Cruce { kind: 'cruce'; m1: number; b1: number; m2: number; b2: number; yours: { m1: number; b1: number; m2: number; b2: number }; solved: boolean; score: number }
interface Gauss { kind: 'gauss'; rows: number; cols: number; start: Q[][]; cells: Q[][]; steps: string[]; score: number; solved: boolean }
interface Relato { kind: 'relato'; scene: number; puzzle: Fichas; mistakes: string[]; score: number; done: boolean }
interface Encuesta { kind: 'encuesta'; values: number[]; bars: number[]; round: number; rounds: number; score: number; solved: boolean }

export type Solo = Balanza | Barras | Fichas | Areas | Proporcion | Cruce | Gauss | Relato | Encuesta;

const SCENES = [
  { title: 'El portón', text: 'La fábrica abre el portón solo si armas el rectángulo de las fichas. El ancho y el alto son los factores.' },
  { title: 'La cinta trabada', text: 'Te equivocaste y la cinta se detuvo. Arma este otro rectángulo para destrabarla. La historia sigue, pero el portón quedó anotado como reparación.' },
  { title: 'La prensa', text: 'La prensa sella el paquete cuando las fichas forman el rectángulo justo, sin huecos.' },
  { title: 'El muelle', text: 'En el muelle etiquetas el envío con el último rectángulo. Si sale bien a la primera, el camión sale. Si no, vuelve a la prensa.' },
];

export function startSolo(game: string, seed: string): Solo | null {
  const rnd = hash(seed);
  if (game === 'balanza') return { kind: 'balanza', round: 1, rounds: 6, eq: makeEq(rnd), steps: 0, score: 0, log: [] };
  if (game === 'barras') {
    const d1 = between(rnd, 2, 6);
    const d2 = between(rnd, 2, 6);
    return { kind: 'barras', n1: between(rnd, 1, d1 - 1), d1, n2: between(rnd, 1, d2 - 1), d2, pieces: 0, shaded: 0, solved: false, score: 0 };
  }
  if (game === 'fichas') return tilePuzzle(between(rnd, 2, 5), between(rnd, 2, 5));
  if (game === 'areas') return { kind: 'areas', target: between(rnd, 6, 18), rows: 6, cols: 8, on: Array(48).fill(false), score: 0, solved: false };
  if (game === 'proporcion') {
    const basePeople = between(rnd, 2, 5);
    return { kind: 'proporcion', basePeople, baseMilk: between(rnd, 2, 6), target: basePeople * between(rnd, 2, 4), milk: 0, round: 1, rounds: 4, score: 0 };
  }
  if (game === 'cruce') {
    const x = between(rnd, -3, 4);
    const y = between(rnd, -3, 5);
    const m1 = between(rnd, 1, 3);
    const m2 = -between(rnd, 1, 3);
    return { kind: 'cruce', m1, b1: y - m1 * x, m2, b2: y - m2 * x, yours: { m1: 1, b1: 0, m2: -1, b2: 0 }, solved: false, score: 0 };
  }
  if (game === 'gauss') return gaussPuzzle(rnd, between(rnd, 0, 1) ? 3 : 2);
  if (game === 'relato') return { kind: 'relato', scene: 0, puzzle: tilePuzzle(between(rnd, 2, 4), between(rnd, 2, 4)), mistakes: [], score: 0, done: false };
  if (game === 'encuesta') return survey(rnd, 1);
  return null;
}

function tilePuzzle(p: number, q: number): Fichas {
  const rows = q + 1;
  const cols = p + 1;
  return { kind: 'fichas', p, q, rows, cols, grid: Array(rows * cols).fill(''), score: 0, solved: false };
}

function gaussPuzzle(rnd: Rnd, n: number): Gauss {
  const vars = Array.from({ length: n }, () => between(rnd, -4, 5));
  const coef = Array.from({ length: n }, () => Array.from({ length: n }, () => between(rnd, -3, 4)));
  for (let i = 0; i < n; i++) if (coef[i]!.every((v) => v === 0)) coef[i]![i] = 1;
  const cells: Q[][] = coef.map((row, i) => [...row.map((v) => q(v)), q(row.reduce((sum, v, j) => sum + v * vars[j]!, 0))]);
  return { kind: 'gauss', rows: n, cols: n + 1, start: cells.map((row) => row.map((cell) => [...cell] as Q)), cells, steps: [], score: 0, solved: false };
}

function cloneGauss(g: Gauss): Gauss {
  return { ...g, cells: g.cells.map((row) => row.map((cell) => [...cell] as Q)), steps: [...g.steps] };
}

export function viewSolo(state: Solo) {
  if (state.kind === 'balanza') {
    const { a, b, c } = state.eq;
    return { kind: state.kind, round: state.round, rounds: state.rounds, equation: equationText(a, b, c), a, b, c, steps: state.steps, score: state.score, solved: a === 1 && b === 0, log: state.log.slice(-4) };
  }
  if (state.kind === 'barras') {
    return { kind: state.kind, prompt: `Pinta la suma ${state.n1}/${state.d1} + ${state.n2}/${state.d2}`, pieces: state.pieces, shaded: state.shaded, solved: state.solved, score: state.score };
  }
  if (state.kind === 'fichas') return tileView(state);
  if (state.kind === 'areas') return { kind: state.kind, target: state.target, rows: state.rows, cols: state.cols, on: state.on, painted: state.on.filter(Boolean).length, solved: state.solved, score: state.score };
  if (state.kind === 'proporcion') {
    return { kind: state.kind, prompt: `${state.baseMilk} vasos de leche alcanzan para ${state.basePeople} personas. ¿Cuántos vasos para ${state.target}?`, milk: state.milk, target: state.target, round: state.round, rounds: state.rounds, score: state.score };
  }
  if (state.kind === 'cruce') {
    return {
      kind: state.kind,
      equations: [`y = ${line(state.m1, state.b1)}`, `y = ${line(state.m2, state.b2)}`],
      yours: state.yours,
      solved: state.solved,
      score: state.score,
    };
  }
  if (state.kind === 'gauss') {
    return { kind: state.kind, rows: state.rows, cols: state.cols, cells: state.cells.map((row) => row.map(qtext)), steps: state.steps.slice(-8), solved: state.solved, score: state.score };
  }
  if (state.kind === 'encuesta') {
    return { kind: state.kind, values: state.values, bars: state.bars, labels: [1, 2, 3, 4, 5], round: state.round, rounds: state.rounds, score: state.score, solved: state.solved };
  }
  const scene = SCENES[state.scene] ?? SCENES[SCENES.length - 1]!;
  return { kind: state.kind, title: scene.title, text: scene.text, puzzle: tileView(state.puzzle), done: state.done, score: state.score, scene: state.scene + 1, scenes: SCENES.length };
}

function line(m: number, b: number) {
  const slope = m === 1 ? 'x' : m === -1 ? '−x' : `${m}x`;
  if (b === 0) return slope;
  return `${slope} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;
}

function tileView(state: Fichas) {
  return {
    kind: 'fichas' as const,
    prompt: `Arma un rectángulo con 1 ficha x², ${state.p + state.q} fichas x y ${state.p * state.q} fichas de 1.`,
    need: { x2: 1, x: state.p + state.q, one: state.p * state.q },
    rows: state.rows,
    cols: state.cols,
    grid: state.grid,
    solved: state.solved,
    score: state.score,
  };
}

export function applySolo(state: Solo, move: Move, seed: string): { state: Solo; message: string; done: boolean } {
  if (state.kind === 'balanza') return applyBalanza(state, move, seed);
  if (state.kind === 'barras') return applyBarras(state, move);
  if (state.kind === 'fichas') return applyFichas(state, move);
  if (state.kind === 'areas') return applyAreas(state, move);
  if (state.kind === 'proporcion') return applyProporcion(state, move, seed);
  if (state.kind === 'cruce') return applyCruce(state, move);
  if (state.kind === 'gauss') return applyGauss(state, move);
  if (state.kind === 'encuesta') return applyEncuesta(state, move, seed);
  return applyRelato(state, move, seed);
}

function applyBalanza(state: Balanza, move: Move, seed: string): { state: Solo; message: string; done: boolean } {
  const n = Number(move.n);
  const { a, b, c } = state.eq;
  if (move.action === 'sub' || move.action === 'add') {
    if (!Number.isInteger(n) || n <= 0 || n > 40) return { state, message: 'Elige un número entero entre 1 y 40.', done: false };
    const sign = move.action === 'sub' ? -1 : 1;
    state.eq = { ...state.eq, b: b + sign * n, c: c + sign * n };
    state.steps += 1;
    state.log.push(`${move.action === 'sub' ? 'Resté' : 'Sumé'} ${n} en los dos lados.`);
  } else if (move.action === 'div') {
    if (!Number.isInteger(n) || n <= 1) return { state, message: 'Divide entre un entero mayor que 1.', done: false };
    if (a % n || b % n || c % n) return { state, message: `${n} no divide a los tres números. La balanza quedaría con pedazos.`, done: false };
    state.eq = { a: a / n, b: b / n, c: c / n, x: state.eq.x };
    state.steps += 1;
    state.log.push(`Dividí los dos lados entre ${n}.`);
  } else return { state, message: 'Ese movimiento no existe.', done: false };
  const solved = state.eq.a === 1 && state.eq.b === 0;
  if (!solved) return { state, message: equationText(state.eq.a, state.eq.b, state.eq.c), done: false };
  const optimal = 2;
  state.score += Math.max(40, 100 - Math.max(0, state.steps - optimal) * 12);
  if (state.round >= state.rounds) return { state, message: `x = ${state.eq.x}. Completaste las ${state.rounds} balanzas.`, done: true };
  const next = makeEq(hash(`${seed}:balanza:${state.round}`));
  state.round += 1;
  state.eq = next;
  state.steps = 0;
  return { state, message: `x despejada. Siguiente balanza (${state.round} de ${state.rounds}).`, done: false };
}

function applyBarras(state: Barras, move: Move): { state: Solo; message: string; done: boolean } {
  if (move.action === 'pieces') {
    const n = Number(move.n);
    if (!Number.isInteger(n) || n < 2 || n > 24) return { state, message: 'Parte la barra en 2 a 24 pedazos iguales.', done: false };
    state.pieces = n;
    state.shaded = Math.min(state.shaded, n);
    return { state, message: `La barra quedó en ${n} pedazos.`, done: false };
  }
  if (move.action === 'shade') {
    const n = Number(move.n);
    if (!state.pieces) return { state, message: 'Primero parte la barra.', done: false };
    if (!Number.isInteger(n) || n < 0 || n > state.pieces) return { state, message: 'Esa cantidad no cabe en la barra.', done: false };
    state.shaded = n;
    return { state, message: `Pintaste ${n} de ${state.pieces}.`, done: false };
  }
  if (move.action === 'check') {
    if (!state.pieces) return { state, message: 'Primero parte la barra.', done: false };
    const value = state.n1 / state.d1 + state.n2 / state.d2;
    const ok = Math.abs(state.shaded / state.pieces - value) < 1e-9;
    if (!ok) return { state, message: 'Esa pintura no es la suma. Revisa el denominador común.', done: false };
    state.solved = true;
    state.score = 100;
    return { state, message: `Sí: ${state.shaded}/${state.pieces}.`, done: true };
  }
  return { state, message: 'Ese movimiento no existe.', done: false };
}

function rectangleOk(state: Fichas) {
  const filled = state.grid.map((tile, index) => (tile ? index : -1)).filter((index) => index >= 0);
  if (!filled.length) return false;
  const rs = filled.map((index) => Math.floor(index / state.cols));
  const cs = filled.map((index) => index % state.cols);
  const r0 = Math.min(...rs);
  const r1 = Math.max(...rs);
  const c0 = Math.min(...cs);
  const c1 = Math.max(...cs);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) if (!state.grid[r * state.cols + c]) return false;
  }
  const count = (tile: string) => state.grid.filter((cell) => cell === tile).length;
  const height = r1 - r0 + 1;
  const width = c1 - c0 + 1;
  return count('x2') === 1 && count('x') === state.p + state.q && count('1') === state.p * state.q && height * width === 1 + state.p + state.q + state.p * state.q;
}

function applyFichas(state: Fichas, move: Move): { state: Solo; message: string; done: boolean } {
  if (move.action === 'put') {
    const index = Number(move.index);
    const tile = move.tile ?? '';
    if (!Number.isInteger(index) || index < 0 || index >= state.grid.length) return { state, message: 'Esa casilla no existe.', done: false };
    if (!['', 'x2', 'x', '1'].includes(tile)) return { state, message: 'Esa ficha no existe.', done: false };
    const count = (wanted: string) => state.grid.filter((cell) => cell === wanted).length + (tile === wanted ? 1 : 0) - (state.grid[index] === wanted ? 1 : 0);
    if (tile === 'x2' && count('x2') > 1) return { state, message: 'Solo hay una ficha x².', done: false };
    if (tile === 'x' && count('x') > state.p + state.q) return { state, message: 'Ya usaste todas las fichas x.', done: false };
    if (tile === '1' && count('1') > state.p * state.q) return { state, message: 'Ya usaste todas las fichas de 1.', done: false };
    state.grid[index] = tile;
    return { state, message: tile ? 'Ficha puesta.' : 'Casilla vacía.', done: false };
  }
  if (move.action === 'check') {
    if (!rectangleOk(state)) return { state, message: 'Tiene que ser un rectángulo lleno, sin huecos, con todas las fichas.', done: false };
    state.solved = true;
    state.score = 100;
    return { state, message: `Los lados son (x + ${state.p}) y (x + ${state.q}).`, done: true };
  }
  return { state, message: 'Ese movimiento no existe.', done: false };
}

function applyAreas(state: Areas, move: Move): { state: Solo; message: string; done: boolean } {
  const index = Number(move.index);
  if (move.action === 'paint') {
    if (!Number.isInteger(index) || index < 0 || index >= state.on.length) return { state, message: 'Esa casilla no existe.', done: false };
    state.on[index] = !state.on[index];
    return { state, message: `Área pintada: ${state.on.filter(Boolean).length}.`, done: false };
  }
  if (move.action === 'check') {
    const on = state.on.map((cell, i) => (cell ? i : -1)).filter((i) => i >= 0);
    if (on.length !== state.target) return { state, message: `Pedí área ${state.target} y pintaste ${on.length}.`, done: false };
    const rs = on.map((i) => Math.floor(i / state.cols));
    const cs = on.map((i) => i % state.cols);
    const height = Math.max(...rs) - Math.min(...rs) + 1;
    const width = Math.max(...cs) - Math.min(...cs) + 1;
    if (height * width !== on.length) return { state, message: 'Tiene que ser un rectángulo completo: base por altura.', done: false };
    state.solved = true;
    state.score = 100;
    return { state, message: `Área ${width} × ${height} = ${state.target}.`, done: true };
  }
  return { state, message: 'Ese movimiento no existe.', done: false };
}

function applyProporcion(state: Proporcion, move: Move, seed: string): { state: Solo; message: string; done: boolean } {
  if (move.action === 'milk') {
    const n = Number(move.n);
    if (!Number.isInteger(n) || n < 0 || n > 80) return { state, message: 'Esa cantidad no cabe en la jarra.', done: false };
    state.milk = n;
    return { state, message: `${n} vasos.`, done: false };
  }
  if (move.action === 'check') {
    const expected = (state.baseMilk * state.target) / state.basePeople;
    if (Math.abs(state.milk - expected) > 1e-9) return { state, message: 'La proporción no se mantiene. Multiplica en cruz.', done: false };
    state.score += 25;
    if (state.round >= state.rounds) return { state, message: 'Los cuatro pedidos quedaron en proporción.', done: true };
    const rnd = hash(`${seed}:prop:${state.round}`);
    state.round += 1;
    state.basePeople = between(rnd, 2, 5);
    state.baseMilk = between(rnd, 2, 6);
    state.target = state.basePeople * between(rnd, 2, 4);
    state.milk = 0;
    return { state, message: 'Pedido servido. Llega otro.', done: false };
  }
  return { state, message: 'Ese movimiento no existe.', done: false };
}

function applyCruce(state: Cruce, move: Move): { state: Solo; message: string; done: boolean } {
  if (move.action !== 'set') return { state, message: 'Mueve las rectas.', done: false };
  const yours = {
    m1: Number(move.n ?? state.yours.m1),
    b1: Number((move as { b1?: number }).b1 ?? state.yours.b1),
    m2: Number((move as { m2?: number }).m2 ?? state.yours.m2),
    b2: Number((move as { b2?: number }).b2 ?? state.yours.b2),
  };
  if (![yours.m1, yours.b1, yours.m2, yours.b2].every((v) => Number.isInteger(v) && Math.abs(v) <= 12)) {
    return { state, message: 'Usa enteros entre −12 y 12.', done: false };
  }
  state.yours = yours;
  const ok = (yours.m1 === state.m1 && yours.b1 === state.b1 && yours.m2 === state.m2 && yours.b2 === state.b2)
    || (yours.m1 === state.m2 && yours.b1 === state.b2 && yours.m2 === state.m1 && yours.b2 === state.b1);
  if (!ok) return { state, message: 'Esas rectas no son las del sistema.', done: false };
  state.solved = true;
  state.score = 100;
  const x = (state.b2 - state.b1) / (state.m1 - state.m2);
  const y = state.m1 * x + state.b1;
  return { state, message: `Se cruzan en (${x}, ${y}).`, done: true };
}

function rref(cells: Q[][]): Q[][] {
  const m = cells.map((row) => row.map((cell) => [...cell] as Q));
  let lead = 0;
  for (let r = 0; r < m.length && lead < (m[0]?.length ?? 0); r++) {
    let i = r;
    while (i < m.length && m[i]![lead]![0] === 0) i++;
    if (i === m.length) { lead++; r--; continue; }
    [m[r], m[i]] = [m[i]!, m[r]!];
    const piv = m[r]![lead]!;
    m[r] = m[r]!.map((cell) => qmul(cell, q(piv[1], piv[0])));
    for (let j = 0; j < m.length; j++) {
      if (j === r) continue;
      const f = m[j]![lead]!;
      if (f[0] === 0) continue;
      m[j] = m[j]!.map((cell, k) => qadd(cell, qmul(m[r]![k]!, q(-f[0], f[1]))));
    }
    lead++;
  }
  return m;
}

function applyGauss(state: Gauss, move: Move): { state: Solo; message: string; done: boolean } {
  const next = cloneGauss(state);
  const row = (n: number) => Number.isInteger(n) && n >= 0 && n < next.rows;
  if (move.action === 'swap') {
    const i = Number(move.n);
    const j = Number(move.index);
    if (!row(i) || !row(j) || i === j) return { state, message: 'Elige dos filas distintas.', done: false };
    [next.cells[i], next.cells[j]] = [next.cells[j]!, next.cells[i]!];
    next.steps.push(`Intercambié la fila ${i + 1} con la fila ${j + 1}.`);
  } else if (move.action === 'scale') {
    const i = Number(move.index);
    const k = Number(move.n);
    if (!row(i) || !Number.isInteger(k) || k === 0 || Math.abs(k) > 12) return { state, message: 'Multiplica una fila por un entero distinto de cero.', done: false };
    next.cells[i] = next.cells[i]!.map((cell) => qmul(cell, q(k)));
    next.steps.push(`Multipliqué la fila ${i + 1} por ${k}.`);
  } else if (move.action === 'add') {
    const i = Number(move.index);
    const j = Number((move as { from?: number }).from);
    const k = Number(move.n);
    if (!row(i) || !row(j) || i === j || !Number.isInteger(k) || k === 0) return { state, message: 'Suma a una fila el múltiplo de otra.', done: false };
    next.cells[i] = next.cells[i]!.map((cell, col) => qadd(cell, qmul(next.cells[j]![col]!, q(k))));
    next.steps.push(`A la fila ${i + 1} le sumé ${k} por la fila ${j + 1}.`);
  } else if (move.action === 'explain') {
    const steps = explainGauss(next.start);
    next.steps = steps;
    return { state: next, message: 'Estos son los pasos hasta la forma reducida. Sirven para entender; el puntaje lo dan tus propias operaciones.', done: false };
  } else if (move.action === 'check') {
    const done = rref(next.start);
    const ok = next.cells.every((line, i) => line.every((cell, j) => qeq(cell, done[i]![j]!)));
    if (!ok) return { state: next, message: 'Todavía no está en la forma reducida: unos en la diagonal y ceros en el resto de esas columnas.', done: false };
    next.solved = true;
    next.score = Math.max(50, 100 - Math.max(0, next.steps.length - next.rows * 2) * 4);
    return { state: next, message: 'La matriz quedó resuelta.', done: true };
  } else return { state, message: 'Esa operación no existe.', done: false };
  return { state: next, message: next.steps[next.steps.length - 1] ?? 'Listo.', done: false };
}

/** Explica Gauss-Jordan de cualquier matriz pequeña, con fracciones. */
export function explainGauss(start: Q[][]): string[] {
  const m = start.map((row) => row.map((cell) => [...cell] as Q));
  const steps: string[] = ['Matriz aumentada: ' + m.map((row) => row.map(qtext).join('  ')).join(' | ')];
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  let lead = 0;
  for (let r = 0; r < rows && lead < cols; r++) {
    let i = r;
    while (i < rows && m[i]![lead]![0] === 0) i++;
    if (i === rows) { lead++; r--; continue; }
    if (i !== r) {
      [m[r], m[i]] = [m[i]!, m[r]!];
      steps.push(`Intercambio la fila ${r + 1} con la fila ${i + 1} para tener un pivote arriba.`);
    }
    const piv = m[r]![lead]!;
    if (!qeq(piv, q(1))) {
      m[r] = m[r]!.map((cell) => qmul(cell, q(piv[1], piv[0])));
      steps.push(`Divido la fila ${r + 1} entre ${qtext(piv)} para que el pivote sea 1.`);
    }
    for (let j = 0; j < rows; j++) {
      if (j === r) continue;
      const f = m[j]![lead]!;
      if (f[0] === 0) continue;
      m[j] = m[j]!.map((cell, k) => qadd(cell, qmul(m[r]![k]!, q(-f[0], f[1]))));
      steps.push(`A la fila ${j + 1} le resto ${qtext(f)} por la fila ${r + 1}, para hacer cero debajo o arriba del pivote.`);
    }
    lead++;
  }
  steps.push('Forma reducida: ' + m.map((row) => row.map(qtext).join('  ')).join(' | '));
  return steps;
}

export function parseMatrix(raw: unknown): Q[][] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) return null;
  const width = Array.isArray(raw[0]) ? raw[0].length : 0;
  if (width < 2 || width > 8) return null;
  const cells: Q[][] = [];
  for (const line of raw) {
    if (!Array.isArray(line) || line.length !== width) return null;
    const row: Q[] = [];
    for (const value of line) {
      const text = String(value).trim().replace(',', '.');
      const [n, d] = text.includes('/') ? text.split('/').map(Number) : [Number(text), 1];
      if (!Number.isFinite(n) || !Number.isFinite(d) || !d) return null;
      row.push(q(Math.round(n), Math.round(d)));
    }
    cells.push(row);
  }
  return cells;
}

function survey(rnd: Rnd, round: number): Encuesta {
  return { kind: 'encuesta', values: Array.from({ length: 8 }, () => between(rnd, 1, 5)), bars: [0, 0, 0, 0, 0], round, rounds: 3, score: Math.round(((round - 1) / 3) * 100), solved: false };
}

function applyEncuesta(state: Encuesta, move: Move, seed: string): { state: Solo; message: string; done: boolean } {
  if (move.action === 'bar') {
    const i = Number(move.index);
    if (i < 0 || i > 4) return { state, message: 'Esa barra no existe', done: false };
    const next = (state.bars[i] ?? 0) + (Number(move.n) < 0 ? -1 : 1);
    state.bars[i] = Math.max(0, Math.min(8, next));
    return { state, message: 'La barra cambió', done: false };
  }
  if (move.action !== 'check') return { state, message: 'Sube o baja una barra', done: false };
  const freq = [1, 2, 3, 4, 5].map((n) => state.values.filter((v) => v === n).length);
  if (freq.some((n, i) => n !== state.bars[i])) return { state, message: 'La altura de cada barra tiene que ser cuántas veces sale ese número', done: false };
  if (state.round >= state.rounds) {
    state.score = 100;
    state.solved = true;
    return { state, message: 'Leíste las tres encuestas.', done: true };
  }
  const next = survey(hash(`${seed}:encuesta:${state.round}`), state.round + 1);
  return { state: next, message: 'Esa gráfica sí cuenta los datos. Viene otra encuesta.', done: false };
}

function applyRelato(state: Relato, move: Move, seed: string): { state: Solo; message: string; done: boolean } {
  const result = applyFichas(state.puzzle, move);
  state.puzzle = result.state as Fichas;
  if (move.action === 'check' && !state.puzzle.solved && !state.mistakes.includes(String(state.scene))) state.mistakes.push(String(state.scene));
  if (!state.puzzle.solved) return { state, message: result.message, done: false };
  const clean = !state.mistakes.includes(String(state.scene));
  if (clean) state.score += 25;
  if (state.scene >= SCENES.length - 1) {
    state.done = true;
    return { state, message: 'El envío salió. La fábrica guardó qué compuertas abriste a la primera.', done: true };
  }
  const rnd = hash(`${seed}:relato:${state.scene}:${state.score}`);
  state.scene = !clean && state.scene !== 1 ? 1 : state.scene === 0 ? 2 : Math.min(SCENES.length - 1, state.scene + 1);
  state.puzzle = tilePuzzle(between(rnd, 2, 4), between(rnd, 2, 4));
  return { state, message: clean ? 'La compuerta abrió.' : 'La máquina se trabó. Repara con este rectángulo.', done: false };
}

export interface Coop { a: number; b: number; c: number; x: number; turn: 'fire' | 'water'; round: number; rounds: number; log: string[] }

export function startCoop(seed: string): Coop {
  const eq = makeEq(hash(seed));
  return { a: eq.a, b: eq.b, c: eq.c, x: eq.x, turn: 'fire', round: 1, rounds: 4, log: [] };
}

export function viewCoop(state: Coop, side: 'fire' | 'water') {
  return {
    equation: equationText(state.a, state.b, state.c),
    turn: state.turn,
    yours: side === state.turn,
    side,
    round: state.round,
    rounds: state.rounds,
    log: state.log.slice(-4),
    role: side === 'fire' ? 'Fuego resta o suma en los dos lados' : 'Agua divide los dos lados',
  };
}

export function applyCoop(state: Coop, side: 'fire' | 'water', move: Move, seed: string): { state: Coop; message: string; done: boolean; points: number } {
  if (state.turn !== side) return { state, message: 'Le toca a tu pareja.', done: false, points: 0 };
  const n = Number(move.n);
  if (side === 'fire') {
    if (move.action !== 'sub' && move.action !== 'add') return { state, message: 'El fuego suma o resta el mismo número en los dos lados.', done: false, points: 0 };
    if (!Number.isInteger(n) || n <= 0 || n > 40) return { state, message: 'Elige un entero entre 1 y 40.', done: false, points: 0 };
    const sign = move.action === 'sub' ? -1 : 1;
    state.b += sign * n;
    state.c += sign * n;
    state.log.push(`Fuego ${move.action === 'sub' ? 'restó' : 'sumó'} ${n}.`);
  } else {
    if (move.action !== 'div') return { state, message: 'El agua divide los dos lados entre el mismo número.', done: false, points: 0 };
    if (!Number.isInteger(n) || n <= 1 || state.a % n || state.b % n || state.c % n) return { state, message: 'Ese número no divide a los tres. Prueben otro.', done: false, points: 0 };
    state.a /= n;
    state.b /= n;
    state.c /= n;
    state.log.push(`Agua dividió entre ${n}.`);
  }
  state.turn = state.turn === 'fire' ? 'water' : 'fire';
  if (!(state.a === 1 && state.b === 0)) return { state, message: equationText(state.a, state.b, state.c), done: false, points: 10 };
  if (state.round >= state.rounds) return { state, message: `x = ${state.x}. Abrieron las ${state.rounds} compuertas juntos.`, done: true, points: 25 };
  const next = makeEq(hash(`${seed}:coop:${state.round}`));
  state.round += 1;
  state.a = next.a;
  state.b = next.b;
  state.c = next.c;
  state.x = next.x;
  state.turn = 'fire';
  return { state, message: 'Compuerta abierta. La siguiente ecuación ya está en la mesa.', done: false, points: 25 };
}
