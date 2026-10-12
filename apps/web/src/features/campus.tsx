import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookMarked,
  BrainCircuit,
  ChevronRight,
  ClipboardList,
  Compass,
  Database,
  Library,
  Megaphone,
  Mic,
  MicOff,
  Moon,
  NotebookPen,
  School,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { matchCommand, useDictation, useSpeech, type VoiceCommand } from '@/shared/voice';
import { useCompanion, type Companion, type CompanionId } from '@/shared/companion';

/* ---------- Isometric geometry ---------- */

const T = 34;
const COS = 0.866;
type Pt = [number, number];
const iso = (x: number, y: number, z = 0): Pt => [(x - y) * T * COS, (x + y) * T * 0.5 - z * T];
const pts = (list: Pt[]) => list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
const shade = (hex: string, t: number) => (t >= 0 ? mix(hex, '#ffffff', t) : mix(hex, '#000000', -t));

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

/* ---------- Buildings ---------- */

export type BuildingKey = 'aula' | 'biblioteca' | 'lab' | 'arena' | 'trofeos' | 'cartelera' | 'cuaderno' | 'ruta';
type Shape = 'school' | 'library' | 'lab' | 'stadium' | 'hall' | 'board' | 'house' | 'tower';

interface Building {
  key: BuildingKey;
  name: string;
  caption: string;
  to: string;
  icon: LucideIcon;
  color: string;
  shape: Shape;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  voice: string[];
}

const G = 14;

const layout: Record<BuildingKey, Pick<Building, 'x' | 'y' | 'w' | 'd' | 'h' | 'shape' | 'color'>> = {
  biblioteca: { x: 1, y: 1, w: 2.5, d: 2.1, h: 1.8, shape: 'library', color: '#4f86f7' },
  lab: { x: 10.2, y: 1, w: 2.3, d: 2.3, h: 1.6, shape: 'lab', color: '#8b6cff' },
  cuaderno: { x: 1, y: 6.1, w: 1.8, d: 1.7, h: 1.2, shape: 'house', color: '#19c39c' },
  aula: { x: 5.6, y: 5.5, w: 2.6, d: 2.6, h: 2.2, shape: 'school', color: '#ff8a5c' },
  ruta: { x: 11.4, y: 6.3, w: 1, d: 1, h: 2.1, shape: 'tower', color: '#3ab8ff' },
  trofeos: { x: 1.2, y: 10.6, w: 2, d: 1.9, h: 1.4, shape: 'hall', color: '#ffc83d' },
  cartelera: { x: 6, y: 12.1, w: 1.9, d: 0.18, h: 1.1, shape: 'board', color: '#ff5d73' },
  arena: { x: 9.9, y: 9.9, w: 3, d: 3, h: 0.7, shape: 'stadium', color: '#ff5d73' },
};

export function buildingsFor(role: string | undefined, companionName = 'Luka'): Building[] {
  const student = role === 'student';
  const guardian = role === 'guardian';
  const rector = role === 'admin' || role === 'rector';
  const coordinator = role === 'coordinator';
  const list: Omit<Building, keyof (typeof layout)[BuildingKey]>[] = [
    { key: 'aula', name: guardian ? 'Familia' : 'Aula', caption: student ? 'lecciones pendientes' : role === 'teacher' ? 'entregas por calificar' : guardian ? 'acudidos' : 'cursos activos', to: guardian ? '/app/acudiente' : '/app/cursos', icon: School, voice: ['aula', 'cursos', 'mis cursos', 'clases', 'seguimiento'] },
    { key: 'biblioteca', name: 'Biblioteca', caption: 'recursos publicados', to: '/app/biblioteca', icon: Library, voice: ['biblioteca', 'libros', 'recursos', 'documentos'] },
    { key: 'lab', name: 'Laboratorio IA', caption: `consultas a ${companionName} hoy`, to: '/app/tutor', icon: BrainCircuit, voice: ['laboratorio', 'tutor', 'inteligencia artificial', 'luka', 'luna', 'preguntar'] },
    { key: 'arena', name: 'Arena', caption: 'salas en vivo', to: '/app/arena', icon: Swords, voice: ['arena', 'competencia', 'equipos', 'en vivo', 'jugar en equipo'] },
    {
      key: 'trofeos',
      name: student ? 'Sala de trofeos' : 'Certificados',
      caption: student ? 'insignias ganadas' : 'certificados emitidos',
      to: student ? '/app/logros' : rector ? '/app/rectoria' : '/app/cursos',
      icon: Trophy,
      voice: ['trofeos', 'logros', 'insignias', 'certificados'],
    },
    { key: 'cartelera', name: 'Cartelera', caption: 'avisos sin leer', to: '/app/novedades', icon: Megaphone, voice: ['cartelera', 'novedades', 'noticias', 'avisos', 'anuncios', 'foros'] },
    student || guardian
      ? { key: 'cuaderno', name: 'Cuaderno', caption: 'tarjetas para repasar hoy', to: '/app/cuaderno', icon: NotebookPen, voice: ['cuaderno', 'apuntes', 'notas', 'flashcards', 'tarjetas', 'repasar'] }
      : coordinator
        ? { key: 'cuaderno', name: 'Coordinación', caption: 'alertas y citaciones', to: '/app/coordinacion', icon: ClipboardList, voice: ['coordinacion', 'seguimiento', 'alertas', 'citaciones', 'asistencia'] }
        : role === 'rector'
          ? { key: 'cuaderno', name: 'Rectoría', caption: 'tablero y firmas', to: '/app/rectoria', icon: ClipboardList, voice: ['rectoria', 'tablero', 'firmas', 'indicadores'] }
          : { key: 'cuaderno', name: 'Taller docente', caption: 'banco y calificaciones', to: '/app/banco', icon: ClipboardList, voice: ['taller', 'banco', 'preguntas', 'calificaciones'] },
    student
      ? { key: 'ruta', name: 'Mi ruta', caption: 'retos pendientes', to: '/app/ruta', icon: Compass, voice: ['mi ruta', 'ruta', 'retos', 'ejercicios', 'practicar'] }
      : { key: 'ruta', name: 'Observatorio', caption: 'pregúntale a los datos', to: '/app/consultas', icon: Database, voice: ['observatorio', 'consultas', 'datos', 'estadisticas'] },
  ];
  return list.map((item) => ({ ...item, ...layout[item.key] })).filter((b) => !(guardian && (b.key === 'arena' || b.key === 'ruta')));
}

/* ---------- SVG primitives ---------- */

interface Paint { tone: (hex: string) => string; night: boolean }

function Box({ x, y, z = 0, w, d, h, color, paint }: { x: number; y: number; z?: number; w: number; d: number; h: number; color: string; paint: Paint }) {
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

function Windows({ x, y, w, d, h, z = 0, paint, seed, door = true }: { x: number; y: number; w: number; d: number; h: number; z?: number; paint: Paint; seed: number; door?: boolean }) {
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
            filter={paint.night && on ? 'url(#glow)' : undefined}
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
      {door && <polygon points={pts([iso(dx, y + d, z), iso(dx + 0.56, y + d, z), iso(dx + 0.56, y + d, z + 0.82), iso(dx, y + d, z + 0.82)])} fill={paint.night ? '#ffb347' : '#5a3a2a'} filter={paint.night ? 'url(#glow)' : undefined} />}
    </g>
  );
}

function PyramidRoof({ x, y, w, d, z, rh, color, paint }: { x: number; y: number; w: number; d: number; z: number; rh: number; color: string; paint: Paint }) {
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

function GableRoof({ x, y, w, d, z, rh, color, paint }: { x: number; y: number; w: number; d: number; z: number; rh: number; color: string; paint: Paint }) {
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

function Dome({ cx, cy, z, r, color, paint }: { cx: number; cy: number; z: number; r: number; color: string; paint: Paint }) {
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

function Stadium({ b, paint }: { b: Building; paint: Paint }) {
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
          <rect x={ex + s * rx * 0.95 - 9} y={ty - 36} width={18} height={8} rx={2} fill={paint.night ? '#fff7d1' : '#e9e6ff'} filter={paint.night ? 'url(#glow)' : undefined} />
        </g>
      ))}
    </g>
  );
}

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const p: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return <polygon points={pts(p)} fill={fill} stroke="#fff" strokeWidth={1.5} />;
}

function Flag({ at, color }: { at: Pt; color: string }) {
  const [x, y] = at;
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 26} stroke="#3d3a5c" strokeWidth={2} />
      <path className="iso-flag" d={`M${x},${y - 26} q8,-3 16,1 t16,-1 v10 q-8,3 -16,-1 t-16,1 z`} fill={color} />
    </g>
  );
}

function BuildingShape({ b, paint, seed }: { b: Building; paint: Paint; seed: number }) {
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
          <polygon points={face(0.1, w - 0.1, 0.7, 0.6 + h - 0.1)} fill={paint.night ? '#fff7d1' : '#ffffff'} filter={paint.night ? 'url(#glow)' : undefined} />
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

export function IsoCampus({ buildings, counts, phase, interactive = true, onPick }: {
  buildings: Building[];
  counts?: Partial<Record<BuildingKey, number>>;
  phase: Phase;
  interactive?: boolean;
  onPick?: (b: Building) => void;
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
        aria-label={interactive ? `${b.name}: ${counts?.[b.key] ?? 0} ${b.caption}` : undefined}
        onMouseEnter={() => interactive && setHover(b.key)}
        onMouseLeave={() => interactive && setHover(null)}
        onFocus={() => interactive && setHover(b.key)}
        onBlur={() => interactive && setHover(null)}
        onClick={() => interactive && onPick?.(b)}
        onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick?.(b); } }}
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
      <div className="iso-labels" aria-hidden>
        {buildings.map((b) => {
          const top = b.shape === 'stadium' ? iso(b.x + b.w / 2, b.y + b.d / 2, b.h + 1.6) : iso(b.x + b.w / 2, b.y + b.d / 2, b.h + (b.shape === 'board' ? 1.6 : b.shape === 'school' ? 1.85 : b.shape === 'tower' ? 1.9 : 1.4));
          const n = counts?.[b.key] ?? 0;
          const active = hover === b.key;
          return (
            <div key={`lbl-${b.key}`} className="iso-tag" style={{ left: `${((top[0] - VIEW.x) / VIEW.w) * 100}%`, top: `${((top[1] - VIEW.y) / VIEW.h) * 100}%` }}>
              <div className={`iso-label${active ? ' on' : ''}${night ? ' night' : ''}`}>
                <span className="iso-label-ico" style={{ background: b.color }}><b.icon size={13} strokeWidth={2.6} /></span>
                <span className="iso-label-name">{b.name}</span>
                {counts && n > 0 && <span className="iso-count">{n > 99 ? '99+' : n}</span>}
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
    if (n('aula')) tips.push({ text: `${greet} Tienes ${plural(n('aula'), 'lección pendiente', 'lecciones pendientes')} en el Aula. ¿Arrancamos con la siguiente?`, to: by('aula')?.to });
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
    queryFn: () => api<{ buildings: Partial<Record<BuildingKey, number>>; pulse: { lessonsToday: number; attemptsToday: number; online: number } }>('/api/campus'),
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
              <button key={b.key} className="hub-row" onClick={() => navigate(b.to)}>
                <span className="campus-list-ico" style={{ background: b.color }}><b.icon size={20} strokeWidth={2.4} /></span>
                <span className="campus-list-text"><b>{b.name}</b><small>{counts[b.key]} {b.caption}</small></span>
                <span className="iso-count">{counts[b.key]}</span>
                <ChevronRight size={18} />
              </button>
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
              <small>{counts[b.key] ?? 0} {b.caption}</small>
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
        <IsoCampus buildings={buildings} counts={counts} phase={phase} onPick={(b) => navigate(b.to)} />
      </div>

      <ul className="campus-list">
        {buildings.map((b, i) => (
          <motion.li key={b.key} initial={{ opacity: 0, x: i % 2 ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <button onClick={() => navigate(b.to)}>
              <span className="campus-list-ico" style={{ background: b.color }}><b.icon size={22} strokeWidth={2.4} /></span>
              <span className="campus-list-text">
                <b>{b.name}</b>
                <small>{counts[b.key] ?? 0} {b.caption}</small>
              </span>
              {(counts[b.key] ?? 0) > 0 && <span className="iso-count">{counts[b.key]}</span>}
              <ChevronRight size={18} />
            </button>
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
