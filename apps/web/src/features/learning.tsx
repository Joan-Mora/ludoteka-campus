import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  Crown,
  Eye,
  Gamepad2,
  Library,
  Loader2,
  Lock,
  MessagesSquare,
  Mic,
  NotebookPen,
  RefreshCw,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { LEARNING_METHODS, LEARNING_QUIZ, LEARNING_QUIZ_VERSION, METHOD_INFO, type LearningMethod } from '@eduquest/contracts';
import { api, ApiException } from '@/shared/api';
import { useSpeech } from '@/shared/voice';
import { SpeakButton } from '@/shared/voice-ui';
import { useCompanion } from '@/shared/companion';
import { Empty, PageHeader, Reveal, Tile } from '@/ui';
import { Manipulative, METHOD_ICON, MethodChip, THEORY, TheoryCard } from './learning-kit';

interface MethodStat { method: LearningMethod; label: string; attempts: number; correct: number; levelUps: number; rate: number | null; opened: number }
export interface ProfileStatus {
  version: number;
  profile: { method: LearningMethod; secondary: LearningMethod | null; scores: Record<LearningMethod, number>; period: string | null; takenAt: string } | null;
  period: string | null;
  canTake: boolean;
  stats: MethodStat[];
  recommendation: { method: LearningMethod; label: string; reason: string } | null;
}
interface RouteTopic { id: string; name: string; generator: string; level: number; stars: number; crowns: number; bossReady: boolean; pending: number }
interface RouteOverview { topics: RouteTopic[]; suggestion: { topicId: string } | null; method: LearningMethod | null }
interface Example { prompt: string; hint: string; answer: string; explanation: string; params: Record<string, unknown> }
interface LibraryItem { id: string; title: string; kind: string; subject: string; description: string }

export const useLearningProfile = () => useQuery({ queryKey: ['learning-profile'], queryFn: () => api<ProfileStatus>('/api/profile') });

const KIND_LABEL: Record<string, string> = { pdf: 'PDF', image: 'Imagen', video: 'Video', doc: 'Documento', link: 'Enlace' };

export function LearningPage() {
  const companion = useCompanion();
  const client = useQueryClient();
  const status = useLearningProfile();
  const route = useQuery({ queryKey: ['route'], queryFn: () => api<RouteOverview>('/api/route') });
  const [params, setParams] = useSearchParams();
  const [quiz, setQuiz] = useState(false);
  const [topicId, setTopicId] = useState('');

  const profile = status.data?.profile ?? null;
  const recommended = profile?.method ?? null;
  const asked = params.get('metodo');
  const active: LearningMethod = (LEARNING_METHODS as readonly string[]).includes(asked ?? '') ? (asked as LearningMethod) : recommended ?? 'practica';
  const topics = route.data?.topics ?? [];
  const topic = topics.find((t) => t.id === topicId) ?? topics.find((t) => t.id === route.data?.suggestion?.topicId) ?? topics[0];
  const order = useMemo(() => (recommended ? [recommended, ...LEARNING_METHODS.filter((m) => m !== recommended)] : [...LEARNING_METHODS]), [recommended]);

  useEffect(() => {
    if (!topic || !profile) return;
    void api('/api/profile/activity', { method: 'POST', body: JSON.stringify({ method: active, topicId: topic.id, resource: 'mi-espacio' }) }).catch(() => undefined);
  }, [active, topic?.id, Boolean(profile)]);

  function choose(method: LearningMethod) {
    const next = new URLSearchParams(params);
    next.set('metodo', method);
    setParams(next, { replace: true });
  }

  if (quiz) {
    return (
      <LearningQuiz
        onCancel={() => setQuiz(false)}
        onDone={(next) => {
          client.setQueryData(['learning-profile'], next);
          client.invalidateQueries({ queryKey: ['route'] });
          setQuiz(false);
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Mi espacio" title="Aprende a tu manera" subtitle={`Seis formas de aprender el mismo tema. ${companion.name} te recomienda una, pero puedes pasar a cualquiera cuando quieras.`} />

      {status.data && !profile && (
        <Reveal>
          <div className="card quiz-hero">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.6 }}><Tile icon={Sparkles} tone="violet" large /></motion.div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="eyebrow">Descubre cómo aprendes</div>
              <h3 style={{ margin: '4px 0 6px', fontSize: 22 }}>12 situaciones, 3 minutos</h3>
              <p className="muted" style={{ margin: 0 }}>{companion.name} te cuenta escenas del colegio y de la casa; eliges lo que harías tú. No hay respuestas buenas ni malas.</p>
            </div>
            <button className="btn lg" onClick={() => setQuiz(true)}><Sparkles size={18} /> Empezar</button>
          </div>
        </Reveal>
      )}

      {profile && status.data && <ProfileCard status={status.data} onRetake={() => setQuiz(true)} onChoose={choose} />}

      <div className="space-toolbar">
        <label className="row g-8">
          <span className="block-label" style={{ margin: 0 }}>Tema</span>
          <select className="lib-select" value={topic?.id ?? ''} onChange={(e) => setTopicId(e.target.value)} aria-label="Tema">
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name} · nivel {t.level}</option>)}
          </select>
        </label>
        {topic && <span className="row g-4 stars-inline" aria-label={`${topic.stars} de 3 estrellas`}>{[0, 1, 2].map((i) => <Star key={i} size={15} className={i < topic.stars ? 'on' : ''} />)}</span>}
      </div>

      <div className="method-tabs" role="tablist" aria-label="Formas de aprender">
        {order.map((method) => {
          const Icon = METHOD_ICON[method];
          return (
            <button
              key={method}
              role="tab"
              aria-selected={active === method}
              className={`method-tab tone-${METHOD_INFO[method].tone} ${active === method ? 'on' : ''} ${recommended === method ? 'rec' : ''}`}
              onClick={() => choose(method)}
            >
              {recommended === method && <span className="rec-badge"><Sparkles size={11} /> Para ti</span>}
              <Icon size={22} />
              <b>{METHOD_INFO[method].label}</b>
              <span>{METHOD_INFO[method].short}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${active}-${topic?.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {!topic ? (
            <Empty icon={Compass} title="Cargando temas" />
          ) : (
            <Section method={active} topic={topic} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProfileCard({ status, onRetake, onChoose }: { status: ProfileStatus; onRetake: () => void; onChoose: (m: LearningMethod) => void }) {
  const profile = status.profile!;
  const Icon = METHOD_ICON[profile.method];
  const best = Math.max(1, ...Object.values(profile.scores));
  return (
    <Reveal>
      <div className="card profile-card">
        <div className="profile-main">
          <Tile icon={Icon} tone={METHOD_INFO[profile.method].tone} large />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow">Aprendes mejor con</div>
            <h3 style={{ margin: '2px 0 4px', fontSize: 24 }}>{METHOD_INFO[profile.method].label}</h3>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {METHOD_INFO[profile.method].short}
              {profile.secondary && <> También te sirve <b>{METHOD_INFO[profile.secondary].label.toLowerCase()}</b>.</>}
            </p>
            <div className="row g-8 wrap" style={{ marginTop: 10 }}>
              <span className="chip soft">{profile.period ? `Respondido en ${profile.period}` : 'Respondido'}</span>
              {status.canTake
                ? <button className="chip violet" onClick={onRetake}><RefreshCw size={12} /> Repetir para {status.period ?? 'este periodo'}</button>
                : <span className="chip soft"><Lock size={12} /> Podrás repetirlo el próximo periodo</span>}
            </div>
          </div>
        </div>
        <div className="score-bars" aria-label="Puntaje por método">
          {LEARNING_METHODS.map((m) => (
            <div key={m} className={`score-row ${m === profile.method ? 'top' : ''}`}>
              <span>{METHOD_INFO[m].label}</span>
              <div className="score-track"><motion.i initial={{ width: 0 }} animate={{ width: `${(profile.scores[m] / best) * 100}%` }} transition={{ duration: 0.6 }} /></div>
            </div>
          ))}
        </div>
        {status.recommendation && (
          <div className="rec-banner">
            <TrendingUp size={18} />
            <div style={{ flex: 1 }}><b>Prueba con {status.recommendation.label.toLowerCase()}.</b> {status.recommendation.reason}</div>
            <button className="btn sm" onClick={() => onChoose(status.recommendation!.method)}>Ir</button>
          </div>
        )}
        <MethodStats stats={status.stats} />
      </div>
    </Reveal>
  );
}

function MethodStats({ stats }: { stats: MethodStat[] }) {
  const used = stats.filter((s) => s.attempts > 0);
  if (!used.length) return <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>Cuando resuelvas retos en Mi ruta verás aquí con qué método aciertas más.</p>;
  return (
    <div className="method-stats">
      <div className="block-label">Cómo te va en Mi ruta con cada método (60 días)</div>
      <div className="row g-8 wrap">
        {used.map((s) => (
          <span key={s.method} className="chip soft" title={`${s.correct} de ${s.attempts} aciertos · subiste ${s.levelUps} niveles`}>
            {s.label}: <b>{Math.round((s.rate ?? 0) * 100)} %</b> <span className="muted">({s.attempts})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Secciones por método ---------- */

function useGenerate(topic: RouteTopic) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(method: LearningMethod, count = 3, boss = false) {
    setBusy(true);
    setError(null);
    try {
      await api('/api/route/generate', { method: 'POST', body: JSON.stringify({ topicId: topic.id, method, count, boss }) });
      await client.invalidateQueries({ queryKey: ['route'] });
      navigate(`/app/ruta?tema=${topic.id}`);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudieron crear los retos');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function Section({ method, topic }: { method: LearningMethod; topic: RouteTopic }) {
  switch (method) {
    case 'teoria': return <TheorySection topic={topic} />;
    case 'ejemplos': return <ExamplesSection topic={topic} />;
    case 'juegos': return <GamesSection topic={topic} />;
    case 'practica': return <PracticeSection topic={topic} />;
    case 'visual': return <VisualSection topic={topic} />;
    case 'conversacion': return <ConversationSection topic={topic} />;
  }
}

function useReadings(topic: RouteTopic, kind?: string) {
  const search = THEORY[topic.generator]?.search ?? topic.name;
  return useQuery({
    queryKey: ['space-library', search, kind ?? ''],
    queryFn: () => api<LibraryItem[]>(`/api/library/items?q=${encodeURIComponent(search)}${kind ? `&kind=${kind}` : ''}`),
    staleTime: 5 * 60_000,
  });
}

function Readings({ items, empty }: { items: LibraryItem[] | undefined; empty: string }) {
  if (!items) return <p className="muted"><Loader2 size={14} className="spin" /> Buscando en la biblioteca…</p>;
  if (!items.length) return <p className="muted" style={{ fontSize: 13.5 }}>{empty}</p>;
  return (
    <div className="reading-list">
      {items.slice(0, 5).map((item) => (
        <Link key={item.id} to={`/app/biblioteca/${item.id}`} className="reading-row">
          <Library size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{item.title}</b>
            <div className="muted" style={{ fontSize: 12.5 }}>{item.subject} · {KIND_LABEL[item.kind] ?? item.kind}</div>
          </div>
          <ArrowRight size={15} />
        </Link>
      ))}
    </div>
  );
}

function SectionShell({ method, title, children, actions }: { method: LearningMethod; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card space-section">
      <div className="row g-8 wrap" style={{ marginBottom: 12 }}>
        <MethodChip method={method} />
        <h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function TheorySection({ topic }: { topic: RouteTopic }) {
  const readings = useReadings(topic);
  const g = useGenerate(topic);
  const theory = THEORY[topic.generator];
  return (
    <SectionShell method="teoria" title={theory?.title ?? topic.name} actions={theory && <SpeakButton text={`${theory.rule} ${theory.why}`} label="Escuchar" />}>
      <TheoryCard generator={topic.generator} />
      <div className="block-label" style={{ marginTop: 16 }}>Para leer en la biblioteca</div>
      <Readings items={readings.data} empty="Todavía no hay lecturas de este tema en la biblioteca." />
      <div className="row g-8 wrap" style={{ marginTop: 14 }}>
        <button className="btn" disabled={g.busy} onClick={() => g.run('teoria')}>{g.busy ? <Loader2 size={16} className="spin" /> : <BookOpen size={16} />} 3 retos que empiezan por la regla</button>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
    </SectionShell>
  );
}

function ExamplesSection({ topic }: { topic: RouteTopic }) {
  const examples = useQuery({ queryKey: ['examples', topic.id], queryFn: () => api<{ items: Example[] }>(`/api/route/topics/${topic.id}/examples`) });
  const [open, setOpen] = useState<number | null>(0);
  const g = useGenerate(topic);
  return (
    <SectionShell method="ejemplos" title={`Ejemplos resueltos: ${topic.name}`} actions={<button className="btn sm ghost" onClick={() => { setOpen(0); void examples.refetch(); }}><RefreshCw size={14} /> Otros ejemplos</button>}>
      <div className="stack g-12">
        {examples.data?.items.map((ex, i) => (
          <div key={ex.prompt} className={`example-card ${open === i ? 'open' : ''}`}>
            <button className="example-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span className="chip sky">Ejemplo {i + 1}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{ex.prompt}</span>
              <Eye size={16} />
            </button>
            {open === i && (
              <motion.ol className="example-steps" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                {ex.explanation.split(/(?<=\.)\s+/).filter(Boolean).map((step, k) => (
                  <motion.li key={k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.25 }}>{step}</motion.li>
                ))}
                <li className="example-answer">Respuesta: <b>{ex.answer}</b></li>
              </motion.ol>
            )}
          </div>
        ))}
        {examples.isLoading && <p className="muted"><Loader2 size={14} className="spin" /> Preparando ejemplos…</p>}
      </div>
      <div className="row g-8 wrap" style={{ marginTop: 14 }}>
        <button className="btn" disabled={g.busy} onClick={() => g.run('ejemplos', 2)}>{g.busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} Ahora tú: 2 retos parecidos</button>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
    </SectionShell>
  );
}

function GamesSection({ topic }: { topic: RouteTopic }) {
  const g = useGenerate(topic);
  return (
    <SectionShell method="juegos" title={`Jugar con ${topic.name.toLowerCase()}`}>
      <div className="space-cards">
        <button className="space-card tone-coral" disabled={g.busy} onClick={() => g.run('juegos', 3)}>
          <Zap size={26} />
          <b>Misión relámpago</b>
          <span>3 retos en formato de misión, con reloj y estrellas.</span>
        </button>
        <Link to="/app/jugar" className="space-card tone-violet">
          <Gamepad2 size={26} />
          <b>Arcade</b>
          <span>Minijuegos cortos que suman XP.</span>
        </Link>
        <Link to="/app/arena" className="space-card tone-gold">
          <Swords size={26} />
          <b>Arena por equipos</b>
          <span>Cuando tu docente abre una partida en clase.</span>
        </Link>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
    </SectionShell>
  );
}

function PracticeSection({ topic }: { topic: RouteTopic }) {
  const g = useGenerate(topic);
  return (
    <SectionShell method="practica" title={`Entrenar ${topic.name.toLowerCase()}`}>
      <div className="row g-12 wrap" style={{ marginBottom: 14 }}>
        <span className="chip violet">Nivel {topic.level} de 10</span>
        <span className="chip gold">{topic.stars} de 3 estrellas</span>
        {topic.crowns > 0 && <span className="chip mint"><Crown size={12} /> Jefe vencido</span>}
        {topic.pending > 0 && <span className="chip soft">{topic.pending} retos pendientes</span>}
      </div>
      <div className="space-cards">
        <button className="space-card tone-mint" disabled={g.busy} onClick={() => g.run('practica', 3)}>
          <Compass size={26} />
          <b>3 retos de entrenamiento</b>
          <span>Dos aciertos seguidos te suben de nivel.</span>
        </button>
        <button className="space-card tone-coral" disabled={g.busy || !topic.bossReady} onClick={() => g.run('practica', 1, true)} title={topic.bossReady ? '' : 'Aparece desde el nivel 4'}>
          <Crown size={26} />
          <b>Reto jefe</b>
          <span>{topic.bossReady ? 'Dos niveles por encima. Si lo vences, subes de una.' : topic.level < 4 ? 'Se desbloquea en el nivel 4.' : 'Ya te está esperando en Mi ruta.'}</span>
        </button>
        <Link to="/app/cuaderno" className="space-card tone-sky">
          <NotebookPen size={26} />
          <b>Tarjetas de repaso</b>
          <span>Repaso espaciado en tu cuaderno.</span>
        </Link>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
    </SectionShell>
  );
}

function VisualSection({ topic }: { topic: RouteTopic }) {
  const examples = useQuery({ queryKey: ['examples', topic.id], queryFn: () => api<{ items: Example[] }>(`/api/route/topics/${topic.id}/examples`) });
  const videos = useReadings(topic, 'video');
  const g = useGenerate(topic);
  const example = examples.data?.items[0];
  return (
    <SectionShell method="visual" title={`Ver ${topic.name.toLowerCase()}`} actions={<button className="btn sm ghost" onClick={() => void examples.refetch()}><RefreshCw size={14} /> Otro caso</button>}>
      {example && (
        <>
          <p style={{ marginTop: 0, fontWeight: 600 }}>{example.prompt}</p>
          <Manipulative key={example.prompt} generator={topic.generator} params={example.params} />
        </>
      )}
      <div className="block-label" style={{ marginTop: 16 }}>Videos de la biblioteca</div>
      <Readings items={videos.data} empty="Aún no hay videos de este tema; mientras tanto, juega con el manipulativo." />
      <div className="row g-8 wrap" style={{ marginTop: 14 }}>
        <button className="btn" disabled={g.busy} onClick={() => g.run('visual')}>{g.busy ? <Loader2 size={16} className="spin" /> : <Eye size={16} />} 3 retos con dibujo</button>
      </div>
      {g.error && <p className="form-error">{g.error}</p>}
    </SectionShell>
  );
}

function ConversationSection({ topic }: { topic: RouteTopic }) {
  const companion = useCompanion();
  const starters = [
    `Quiero explicarte cómo se resuelve un ejercicio de ${topic.name.toLowerCase()}. Corrígeme si me equivoco.`,
    `Hazme preguntas sobre ${topic.name.toLowerCase()} para ver si lo entendí.`,
    `¿Para qué sirve ${topic.name.toLowerCase()} en la vida diaria?`,
  ];
  return (
    <SectionShell method="conversacion" title={`Conversar con ${companion.name}`}>
      <p className="muted" style={{ marginTop: 0 }}>
        {companion.name} te hace preguntas, una a la vez, y te pide que expliques con tus palabras. Puedes hablarle con el micrófono <Mic size={13} /> y activar que te lea las respuestas.
      </p>
      <div className="stack g-8">
        {starters.map((s) => (
          <Link key={s} className="starter-row" to={`/app/tutor?method=conversacion&q=${encodeURIComponent(s)}`}>
            <MessagesSquare size={16} /> <span style={{ flex: 1 }}>{s}</span> <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/* ---------- Cuestionario ---------- */

function shuffled(length: number, seed: number) {
  const out = Array.from({ length }, (_, i) => i);
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function LearningQuiz({ onDone, onCancel }: { onDone: (status: ProfileStatus) => void; onCancel: () => void }) {
  const companion = useCompanion();
  const speech = useSpeech();
  const [narrate, setNarrate] = useState(() => localStorage.getItem('eq_quiz_voice') !== '0');
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => Array(LEARNING_QUIZ.length).fill(undefined));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileStatus | null>(null);
  const seed = useMemo(() => Math.floor(Math.random() * 10_000), []);
  const orders = useMemo(() => LEARNING_QUIZ.map((q, i) => shuffled(q.options.length, seed + i * 31)), [seed]);
  const letters = ['A', 'B', 'C', 'D'];
  const intro = `Hola, soy ${companion.name}. Te voy a contar ${LEARNING_QUIZ.length} situaciones del colegio y de la casa. Elige lo que harías tú. No hay respuestas buenas ni malas.`;

  useEffect(() => { localStorage.setItem('eq_quiz_voice', narrate ? '1' : '0'); if (!narrate) speech.stop(); }, [narrate]);

  useEffect(() => {
    if (!narrate || !speech.supported || result) return;
    if (step < 0) { speech.speak(intro); return; }
    const q = LEARNING_QUIZ[step];
    if (!q) return;
    speech.speak(`${q.scene} ${orders[step]!.map((o, i) => `${letters[i]}: ${q.options[o]!.text}`).join(' ')}`);
  }, [step, narrate]);

  async function submit(final: number[]) {
    setSending(true);
    setError(null);
    try {
      const status = await api<ProfileStatus>('/api/profile', { method: 'POST', body: JSON.stringify({ version: LEARNING_QUIZ_VERSION, answers: final }) });
      setResult(status);
      const p = status.profile;
      if (p && narrate) speech.speak(`¡Listo! Aprendes mejor con ${METHOD_INFO[p.method].label.toLowerCase()}. ${METHOD_INFO[p.method].short}`);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudo guardar');
    } finally {
      setSending(false);
    }
  }

  function pick(option: number) {
    const next = [...answers];
    next[step] = option;
    setAnswers(next);
    window.setTimeout(() => {
      if (step + 1 < LEARNING_QUIZ.length) setStep(step + 1);
      else void submit(next as number[]);
    }, 260);
  }

  const q = step >= 0 ? LEARNING_QUIZ[step] : null;
  return (
    <div className="quiz-wrap">
      <div className="row g-8" style={{ marginBottom: 14 }}>
        <button className="btn sm ghost" onClick={() => { speech.stop(); onCancel(); }}><ArrowLeft size={14} /> Salir</button>
        <div className="quiz-progress" aria-label={`Pregunta ${Math.max(0, step) + 1} de ${LEARNING_QUIZ.length}`}>
          <motion.i animate={{ width: `${((result ? LEARNING_QUIZ.length : Math.max(0, step)) / LEARNING_QUIZ.length) * 100}%` }} />
        </div>
        {speech.supported && (
          <button className={`chip ${narrate ? 'violet' : ''}`} onClick={() => setNarrate(!narrate)} title={narrate ? `Silenciar a ${companion.name}` : `Que ${companion.name} me lea`}>
            {narrate ? <Volume2 size={13} /> : <VolumeX size={13} />} {companion.name}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {result?.profile ? (
          <motion.div key="result" className="card quiz-card result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div initial={{ rotate: -14, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring' }}>
              <Tile icon={METHOD_ICON[result.profile.method]} tone="violet" large />
            </motion.div>
            <div className="eyebrow" style={{ marginTop: 14 }}>Aprendes mejor con</div>
            <h2 className="display" style={{ margin: '4px 0 8px' }}>{METHOD_INFO[result.profile.method].label}</h2>
            <p className="muted">{METHOD_INFO[result.profile.method].short}{result.profile.secondary ? ` Tu segunda opción: ${METHOD_INFO[result.profile.secondary].label.toLowerCase()}.` : ''}</p>
            <p className="muted" style={{ fontSize: 13 }}>Tus retos de Mi ruta y las pistas de {companion.name} se van a ajustar a esto. Puedes usar los otros métodos cuando quieras.</p>
            <button className="btn lg" onClick={() => { speech.stop(); onDone(result); }}>Ver mi espacio <ArrowRight size={16} /></button>
          </motion.div>
        ) : q ? (
          <motion.div key={step} className="card quiz-card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
            <div className="row g-8">
              <span className="chip violet">{step + 1} de {LEARNING_QUIZ.length}</span>
              <span style={{ marginLeft: 'auto' }}><SpeakButton text={q.scene} label="Escuchar" /></span>
            </div>
            <h2 className="quiz-scene">{q.scene}</h2>
            <div className="quiz-options">
              {orders[step]!.map((o, i) => (
                <button key={o} className={`quiz-option ${answers[step] === o ? 'on' : ''}`} onClick={() => pick(o)} disabled={sending}>
                  <span className="quiz-letter">{letters[i]}</span>
                  <span>{q.options[o]!.text}</span>
                </button>
              ))}
            </div>
            <div className="row between" style={{ marginTop: 14 }}>
              <button className="btn sm ghost" disabled={step === 0 || sending} onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Anterior</button>
              {sending && <span className="muted row g-4"><Loader2 size={14} className="spin" /> Guardando…</span>}
            </div>
            {error && <p className="form-error">{error}</p>}
          </motion.div>
        ) : (
          <motion.div key="intro" className="card quiz-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} style={{ display: 'inline-block' }}><Tile icon={Sparkles} tone="violet" large /></motion.div>
            <h2 className="quiz-scene">Descubre cómo aprendes</h2>
            <p className="muted">{intro}</p>
            <p className="muted" style={{ fontSize: 13 }}>Tus respuestas las ve el colegio. A la IA solo le llega el nombre del método que mejor te funciona, nunca tus datos.</p>
            <button className="btn lg" onClick={() => setStep(0)}>Empezar <ArrowRight size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
