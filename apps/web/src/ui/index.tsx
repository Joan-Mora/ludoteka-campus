import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode, type RefObject, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Moon, Sun, X, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/shared/theme';
import { useAuth } from '@/shared/auth';
import { useCompanion } from '@/shared/companion';
import { buildingForPath, buildingsFor } from '@/shared/buildings';
import { BuildingArt } from './campus-mini';

export function ThemeButton({ className = 'icon-btn', label }: { className?: string; label?: boolean }) {
  const { dark, toggleTheme } = useTheme();
  const text = dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  return (
    <button type="button" className={className} onClick={toggleTheme} title={text} aria-label={text}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {label && <span>{dark ? 'Tema claro' : 'Tema oscuro'}</span>}
    </button>
  );
}

/** Open sheets; the page scrolls again only when the last one closes, whatever the order they close in. */
let scrollLocks = 0;
function lockScroll() {
  scrollLocks += 1;
  document.body.style.overflow = 'hidden';
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (!scrollLocks) document.body.style.removeProperty('overflow');
  };
}

/** Bottom sheet for phones: slides up, closes on backdrop tap, Escape or the close button. */
export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title: string; children: ReactNode; full?: boolean }) {
  const drag = useDragControls();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current(); };
    const unlock = lockScroll();
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-layer">
          <motion.div className="sheet-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.section
            className={`sheet${full ? ' full' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
          >
            <div className="sheet-grip" aria-hidden onPointerDown={(event) => drag.start(event)} />
            <header className="sheet-head" onPointerDown={(event) => drag.start(event)}>
              <b>{title}</b>
              <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
            </header>
            <div className="sheet-body">{children}</div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

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

/** Inside a building the header is its facade (material, plate and drawing); elsewhere a plain title. */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const companion = useCompanion();
  const { dark } = useTheme();
  const building = useMemo(() => buildingForPath(pathname, buildingsFor(user?.role, companion.name)), [pathname, user?.role, companion.name]);

  if (!building) {
    return (
      <header className="page-head" data-at={pathname}>
        <div>
          {eyebrow && <div className="page-kicker">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="row g-8 wrap">{actions}</div>}
      </header>
    );
  }
  const Icon = building.icon;
  return (
    <header
      className={`page-head facade m-${building.material}`}
      data-at={pathname}
      data-building={building.key}
      style={{ '--b': building.color } as CSSProperties}
    >
      <div className="facade-text">
        <span className="placa">
          <Icon size={14} aria-hidden="true" />
          {building.name}
          {eyebrow && eyebrow !== building.name && <span className="placa-sub">· {eyebrow}</span>}
        </span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {actions && <div className="row g-8 wrap facade-actions">{actions}</div>}
      </div>
      <BuildingArt className="facade-art" building={building} dark={dark} />
    </header>
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

/** Grows downward with its content; Enter sends and Shift+Enter breaks the line when `onSend` is given. */
export function AutoTextarea({ onSend, inputRef, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { onSend?: () => void; inputRef?: RefObject<HTMLTextAreaElement | null> }) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? own;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      {...props}
      className={`auto-textarea ${className}`}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (onSend && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSend();
        }
      }}
    />
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
