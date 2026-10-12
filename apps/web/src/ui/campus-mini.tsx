import { type KeyboardEvent, type MouseEvent } from 'react';
import { MapPin } from 'lucide-react';
import { G, type Building, type BuildingKey } from '@/shared/buildings';
import { BuildingShape, iso, mix, pts, type Paint, type Pt } from './iso';

const nightPaint: Paint = { tone: (hex) => mix(hex, '#1a1650', 0.42), night: true, glow: false };
const dayPaint: Paint = { tone: (hex) => hex, night: false, glow: false };
const paintFor = (dark: boolean) => (dark ? nightPaint : dayPaint);

/** Grass slab under a footprint, with its two visible sides. */
function Slab({ x0, y0, x1, y1, paint }: { x0: number; y0: number; x1: number; y1: number; paint: Paint }) {
  const depth = -0.45;
  return (
    <g>
      <polygon points={pts([iso(x0, y1), iso(x1, y1), iso(x1, y1, depth), iso(x0, y1, depth)])} fill={paint.tone('#c2925e')} />
      <polygon points={pts([iso(x1, y0), iso(x1, y1), iso(x1, y1, depth), iso(x1, y0, depth)])} fill={paint.tone('#9a6d42')} />
      <polygon points={pts([iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)])} fill={paint.tone('#86dc8f')} />
    </g>
  );
}

/** One building from the campus, drawn alone on its plot. The facade uses it as its illustration. */
export function BuildingArt({ building, dark, className }: { building: Building; dark: boolean; className?: string }) {
  const paint = paintFor(dark);
  const { x, y, w, d, h } = building;
  const m = 0.55;
  const corners: Pt[] = [iso(x - m, y - m), iso(x + w + m, y - m), iso(x + w + m, y + d + m), iso(x - m, y + d + m)];
  const top = iso(x + w / 2, y + d / 2, h + (building.shape === 'stadium' ? 1.4 : 2.6));
  const xs = corners.map((p) => p[0]);
  const minX = Math.min(...xs) - 6;
  const maxX = Math.max(...xs) + 6;
  const minY = Math.min(top[1], ...corners.map((p) => p[1] - h * 34 - 30)) - 4;
  const maxY = Math.max(...corners.map((p) => p[1])) + 0.45 * 34 + 4;
  return (
    <svg className={className} viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`} aria-hidden="true" focusable="false">
      <Slab x0={x - m} y0={y - m} x1={x + w + m} y1={y + d + m} paint={paint} />
      <BuildingShape b={building} paint={paint} seed={7} />
    </svg>
  );
}

const MINI_VIEW = { x: -430, y: -96, w: 860, h: 600 };

/**
 * The campus at sidebar size: same buildings, colors and places as the home map, with a pin on the building
 * of the current page (on the plaza at home). Each building is a way in.
 */
export function MiniCampus({ buildings, current, dark, onEnter }: {
  buildings: Building[];
  current: BuildingKey | null;
  dark: boolean;
  onEnter: (building: Building, source: SVGGElement) => void;
}) {
  const paint = paintFor(dark);
  const here = buildings.find((b) => b.key === current) ?? null;
  const sorted = [...buildings].sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2));
  const plaza = paint.tone('#efe6d2');
  const pin = here ? iso(here.x + here.w / 2, here.y + here.d / 2, here.h + (here.shape === 'stadium' ? 1.1 : 2.2)) : iso(6.9, 10.2, 0.1);

  const enter = (b: Building) => (event: MouseEvent<SVGGElement> | KeyboardEvent<SVGGElement>) => {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const art = event.currentTarget.querySelector<SVGGElement>('.mini-art') ?? event.currentTarget;
    onEnter(b, art);
  };

  return (
    <nav className="mini-campus" aria-label="Mapa del campus">
      <svg viewBox={`${MINI_VIEW.x} ${MINI_VIEW.y} ${MINI_VIEW.w} ${MINI_VIEW.h}`} role="group" aria-label="Edificios del campus">
        <Slab x0={0} y0={0} x1={G} y1={G} paint={paint} />
        <polygon points={pts([iso(0, 6.5), iso(G, 6.5), iso(G, 7.3), iso(0, 7.3)])} fill={plaza} />
        <polygon points={pts([iso(6.5, 0), iso(7.3, 0), iso(7.3, G), iso(6.5, G)])} fill={plaza} />
        {sorted.map((b) => (
          <g
            key={b.key}
            className={`mini-b${b.key === current ? ' here' : ''}`}
            data-mini={b.key}
            role="link"
            tabIndex={0}
            aria-label={`Entrar a ${b.name}`}
            aria-current={b.key === current ? 'location' : undefined}
            onClick={enter(b)}
            onKeyDown={enter(b)}
          >
            <polygon className="mini-pad" points={pts([iso(b.x - 0.3, b.y - 0.3), iso(b.x + b.w + 0.3, b.y - 0.3), iso(b.x + b.w + 0.3, b.y + b.d + 0.3), iso(b.x - 0.3, b.y + b.d + 0.3)])} />
            <g className="mini-art"><BuildingShape b={b} paint={paint} seed={3} /></g>
          </g>
        ))}
        <g className="mini-pin" transform={`translate(${pin[0].toFixed(1)} ${pin[1].toFixed(1)})`} aria-hidden="true">
          <g className="mini-pin-bob">
            <ellipse cx={0} cy={here ? 0 : 2} rx={16} ry={7} fill="rgba(0,0,0,.18)" />
            <path d="M0,-6 C-14,-26 -24,-38 -24,-52 a24,24 0 1 1 48,0 C24,-38 14,-26 0,-6 Z" fill="#5b3df5" stroke="#fff" strokeWidth={5} />
            <circle cx={0} cy={-52} r={9} fill="#fff" />
          </g>
        </g>
      </svg>
      <p className="mini-here"><MapPin size={14} aria-hidden="true" /> Estás en {here ? <b>{here.name}</b> : <b>la plaza</b>}</p>
    </nav>
  );
}
