import type { ReactNode } from 'react';
import type { Building } from '@/shared/buildings';

/* ---------- Isometric geometry ---------- */

export const T = 34;
export const COS = 0.866;
export type Pt = [number, number];
export const iso = (x: number, y: number, z = 0): Pt => [(x - y) * T * COS, (x + y) * T * 0.5 - z * T];
export const pts = (list: Pt[]) => list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
export const shade = (hex: string, t: number) => (t >= 0 ? mix(hex, '#ffffff', t) : mix(hex, '#000000', -t));

/* ---------- SVG primitives ---------- */

/** `glow: false` keeps the night colors without the blur filter, which is costly when repeated on every window of small drawings. */
export interface Paint { tone: (hex: string) => string; night: boolean; glow?: false }

const glowOf = (paint: Paint) => (paint.glow === false ? undefined : 'url(#glow)');

export function Box({ x, y, z = 0, w, d, h, color, paint }: { x: number; y: number; z?: number; w: number; d: number; h: number; color: string; paint: Paint }) {
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  return (
    <g>
      <polygon points={pts(left)} fill={paint.tone(shade(color, -0.04))} />
      <polygon points={pts(right)} fill={paint.tone(shade(color, -0.26))} />
      <polygon points={pts(top)} fill={paint.tone(shade(color, 0.22))} />
    </g>
  );
}

function windowsLit(seed: number) {
  return (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280 > 0.22;
}

export function Windows({ x, y, w, d, h, z = 0, paint, seed, door = true }: { x: number; y: number; w: number; d: number; h: number; z?: number; paint: Paint; seed: number; door?: boolean }) {
  const lit = windowsLit(seed);
  const panes: ReactNode[] = [];
  const glass = paint.night ? '#ffd66b' : '#d8f0ff';
  const dark = paint.night ? '#2a2560' : '#9fc7e8';
  let i = 0;
  const rows = Math.max(1, Math.floor((h - 0.35) / 0.72));
  const front = (cols: number, span: number, place: (u: number, v: number) => Pt) => {
    const gap = span / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = c * gap + gap * 0.28;
        const v = z + 0.32 + r * 0.72;
        if (door && r === 0 && c === Math.floor(cols / 2) && place === leftFace) continue;
        const on = lit(i++);
        panes.push(
          <polygon
            key={`${i}`}
            points={pts([place(u, v), place(u + gap * 0.44, v), place(u + gap * 0.44, v + 0.4), place(u, v + 0.4)])}
            fill={on ? glass : dark}
            opacity={paint.night ? 1 : 0.92}
            filter={paint.night && on ? glowOf(paint) : undefined}
          />,
        );
      }
    }
  };
  const leftFace = (u: number, v: number) => iso(x + u, y + d, v);
  const rightFace = (u: number, v: number) => iso(x + w, y + u, v);
  front(Math.max(2, Math.round(w / 0.62)), w, leftFace);
  front(Math.max(2, Math.round(d / 0.62)), d, rightFace);
  const dx = x + w / 2 - 0.28;
  return (
    <g>
      {panes}
      {door && <polygon points={pts([iso(dx, y + d, z), iso(dx + 0.56, y + d, z), iso(dx + 0.56, y + d, z + 0.82), iso(dx, y + d, z + 0.82)])} fill={paint.night ? '#ffb347' : '#5a3a2a'} filter={paint.night ? glowOf(paint) : undefined} />}
    </g>
  );
}

export function PyramidRoof({ x, y, w, d, z, rh, color, paint }: { x: number; y: number; w: number; d: number; z: number; rh: number; color: string; paint: Paint }) {
  const apex = iso(x + w / 2, y + d / 2, z + rh);
  const A = iso(x - 0.12, y - 0.12, z);
  const B = iso(x + w + 0.12, y - 0.12, z);
  const C = iso(x + w + 0.12, y + d + 0.12, z);
  const D = iso(x - 0.12, y + d + 0.12, z);
  return (
    <g>
      <polygon points={pts([A, B, apex])} fill={paint.tone(shade(color, 0.1))} />
      <polygon points={pts([A, D, apex])} fill={paint.tone(shade(color, 0.2))} />
      <polygon points={pts([D, C, apex])} fill={paint.tone(color)} />
      <polygon points={pts([B, C, apex])} fill={paint.tone(shade(color, -0.25))} />
    </g>
  );
}

export function GableRoof({ x, y, w, d, z, rh, color, paint }: { x: number; y: number; w: number; d: number; z: number; rh: number; color: string; paint: Paint }) {
  const o = 0.14;
  const rl = iso(x - o, y + d / 2, z + rh);
  const rr = iso(x + w + o, y + d / 2, z + rh);
  return (
    <g>
      <polygon points={pts([iso(x - o, y - o, z), iso(x + w + o, y - o, z), rr, rl])} fill={paint.tone(shade(color, 0.12))} />
      <polygon points={pts([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d / 2, z + rh)])} fill={paint.tone(shade(color, -0.3))} />
      <polygon points={pts([iso(x - o, y + d + o, z), iso(x + w + o, y + d + o, z), rr, rl])} fill={paint.tone(color)} />
    </g>
  );
}

export function Dome({ cx, cy, z, r, color, paint }: { cx: number; cy: number; z: number; r: number; color: string; paint: Paint }) {
  const [ex, ey] = iso(cx, cy, z);
  const rx = r * T * COS * Math.SQRT2;
  const ry = (r * T * Math.SQRT2) / 2;
  const hz = r * T * 1.05;
  return (
    <g>
      <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill={paint.tone(shade(color, -0.3))} />
      <path d={`M${ex - rx},${ey} A${rx},${ry} 0 0 0 ${ex + rx},${ey} C${ex + rx},${ey - hz * 1.3} ${ex - rx},${ey - hz * 1.3} ${ex - rx},${ey} Z`} fill={paint.tone(color)} />
      <path d={`M${ex - rx * 0.55},${ey - hz * 0.35} C${ex - rx * 0.45},${ey - hz * 0.85} ${ex - rx * 0.05},${ey - hz * 0.98} ${ex + rx * 0.15},${ey - hz * 0.95}`} stroke="#fff" strokeOpacity={0.55} strokeWidth={3} fill="none" strokeLinecap="round" />
      <line x1={ex} y1={ey - hz * 0.98} x2={ex} y2={ey - hz * 1.35} stroke={paint.tone('#3d3a5c')} strokeWidth={2} />
      <circle cx={ex} cy={ey - hz * 1.38} r={3.2} fill="#ff5d73" className="iso-blink" />
    </g>
  );
}

export function Stadium({ b, paint }: { b: Building; paint: Paint }) {
  const r = b.w / 2;
  const [ex, ey] = iso(b.x + r, b.y + r, 0);
  const rx = r * T * COS * Math.SQRT2;
  const ry = (r * T * Math.SQRT2) / 2;
  const hz = b.h * T;
  const ty = ey - hz;
  return (
    <g>
      <path d={`M${ex - rx},${ey} A${rx},${ry} 0 0 0 ${ex + rx},${ey} L${ex + rx},${ty} A${rx},${ry} 0 0 1 ${ex - rx},${ty} Z`} fill={paint.tone(shade(b.color, -0.18))} />
      {[0.2, 0.4, 0.6, 0.8].map((t) => (
        <line key={t} x1={ex - rx + 2 * rx * t} y1={ty + Math.sin(Math.acos(1 - 2 * t)) * ry} x2={ex - rx + 2 * rx * t} y2={ey + Math.sin(Math.acos(1 - 2 * t)) * ry} stroke={paint.tone(shade(b.color, -0.35))} strokeWidth={1.5} />
      ))}
      <ellipse cx={ex} cy={ty} rx={rx} ry={ry} fill={paint.tone(shade(b.color, 0.25))} />
      <ellipse cx={ex} cy={ty} rx={rx * 0.86} ry={ry * 0.86} fill="none" stroke={paint.tone('#ffd66b')} strokeWidth={4} strokeDasharray="6 4" />
      <ellipse cx={ex} cy={ty + 3} rx={rx * 0.68} ry={ry * 0.68} fill={paint.tone('#3fbf6f')} />
      <ellipse cx={ex} cy={ty + 3} rx={rx * 0.2} ry={ry * 0.2} fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={1.5} />
      <line x1={ex - rx * 0.48} y1={ty + 3 - ry * 0.48} x2={ex + rx * 0.48} y2={ty + 3 + ry * 0.48} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.5} />
      {[-1, 1].map((s) => (
        <g key={s}>
          <line x1={ex + s * rx * 0.95} y1={ty} x2={ex + s * rx * 0.95} y2={ty - 30} stroke={paint.tone('#3d3a5c')} strokeWidth={2} />
          <rect x={ex + s * rx * 0.95 - 9} y={ty - 36} width={18} height={8} rx={2} fill={paint.night ? '#fff7d1' : '#e9e6ff'} filter={paint.night ? glowOf(paint) : undefined} />
        </g>
      ))}
    </g>
  );
}

export function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const p: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return <polygon points={pts(p)} fill={fill} stroke="#fff" strokeWidth={1.5} />;
}

export function Flag({ at, color }: { at: Pt; color: string }) {
  const [x, y] = at;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 26} stroke="#3d3a5c" strokeWidth={2} />
      <path className="iso-flag" d={`M${x},${y - 26} q8,-3 16,1 t16,-1 v10 q-8,3 -16,-1 t-16,1 z`} fill={color} />
    </g>
  );
}

export function BuildingShape({ b, paint, seed }: { b: Building; paint: Paint; seed: number }) {
  const { x, y, w, d, h, color } = b;
  switch (b.shape) {
    case 'school':
      return (
        <g>
          <Box x={x} y={y} w={w} d={d} h={h} color={color} paint={paint} />
          <Windows x={x} y={y} w={w} d={d} h={h} paint={paint} seed={seed} />
          <PyramidRoof x={x} y={y} w={w} d={d} z={h} rh={1.5} color="#e2464f" paint={paint} />
          {(() => {
            const [cx, cy] = iso(x + w / 2, y + d, h - 0.42);
            return (
              <g>
                <ellipse cx={cx} cy={cy} rx={9} ry={9} fill="#fff" stroke={paint.tone('#3d3a5c')} strokeWidth={2} />
                <line x1={cx} y1={cy} x2={cx} y2={cy - 6} stroke="#3d3a5c" strokeWidth={1.6} />
                <line x1={cx} y1={cy} x2={cx + 4} y2={cy + 2} stroke="#3d3a5c" strokeWidth={1.6} />
              </g>
            );
          })()}
          <Flag at={iso(x + w / 2, y + d / 2, h + 1.5)} color="#ffc83d" />
        </g>
      );
    case 'library': {
      const cols = [0.3, 0.9, 1.5, 2.1];
      return (
        <g>
          <Box x={x} y={y} w={w} d={d} h={h} color={color} paint={paint} />
          <Windows x={x} y={y} w={w} d={d} h={h} paint={paint} seed={seed} door={false} />
          <Box x={x - 0.1} y={y + d} w={w + 0.2} d={0.35} h={0.12} color="#e9e6ff" paint={paint} />
          {cols.map((u) => (
            <Box key={u} x={x + u} y={y + d + 0.08} w={0.16} d={0.16} h={h - 0.1} color="#ffffff" paint={paint} />
          ))}
          <GableRoof x={x - 0.1} y={y} w={w + 0.2} d={d + 0.5} z={h} rh={0.95} color="#2f5fc9" paint={paint} />
        </g>
      );
    }
    case 'lab':
      return (
        <g>
          <Box x={x} y={y} w={w} d={d} h={h} color={color} paint={paint} />
          <Windows x={x} y={y} w={w} d={d} h={h} paint={paint} seed={seed} />
          <Box x={x + 0.15} y={y + 0.15} w={w - 0.3} d={d - 0.3} z={h} h={0.12} color="#e9e6ff" paint={paint} />
          <Dome cx={x + w / 2} cy={y + d / 2} z={h + 0.12} r={0.85} color="#5be0c0" paint={paint} />
        </g>
      );
    case 'house':
      return (
        <g>
          <Box x={x} y={y} w={w} d={d} h={h} color={color} paint={paint} />
          <Windows x={x} y={y} w={w} d={d} h={h} paint={paint} seed={seed} />
          <GableRoof x={x} y={y} w={w} d={d} z={h} rh={0.85} color="#0f8f72" paint={paint} />
        </g>
      );
    case 'tower':
      return (
        <g>
          <Box x={x} y={y} w={w} d={d} h={h} color={color} paint={paint} />
          <Box x={x} y={y} w={w} d={d} z={h * 0.55} h={0.16} color="#ffffff" paint={paint} />
          <Windows x={x} y={y} w={w} d={d} h={h} paint={paint} seed={seed} />
          <Box x={x - 0.12} y={y - 0.12} w={w + 0.24} d={d + 0.24} z={h} h={0.14} color="#e9e6ff" paint={paint} />
          <PyramidRoof x={x} y={y} w={w} d={d} z={h + 0.14} rh={0.9} color="#1d6fd6" paint={paint} />
          <Flag at={iso(x + w / 2, y + d / 2, h + 1.04)} color="#19c39c" />
        </g>
      );
    case 'hall': {
      const [sx, sy] = iso(x + w / 2, y + d / 2, h + 0.9);
      return (
        <g>
          <Box x={x} y={y} w={w} d={d} h={h} color={color} paint={paint} />
          <Windows x={x} y={y} w={w} d={d} h={h} paint={paint} seed={seed} />
          <Box x={x - 0.08} y={y - 0.08} w={w + 0.16} d={d + 0.16} z={h} h={0.18} color="#fff1c2" paint={paint} />
          <Box x={x + w / 2 - 0.12} y={y + d / 2 - 0.12} w={0.24} d={0.24} z={h + 0.18} h={0.4} color="#cfa020" paint={paint} />
          <g className="iso-spin" style={{ transformOrigin: `${sx}px ${sy}px` }}>
            <Star x={sx} y={sy} r={13} fill={paint.night ? '#ffe27a' : '#ffc83d'} />
          </g>
        </g>
      );
    }
    case 'board': {
      const face = (u0: number, u1: number, v0: number, v1: number) => pts([iso(x + u0, y + d, v0), iso(x + u1, y + d, v0), iso(x + u1, y + d, v1), iso(x + u0, y + d, v1)]);
      return (
        <g>
          <Box x={x + 0.2} y={y} w={0.12} d={0.12} h={0.7} color="#5a3a2a" paint={paint} />
          <Box x={x + w - 0.32} y={y} w={0.12} d={0.12} h={0.7} color="#5a3a2a" paint={paint} />
          <Box x={x} y={y} z={0.6} w={w} d={d} h={h} color={color} paint={paint} />
          <polygon points={face(0.1, w - 0.1, 0.7, 0.6 + h - 0.1)} fill={paint.night ? '#fff7d1' : '#ffffff'} filter={paint.night ? glowOf(paint) : undefined} />
          <polygon points={face(0.2, 0.85, 1.3, 1.5)} fill="#7c5cff" />
          <polygon points={face(0.2, 1.6, 1.05, 1.15)} fill="#c9c3f3" />
          <polygon points={face(0.2, 1.3, 0.88, 0.98)} fill="#c9c3f3" />
          <polygon points={face(1.05, 1.65, 1.25, 1.55)} fill="#ffc83d" />
        </g>
      );
    }
    case 'stadium':
      return <Stadium b={b} paint={paint} />;
  }
}
