import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export type Tone = 'violet' | 'gold' | 'mint' | 'sky' | 'coral' | 'soft';

export const courseGradients = [
  'linear-gradient(135deg, #7c5cff 0%, #b24bf3 55%, #ff5d73 100%)',
  'linear-gradient(135deg, #3ab8ff 0%, #3a7bff 60%, #7c5cff 100%)',
  'linear-gradient(135deg, #19c39c 0%, #0ea5a4 60%, #3a7bff 100%)',
  'linear-gradient(135deg, #ffb13d 0%, #ff7a3d 55%, #ff5d73 100%)',
  'linear-gradient(135deg, #ff5d73 0%, #d9468f 55%, #7c5cff 100%)',
  'linear-gradient(135deg, #5b3df5 0%, #3a2a9f 60%, #140f2e 100%)',
];

export function pickGradient(seed: string | number) {
  const text = String(seed);
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return courseGradients[hash % courseGradients.length]!;
}

export function initials(name?: string) {
  if (!name) return 'EQ';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Reveal className="page-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row g-8 wrap">{actions}</div>}
    </Reveal>
  );
}

export function Tile({ icon: Icon, tone = 'violet', size = 20, large }: { icon: LucideIcon; tone?: Tone; size?: number; large?: boolean }) {
  return (
    <div className={`tile ${tone} ${large ? 'lg' : ''}`}>
      <Icon size={large ? size + 4 : size} strokeWidth={2.4} />
    </div>
  );
}

export function Stat({ icon, tone, value, label, extra }: { icon: LucideIcon; tone: Tone; value: ReactNode; label: string; extra?: ReactNode }) {
  return (
    <div className="card hover">
      <div className="stat">
        <Tile icon={icon} tone={tone} large />
        <div style={{ minWidth: 0 }}>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      </div>
      {extra && <div style={{ marginTop: 14 }}>{extra}</div>}
    </div>
  );
}

export function Bar({ value, tone, thin }: { value: number; tone?: 'gold' | 'mint'; thin?: boolean }) {
  return (
    <div className={`bar ${tone ?? ''} ${thin ? 'thin' : ''}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 12, children, color = 'url(#ringGrad)', track = 'rgba(255,255,255,.14)' }: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  color?: string;
  track?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="eq-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd66b" />
            <stop offset="100%" stopColor="#ff5d73" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, body }: { icon: LucideIcon; title: string; body?: string }) {
  return (
    <div className="empty">
      <Tile icon={icon} tone="soft" large />
      <div style={{ fontWeight: 800, color: 'var(--ink)' }}>{title}</div>
      {body && <p style={{ marginTop: 4, fontSize: 14 }}>{body}</p>}
    </div>
  );
}

export function Avatar({ name, large }: { name?: string; large?: boolean }) {
  return (
    <div className={`avatar ${large ? 'lg' : ''}`} style={{ background: pickGradient(name ?? 'x') }}>
      {initials(name)}
    </div>
  );
}

export function DateTile({ date }: { date: string | Date }) {
  const value = new Date(date);
  return (
    <div className="date-tile">
      <small>{value.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</small>
      <b>{value.getDate()}</b>
    </div>
  );
}
