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
import type { Role } from '@eduquest/contracts';
import { api } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { matchCommand, useDictation, useSpeech, type VoiceCommand } from '@/shared/voice';
import { useCompanion, type Companion, type CompanionId } from '@/shared/companion';
import { campusFor, ROAD, roofTop, type Building, type BuildingKey, type CampusLayout } from '@/shared/buildings';
import { BuildingShape, iso, mix, pts, type Paint } from '@/ui/iso';
import { campusView, Roads } from '@/ui/campus-mini';
import { enterBuilding } from '@/shared/enter';
import { openGuide } from '@/shared/guide';

export { buildingsFor, campusFor, type BuildingKey } from '@/shared/buildings';

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

/* ---------- Isometric campus ---------- */

/** Fixed silhouette covering the building at rest and lifted, so hovering never moves the target out from under the cursor. */
function hitArea(b: Building): [number, number][] {
  const top = roofTop(b) + 0.35;
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

/** Pauses SVG and CSS animations while the map is off screen, so they never compete with scrolling. */
function useOffscreenPause(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting);
      el.classList.toggle('paused', !visible);
      const svg = el.querySelector('svg');
      if (svg) visible ? svg.unpauseAnimations() : svg.pauseAnimations();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

export function IsoCampus({ layout, counts, pending, phase, interactive = true, onPick }: {
  layout: CampusLayout;
  counts?: CampusCounts;
  pending?: CampusPending;
  phase: Phase;
  interactive?: boolean;
  onPick?: (b: Building, source: Element | null) => void;
}) {
  const [hover, setHover] = useState<BuildingKey | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { buildings, gx, gy, plaza: square } = layout;
  const VIEW = useMemo(() => campusView(layout, 34), [layout]);
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
  }, [VIEW.w]);
  useOffscreenPause(wrap);
  const paint: Paint = useMemo(() => ({ tone: toner(phase), night: phase === 'night' }), [phase]);
  const night = phase === 'night';

  const grass = paint.tone('#86dc8f');
  const stone = paint.tone('#efe6d2');
  const sideA = paint.tone('#c2925e');
  const sideB = paint.tone('#9a6d42');
  const P = (x: number, y: number) => iso(x, y, 0);

  const renderBuilding = (b: Building, index: number) => {
    const active = hover === b.key;
    return (
      <g
        key={b.key}
        className={`iso-b${interactive ? ' live' : ''}${active ? ' on' : ''}`}
        data-building={b.key}
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
  layout.trees.forEach(([x, y, k]) => items.push({ depth: x + y, node: <Tree key={`t${x}-${y}`} x={x} y={y} kind={k} paint={paint} /> }));
  layout.lamps.forEach(([x, y]) => items.push({ depth: x + y, node: <Lamp key={`l${x}-${y}`} x={x} y={y} paint={paint} /> }));
  const scenery = items.sort((a, b) => a.depth - b.depth).map((item) => item.node);

  // Students walk on the street ring around the plaza.
  const r0x = square.x - ROAD / 2;
  const r0y = square.y - ROAD / 2;
  const r1x = square.x + square.size + ROAD / 2;
  const r1y = square.y + square.size + ROAD / 2;
  const walkLoop = [P(r0x, r0y), P(r1x, r0y), P(r1x, r1y), P(r0x, r1y)];
  const loopD = `M${walkLoop.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L')} Z`;
  const walkers = ['#ff5d73', '#7c5cff', '#ffc83d', '#19c39c', '#3ab8ff'];
  const [fx, fy] = P(square.x + square.size / 2, square.y + square.size / 2);
  const inset = 0.45;

  return (
    <div className="iso-wrap" ref={wrap} style={{ '--iso-scale': scale } as CSSProperties}>
      <svg className="iso-svg" viewBox={`${VIEW.x.toFixed(1)} ${VIEW.y.toFixed(1)} ${VIEW.w.toFixed(1)} ${VIEW.h.toFixed(1)}`} role="img" aria-label="Mapa del campus Ludoteka">
        <defs>
          <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="lampPool"><stop offset="0%" stopColor="#ffd66b" stopOpacity=".55" /><stop offset="100%" stopColor="#ffd66b" stopOpacity="0" /></radialGradient>
          <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={paint.tone('#7fd6ff')} /><stop offset="100%" stopColor={paint.tone('#3a9bff')} /></linearGradient>
        </defs>

        <polygon points={pts([P(0, gy), P(gx, gy), iso(gx, gy, -0.7), iso(0, gy, -0.7)])} fill={sideA} />
        <polygon points={pts([P(gx, 0), P(gx, gy), iso(gx, gy, -0.7), iso(gx, 0, -0.7)])} fill={sideB} />
        <polygon points={pts([iso(0, gy, -0.7), iso(gx, gy, -0.7), iso(gx, gy, -0.9), iso(0, gy, -0.9)])} fill={paint.tone('#7a5232')} />
        <polygon points={pts([iso(gx, 0, -0.7), iso(gx, gy, -0.7), iso(gx, gy, -0.9), iso(gx, 0, -0.9)])} fill={paint.tone('#5e3e25')} />
        <polygon points={pts([P(0, 0), P(gx, 0), P(gx, gy), P(0, gy)])} fill={grass} />
        <polygon points={pts([P(0, 0), P(gx, 0), P(gx, 0.12), P(0.12, 0.12), P(0.12, gy), P(0, gy)])} fill={paint.tone('#a6eaa9')} />

        <Roads layout={layout} fill={stone} />
        <polygon points={pts([P(square.x, square.y), P(square.x + square.size, square.y), P(square.x + square.size, square.y + square.size), P(square.x, square.y + square.size)])} fill={stone} />
        <polygon points={pts([P(square.x + inset, square.y + inset), P(square.x + square.size - inset, square.y + inset), P(square.x + square.size - inset, square.y + square.size - inset), P(square.x + inset, square.y + square.size - inset)])} fill="none" stroke={paint.tone('#d9ccb0')} strokeWidth={1.2} strokeDasharray="4 6" />
        <path d={loopD} fill="none" stroke={paint.tone('#d9ccb0')} strokeWidth={1} strokeDasharray="3 7" />

        <g aria-hidden>
          <ellipse cx={fx} cy={fy} rx={40} ry={20} fill={paint.tone('#b9ab8e')} />
          <ellipse cx={fx} cy={fy - 2} rx={35} ry={17} fill="url(#water)" />
          <rect x={fx - 4} y={fy - 22} width={8} height={20} rx={3} fill={paint.tone('#d9ccb0')} />
          <ellipse cx={fx} cy={fy - 22} rx={12} ry={5} fill={paint.tone('#efe6d2')} />
          <ellipse className="iso-ripple" cx={fx - 10} cy={fy - 4} rx={8} ry={3} fill="none" stroke="#fff" strokeOpacity={0.6} />
        </g>

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
          const top = iso(b.x + b.w / 2, b.y + b.d / 2, roofTop(b) + 0.25);
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
  const add = (k: BuildingKey, text: string) => { if (by(k)) tips.push({ text, to: by(k)!.to }); };

  if (role === 'student') {
    if (n('aula')) add('aula', `${greet} Esta semana tienes ${plural(n('aula'), 'pendiente', 'pendientes')} en Mis cursos entre tareas y lecciones. ¿Arrancamos?`);
    if (n('envivo')) add('envivo', `Tu docente abrió ${plural(n('envivo'), 'una sala en vivo', 'salas en vivo')}. Entra con el código que proyecta en clase.`);
    if (n('arena')) add('arena', `¡Hay ${plural(n('arena'), 'sala abierta', 'salas abiertas')} en la Arena! Únete con tu equipo antes de que empiece.`);
    if (n('cuaderno')) add('cuaderno', `Tu Cuaderno tiene ${plural(n('cuaderno'), 'tarjeta', 'tarjetas')} para repasar hoy. Cinco minutos bastan.`);
    if (n('ruta')) add('ruta', `En Mi ruta te esperan ${plural(n('ruta'), 'reto', 'retos')} hechos a tu medida.`);
    if (n('trofeos')) add('trofeos', `Ganaste ${plural(n('trofeos'), 'insignia nueva', 'insignias nuevas')}. Pasa por la Sala de trofeos a verlas.`);
    if (n('biblioteca')) add('biblioteca', `La Biblioteca tiene ${plural(n('biblioteca'), 'recurso nuevo', 'recursos nuevos')} desde tu última visita.`);
    if (n('cartelera')) add('cartelera', `Hay ${plural(n('cartelera'), 'aviso nuevo', 'avisos nuevos')} en la Cartelera.`);
    if (!tips.length) add('arcade', `${greet} Estás al día. ¿Un reto rápido en el Arcade?`);
    add('tutor', `Si no entiendes un tema, pregúntame en el Laboratorio IA. Te explico paso a paso sin darte la respuesta de una.`);
  } else if (role === 'teacher') {
    add('aula', n('aula') ? `${greet} Tienes ${plural(n('aula'), 'entrega', 'entregas')} por calificar en Mis cursos.` : `${greet} No hay entregas pendientes. Buen momento para preparar una evaluación.`);
    add('envivo', 'En la Sala en vivo eliges una evaluación publicada, proyectas el código y avanzas pregunta por pregunta mientras ves quién respondió.');
    if (n('mensajes')) add('mensajes', `Tienes ${plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')} de familias o colegas.`);
    add('banco', 'Guarda tus preguntas en el Banco: luego las reutilizas en quices, exámenes y salas en vivo.');
    add('observatorio', 'En el Observatorio pregunta por tus cursos en lenguaje natural, por ejemplo: «¿quiénes no han entregado esta semana?».');
  } else if (role === 'coordinator') {
    add('alertas', n('alertas') ? `${greet} Hay ${plural(n('alertas'), 'alerta abierta', 'alertas abiertas')} esperando seguimiento.` : `${greet} No hay alertas abiertas. Revisa la asistencia consolidada de la semana.`);
    if (n('citaciones')) add('citaciones', `Tienes ${plural(n('citaciones'), 'citación próxima', 'citaciones próximas')} con acudientes.`);
    add('asistencia', 'En Asistencia ves qué estudiantes superan el umbral de faltas y puedes citar a su acudiente desde ahí.');
    if (n('mensajes')) add('mensajes', `Tienes ${plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')} de colegas.`);
  } else if (role === 'rector') {
    add('firmas', n('firmas') ? `${greet} Hay ${plural(n('firmas'), 'documento', 'documentos')} esperando tu firma.` : `${greet} No hay documentos por firmar.`);
    add('tablero', 'En el Tablero comparas los grupos del periodo y publicas comunicados oficiales.');
    if (n('mensajes')) add('mensajes', `Tienes ${plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')}.`);
    add('mensajes', 'Desde Mensajes puedes escribirle a cualquier docente o directivo; verás su nombre, su rol y lo que enseña.');
  } else if (role === 'guardian') {
    add('familia', n('familia') ? `${greet} Hay ${plural(n('familia'), 'novedad', 'novedades')} de tus hijos por atender.` : `${greet} En Mis hijos ves notas, asistencia, alertas y citaciones de cada uno.`);
    if (n('mensajes')) add('mensajes', `Tienes ${plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')} de los docentes.`);
    if (n('cartelera')) add('cartelera', `El colegio publicó ${plural(n('cartelera'), 'aviso', 'avisos')} que aún no lees.`);
  } else if (role === 'admin') {
    add('usuarios', n('usuarios') ? `${greet} Hay ${plural(n('usuarios'), 'solicitud de datos', 'solicitudes de datos')} por atender.` : `${greet} En Usuarios creas cuentas, cambias roles e importas listas.`);
    add('institucion', 'En Institución organizas grados, grupos, asignaturas y la carga de cada docente.');
    add('observatorio', 'Pregúntale al Observatorio cosas como «promedio por grado este periodo»: respondo con una consulta segura de solo lectura.');
  }
  tips.push({ text: `Soy ${companion.name}, tu ${companion.noun}. Tócame cuando quieras: te explico dónde estás y te llevo a donde necesites.` });
  return tips;
}

const ROLE_INTRO: Record<string, string> = {
  student: 'Tu campus del Colegio Francisco Arango: estudia, practica y juega.',
  teacher: 'Tu campus docente: cursos, notas, salas en vivo y comunicación con familias y colegas.',
  coordinator: 'Campus de coordinación: alertas, asistencia, citaciones y consolidado académico.',
  rector: 'Campus de rectoría: indicadores, firmas, reportes y comunicados oficiales.',
  guardian: 'Campus de familia: el avance de tus hijos y la comunicación con el colegio.',
  admin: 'Campus de administración: cuentas, roles y estructura del colegio.',
};

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
  const buildings = useMemo(() => campusFor(user?.role, companion.name).buildings, [user?.role, companion.name]);
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
          {user?.role !== 'guardian' && <span className="campus-chip live"><i /> {data.data?.pulse.online ?? 0} en línea</span>}
          {pulseFor(user?.role, data.data?.pulse, counts).slice(0, 1).map((text) => <span key={text} className="campus-chip">{text}</span>)}
        </div>
      </section>

      <section className="hub-companion">
        <button className="luka-btn" onClick={() => openGuide()} aria-label={`Abrir la guía de ${companion.name}`}>
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

type CampusPulse = { online: number; lessonsToday: number; attemptsToday: number };

/** What each role cares about at a glance; classroom activity only means something to students and teachers. */
function pulseFor(role: Role | undefined, pulse: CampusPulse | undefined, counts: Partial<Record<BuildingKey, number>>): string[] {
  const n = (k: BuildingKey) => counts[k] ?? 0;
  const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
  switch (role) {
    case 'student':
    case 'teacher':
      return [plural(pulse?.lessonsToday ?? 0, 'lección hoy', 'lecciones hoy'), plural(pulse?.attemptsToday ?? 0, 'intento hoy', 'intentos hoy')];
    case 'coordinator':
      return [plural(n('alertas'), 'alerta abierta', 'alertas abiertas'), plural(n('citaciones'), 'citación esta semana', 'citaciones esta semana')];
    case 'rector':
      return [plural(n('firmas'), 'documento por firmar', 'documentos por firmar'), plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')];
    case 'guardian':
      return [plural(n('familia'), 'asunto por atender', 'asuntos por atender'), plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')];
    case 'admin':
      return [plural(n('usuarios'), 'solicitud de datos', 'solicitudes de datos'), plural(n('mensajes'), 'mensaje sin leer', 'mensajes sin leer')];
    default:
      return [];
  }
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
  const layout = useMemo(() => campusFor(user?.role, companion.name), [user?.role, companion.name]);
  const buildings = layout.buildings;
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
          <p>{ROLE_INTRO[user?.role ?? 'student']} Toca un edificio para entrar.</p>
        </div>
        <div className="campus-hud">
          {user?.role !== 'guardian' && <span className="campus-chip live"><i /> {data.data?.pulse.online ?? 0} en línea</span>}
          {pulseFor(user?.role, data.data?.pulse, counts).map((text) => <span key={text} className="campus-chip">{text}</span>)}
          <button className="campus-chip btnish" title="Ver el campus en otro momento del día" onClick={() => setOverride((o) => (o === 'night' ? null : cycle[o === null ? 0 : cycle.indexOf(o) + 1]!))}>
            <PhaseIcon size={14} /> {time} · {meta.label}{override ? ' (vista previa)' : ''}
          </button>
        </div>
      </header>

      <div className="campus-map">
        <IsoCampus layout={layout} counts={counts} pending={data.data?.pending} phase={phase} onPick={(b, source) => enterBuilding(navigate, b.to, source)} />
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
        <button className="luka-btn" onClick={() => openGuide('tour')} title={`Recorrido del campus con ${companion.name}`}><Luka mood={mood} variant={companion.id} /></button>
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
