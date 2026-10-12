import { useMemo, useState, type ReactElement } from 'react';
import { BookOpen, Gamepad2, ListChecks, MessagesSquare, Minus, Plus, Shapes, Target, type LucideIcon } from 'lucide-react';
import { METHOD_INFO, type LearningMethod } from '@eduquest/contracts';

export const METHOD_ICON: Record<LearningMethod, LucideIcon> = {
  teoria: BookOpen,
  ejemplos: ListChecks,
  juegos: Gamepad2,
  practica: Target,
  visual: Shapes,
  conversacion: MessagesSquare,
};

export function MethodChip({ method, prefix }: { method: LearningMethod; prefix?: string }) {
  const Icon = METHOD_ICON[method];
  return (
    <span className={`chip ${METHOD_INFO[method].tone}`}>
      <Icon size={12} /> {prefix ? `${prefix} ` : ''}{METHOD_INFO[method].label}
    </span>
  );
}

type Params = Record<string, unknown>;
const n = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const fmt = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/* ---------- Teoría por tipo de ejercicio ---------- */

export const THEORY: Record<string, { title: string; rule: string; why: string; search: string }> = {
  order_ops: {
    title: 'Orden de las operaciones',
    rule: 'Primero lo que está entre paréntesis, después multiplicaciones y divisiones, y al final sumas y restas, de izquierda a derecha.',
    why: 'Si cada quien eligiera su orden, la misma expresión daría resultados distintos. La convención hace que todos lleguemos al mismo número.',
    search: 'operaciones',
  },
  simplify: {
    title: 'Fracciones equivalentes',
    rule: 'Si divides el numerador y el denominador entre el mismo número, la fracción vale lo mismo. Es irreducible cuando ya no tienen divisores comunes.',
    why: 'Dividir arriba y abajo entre el mismo número es como agrupar las partes de a varias: el pedazo que tomas no cambia de tamaño.',
    search: 'fracciones',
  },
  frac_add: {
    title: 'Sumar y restar fracciones',
    rule: 'Con el mismo denominador, operas los numeradores. Si son distintos, primero conviertes ambas a un denominador común (el MCM).',
    why: 'Solo se pueden juntar partes del mismo tamaño: medios con medios, sextos con sextos.',
    search: 'fracciones',
  },
  gcd_lcm: {
    title: 'MCD y MCM',
    rule: 'El MCD es el mayor número que divide a ambos. El MCM es el menor número que es múltiplo de ambos.',
    why: 'El MCD sirve para repartir en grupos iguales sin que sobre; el MCM, para saber cuándo dos ciclos coinciden.',
    search: 'múltiplos',
  },
  decimal: {
    title: 'Operaciones con decimales',
    rule: 'Para sumar o restar, alinea las comas. Para multiplicar, multiplica sin coma y luego pon tantos decimales como tengan los dos factores juntos.',
    why: 'Cada cifra tiene un valor según su posición: décimas con décimas, centésimas con centésimas.',
    search: 'decimales',
  },
  percent: {
    title: 'Porcentajes',
    rule: 'El p % de un número es p partes de cada 100: multiplica por p y divide entre 100.',
    why: 'Por ciento significa «de cada cien». El 50 % es la mitad, el 25 % la cuarta parte y el 10 % la décima parte.',
    search: 'porcentaje',
  },
  proportion: {
    title: 'Razones y proporciones',
    rule: 'Si dos cantidades son proporcionales, averigua cuánto vale una unidad y multiplica por las unidades que necesitas.',
    why: 'Al mismo precio, el doble de cuadernos cuesta el doble: las dos cantidades crecen al mismo ritmo.',
    search: 'proporciones',
  },
  triangle: {
    title: 'Ángulos del triángulo',
    rule: 'Los tres ángulos interiores de cualquier triángulo suman 180°.',
    why: 'Si recortas las tres esquinas y las pones juntas, forman una línea recta: media vuelta, 180°.',
    search: 'triángulo',
  },
  area: {
    title: 'Perímetro y área',
    rule: 'El perímetro suma los lados. El área del rectángulo es base × altura, y la del triángulo es la mitad: base × altura ÷ 2.',
    why: 'El área cuenta cuántos cuadritos de 1 cm² caben dentro; el perímetro mide el borde.',
    search: 'área',
  },
  mean: {
    title: 'Promedio',
    rule: 'Suma todos los datos y divide entre la cantidad de datos.',
    why: 'El promedio es el valor que tendría cada dato si los nivelaras todos a la misma altura.',
    search: 'promedio',
  },
};

export function TheoryCard({ generator, compact }: { generator: string; compact?: boolean }) {
  const theory = THEORY[generator];
  if (!theory) return null;
  return (
    <div className={`theory-card ${compact ? 'compact' : ''}`}>
      <div className="row g-8"><BookOpen size={16} /><b>{theory.title}</b></div>
      <p className="theory-rule">{theory.rule}</p>
      {!compact && <p className="muted theory-why"><b>¿Por qué?</b> {theory.why}</p>}
    </div>
  );
}

/* ---------- Manipulativos ---------- */

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <button type="button" className="icon-btn" aria-label="Menos" disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={14} /></button>
      <b>{value}</b>
      <button type="button" className="icon-btn" aria-label="Más" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={14} /></button>
    </div>
  );
}

function FractionBar({ top, bottom, color = 'var(--violet)', label }: { top: number; bottom: number; color?: string; label?: string }) {
  const parts = Math.max(1, bottom);
  const segmented = parts <= 48;
  return (
    <div className="frac-bar-row">
      <svg viewBox="0 0 400 34" className="frac-bar" role="img" aria-label={label ?? `${top} de ${bottom}`}>
        <rect x="1" y="1" width="398" height="32" rx="7" fill="var(--surface-2, #f1f0fb)" stroke="var(--line)" />
        {segmented
          ? Array.from({ length: parts }, (_, i) => (
              <rect key={i} x={1 + (398 / parts) * i} y="1" width={398 / parts} height="32" fill={i < top ? color : 'transparent'} stroke="var(--line)" strokeWidth="1" opacity={i < top ? 0.85 : 1} />
            ))
          : <rect x="1" y="1" width={(398 * Math.min(top, parts)) / parts} height="32" rx="7" fill={color} opacity="0.85" />}
      </svg>
      <span className="frac-label">{label ?? `${top}/${bottom}`}</span>
    </div>
  );
}

function SimplifyKit({ p }: { p: Params }) {
  const [num, den] = [n(p.n, 1), n(p.d, 2)];
  const [k, setK] = useState(1);
  const fits = num % k === 0 && den % k === 0;
  return (
    <div className="stack g-8">
      <FractionBar top={num} bottom={den} />
      <Stepper label="Agrupar las partes de a" value={k} min={1} max={Math.min(num, 20)} onChange={setK} />
      {k > 1 && (fits
        ? <FractionBar top={num / k} bottom={den / k} color="var(--mint)" label={`${num / k}/${den / k}`} />
        : <p className="muted manip-note">Con grupos de {k} no queda cada parte completa: {num} o {den} no se dejan dividir entre {k}.</p>)}
      <p className="muted manip-note">El pedazo pintado no cambia de tamaño: solo cambia cuántas partes cuentas.</p>
    </div>
  );
}

function FracAddKit({ p }: { p: Params }) {
  const [a, b, c, d] = [n(p.a), n(p.b, 2), n(p.c), n(p.d, 2)];
  const options = useMemo(() => Array.from({ length: Math.min(d, 8) }, (_, i) => b * (i + 1)), [b, d]);
  const [den, setDen] = useState(b === d ? b : 0);
  const fits = den > 0 && den % b === 0 && den % d === 0;
  return (
    <div className="stack g-8">
      <FractionBar top={a} bottom={b} />
      <FractionBar top={c} bottom={d} color="var(--sky, #3ab8ff)" />
      {b !== d && (
        <>
          <div className="row g-6 wrap">
            <span className="muted manip-note">Partir todo en:</span>
            {options.map((o) => <button key={o} type="button" className={`chip ${den === o ? 'violet' : ''}`} onClick={() => setDen(o)}>{o} partes</button>)}
          </div>
          {den > 0 && (fits ? (
            <>
              <FractionBar top={a * (den / b)} bottom={den} label={`${a * (den / b)}/${den}`} />
              <FractionBar top={c * (den / d)} bottom={den} color="var(--sky, #3ab8ff)" label={`${c * (den / d)}/${den}`} />
              <p className="muted manip-note">Ahora las partes son del mismo tamaño: ya puedes {p.op === '-' ? 'restar' : 'sumar'} los numeradores.</p>
            </>
          ) : <p className="muted manip-note">En {den} partes la segunda barra no queda exacta. Prueba otro número.</p>)}
        </>
      )}
    </div>
  );
}

function GcdKit({ p }: { p: Params }) {
  const [a, b] = [n(p.a, 2), n(p.b, 2)];
  const mcd = p.op === 'mcd';
  const [mark, setMark] = useState(false);
  const list = (x: number) => (mcd ? Array.from({ length: x }, (_, i) => i + 1).filter((v) => x % v === 0) : Array.from({ length: Math.min(12, Math.ceil((a * b) / gcd(a, b) / x) + 2) }, (_, i) => x * (i + 1)));
  const [la, lb] = [list(a), list(b)];
  const common = new Set(la.filter((v) => lb.includes(v)));
  return (
    <div className="stack g-8">
      {[[a, la], [b, lb]].map(([x, values]) => (
        <div key={String(x)} className="row g-6 wrap">
          <b style={{ minWidth: 96 }}>{mcd ? 'Divisores' : 'Múltiplos'} de {String(x)}</b>
          {(values as number[]).map((v) => <span key={v} className={`chip ${mark && common.has(v) ? 'gold' : ''}`}>{v}</span>)}
        </div>
      ))}
      <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setMark(!mark)}>{mark ? 'Ocultar comunes' : 'Marcar los comunes'}</button>
    </div>
  );
}

function DecimalKit({ p }: { p: Params }) {
  const [a, b] = [n(p.a), n(p.b)];
  const op = p.op === '×' ? '×' : p.op === '-' ? '−' : '+';
  const cols = ['C', 'D', 'U', ',', 'd', 'c'];
  const digits = (value: number) => {
    const [int, dec = ''] = value.toFixed(2).split('.');
    const i = int!.padStart(3, ' ').slice(-3).split('');
    return [...i, ',', ...dec.split('')];
  };
  if (op === '×') {
    const places = (v: number) => (String(v).split('.')[1] ?? '').length;
    return (
      <div className="stack g-8">
        <div className="row g-8 wrap">
          <span className="chip">{fmt(a)} → {places(a)} decimal{places(a) === 1 ? '' : 'es'}</span>
          <span className="chip">{fmt(b)} → {places(b)} decimal{places(b) === 1 ? '' : 'es'}</span>
          <span className="chip gold">El resultado lleva {places(a) + places(b)}</span>
        </div>
        <p className="muted manip-note">Multiplica {String(a).replace('.', '')} × {String(b).replace('.', '')} como enteros y corre la coma.</p>
      </div>
    );
  }
  return (
    <table className="place-table" aria-label="Tabla de valor posicional">
      <thead><tr><th />{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>
        <tr><td />{digits(a).map((x, i) => <td key={i} className={x === ',' ? 'comma' : ''}>{x.trim()}</td>)}</tr>
        <tr><td className="op">{op}</td>{digits(b).map((x, i) => <td key={i} className={x === ',' ? 'comma' : ''}>{x.trim()}</td>)}</tr>
        <tr className="sum"><td />{cols.map((c, i) => <td key={i} className={c === ',' ? 'comma' : ''}>{c === ',' ? ',' : ''}</td>)}</tr>
      </tbody>
    </table>
  );
}

function PercentKit({ p }: { p: Params }) {
  const [pct, total] = [Math.min(100, n(p.p)), n(p.n)];
  return (
    <div className="row g-16 wrap" style={{ alignItems: 'center' }}>
      <svg viewBox="0 0 202 202" className="pct-grid" role="img" aria-label={`${pct} de 100 cuadritos`}>
        {Array.from({ length: 100 }, (_, i) => (
          <rect key={i} x={2 + (i % 10) * 20} y={2 + Math.floor(i / 10) * 20} width="18" height="18" rx="3" fill={i < pct ? 'var(--gold, #ffb020)' : 'var(--surface-2, #f1f0fb)'} stroke="var(--line)" />
        ))}
      </svg>
      <div className="stack g-6" style={{ flex: 1, minWidth: 180 }}>
        <b>{pct} de cada 100</b>
        <p className="muted manip-note">Los 100 cuadritos son {fmt(total)}. Cada cuadrito vale {fmt(total)} ÷ 100. ¿Cuánto valen {pct}?</p>
      </div>
    </div>
  );
}

function ProportionKit({ p }: { p: Params }) {
  const [a, b, c] = [n(p.a, 1), n(p.b), n(p.c, 1)];
  return (
    <div className="stack g-8">
      <table className="ratio-table">
        <thead><tr><th /><th>÷ {a}</th><th>× {c}</th></tr></thead>
        <tbody>
          <tr><td>Cuadernos</td><td>{a}</td><td>1</td><td>{c}</td></tr>
          <tr><td>Precio</td><td>${fmt(b)}</td><td><input aria-label="Precio de uno" placeholder="?" /></td><td><input aria-label="Precio buscado" placeholder="?" /></td></tr>
        </tbody>
      </table>
      <p className="muted manip-note">Lo que haces en la fila de arriba lo haces también en la de abajo.</p>
    </div>
  );
}

function TriangleKit({ p }: { p: Params }) {
  const [x, y] = [n(p.x, 60), n(p.y, 60)];
  const z = Math.max(0, 180 - x - y);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const base = 240;
  const A = { x: 20, y: 150 };
  const B = { x: 20 + base, y: 150 };
  const tA = Math.tan(toRad(x));
  const tB = Math.tan(toRad(y));
  const cx = x >= 90 || y >= 90 ? 20 + base / 2 : (base * tB) / (tA + tB) + 20;
  const cy = 150 - Math.min(130, Math.abs((cx - 20) * tA));
  return (
    <div className="row g-16 wrap" style={{ alignItems: 'center' }}>
      <svg viewBox="0 0 280 170" className="tri-svg" role="img" aria-label={`Triángulo con ángulos de ${x} y ${y} grados`}>
        <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${cx},${cy}`} fill="rgba(124,92,255,.12)" stroke="var(--violet)" strokeWidth="2.5" strokeLinejoin="round" />
        <text x={A.x + 22} y={A.y - 8} className="tri-label">{x}°</text>
        <text x={B.x - 44} y={B.y - 8} className="tri-label">{y}°</text>
        <text x={cx - 8} y={cy + 26} className="tri-label q">?</text>
      </svg>
      <div className="stack g-6" style={{ flex: 1, minWidth: 180 }}>
        <svg viewBox="0 0 200 26" className="frac-bar" aria-label="Media vuelta de 180 grados">
          <rect x="0" y="0" width={(200 * x) / 180} height="26" fill="var(--violet)" opacity=".8" />
          <rect x={(200 * x) / 180} y="0" width={(200 * y) / 180} height="26" fill="var(--sky, #3ab8ff)" opacity=".8" />
          <rect x={(200 * (x + y)) / 180} y="0" width={(200 * z) / 180} height="26" fill="none" stroke="var(--gold, #ffb020)" strokeDasharray="4 3" strokeWidth="2" />
        </svg>
        <p className="muted manip-note">Las tres esquinas juntas forman media vuelta (180°). El hueco punteado es el ángulo que falta.</p>
      </div>
    </div>
  );
}

function AreaKit({ p }: { p: Params }) {
  const shape = String(p.shape ?? 'rect_area');
  const b = n(p.b, 4);
  const h = shape === 'square_area' ? b : n(p.h, 3);
  const unit = Math.min(240 / b, 150 / h, 22);
  const w = b * unit;
  const ht = h * unit;
  const fine = b <= 24 && h <= 24;
  return (
    <svg viewBox={`0 0 ${w + 60} ${ht + 44}`} className="area-svg" role="img" aria-label={`Figura de ${b} por ${h}`}>
      <g transform="translate(30 10)">
        {fine && Array.from({ length: b * h }, (_, i) => (
          <rect key={i} x={(i % b) * unit} y={Math.floor(i / b) * unit} width={unit} height={unit} fill={shape === 'rect_perimeter' ? 'transparent' : 'rgba(124,92,255,.08)'} stroke="var(--line)" strokeWidth="0.8" />
        ))}
        {shape === 'triangle_area'
          ? <>
              <rect width={w} height={ht} fill="none" stroke="var(--muted)" strokeDasharray="5 4" />
              <polygon points={`0,${ht} ${w},${ht} ${w * 0.35},0`} fill="rgba(255,176,32,.35)" stroke="var(--gold, #ffb020)" strokeWidth="2.5" />
            </>
          : <rect width={w} height={ht} fill={shape === 'rect_perimeter' ? 'none' : 'rgba(124,92,255,.16)'} stroke={shape === 'rect_perimeter' ? 'var(--coral, #ff5d73)' : 'var(--violet)'} strokeWidth={shape === 'rect_perimeter' ? 4 : 2.5} />}
        <text x={w / 2} y={ht + 24} textAnchor="middle" className="tri-label">{b} cm</text>
        <text x={-8} y={ht / 2} textAnchor="end" dominantBaseline="middle" className="tri-label">{h}</text>
      </g>
    </svg>
  );
}

function MeanKit({ p }: { p: Params }) {
  const values = Array.isArray(p.values) ? (p.values as unknown[]).map((v) => n(v)) : [];
  const max = Math.max(1, ...values);
  const [level, setLevel] = useState(Math.round(max / 2));
  const above = values.reduce((s, v) => s + Math.max(0, v - level), 0);
  const below = values.reduce((s, v) => s + Math.max(0, level - v), 0);
  const H = 140;
  const y = (v: number) => H - (v / max) * (H - 10);
  return (
    <div className="stack g-8">
      <svg viewBox={`0 0 ${values.length * 50 + 20} ${H + 20}`} className="mean-svg" role="img" aria-label="Barras de los datos">
        {values.map((v, i) => (
          <g key={i}>
            <rect x={14 + i * 50} y={y(v)} width="34" height={H - y(v)} rx="5" fill="var(--sky, #3ab8ff)" opacity=".8" />
            <text x={31 + i * 50} y={H + 15} textAnchor="middle" className="tri-label small">{v}</text>
          </g>
        ))}
        <line x1="6" x2={values.length * 50 + 14} y1={y(level)} y2={y(level)} stroke="var(--coral, #ff5d73)" strokeWidth="2.5" strokeDasharray="6 4" />
      </svg>
      <label className="row g-8 manip-note">
        Mueve la línea: <input type="range" min={0} max={max} value={level} onChange={(e) => setLevel(Number(e.target.value))} style={{ flex: 1 }} /> <b>{level}</b>
      </label>
      <p className={`manip-note ${above === below ? 'ok' : 'muted'}`}>
        {above === below ? '¡Equilibrado! Lo que sobra arriba llena exactamente lo que falta abajo.' : `Sobra arriba: ${above} · Falta abajo: ${below}`}
      </p>
    </div>
  );
}

function OrderOpsKit({ p }: { p: Params }) {
  const [form, a, b, c] = [n(p.form, 1), n(p.a), n(p.b), n(p.c)];
  const parts: Record<number, { tokens: string[]; first: [number, number] }> = {
    1: { tokens: [String(a), '+', String(b), '×', String(c)], first: [2, 4] },
    2: { tokens: ['(', String(a), '+', String(b), ')', '×', String(c)], first: [0, 4] },
    3: { tokens: [String(a), '×', String(b), '−', String(c)], first: [0, 2] },
    4: { tokens: [String(a), '×', '(', String(b), '−', String(c), ')'], first: [2, 6] },
  };
  const { tokens, first } = parts[form] ?? parts[1]!;
  return (
    <div className="stack g-8">
      <div className="ops-row">
        {tokens.map((t, i) => <span key={i} className={`ops-token ${i >= first[0] && i <= first[1] ? 'first' : ''}`}>{t}</span>)}
      </div>
      <p className="muted manip-note"><span className="chip gold">1°</span> Lo resaltado va primero{form === 2 || form === 4 ? ' porque está entre paréntesis' : ' porque la multiplicación va antes que la suma y la resta'}. Después resuelves lo que queda.</p>
    </div>
  );
}

const KITS: Record<string, (props: { p: Params }) => ReactElement> = {
  simplify: SimplifyKit,
  frac_add: FracAddKit,
  gcd_lcm: GcdKit,
  decimal: DecimalKit,
  percent: PercentKit,
  proportion: ProportionKit,
  triangle: TriangleKit,
  area: AreaKit,
  mean: MeanKit,
  order_ops: OrderOpsKit,
};

export const MANIPULATIVE_NAME: Record<string, string> = {
  simplify: 'Barras de fracción',
  frac_add: 'Barras de fracción',
  gcd_lcm: 'Divisores y múltiplos',
  decimal: 'Tabla de valor posicional',
  percent: 'Cuadrícula de 100',
  proportion: 'Tabla de proporción',
  triangle: 'Triángulo y media vuelta',
  area: 'Cuadrícula de área',
  mean: 'Barras para nivelar',
  order_ops: 'Orden de las operaciones',
};

export const hasManipulative = (generator: string) => generator in KITS;

export function Manipulative({ generator, params }: { generator: string; params: unknown }) {
  const Kit = KITS[generator];
  if (!Kit || !params || typeof params !== 'object') return null;
  return (
    <div className="manipulative">
      <div className="row g-8 manip-title"><Shapes size={15} /> {MANIPULATIVE_NAME[generator]}</div>
      <Kit p={params as Params} />
    </div>
  );
}
