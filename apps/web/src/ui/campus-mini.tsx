import { type KeyboardEvent, type MouseEvent } from 'react';
import { MapPin } from 'lucide-react';
import { CELL, ROAD, roofTop, type Building, type BuildingKey, type CampusLayout } from '@/shared/buildings';
import { BuildingShape, iso, mix, pts, T, type Paint, type Pt } from './iso';

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

/** The street grid between cells, shared by the mini map and the big campus. */
export function Roads({ layout, fill }: { layout: CampusLayout; fill: string }) {
  const { gx, gy, cols, rows } = layout;
  const strips: Pt[][] = [];
  for (let r = 0; r <= rows; r++) strips.push([iso(0, r * CELL), iso(gx, r * CELL), iso(gx, r * CELL + ROAD), iso(0, r * CELL + ROAD)]);
  for (let c = 0; c <= cols; c++) strips.push([iso(c * CELL, 0), iso(c * CELL + ROAD, 0), iso(c * CELL + ROAD, gy), iso(c * CELL, gy)]);
  return <g>{strips.map((s, i) => <polygon key={i} points={pts(s)} fill={fill} />)}</g>;
}

/** One building from the campus, drawn alone on its plot. The facade uses it as its illustration. */
export function BuildingArt({ building, dark, className }: { building: Building; dark: boolean; className?: string }) {
  const paint = paintFor(dark);
  const { x, y, w, d, h } = building;
  const m = 0.55;
  const corners: Pt[] = [iso(x - m, y - m), iso(x + w + m, y - m), iso(x + w + m, y + d + m), iso(x - m, y + d + m)];
  const top = iso(x + w / 2, y + d / 2, roofTop(building) + 0.9);
  const xs = corners.map((p) => p[0]);
  const minX = Math.min(...xs) - 10;
  const maxX = Math.max(...xs) + 10;
  const minY = Math.min(top[1], ...corners.map((p) => p[1] - h * T - 30)) - 4;
  const maxY = Math.max(...corners.map((p) => p[1])) + 0.45 * T + 4;
  return (
    <svg className={className} viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`} aria-hidden="true" focusable="false">
      <Slab x0={x - m} y0={y - m} x1={x + w + m} y1={y + d + m} paint={paint} />
      <BuildingShape b={building} paint={paint} seed={7} />
    </svg>
  );
}

/** View box of a whole campus, with room above for the tallest roofs. */
export function campusView(layout: CampusLayout, pad = 24) {
  const left = iso(0, layout.gy)[0] - pad;
  const right = iso(layout.gx, 0)[0] + pad;
  const top = iso(0, 0, 4.8)[1] - pad;
  const bottom = iso(layout.gx, layout.gy, -0.9)[1] + pad;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * The role's campus at sidebar size: same buildings, colors and places as the home map, with a pin resting on
 * the roof of the building of the current page (on the plaza at home). Each building is a way in.
 */
export function MiniCampus({ layout, current, dark, onEnter }: {
  layout: CampusLayout;
  current: BuildingKey | null;
  dark: boolean;
  onEnter: (building: Building, source: SVGGElement) => void;
}) {
  const paint = paintFor(dark);
  const { buildings, gx, gy, plaza } = layout;
  const view = campusView(layout, 12);
  const here = buildings.find((b) => b.key === current) ?? null;
  const sorted = [...buildings].sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2));
  const stone = paint.tone('#efe6d2');
  const pin = here ? iso(here.x + here.w / 2, here.y + here.d / 2, roofTop(here) + 0.1) : iso(plaza.x + plaza.size / 2, plaza.y + plaza.size / 2, 0.1);
  // The pin keeps the same on-screen size whatever the size of the campus.
  const scale = (view.w / 860) * 0.95;

  const enter = (b: Building) => (event: MouseEvent<SVGGElement> | KeyboardEvent<SVGGElement>) => {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const art = event.currentTarget.querySelector<SVGGElement>('.mini-art') ?? event.currentTarget;
    onEnter(b, art);
  };

  return (
    <nav className="mini-campus" aria-label="Mapa del campus">
      <svg viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`} role="group" aria-label="Edificios del campus">
        <Slab x0={0} y0={0} x1={gx} y1={gy} paint={paint} />
        <Roads layout={layout} fill={stone} />
        <polygon points={pts([iso(plaza.x, plaza.y), iso(plaza.x + plaza.size, plaza.y), iso(plaza.x + plaza.size, plaza.y + plaza.size), iso(plaza.x, plaza.y + plaza.size)])} fill={stone} />
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
            <title>{b.name}</title>
            <polygon className="mini-pad" points={pts([iso(b.x - 0.35, b.y - 0.35), iso(b.x + b.w + 0.35, b.y - 0.35), iso(b.x + b.w + 0.35, b.y + b.d + 0.35), iso(b.x - 0.35, b.y + b.d + 0.35)])} />
            <g className="mini-art"><BuildingShape b={b} paint={paint} seed={3} /></g>
          </g>
        ))}
        <g className="mini-pin" transform={`translate(${pin[0].toFixed(1)} ${pin[1].toFixed(1)}) scale(${scale.toFixed(3)})`} aria-hidden="true">
          <g className="mini-pin-bob">
            <path d="M0,-4 C-14,-24 -24,-36 -24,-50 a24,24 0 1 1 48,0 C24,-36 14,-24 0,-4 Z" fill="#5b3df5" stroke="#fff" strokeWidth={5} />
            <circle cx={0} cy={-50} r={9} fill="#fff" />
          </g>
        </g>
      </svg>
      <p className="mini-here"><MapPin size={14} aria-hidden="true" /> Estás en {here ? <b>{here.name}</b> : <b>la plaza</b>}</p>
    </nav>
  );
}
