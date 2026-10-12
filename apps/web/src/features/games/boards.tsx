import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, Heart, RotateCcw, Send, X } from 'lucide-react';
import type { ArcadeUi } from '@eduquest/contracts';

export interface PublicItem {
  ui: ArcadeUi;
  prompt: string;
  hint?: string;
  options?: string[];
  cards?: string[];
  steps?: string[];
  line?: { min: number; max: number; label: string };
  grid?: { max: number; target: 'area' | 'perimeter'; value: number };
  mask?: string;
}

export interface AnswerResponse {
  ok: boolean;
  points?: number;
  answer?: string;
  explanation?: string;
  matched?: number[];
  misses?: number;
  lives?: number;
  mask?: string;
  done?: boolean;
  solved?: boolean;
}

export type Feedback = { ok: boolean; answer?: string; explanation?: string; points?: number; given: string } | null;

export interface BoardProps {
  item: PublicItem;
  feedback: Feedback;
  /** Una sola respuesta por pregunta; el runner muestra la corrección y avanza. */
  submit: (answer: string) => void;
  /** Para tableros de varios pasos (memoria y ahorcado). */
  send: (answer: string) => Promise<AnswerResponse>;
  complete: () => void;
}

export function InputBoard({ item, feedback, submit }: BoardProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!feedback) ref.current?.focus(); }, [item, feedback]);
  return (
    <div className="board">
      <motion.div key={item.prompt} className="big-number board-prompt" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{item.prompt}</motion.div>
      <form
        className="row g-12 board-form"
        onSubmit={(event) => {
          event.preventDefault();
          const value = ref.current?.value.trim();
          if (value) submit(value);
        }}
      >
        <input ref={ref} key={item.prompt} inputMode="decimal" autoComplete="off" className="board-input" placeholder="?" disabled={!!feedback} aria-label="Tu respuesta" />
        <button className="btn lg" type="submit" disabled={!!feedback}><Send size={18} /> Enviar</button>
      </form>
      {item.hint && !feedback && <p className="muted board-hint">{item.hint}</p>}
    </div>
  );
}

export function ChoiceBoard({ item, feedback, submit }: BoardProps) {
  const options = item.options ?? [];
  return (
    <div className="board">
      <h2 className="board-question">{item.prompt}</h2>
      <div className={`board-options n${options.length}`}>
        {options.map((option, i) => {
          const right = feedback && option === feedback.answer;
          const wrong = feedback && !feedback.ok && option === feedback.given;
          return (
            <motion.button
              key={option + i}
              className={`board-option tone-${i % 4} ${right ? 'right' : ''} ${wrong ? 'wrong' : ''}`}
              whileHover={feedback ? undefined : { scale: 1.03 }}
              whileTap={feedback ? undefined : { scale: 0.96 }}
              disabled={!!feedback}
              onClick={() => submit(option)}
            >
              {option}
              {right && <Check size={20} strokeWidth={3} />}
              {wrong && <X size={20} strokeWidth={3} />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ticksFor(max: number) {
  const step = max === 1 ? 0.1 : max === 2 ? 0.1 : 1;
  return Array.from({ length: Math.round(max / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}
const fmt = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');

export function LineBoard({ item, feedback, submit }: BoardProps) {
  const line = item.line ?? { min: 0, max: 1, label: '' };
  const [value, setValue] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => setValue(null), [item]);
  const place = (event: ReactPointerEvent) => {
    if (feedback || !track.current) return;
    const box = track.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    setValue(Math.round((line.min + ratio * (line.max - line.min)) * 100) / 100);
  };
  const pct = (v: number) => `${((v - line.min) / (line.max - line.min)) * 100}%`;
  const ticks = ticksFor(line.max);
  return (
    <div className="board">
      <h2 className="board-question">Ubica <span className="board-target">{line.label}</span> en la recta</h2>
      <div
        className="numline"
        ref={track}
        onPointerDown={(event) => { (event.target as Element).setPointerCapture?.(event.pointerId); place(event); }}
        onPointerMove={(event) => event.buttons && place(event)}
        role="slider"
        aria-label={`Recta de ${line.min} a ${line.max}`}
        aria-valuemin={line.min}
        aria-valuemax={line.max}
        aria-valuenow={value ?? undefined}
        tabIndex={0}
        onKeyDown={(event) => {
          const delta = (line.max - line.min) / 100;
          if (event.key === 'ArrowRight') setValue((v) => Math.min(line.max, Math.round(((v ?? line.min) + delta) * 100) / 100));
          if (event.key === 'ArrowLeft') setValue((v) => Math.max(line.min, Math.round(((v ?? line.min) - delta) * 100) / 100));
          if (event.key === 'Enter' && value !== null) submit(String(value));
        }}
      >
        <div className="numline-bar" />
        {ticks.map((t, i) => (
          <span key={t} className={`numline-tick ${i === 0 || i === ticks.length - 1 || (line.max !== 10 && i % 5 === 0) ? 'major' : ''}`} style={{ left: pct(t) }}>
            {(i === 0 || i === ticks.length - 1 || line.max === 10 || i % 5 === 0) && <em>{fmt(t)}</em>}
          </span>
        ))}
        {value !== null && <motion.span className={`numline-pin ${feedback ? (feedback.ok ? 'right' : 'wrong') : ''}`} style={{ left: pct(value) }} layout>{fmt(value)}</motion.span>}
        {feedback && <span className="numline-pin answer" style={{ left: pct(Number(feedback.answer)) }}>{line.label}</span>}
      </div>
      <div className="row g-12 board-form">
        <button className="btn lg" disabled={value === null || !!feedback} onClick={() => value !== null && submit(String(value))}><Check size={18} /> Marcar</button>
      </div>
      {feedback?.points !== undefined && <p className="muted board-hint">{feedback.points ? `+${feedback.points} puntos por cercanía` : 'Muy lejos esta vez.'}</p>}
    </div>
  );
}

export function OrderBoard({ item, feedback, submit }: BoardProps) {
  const steps = item.steps ?? [];
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => setPicked([]), [item]);
  const correct = feedback?.answer?.split(',').map(Number) ?? [];
  const tap = (i: number) => {
    if (feedback || picked.includes(i)) return;
    const next = [...picked, i];
    setPicked(next);
    if (next.length === steps.length) submit(next.join(','));
  };
  return (
    <div className="board">
      <div className="board-expr">{item.prompt}</div>
      <p className="muted" style={{ marginBottom: 14 }}>Toca los pasos en el orden en que se resuelven.</p>
      <div className="order-steps">
        {steps.map((step, i) => {
          const position = picked.indexOf(i);
          const shouldBe = correct.indexOf(i);
          return (
            <motion.button key={step} className={`order-step ${position >= 0 ? 'picked' : ''} ${feedback ? (shouldBe === position ? 'right' : 'wrong') : ''}`} onClick={() => tap(i)} whileTap={{ scale: 0.97 }} disabled={!!feedback}>
              <span className="order-badge">{position >= 0 ? position + 1 : '·'}</span>
              <span>{step}</span>
              {feedback && shouldBe !== position && <em className="order-should">va {shouldBe + 1}.º</em>}
            </motion.button>
          );
        })}
      </div>
      {picked.length > 0 && !feedback && <button className="btn ghost sm" onClick={() => setPicked([])}><RotateCcw size={14} /> Empezar de nuevo</button>}
    </div>
  );
}

export function GridBoard({ item, feedback, submit }: BoardProps) {
  const grid = item.grid ?? { max: 8, target: 'area' as const, value: 0 };
  const [size, setSize] = useState<{ b: number; h: number } | null>(null);
  const [hover, setHover] = useState<{ b: number; h: number } | null>(null);
  useEffect(() => { setSize(null); setHover(null); }, [item]);
  const shown = feedback ? size : hover ?? size;
  return (
    <div className="board">
      <h2 className="board-question">{item.prompt}</h2>
      <p className="muted" style={{ marginBottom: 12 }}>Toca la esquina donde termina tu rectángulo. Cada cuadrito mide 1 cm.</p>
      <div className="build-grid" style={{ gridTemplateColumns: `repeat(${grid.max}, 1fr)` }} onPointerLeave={() => setHover(null)}>
        {Array.from({ length: grid.max * grid.max }, (_, i) => {
          const [x, y] = [i % grid.max, Math.floor(i / grid.max)];
          const on = shown && x < shown.b && y < shown.h;
          return (
            <button
              key={i}
              className={`build-cell ${on ? 'on' : ''} ${on && feedback ? (feedback.ok ? 'right' : 'wrong') : ''}`}
              disabled={!!feedback}
              onPointerEnter={() => setHover({ b: x + 1, h: y + 1 })}
              onClick={() => setSize({ b: x + 1, h: y + 1 })}
              aria-label={`${x + 1} por ${y + 1}`}
            />
          );
        })}
      </div>
      <div className="row g-12 board-form">
        <span className="chip violet">{shown ? `${shown.b} cm × ${shown.h} cm` : 'Sin rectángulo'}</span>
        <button className="btn lg" disabled={!size || !!feedback} onClick={() => size && submit(`${size.b},${size.h}`)}><Check size={18} /> Construir</button>
      </div>
    </div>
  );
}

export function MemoryBoard({ item, send, complete }: BoardProps) {
  const cards = item.cards ?? [];
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [busy, setBusy] = useState(false);
  const flip = async (i: number) => {
    if (busy || open.includes(i) || matched.includes(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setBusy(true);
    try {
      const res = await send(next.join(','));
      setMisses((m) => res.misses ?? m);
      if (res.ok) {
        setMatched(res.matched ?? []);
        setOpen([]);
        if (res.done) setTimeout(complete, 600);
      } else {
        await new Promise((r) => setTimeout(r, 750));
        setOpen([]);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="board">
      <h2 className="board-question">{item.prompt}</h2>
      <div className="memory-grid">
        {cards.map((label, i) => {
          const shown = open.includes(i) || matched.includes(i);
          return (
            <motion.button key={i} className={`memory-card ${shown ? 'shown' : ''} ${matched.includes(i) ? 'matched' : ''}`} onClick={() => flip(i)} animate={{ rotateY: shown ? 0 : 180 }} transition={{ duration: 0.3 }} aria-label={shown ? label : 'Carta boca abajo'}>
              <span style={{ transform: shown ? undefined : 'rotateY(180deg)' }}>{shown ? label : '?'}</span>
            </motion.button>
          );
        })}
      </div>
      <p className="muted board-hint">{matched.length / 2} de {cards.length / 2} parejas · {misses} intentos fallidos</p>
    </div>
  );
}

const LETTERS = 'abcdefghijklmnñopqrstuvwxyz'.split('');

export function HangmanBoard({ item, send, complete }: BoardProps) {
  const [mask, setMask] = useState(item.mask ?? '');
  const [tried, setTried] = useState<string[]>([]);
  const [hits, setHits] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [lives, setLives] = useState(6);
  const [end, setEnd] = useState<{ solved: boolean; answer: string; explanation?: string } | null>(null);
  const busy = useRef(false);
  useEffect(() => { setMask(item.mask ?? ''); setTried([]); setHits([]); setMisses(0); setEnd(null); }, [item]);
  const guess = async (letter: string) => {
    if (busy.current || end || tried.includes(letter)) return;
    busy.current = true;
    setTried((t) => [...t, letter]);
    try {
      const res = await send(letter);
      if (res.ok) setHits((h) => [...h, letter]);
      setMask((m) => res.mask ?? m);
      setMisses((m) => res.misses ?? m);
      setLives((l) => res.lives ?? l);
      if (res.done) setEnd({ solved: !!res.solved, answer: res.answer ?? '', explanation: res.explanation });
    } finally {
      busy.current = false;
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (LETTERS.includes(key) && !(event.target instanceof HTMLInputElement)) void guess(key);
      if (key === 'enter' && end) complete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="board">
      <p className="board-definition">«{item.prompt}»</p>
      <div className="hang-word" aria-label="Palabra">{[...(end ? end.answer : mask)].map((ch, i) => <span key={i} className={ch === '_' ? 'blank' : ''}>{ch === '_' ? '' : ch}</span>)}</div>
      <div className="hang-lives" aria-label={`${lives - misses} vidas`}>
        {Array.from({ length: lives }, (_, i) => <Heart key={i} size={18} className={i < lives - misses ? 'alive' : 'lost'} />)}
      </div>
      {end ? (
        <div className={`board-end ${end.solved ? 'right' : 'wrong'}`}>
          <b>{end.solved ? '¡Adivinaste!' : `Era «${end.answer}»`}</b>
          {end.explanation && <p>{end.explanation}</p>}
          <button className="btn" onClick={complete}>Siguiente</button>
        </div>
      ) : (
        <div className="hang-keys">
          {LETTERS.map((letter) => {
            const used = tried.includes(letter);
            return <button key={letter} className={`hang-key ${used ? (hits.includes(letter) ? 'hit' : 'miss') : ''}`} disabled={used} onClick={() => guess(letter)}>{letter}</button>;
          })}
        </div>
      )}
    </div>
  );
}
