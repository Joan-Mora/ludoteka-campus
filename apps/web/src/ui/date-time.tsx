import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEKDAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Every half hour of the day, shown the way people say it: «7:30 a. m.». */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return { value: `${pad(h)}:${pad(m)}`, label };
});

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i));
}

/**
 * Date from a calendar and time from a list, so an impossible date (year 202622, 31 de febrero) can't be typed.
 * `min` blocks earlier days and, on that same day, earlier times.
 */
export function DateTimeField({ label, value, onChange, min, placeholder, defaultTime = '07:00' }: {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  min?: Date;
  placeholder: string;
  defaultTime?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const base = value ?? min ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const time = value ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : '';
  const today = startOfDay(new Date());
  const minDay = min ? startOfDay(min) : null;

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  function at(day: Date, hhmm: string) {
    const [h, m] = hhmm.split(':').map(Number);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    if (min && next < min) {
      const first = TIMES.find((t) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(t.value.slice(0, 2)), Number(t.value.slice(3))) >= min);
      if (first) return at(day, first.value);
    }
    return next;
  }

  const timeDisabled = (t: string) => {
    if (!value || !min || dayKey(value) !== dayKey(min)) return false;
    const [h, m] = t.split(':').map(Number);
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), h, m) < min;
  };

  const shown = value?.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="field dt-field" ref={box}>
      <span id={`${id}-label`}>{label}</span>
      <div className="dt-row">
        <button type="button" className={`dt-date ${value ? '' : 'empty'}`} aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${id}-label`} onClick={() => setOpen(!open)}>
          <CalendarDays size={16} aria-hidden /> <span>{shown ?? placeholder}</span>
        </button>
        <select value={time} disabled={!value} onChange={(e) => value && onChange(at(value, e.target.value))} aria-label={`${label}: hora`}>
          {!value && <option value="">Hora</option>}
          {TIMES.map((t) => <option key={t.value} value={t.value} disabled={timeDisabled(t.value)}>{t.label}</option>)}
        </select>
        {value && <button type="button" className="icon-btn sm" aria-label={`Quitar ${label.toLowerCase()}`} onClick={() => onChange(null)}><X size={14} /></button>}
      </div>
      {open && (
        <div className="dt-pop" role="dialog" aria-label={`Calendario: ${label}`}>
          <div className="dt-head">
            <button type="button" className="icon-btn sm" aria-label="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <b>{month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</b>
            <button type="button" className="icon-btn sm" aria-label="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="dt-grid" role="grid">
            {WEEKDAYS.map((w) => <span key={w} className="dt-wd" aria-hidden>{w}</span>)}
            {monthDays(month).map((day) => {
              const off = day.getMonth() !== month.getMonth();
              const blocked = Boolean(minDay && day < minDay);
              const on = value && dayKey(value) === dayKey(day);
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  className={`dt-day ${off ? 'off' : ''} ${on ? 'on' : ''} ${dayKey(day) === dayKey(today) ? 'today' : ''}`}
                  disabled={blocked}
                  aria-pressed={Boolean(on)}
                  aria-label={day.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  onClick={() => { onChange(at(day, time || defaultTime)); setOpen(false); }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
