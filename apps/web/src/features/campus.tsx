import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookMarked,
  ChevronRight,
  Mic,
  MicOff,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { matchCommand, useDictation, useSpeech, type VoiceCommand } from '@/shared/voice';
import { useCompanion, type Companion, type CompanionId } from '@/shared/companion';
import { buildingsFor, G, type Building, type BuildingKey } from '@/shared/buildings';
import { BuildingShape, iso, mix, pts, type Paint } from '@/ui/iso';
import { enterBuilding } from '@/shared/enter';

export { buildingsFor, type BuildingKey } from '@/shared/buildings';

/* ---------- Day / night ---------- */

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

function bogotaHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(date)) % 24;
}
export function phaseOf(hour: number): Phase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}
const phaseMeta: Record<Phase, { label: string; icon: LucideIcon; sky: string; greet: string }> = {
  dawn: { label: 'Amanecer', icon: Sunrise, sky: 'linear-gradient(180deg,#ff9a7a 0%,#ffc79a 45%,#fff0d9 100%)', greet: '¡Madrugaste' },
  day: { label: 'Día', icon: Sun, sky: 'linear-gradient(180deg,#6fc3ff 0%,#a9dcff 50%,#e4f5ff 100%)', greet: '¡Hola' },
  dusk: { label: 'Atardecer', icon: Sunset, sky: 'linear-gradient(180deg,#4b33b8 0%,#c4569a 45%,#ffb27a 100%)', greet: '¡Buenas tardes' },
  night: { label: 'Noche', icon: Moon, sky: 'linear-gradient(180deg,#070620 0%,#151146 50%,#2a2166 100%)', greet: '¡Buenas noches' },
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function toner(phase: Phase) {
  return (hex: string) => {
    if (phase === 'night') return mix(hex, '#1a1650', 0.55);
    if (phase === 'dusk') return mix(hex, '#ff6f61', 0.14);
    if (phase === 'dawn') return mix(hex, '#ffb38a', 0.12);
    return hex;
  };
}


export interface PendingItem { title: string; meta: string; link: string }
export type CampusCounts = Partial<Record<BuildingKey, number>>;
export type CampusPending = Partial<Record<BuildingKey, PendingItem[]>>;

export const statusOf = (b: Pick<Building, 'caption' | 'idle'>, n: number | undefined) =>
  !n ? b.idle : n === 1 ? `1 ${b.caption.replace(/(\p{L}{3,})s\b/gu, '$1')}` : `${n} ${b.caption}`;

/** Red counter of a building; hover (on pointer devices) or tap opens what is pending, each with its own "Ir". */
export function PendingBadge({ building, count, items }: { building: Pick<Building, 'key' | 'name' | 'caption' | 'idle' | 'to'>; count: number; items: PendingItem[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const hover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (count <= 0) return null;
  const go = (to: string) => { setOpen(false); navigate(to); };
  return (
    <span
      ref={ref}
      className={`pending${open ? ' open' : ''}`}
      onMouseEnter={() => { if (!hover) return; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), 160); }}
      onMouseLeave={() => { if (!hover) return; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 220); }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button type="button" className="iso-count pending-btn" aria-expanded={open} aria-label={`${statusOf(building, count)}. Ver detalle`} onClick={() => setOpen((o) => !o)}>
        {count > 99 ? '99+' : count}
      </button>
      {open && (
        <div className="pending-pop" role="dialog" aria-label={`Pendientes de ${building.name}`}>
          <div className="pending-head"><b>{building.name}</b><small>{statusOf(building, count)}</small></div>
          <ul>
            {items.map((item) => (
              <li key={`${item.link}-${item.title}`}>
                <span><b>{item.title}</b>{item.meta && <small>{item.meta}</small>}</span>
                <button type="button" className="btn sm" onClick={() => go(item.link)}>Ir</button>
              </li>
            ))}
          </ul>
          {count > items.length && <small className="pending-more">y {count - items.length} más</small>}
          <button type="button" className="btn sm ghost pending-all" onClick={() => go(building.to)}>Abrir {building.name} <ChevronRight size={14} /></button>
        </div>
      )}
    </span>
  );
}


function Tree({ x, y, kind, paint }: { x: number; y: number; kind: 0 | 1; paint: Paint }) {
  const [bx, by] = iso(x, y, 0);
  if (kind === 1) {
    return (
      <g>
        <ellipse cx={bx} cy={by} rx={9} ry={4.5} fill="rgba(0,0,0,.14)" />
        <polygon points={pts([[bx - 11, by - 8], [bx + 11, by - 8], [bx, by - 40]])} fill={paint.tone('#1f9e63')} />
        <polygon points={pts([[bx, by - 8], [bx + 11, by - 8], [bx, by - 40]])} fill={paint.tone('#16804f')} />
        <rect x={bx - 2} y={by - 9} width={4} height={9} fill={paint.tone('#6b4a2f')} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={bx} cy={by} rx={10} ry={5} fill="rgba(0,0,0,.14)" />
      <rect x={bx - 2} y={by - 14} width={4} height={14} fill={paint.tone('#6b4a2f')} />
      <circle cx={bx} cy={by - 22} r={12} fill={paint.tone('#3fbf6f')} />
      <circle cx={bx - 4} cy={by - 26} r={6} fill={paint.tone('#6fe08f')} opacity={0.8} />
    </g>
  );
}

function Lamp({ x, y, paint }: { x: number; y: number; paint: Paint }) {
  const [bx, by] = iso(x, y, 0);
  return (
    <g>
      {paint.night && <ellipse cx={bx} cy={by} rx={22} ry={11} fill="url(#lampPool)" />}
      <line x1={bx} y1={by} x2={bx} y2={by - 28} stroke={paint.tone('#3d3a5c')} strokeWidth={2} />
      <circle cx={bx} cy={by - 30} r={paint.night ? 4.5 : 3.5} fill={paint.night ? '#ffe7a3' : '#d6d2f0'} filter={paint.night ? 'url(#glow)' : undefined} />
    </g>
  );
}

const trees: [number, number, 0 | 1][] = [
  [0.5, 0.5, 0], [0.5, 4.5, 1], [0.5, 9, 0], [0.6, 13.3, 1], [4.2, 0.5, 0], [8.6, 0.6, 1], [13.4, 0.6, 0], [13.3, 4.5, 1],
  [13.4, 8.4, 0], [4.3, 13.4, 1], [8.8, 13.3, 0], [13.4, 13.4, 1], [4, 10.8, 0], [3.9, 4.2, 1], [10.4, 4.2, 0], [3.4, 8.8, 1],
  [9.9, 8.4, 0], [2.3, 4.6, 0], [11.9, 4.7, 1],
];
const lamps: [number, number][] = [[4.1, 6.1], [9.7, 6.1], [4.1, 8.1], [9.7, 8.1], [6.1, 3.3], [8.1, 10.5], [3.3, 6.2], [10.7, 7.9]];

/* ---------- Isometric campus ---------- */

const VIEW = { x: -430, y: -110, w: 860, h: 640 };

/** Fixed silhouette covering the building at rest and lifted, so hovering never moves the target out from under the cursor. */
function hitArea(b: Building): [number, number][] {
  const top = b.h + (b.shape === 'board' || b.shape === 'stadium' ? 1.6 : 1.9);
  const corners: [number, number][] = [];
  for (const [x, y] of [[b.x - 0.2, b.y - 0.2], [b.x + b.w + 0.2, b.y - 0.2], [b.x + b.w + 0.2, b.y + b.d + 0.2], [b.x - 0.2, b.y + b.d + 0.2]] as const) {
    corners.push(iso(x, y, 0), iso(x, y, top));
  }
  const sorted = [...corners].sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  const cross = (o: [number, number], a: [number, number], c: [number, number]) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const half = (points: [number, number][]) => {
    const hull: [number, number][] = [];
    for (const p of points) {
      while (hull.length >= 2 && cross(hull[hull.length - 2]!, hull[hull.length - 1]!, p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop();
    return hull;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function IsoCampus({ buildings, counts, pending, phase, interactive = true, onPick }: {
  buildings: Building[];
  counts?: CampusCounts;
  pending?: CampusPending;
  phase: Phase;
  interactive?: boolean;
  onPick?: (b: Building, source: Element | null) => void;
}) {
  const [hover, setHover] = useState<BuildingKey | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? VIEW.w;
      setScale(Math.max(0.55, Math.min(1.15, width / VIEW.w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const paint: Paint = useMemo(() => ({ tone: toner(phase), night: phase === 'night' }), [phase]);
  const night = phase === 'night';

  const grass = paint.tone('#86dc8f');
  const plaza = paint.tone('#efe6d2');
  const sideA = paint.tone('#c2925e');
  const sideB = paint.tone('#9a6d42');
  const P = (x: number, y: number) => iso(x, y, 0);

  const renderBuilding = (b: Building, index: number) => {
    const active = hover === b.key;
    return (
      <g
        key={b.key}
        className={`iso-b${interactive ? ' live' : ''}${active ? ' on' : ''}`}
        role={interactive ? 'link' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${b.name}: ${statusOf(b, counts?.[b.key])}` : undefined}
        onMouseEnter={() => interactive && setHover(b.key)}
        onMouseLeave={() => interactive && setHover(null)}
        onFocus={() => interactive && setHover(b.key)}
        onBlur={() => interactive && setHover(null)}
        onClick={(e) => interactive && onPick?.(b, e.currentTarget.querySelector('.iso-lift'))}
        onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick?.(b, e.currentTarget.querySelector('.iso-lift')); } }}
      >
        <polygon className="iso-pad" points={pts([P(b.x - 0.2, b.y - 0.2), P(b.x + b.w + 0.2, b.y - 0.2), P(b.x + b.w + 0.2, b.y + b.d + 0.2), P(b.x - 0.2, b.y + b.d + 0.2)])} fill={active ? 'rgba(124,92,255,.35)' : 'rgba(0,0,0,.10)'} />
        <g className="iso-lift">
          <BuildingShape b={b} paint={paint} seed={index + 3} />
        </g>
        {interactive && <polygon className="iso-hit" points={pts(hitArea(b))} />}
      </g>
    );
  };

  const items: { depth: number; node: ReactNode }[] = [];
  buildings.forEach((b, i) => items.push({ depth: b.x + b.w / 2 + b.y + b.d / 2, node: renderBuilding(b, i) }));
  trees.forEach(([x, y, k]) => items.push({ depth: x + y, node: <Tree key={`t${x}-${y}`} x={x} y={y} kind={k} paint={paint} /> }));
  lamps.forEach(([x, y]) => items.push({ depth: x + y, node: <Lamp key={`l${x}-${y}`} x={x} y={y} paint={paint} /> }));
  const scenery = items.sort((a, b) => a.depth - b.depth).map((item) => item.node);

  const walkLoop = [P(4.5, 4.4), P(9.3, 4.4), P(9.3, 9.2), P(4.5, 9.2)];
  const loopD = `M${walkLoop.map((p) => p.join(',')).join(' L')} Z`;
  const walkers = ['#ff5d73', '#7c5cff', '#ffc83d', '#19c39c', '#3ab8ff'];

  return (
    <div className="iso-wrap" ref={wrap} style={{ '--iso-scale': scale } as CSSProperties}>
      <svg className="iso-svg" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="img" aria-label="Mapa del campus Ludoteka">
        <defs>
          <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="lampPool"><stop offset="0%" stopColor="#ffd66b" stopOpacity=".55" /><stop offset="100%" stopColor="#ffd66b" stopOpacity="0" /></radialGradient>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={paint.tone('#7fd6ff')} /><stop offset="100%" stopColor={paint.tone('#3a9bff')} /></linearGradient>
        </defs>

        <polygon points={pts([P(0, G), P(G, G), iso(G, G, -0.7), iso(0, G, -0.7)])} fill={sideA} />
        <polygon points={pts([P(G, 0), P(G, G), iso(G, G, -0.7), iso(G, 0, -0.7)])} fill={sideB} />
        <polygon points={pts([iso(0, G, -0.7), iso(G, G, -0.7), iso(G, G, -0.9), iso(0, G, -0.9)])} fill={paint.tone('#7a5232')} />
        <polygon points={pts([iso(G, 0, -0.7), iso(G, G, -0.7), iso(G, G, -0.9), iso(G, 0, -0.9)])} fill={paint.tone('#5e3e25')} />
        <polygon points={pts([P(0, 0), P(G, 0), P(G, G), P(0, G)])} fill={grass} />
        <polygon points={pts([P(0, 0), P(G, 0), P(G, 0.12), P(0.12, 0.12), P(0.12, G), P(0, G)])} fill={paint.tone('#a6eaa9')} />

        <polygon points={pts([P(0, 6.5), P(G, 6.5), P(G, 7.3), P(0, 7.3)])} fill={plaza} />
        <polygon points={pts([P(6.5, 0), P(7.3, 0), P(7.3, G), P(6.5, G)])} fill={plaza} />
        <path d={loopD} fill="none" stroke={plaza} strokeWidth={13} strokeLinejoin="round" />
        <path d={loopD} fill="none" stroke={paint.tone('#d9ccb0')} strokeWidth={1} strokeDasharray="3 7" />

        {(() => {
          const [px, py] = iso(4.9, 2, 0);
          return (
            <g>
              <ellipse cx={px} cy={py} rx={34} ry={17} fill={paint.tone('#5a8f5e')} />
              <ellipse cx={px} cy={py - 1} rx={30} ry={14.5} fill="url(#water)" />
              <ellipse className="iso-ripple" cx={px - 6} cy={py - 3} rx={8} ry={3} fill="none" stroke="#fff" strokeOpacity={0.6} />
            </g>
          );
        })()}

        {walkers.map((c, i) => (
          <g key={c}>
            <circle r={3.2} cy={-9} fill={paint.tone('#ffd9b8')} />
            <rect x={-3.5} y={-6.5} width={7} height={8} rx={3} fill={paint.tone(c)} />
            <animateMotion dur={`${26 + i * 5}s`} repeatCount="indefinite" path={loopD} begin={`-${i * 6}s`} keyPoints={i % 2 ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
          </g>
        ))}

        {scenery}
      </svg>
      <div className="iso-labels">
        {buildings.map((b) => {
          const top = b.shape === 'stadium' ? iso(b.x + b.w / 2, b.y + b.d / 2, b.h + 1.6) : iso(b.x + b.w / 2, b.y + b.d / 2, b.h + (b.shape === 'board' ? 1.6 : b.shape === 'school' ? 1.85 : b.shape === 'tower' ? 1.9 : 1.4));
          const n = counts?.[b.key] ?? 0;
          const active = hover === b.key;
          return (
            <div key={`lbl-${b.key}`} className="iso-tag" style={{ left: `${((top[0] - VIEW.x) / VIEW.w) * 100}%`, top: `${((top[1] - VIEW.y) / VIEW.h) * 100}%` }}>
              <div className={`iso-label${active ? ' on' : ''}${night ? ' night' : ''}`}>
                <span className="iso-label-ico" style={{ background: b.color }} aria-hidden><b.icon size={13} strokeWidth={2.6} /></span>
                <span className="iso-label-name" aria-hidden>{b.name}</span>
                {counts && n > 0 && (interactive
                  ? <PendingBadge building={b} count={n} items={pending?.[b.key] ?? []} />
                  : <span className="iso-count" aria-hidden>{n > 99 ? '99+' : n}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Luka, the AI companion ---------- */

const lookOf: Record<CompanionId, { stops: [string, string, string]; limb: string; eye: string; mark: string }> = {
  luka: { stops: ['#9b7bff', '#6a45f0', '#d5459a'], limb: '#6a45f0', eye: '#3fe0b4', mark: '#ffc83d' },
  luna: { stops: ['#ff9ad5', '#b45cff', '#5b8cff'], limb: '#9a4ff0', eye: '#7fd6ff', mark: '#fff1a8' },
};

export function Luka({ mood = 'idle', size = 112, variant = 'luka' }: { mood?: 'idle' | 'talking' | 'listening'; size?: number; variant?: CompanionId }) {
  const look = lookOf[variant];
  const body = `cBody-${variant}`;
  const eye = `cEye-${variant}`;
  return (
    <svg className={`luka luka-${mood}`} width={size} height={size * 1.15} viewBox="0 0 120 138" aria-hidden>
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={look.stops[0]} />
          <stop offset="60%" stopColor={look.stops[1]} />
          <stop offset="100%" stopColor={look.stops[2]} />
        </linearGradient>
        <radialGradient id={eye}><stop offset="0%" stopColor="#e9fbff" /><stop offset="100%" stopColor={look.eye} /></radialGradient>
      </defs>
      <ellipse className="luka-shadow" cx="60" cy="132" rx="26" ry="5" fill="rgba(0,0,0,.22)" />
      <g className="luka-float">
        <line x1="60" y1="24" x2="60" y2="10" stroke={look.limb} strokeWidth="3" strokeLinecap="round" />
        {variant === 'luna'
          ? <path className="luka-antenna" d="M63 1.5a7 7 0 1 0 0 13 5.6 5.6 0 1 1 0-13z" fill={look.mark} />
          : <circle className="luka-antenna" cx="60" cy="8" r="5.5" fill={look.mark} />}
        <rect className="luka-arm l" x="10" y="88" width="16" height="26" rx="8" fill={look.limb} />
        <rect className="luka-arm r" x="94" y="88" width="16" height="26" rx="8" fill={look.limb} />
        <rect x="30" y="82" width="60" height="40" rx="20" fill={`url(#${body})`} />
        <circle cx="60" cy="101" r="9" fill="#140f2e" />
        <text x="60" y="105.5" textAnchor="middle" fontSize="12" fontWeight="800" fill={look.mark} fontFamily="var(--font-display)">L</text>
        <rect x="16" y="22" width="88" height="66" rx="32" fill={`url(#${body})`} />
        <rect x="16" y="22" width="88" height="66" rx="32" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2" />
        <rect x="27" y="36" width="66" height="38" rx="19" fill="#140f2e" />
        <g className="luka-eyes">
          <ellipse cx="47" cy="53" rx="6.5" ry="8" fill={`url(#${eye})`} />
          <ellipse cx="73" cy="53" rx="6.5" ry="8" fill={`url(#${eye})`} />
          <circle cx="49" cy="50" r="2" fill="#fff" />
          <circle cx="75" cy="50" r="2" fill="#fff" />
          {variant === 'luna' && (
            <g stroke={look.eye} strokeWidth="1.8" strokeLinecap="round">
              <path d="M40 46l-3-3M43 44.5l-1.5-3.5M80 46l3-3M77 44.5l1.5-3.5" />
            </g>
          )}
        </g>
        <path className="luka-mouth" d="M51 64 Q60 70 69 64" stroke={look.eye} strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="34" cy="66" r="5" fill="#ff5d73" opacity=".45" />
        <circle cx="86" cy="66" r="5" fill="#ff5d73" opacity=".45" />
      </g>
    </svg>
  );
}

function tipsFor(role: string | undefined, counts: Partial<Record<BuildingKey, number>>, buildings: Building[], name: string, phase: Phase, companion: Companion) {
  const tips: { text: string; to?: string }[] = [];
  const by = (k: BuildingKey) => buildings.find((b) => b.key === k);
  const n = (k: BuildingKey) => counts[k] ?? 0;
  const plural = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  const greet = phase === 'night' ? `Buenas noches, ${name}.` : phase === 'dusk' ? `Buenas tardes, ${name}.` : `¡Hola, ${name}!`;

  if (role === 'student') {
    if (n('aula')) tips.push({ text: `${greet} Esta semana tienes ${plural(n('aula'), 'pendiente', 'pendientes')} en el Aula entre tareas y lecciones. ¿Arrancamos?`, to: by('aula')?.to });
    if (n('trofeos')) tips.push({ text: `Ganaste ${plural(n('trofeos'), 'insignia nueva', 'insignias nuevas')}. Pasa por la Sala de trofeos a verlas.`, to: by('trofeos')?.to });
    if (n('biblioteca')) tips.push({ text: `La Biblioteca tiene ${plural(n('biblioteca'), 'recurso nuevo', 'recursos nuevos')} desde tu última visita.`, to: by('biblioteca')?.to });
    if (n('arena')) tips.push({ text: `¡Hay ${plural(n('arena'), 'sala abierta', 'salas abiertas')} en la Arena! Únete con tu equipo antes de que empiece.`, to: by('arena')?.to });
    if (n('cuaderno')) tips.push({ text: `Tu Cuaderno tiene ${plural(n('cuaderno'), 'tarjeta', 'tarjetas')} para repasar hoy. Cinco minutos bastan para no olvidarlo.`, to: by('cuaderno')?.to });
    if (n('ruta')) tips.push({ text: `En Mi ruta te esperan ${plural(n('ruta'), 'reto', 'retos')} hechos a tu medida.`, to: by('ruta')?.to });
    if (n('cartelera')) tips.push({ text: `Hay ${plural(n('cartelera'), 'aviso nuevo', 'avisos nuevos')} en la Cartelera.`, to: by('cartelera')?.to });
    if (!tips.length) tips.push({ text: `${greet} Estás al día. ¿Exploramos la Biblioteca o me haces una pregunta en el Laboratorio?`, to: by('lab')?.to });
    tips.push({ text: 'Si no entiendes un tema, pregúntame en el Laboratorio IA. Te explico paso a paso sin darte la respuesta de una.', to: by('lab')?.to });
  } else if (role === 'teacher') {
    tips.push(n('aula')
      ? { text: `${greet} Tienes ${plural(n('aula'), 'entrega', 'entregas')} por calificar en el Aula.`, to: by('aula')?.to }
      : { text: `${greet} No hay entregas pendientes. Buen momento para preparar una evaluación en el Taller docente.`, to: by('cuaderno')?.to });
    tips.push({ text: 'En el Observatorio puedes preguntarme por tus cursos en lenguaje natural, por ejemplo: «¿quiénes no han entregado esta semana?».', to: by('ruta')?.to });
    tips.push({ text: 'Abre una sala en la Arena y proyecta el código QR: los equipos compiten en vivo.', to: by('arena')?.to });
  } else if (role === 'guardian') {
    tips.push({ text: `${greet} En Seguimiento ves el avance, las alertas y los boletines de tus acudidos.`, to: by('aula')?.to });
    if (n('cartelera')) tips.push({ text: `El colegio publicó ${plural(n('cartelera'), 'aviso', 'avisos')} que aún no lees.`, to: by('cartelera')?.to });
  } else {
    tips.push({ text: `${greet} El campus registra hoy actividad en tiempo real; revisa los indicadores en Certificados y reportes.`, to: by('trofeos')?.to });
    tips.push({ text: 'Pregúntale al Observatorio cosas como «promedio por grado este periodo» y te respondo con una consulta segura de solo lectura.', to: by('ruta')?.to });
  }
  tips.push({ text: `Soy ${companion.name}, tu ${companion.noun} IA. Tócame el micrófono y di, por ejemplo, «abre la biblioteca» o «ir a la arena». Te llevo de una.` });
  return tips;
}

export function useCampusData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['campus'],
    queryFn: () => api<{ buildings: CampusCounts; pending: CampusPending; pulse: { lessonsToday: number; attemptsToday: number; online: number } }>('/api/campus'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
}

/** Phone home: the same buildings, counts and companion as the campus map, laid out as a vertical hub. */
export function MobileHub() {
  const { user } = useAuth();
  const companion = useCompanion();
  const navigate = useNavigate();
  const now = useClock();
  const phase = phaseOf(bogotaHour(now));
  const meta = phaseMeta[phase];
  const buildings = useMemo(() => buildingsFor(user?.role, companion.name), [user?.role, companion.name]);
  const data = useCampusData();
  const counts = data.data?.buildings ?? {};
  const details = data.data?.pending ?? {};
  const firstName = user?.fullName.split(' ')[0] ?? '';
  const tips = useMemo(() => tipsFor(user?.role, counts, buildings, firstName, phase, companion), [user?.role, counts, buildings, firstName, phase, companion]);
  const [tip, setTip] = useState(0);
  const current = tips[tip % tips.length]!;
  const speech = useSpeech();
  const pending = buildings.filter((b) => (counts[b.key] ?? 0) > 0);
  const PhaseIcon = meta.icon;

  return (
    <div className="hub">
      <section className={`hub-hero phase-${phase}`} style={{ background: meta.sky }}>
        <span className="campus-chip"><PhaseIcon size={14} /> {capitalize(now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }))}</span>
        <h1>{meta.greet}, {firstName}!</h1>
        <div className="hub-pulse">
          <span className="campus-chip live"><i /> {data.data?.pulse.online ?? 0} en línea</span>
          <span className="campus-chip">{data.data?.pulse.lessonsToday ?? 0} lecciones hoy</span>
        </div>
      </section>

      <section className="hub-companion">
        <button className="luka-btn" onClick={() => navigate('/app/tutor')} aria-label={`Hablar con ${companion.name}`}>
          <Luka mood={speech.speaking ? 'talking' : 'idle'} size={64} variant={companion.id} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="luka-name"><Sparkles size={13} /> {companion.name}</div>
          <p>{current.text}</p>
          <div className="luka-actions">
            {current.to && <button className="btn sm" onClick={() => navigate(current.to!)}>Ir ahora</button>}
            {speech.supported && (
              <button className="btn sm ghost" onClick={() => (speech.speaking ? speech.stop() : speech.speak(current.text))} aria-label="Leer en voz alta">
                {speech.speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
            <button className="btn sm ghost" onClick={() => setTip((t) => t + 1)} aria-label="Otro consejo"><BookMarked size={14} /></button>
          </div>
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="hub-title">Para hoy</h2>
          <div className="stack g-8">
            {pending.map((b) => (
              <div key={b.key} className="row-with-badge">
                <button className="hub-row" onClick={() => navigate(b.to)}>
                  <span className="campus-list-ico" style={{ background: b.color }}><b.icon size={20} strokeWidth={2.4} /></span>
                  <span className="campus-list-text"><b>{b.name}</b><small>{statusOf(b, counts[b.key])}</small></span>
                  <ChevronRight size={18} />
                </button>
                <PendingBadge building={b} count={counts[b.key] ?? 0} items={details[b.key] ?? []} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="hub-title">Edificios del campus</h2>
        <div className="hub-grid">
          {buildings.map((b) => (
            <button key={b.key} className="hub-tile" onClick={() => navigate(b.to)}>
              <span className="hub-tile-ico" style={{ background: b.color }}><b.icon size={22} strokeWidth={2.4} /></span>
              <b>{b.name}</b>
              <small>{statusOf(b, counts[b.key])}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CampusHome() {
  const { user } = useAuth();
  const companion = useCompanion();
  const navigate = useNavigate();
  const now = useClock();
  const [override, setOverride] = useState<Phase | null>(null);
  const autoPhase = phaseOf(bogotaHour(now));
  const phase = override ?? autoPhase;
  const meta = phaseMeta[phase];
  const buildings = useMemo(() => buildingsFor(user?.role, companion.name), [user?.role, companion.name]);
  const data = useCampusData();
  const counts = data.data?.buildings ?? {};
  const firstName = user?.fullName.split(' ')[0] ?? '';
  const tips = useMemo(() => tipsFor(user?.role, counts, buildings, firstName, phase, companion), [user?.role, counts, buildings, firstName, phase, companion]);
  const [tip, setTip] = useState(0);
  const current = tips[tip % tips.length]!;
  const speech = useSpeech();
  const [heard, setHeard] = useState<string | null>(null);

  const commands: (VoiceCommand & { say?: string })[] = useMemo(() => [
    ...buildings.map((b) => ({ label: b.name, say: `Vamos a ${b.name}`, phrases: b.voice, run: () => navigate(b.to) })),
    { label: 'Ajustes', say: 'Vamos a tus ajustes', phrases: ['ajustes', 'configuracion', 'acceso facial', 'rostro', 'mi cuenta'], run: () => navigate('/app/ajustes') },
    { label: 'Siguiente consejo', phrases: ['siguiente', 'otro consejo', 'que mas'], run: () => { setHeard(null); setTip((t) => t + 1); } },
    { label: 'Leer consejo', phrases: ['lee', 'leer', 'repite', 'que dijiste'], run: () => { setHeard(null); speech.speak(current.text); } },
  ], [buildings, navigate, speech, current.text]);

  const mic = useDictation((text) => {
    const command = matchCommand(text, commands) as ((typeof commands)[number] | null);
    if (command) {
      setHeard(`«${text}» → ${command.label}`);
      if (command.say) speech.speak(command.say);
      window.setTimeout(() => command.run(), command.say ? 700 : 0);
    } else {
      setHeard(`«${text}» — no reconocí ese lugar. Prueba «abre la biblioteca».`);
    }
  });

  const mood = mic.listening ? 'listening' : speech.speaking ? 'talking' : 'idle';
  const cycle: Phase[] = ['dawn', 'day', 'dusk', 'night'];
  const PhaseIcon = meta.icon;
  const time = now.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });

  return (
    <section className={`campus phase-${phase}`} style={{ background: meta.sky }}>
      <div className="campus-sky" aria-hidden>
        {phase === 'night' ? (
          <>
            {Array.from({ length: 40 }, (_, i) => <span key={i} className="campus-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 46}%`, animationDelay: `${(i % 7) * 0.4}s` }} />)}
            <span className="campus-moon" />
          </>
        ) : (
          <>
            <span className={`campus-sun ${phase}`} />
            <span className="campus-cloud c1" />
            <span className="campus-cloud c2" />
            <span className="campus-cloud c3" />
          </>
        )}
      </div>

      <header className="campus-head">
        <div>
          <span className="campus-chip">{capitalize(now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }))}</span>
          <h1>{meta.greet}, {firstName}!</h1>
          <p>Bienvenido al campus del Colegio Francisco Arango. Toca un edificio para entrar.</p>
        </div>
        <div className="campus-hud">
          <span className="campus-chip live"><i /> {data.data?.pulse.online ?? 0} en línea</span>
          <span className="campus-chip">{data.data?.pulse.lessonsToday ?? 0} lecciones hoy</span>
          <span className="campus-chip">{data.data?.pulse.attemptsToday ?? 0} intentos hoy</span>
          <button className="campus-chip btnish" title="Ver el campus en otro momento del día" onClick={() => setOverride((o) => (o === 'night' ? null : cycle[o === null ? 0 : cycle.indexOf(o) + 1]!))}>
            <PhaseIcon size={14} /> {time} · {meta.label}{override ? ' (vista previa)' : ''}
          </button>
        </div>
      </header>

      <div className="campus-map">
        <IsoCampus buildings={buildings} counts={counts} pending={data.data?.pending} phase={phase} onPick={(b, source) => enterBuilding(navigate, b.to, source)} />
      </div>

      <ul className="campus-list">
        {buildings.map((b, i) => (
          <motion.li key={b.key} className="row-with-badge" initial={{ opacity: 0, x: i % 2 ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <button className="campus-go" onClick={() => enterBuilding(navigate, b.to, document.querySelector(`[data-mini="${b.key}"] .mini-art`))}>
              <span className="campus-list-ico" style={{ background: b.color }}><b.icon size={22} strokeWidth={2.4} /></span>
              <span className="campus-list-text">
                <b>{b.name}</b>
                <small>{statusOf(b, counts[b.key])}</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <PendingBadge building={b} count={counts[b.key] ?? 0} items={data.data?.pending?.[b.key] ?? []} />
          </motion.li>
        ))}
      </ul>

      <div className="campus-luka">
        <button className="luka-btn" onClick={() => navigate('/app/tutor')} title={`Hablar con ${companion.name} en el Laboratorio IA`}><Luka mood={mood} variant={companion.id} /></button>
        <AnimatePresence mode="wait">
          <motion.div key={tip + (heard ?? '')} className="luka-bubble" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}>
            <div className="luka-name"><Sparkles size={13} /> {companion.name} · tu {companion.noun} IA</div>
            <p>{mic.listening ? (mic.interim || 'Te escucho…') : heard ?? current.text}</p>
            {mic.error && <p className="err" style={{ fontSize: 12.5 }}>{mic.error}</p>}
            <div className="luka-actions">
              {current.to && !heard && <button className="btn sm" onClick={() => navigate(current.to!)}>Ir ahora</button>}
              {speech.supported && (
                <button className="btn sm ghost" onClick={() => (speech.speaking ? speech.stop() : speech.speak(heard ?? current.text))} title="Leer en voz alta">
                  {speech.speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              )}
              {mic.supported && (
                <button className={`btn sm ${mic.listening ? '' : 'ghost'}`} onClick={() => { setHeard(null); mic.toggle(); }} title="Comando de voz">
                  {mic.listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              )}
              <button className="btn sm ghost" onClick={() => { setHeard(null); setTip((t) => t + 1); }} title="Otro consejo"><BookMarked size={14} /></button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
