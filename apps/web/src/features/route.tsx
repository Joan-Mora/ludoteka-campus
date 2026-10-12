import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Compass,
  Crown,
  Eye,
  Flag,
  Lightbulb,
  ListChecks,
  Loader2,
  MessagesSquare,
  Shapes,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { METHOD_INFO, type LearningMethod } from '@eduquest/contracts';
import { api, ApiException } from '@/shared/api';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { spokenAnswer } from '@/shared/voice';
import { useCompanion } from '@/shared/companion';
import { Empty, PageHeader, Reveal, Ring } from '@/ui';
import { hasManipulative, Manipulative, MANIPULATIVE_NAME, MethodChip, TheoryCard } from './learning-kit';

interface Topic {
  id: string; code: string; name: string; generator: string; level: number; streak: number; correct_count: number; attempt_count: number; pending: number;
  stars: number; crowns: number; bossReady: boolean;
}
interface Pending {
  id: string; topic_id: string; topic: string; level: number; prompt: string; hint: string; source: string;
  generator: string; params: unknown; method: LearningMethod | null; boss: boolean;
}
interface Recent { id: string; topic: string; level: number; prompt: string; status: string; given: string | null; answer: string; explanation: string; verification: string; boss: boolean }
interface Overview {
  topics: Topic[]; pending: Pending[]; recent: Recent[]; suggestion: { topicId: string; name: string; level: number } | null; average: number;
  method: LearningMethod | null; stars: number; bossMinLevel: number;
}
interface Result { correct: boolean; answer: string; explanation: string; verification: string; boss: boolean; mastery: { level: number; change: -1 | 0 | 1; stars: number } }

const VERIFICATION: Record<string, string> = {
  verified: 'La IA propuso el reto y el servidor confirmó la respuesta.',
  corrected: 'La IA propuso el reto y el servidor corrigió su respuesta.',
  template: 'Reto de plantilla calculado por el servidor.',
};

function LevelBar({ level }: { level: number }) {
  return (
    <div className="level-bar" aria-label={`Nivel ${level} de 10`}>
      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < level ? `on t${Math.min(3, Math.ceil(level / 3.4))}` : ''} />)}
    </div>
  );
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="trail-stars" aria-label={`${value} de 3 estrellas`}>
      {[0, 1, 2].map((i) => <Star key={i} size={size} className={i < value ? 'on' : ''} />)}
    </span>
  );
}

export function RoutePage() {
  const client = useQueryClient();
  const companion = useCompanion();
  const overview = useQuery({ queryKey: ['route'], queryFn: () => api<Overview>('/api/route') });
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const data = overview.data;
  const selectedId = params.get('tema');
  const selected = data?.topics.find((t) => t.id === selectedId) ?? null;

  function select(topicId: string | null) {
    const next = new URLSearchParams(params);
    if (topicId) next.set('tema', topicId);
    else next.delete('tema');
    setParams(next, { replace: true });
    if (topicId && window.matchMedia('(max-width: 1100px)').matches) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  async function generate(topicId?: string, boss = false) {
    setBusy(boss ? `boss-${topicId}` : topicId ?? 'auto');
    setError(null);
    try {
      const created = await api<{ topic: { id: string } }>('/api/route/generate', { method: 'POST', body: JSON.stringify({ ...(topicId ? { topicId } : {}), count: 3, boss }) });
      await client.invalidateQueries({ queryKey: ['route'] });
      select(created.topic.id);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudieron crear los retos');
    } finally {
      setBusy(null);
    }
  }

  const refresh = () => client.invalidateQueries({ queryKey: ['route'] });
  const crowns = data?.topics.reduce((s, t) => s + (t.crowns ? 1 : 0), 0) ?? 0;
  const others = data?.pending.filter((p) => p.topic_id !== selected?.id) ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Mi ruta"
        title="El sendero de los temas"
        subtitle={`Cada parada es un tema. Gana estrellas subiendo de nivel y vence al jefe de cada tema. ${companion.name} redacta los retos y el servidor verifica cada respuesta.`}
        actions={data?.method
          ? <Link to="/app/aprender" className="btn ghost"><Sparkles size={16} /> Formato: {METHOD_INFO[data.method].label}</Link>
          : <Link to="/app/aprender" className="btn ghost"><Sparkles size={16} /> Descubre cómo aprendes</Link>}
      />

      {data && (
        <Reveal>
          <div className="card route-hero">
            <Ring value={data.average * 10} size={86} stroke={10} color="#fff" track="rgba(255,255,255,.25)">
              <div style={{ textAlign: 'center', color: '#fff' }}><b style={{ fontSize: 21 }}>{data.average}</b><div style={{ fontSize: 11, opacity: 0.85 }}>nivel medio</div></div>
            </Ring>
            <div className="route-hero-stats">
              <div><Star size={18} /> <b>{data.stars}</b> / {data.topics.length * 3} estrellas</div>
              <div><Crown size={18} /> <b>{crowns}</b> / {data.topics.length} jefes vencidos</div>
              <div><Target size={18} /> <b>{data.pending.length}</b> retos pendientes</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {data.suggestion && (
                <>
                  <div className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>{companion.name} sugiere</div>
                  <h3 style={{ margin: '4px 0 0', fontSize: 20 }}>{data.suggestion.name}</h3>
                </>
              )}
            </div>
            <button className="btn lg" style={{ background: '#fff', color: 'var(--violet)' }} disabled={Boolean(busy)} onClick={() => generate(data.suggestion?.topicId)}>
              {busy === (data.suggestion?.topicId ?? 'auto') ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />} Dame 3 retos
            </button>
          </div>
        </Reveal>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="trail-layout">
        <div className="card trail-card">
          {data ? <Trail topics={data.topics} suggestion={data.suggestion?.topicId ?? null} selected={selected?.id ?? null} onSelect={select} /> : <p className="muted"><Loader2 size={14} className="spin" /> Trazando el sendero…</p>}
        </div>

        <div className="trail-side" ref={panelRef}>
          {selected ? (
            <TopicPanel
              topic={selected}
              items={data?.pending.filter((p) => p.topic_id === selected.id) ?? []}
              busy={busy}
              bossMinLevel={data?.bossMinLevel ?? 4}
              onClose={() => select(null)}
              onGenerate={(boss) => generate(selected.id, boss)}
              onDone={refresh}
            />
          ) : (
            <div className="card stack" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>Elige una parada</h3>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Toca un tema del sendero para ver su nivel, sus retos y su jefe.</p>
              <button className="btn ghost" disabled={Boolean(busy)} onClick={() => generate()}>{busy === 'auto' ? <Loader2 size={14} className="spin" /> : <Target size={14} />} Sorpréndeme</button>
            </div>
          )}

          {!!others.length && (
            <div className="card">
              <div className="block-label">Retos esperando en otras paradas</div>
              <div className="stack" style={{ gap: 6 }}>
                {others.map((p) => (
                  <button key={p.id} className="pending-row" onClick={() => select(p.topic_id)}>
                    {p.boss ? <Crown size={15} color="var(--gold)" /> : <Target size={15} />}
                    <span style={{ flex: 1, minWidth: 0 }}><b>{p.topic}</b><span className="muted"> · nivel {p.level}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!data?.recent.length && (
            <div className="card">
              <div className="block-label">Últimos retos</div>
              <div className="stack" style={{ gap: 4 }}>
                {data.recent.map((r) => (
                  <div key={r.id} className="row g-8" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                    {r.status === 'correct' ? <CheckCircle2 size={16} color="var(--mint)" /> : r.status === 'wrong' ? <XCircle size={16} color="var(--coral)" /> : <SkipForward size={16} color="var(--muted)" />}
                    {r.boss && <Crown size={13} color="var(--gold)" />}
                    <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{r.topic} · {r.given ? `respondiste ${r.given}, ` : ''}era {r.answer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Sendero ---------- */

const LANES = [50, 80, 50, 20];
const ROW = 118;

function Trail({ topics, suggestion, selected, onSelect }: { topics: Topic[]; suggestion: string | null; selected: string | null; onSelect: (id: string) => void }) {
  const points = topics.map((_, i) => ({ x: LANES[i % LANES.length]!, y: 86 + i * ROW }));
  const height = 86 + topics.length * ROW + 30;
  const path = points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} 24 L ${p.x} ${p.y}`;
    const prev = points[i - 1]!;
    return `${d} C ${prev.x} ${prev.y + ROW / 2}, ${p.x} ${p.y - ROW / 2}, ${p.x} ${p.y}`;
  }, '');
  const last = points[points.length - 1];
  return (
    <div className="trail" style={{ height }}>
      <svg className="trail-path" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
        <path d={last ? `${path} L ${last.x} ${height - 14}` : path} className="trail-road" vectorEffect="non-scaling-stroke" />
        <path d={last ? `${path} L ${last.x} ${height - 14}` : path} className="trail-dash" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="trail-start" style={{ left: `${points[0]?.x ?? 50}%` }}><Flag size={14} /> Salida</div>
      {topics.map((topic, i) => {
        const p = points[i]!;
        const tier = topic.stars;
        return (
          <motion.button
            key={topic.id}
            className={`trail-node tier-${tier} ${selected === topic.id ? 'on' : ''} ${suggestion === topic.id ? 'here' : ''}`}
            style={{ left: `${p.x}%`, top: p.y, x: '-50%', y: -32 }}
            onClick={() => onSelect(topic.id)}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 20 }}
            aria-label={`${topic.name}, nivel ${topic.level}, ${topic.stars} estrellas${topic.crowns ? ', jefe vencido' : ''}`}
          >
            <span className="trail-disc">
              <svg viewBox="0 0 64 64" className="trail-ring" aria-hidden>
                <circle cx="32" cy="32" r="28" className="track" />
                <circle cx="32" cy="32" r="28" className="fill" strokeDasharray={`${(topic.level / 10) * 176} 176`} />
              </svg>
              <b>{topic.level}</b>
              {topic.crowns > 0 && <span className="trail-crown"><Crown size={14} /></span>}
              {topic.pending > 0 && <span className="trail-badge">{topic.pending}</span>}
            </span>
            <span className="trail-name">{topic.name}</span>
            <Stars value={topic.stars} size={12} />
            {topic.bossReady && <span className="trail-boss"><Crown size={11} /> Jefe</span>}
            {suggestion === topic.id && <span className="trail-here">Sugerido</span>}
          </motion.button>
        );
      })}
      {last && <div className="trail-goal" style={{ left: `${last.x}%`, top: height - 22 }}><Trophy size={14} /> Meta</div>}
    </div>
  );
}

function TopicPanel({ topic, items, busy, bossMinLevel, onClose, onGenerate, onDone }: {
  topic: Topic; items: Pending[]; busy: string | null; bossMinLevel: number; onClose: () => void; onGenerate: (boss: boolean) => void; onDone: () => void;
}) {
  const nextStar = topic.level >= 10 ? null : topic.level < 4 ? 4 : topic.level < 7 ? 7 : 10;
  return (
    <motion.div className="card topic-panel" key={topic.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
      <div className="row g-8">
        <h3 style={{ margin: 0, flex: 1 }}>{topic.name}</h3>
        <button className="icon-btn" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="row g-8 wrap" style={{ margin: '8px 0' }}>
        <span className="chip violet">Nivel {topic.level}</span>
        <Stars value={topic.stars} />
        {topic.crowns > 0 && <span className="chip gold"><Crown size={12} /> Jefe vencido{topic.crowns > 1 ? ` ×${topic.crowns}` : ''}</span>}
      </div>
      <LevelBar level={topic.level} />
      <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 12px' }}>
        {topic.attempt_count ? `${topic.correct_count} de ${topic.attempt_count} aciertos.` : 'Aún sin intentos.'} {nextStar ? `La próxima estrella llega en el nivel ${nextStar}.` : '¡Tema dominado!'}
      </p>
      <div className="row g-8 wrap">
        <button className="btn" disabled={Boolean(busy)} onClick={() => onGenerate(false)}>{busy === topic.id ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} 3 retos</button>
        <button className="btn boss-btn" disabled={Boolean(busy) || !topic.bossReady} onClick={() => onGenerate(true)} title={topic.bossReady ? 'Dos niveles por encima; si lo vences subes un nivel de una' : topic.level < bossMinLevel ? `Aparece desde el nivel ${bossMinLevel}` : 'Ya está esperándote abajo'}>
          {busy === `boss-${topic.id}` ? <Loader2 size={16} className="spin" /> : <Crown size={16} />} Reto jefe
        </button>
      </div>
      <div className="stack" style={{ gap: 12, marginTop: 14 }}>
        <AnimatePresence>
          {items.map((item) => <Challenge key={item.id} item={item} onDone={onDone} />)}
        </AnimatePresence>
        {!items.length && <Empty icon={Compass} title="Sin retos en esta parada" body="Pide 3 retos o enfrenta al jefe cuando llegues al nivel 4." />}
      </div>
    </motion.div>
  );
}

/* ---------- Reto ---------- */

function MethodAid({ item }: { item: Pending }) {
  const companion = useCompanion();
  const [example, setExample] = useState<{ prompt: string; explanation: string; answer: string } | null>(null);
  const [loading, setLoading] = useState(false);
  switch (item.method) {
    case 'teoria':
      return <TheoryCard generator={item.generator} compact />;
    case 'ejemplos':
      return example ? (
        <div className="aid-example">
          <div className="row g-6"><ListChecks size={15} /><b>Ejemplo parecido</b></div>
          <p style={{ margin: '4px 0' }}>{example.prompt}</p>
          <p className="muted" style={{ margin: 0 }}>{example.explanation} <b>Respuesta: {example.answer}</b></p>
        </div>
      ) : (
        <button className="btn sm ghost" disabled={loading} onClick={async () => {
          setLoading(true);
          const data = await api<{ items: { prompt: string; explanation: string; answer: string }[] }>(`/api/route/topics/${item.topic_id}/examples`).finally(() => setLoading(false));
          setExample(data.items[0] ?? null);
        }}>{loading ? <Loader2 size={14} className="spin" /> : <ListChecks size={14} />} Ver un ejemplo parecido resuelto</button>
      );
    case 'conversacion':
      return (
        <Link className="btn sm ghost" to={`/app/tutor?method=conversacion&q=${encodeURIComponent(`Este es mi reto: «${item.prompt}». Te explico cómo lo pensé: `)}`}>
          <MessagesSquare size={14} /> Explícaselo a {companion.name}
        </Link>
      );
    default:
      return null;
  }
}

function useSeconds(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return seconds;
}

function Challenge({ item, onDone }: { item: Pending; onDone: () => void }) {
  const client = useQueryClient();
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [showKit, setShowKit] = useState(item.method === 'visual');
  const [result, setResult] = useState<Result | null>(null);
  const [skipped, setSkipped] = useState<{ answer: string; explanation: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const game = item.method === 'juegos';
  const seconds = useSeconds(game && !result && !skipped);
  const missionStars = useMemo(() => (seconds <= 30 ? 3 : seconds <= 75 ? 2 : 1), [result]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) return;
    setSending(true);
    setError(null);
    try {
      const outcome = await api<Result>(`/api/route/items/${item.id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) });
      setResult(outcome);
      if (outcome.correct) client.invalidateQueries({ queryKey: ['me-game'] });
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

  async function skip() {
    setSkipped(await api(`/api/route/items/${item.id}/skip`, { method: 'POST' }));
  }

  const done = result || skipped;
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className={`card challenge ${item.boss ? 'boss' : ''} ${game ? 'mission' : ''} ${result ? (result.correct ? 'ok' : 'bad') : ''}`}>
      <div className="row g-6 wrap" style={{ marginBottom: 10 }}>
        {item.boss ? <span className="chip gold"><Crown size={12} /> Jefe del tema</span> : <span className="chip">Nivel {item.level}</span>}
        {item.boss && <span className="chip">Nivel {item.level}</span>}
        {item.method && <MethodChip method={item.method} />}
        {item.source === 'ia' && <span className="chip sky"><Sparkles size={12} /> IA</span>}
        {game && !done && <span className="chip coral"><Timer size={12} /> {seconds} s</span>}
        <span style={{ marginLeft: 'auto' }}><SpeakButton text={item.prompt} label="Leer" /></span>
      </div>
      <p className="challenge-prompt">{item.prompt}</p>
      {!done && (
        <>
          <MethodAid item={item} />
          {showKit && hasManipulative(item.generator) && <Manipulative generator={item.generator} params={item.params} />}
          {hint && <p className="hint"><Lightbulb size={15} /> {item.hint}</p>}
          <form className="composer" onSubmit={submit}>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Tu respuesta: 3/4, 2,5, 1.200…" inputMode="text" autoComplete="off" aria-label="Tu respuesta" />
            <MicButton onText={(text) => setAnswer(spokenAnswer(text) || text)} />
            <button className="btn" type="submit" disabled={sending || !answer.trim()}>{sending ? <Loader2 size={16} className="spin" /> : 'Responder'}</button>
          </form>
          {error && <p className="form-error">{error}</p>}
          <div className="row g-8 wrap" style={{ marginTop: 10 }}>
            {!hint && <button className="btn sm ghost" onClick={() => setHint(true)}><Lightbulb size={14} /> Pista</button>}
            {hasManipulative(item.generator) && (
              <button className="btn sm ghost" onClick={() => setShowKit(!showKit)} title={MANIPULATIVE_NAME[item.generator]}>
                {showKit ? <Eye size={14} /> : <Shapes size={14} />} {showKit ? 'Ocultar dibujo' : 'Dibujarlo'}
              </button>
            )}
            <button className="btn sm ghost" onClick={skip}><SkipForward size={14} /> Saltar</button>
          </div>
        </>
      )}
      {result && (
        <div className="challenge-result">
          <div className="row g-8 wrap" style={{ fontWeight: 800, fontSize: 16 }}>
            {result.correct
              ? <><CheckCircle2 color="var(--mint)" /> {result.boss ? '¡Venciste al jefe!' : game ? '¡Misión cumplida!' : '¡Correcto!'}</>
              : <><XCircle color="var(--coral)" /> La respuesta era {result.answer}</>}
            {result.correct && game && <Stars value={missionStars} size={16} />}
            {result.mastery.change === 1 && <span className="chip mint"><TrendingUp size={12} /> Subiste a nivel {result.mastery.level}</span>}
            {result.mastery.change === -1 && <span className="chip coral"><TrendingDown size={12} /> Bajaste a nivel {result.mastery.level}</span>}
            {result.boss && !result.correct && <span className="chip soft">El jefe no quita niveles: vuelve a intentarlo</span>}
          </div>
          <p style={{ margin: '8px 0' }}>{result.explanation}</p>
          <p className="muted row g-4" style={{ fontSize: 12.5, margin: 0 }}><ShieldCheck size={14} /> {VERIFICATION[result.verification]}</p>
        </div>
      )}
      {skipped && (
        <div className="challenge-result">
          <b>Respuesta: {skipped.answer}</b>
          <p style={{ margin: '6px 0 0' }}>{skipped.explanation}</p>
        </div>
      )}
      {done && <button className="btn sm" style={{ marginTop: 12 }} onClick={onDone}>Siguiente</button>}
    </motion.div>
  );
}
