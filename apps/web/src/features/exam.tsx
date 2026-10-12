import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Circle, Clock, Diamond, Hash, ListChecks, Play, Radio, Send, ShieldCheck, Square, Triangle, Trophy, Users } from 'lucide-react';
import { api } from '@/shared/api';
import { getToken } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Empty, PageHeader, Ring, Tile } from '@/ui';

interface Attempt {
  id: string;
  status: string;
  score: number;
  maxScore: number;
  title: string;
  kind: string;
  timeLimitSec: number;
  questions: { id: string; prompt: string; options: { id: string; label: string; text: string }[] }[];
  answers: { questionId: string; optionId: string | null }[];
}

function useCountdown(seconds: number | undefined, running: boolean) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!seconds || !running) return;
    setLeft(seconds);
    const timer = setInterval(() => setLeft((value) => (value === null ? null : Math.max(0, value - 1))), 1000);
    return () => clearInterval(timer);
  }, [seconds, running]);
  return left;
}

export function ExamPage() {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState(0);
  const left = useCountdown(attempt?.timeLimitSec, attempt?.status === 'active');

  useEffect(() => {
    api<Attempt>(`/api/attempts/${id}`).then((data) => {
      setAttempt(data);
      const initial: Record<string, string> = {};
      for (const answer of data.answers) if (answer.optionId) initial[answer.questionId] = answer.optionId;
      setPicks(initial);
      setLocked(data.status !== 'active');
    });
  }, [id]);

  useEffect(() => {
    if (!attempt || attempt.kind === 'practice' || attempt.status !== 'active') return;
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => undefined);
    let sent = false;
    async function report(type: 'fullscreen_exit' | 'visibility_hidden' | 'blur' | 'escape') {
      if (sent) return;
      const result = await api<{ suspended: boolean; count: number }>(`/api/attempts/${id}/integrity`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      if (result.suspended) {
        sent = true;
        setLocked(true);
        setMessage('La evaluación se suspendió. El docente ya tiene la alerta.');
      } else setMessage(`Aviso ${result.count}. Mantente en la pantalla del examen.`);
    }
    const onVis = () => { if (document.hidden) report('visibility_hidden'); };
    const onBlur = () => report('blur');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') report('escape'); };
    const onFs = () => { if (!document.fullscreenElement) report('fullscreen_exit'); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [attempt, id]);

  async function choose(questionId: string, optionId: string) {
    if (locked) return;
    setPicks((prev) => ({ ...prev, [questionId]: optionId }));
    await api(`/api/attempts/${id}/answers`, { method: 'POST', body: JSON.stringify({ questionId, optionId }) });
  }

  async function finish() {
    const data = await api<Attempt>(`/api/attempts/${id}/submit`, { method: 'POST' });
    setAttempt(data);
    setLocked(true);
    if (document.fullscreenElement) document.exitFullscreen?.();
  }

  if (!attempt) {
    return (
      <main className="kiosk" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Tile icon={ShieldCheck} tone="violet" large />
          <p style={{ marginTop: 14, fontWeight: 700 }}>Preparando la evaluación…</p>
        </div>
      </main>
    );
  }

  const answered = attempt.questions.filter((q) => picks[q.id]).length;
  const question = attempt.questions[current];
  const finished = attempt.status !== 'active';
  const percent = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
  const mm = left !== null ? String(Math.floor(left / 60)).padStart(2, '0') : '--';
  const ss = left !== null ? String(left % 60).padStart(2, '0') : '--';

  return (
    <main className="kiosk">
      <header className="kiosk-top">
        <div className="row g-12">
          <img src="/favicon.svg" alt="" style={{ width: 36, height: 36, borderRadius: 11 }} />
          <div>
            <div style={{ fontSize: 12, color: '#a79fe0', fontWeight: 700 }}>{attempt.kind === 'exam' ? 'EXAMEN EN KIOSCO' : 'PRÁCTICA'}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>{attempt.title}</div>
          </div>
        </div>
        {!finished && (
          <div className="row g-12">
            <span className="chip" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', border: 0 }}><Check size={14} /> {answered}/{attempt.questions.length}</span>
            <span className="chip" style={{ background: left !== null && left < 60 ? 'rgba(255,93,115,.25)' : 'rgba(255,255,255,.08)', color: '#fff', border: 0, fontSize: 15, padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}><Clock size={15} /> {mm}:{ss}</span>
            {attempt.kind === 'exam' && <span className="chip mint"><ShieldCheck size={14} /> Integridad activa</span>}
          </div>
        )}
      </header>

      <div className="kiosk-body">
        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="row g-12" style={{ padding: 14, borderRadius: 16, background: 'rgba(255,93,115,.18)', border: '1px solid rgba(255,93,115,.4)', marginBottom: 20 }}>
              <AlertTriangle size={20} color="#ff8a9a" /> <b>{message}</b>
            </motion.div>
          )}
        </AnimatePresence>

        {finished ? (
          <motion.div className="card" style={{ textAlign: 'center', padding: 40 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <Ring value={percent} size={170} stroke={16} track="var(--bg-2)">
                <div className="display" style={{ fontSize: 44 }}>{percent}%</div>
                <div className="muted" style={{ fontWeight: 700, fontSize: 13 }}>{attempt.score} / {attempt.maxScore}</div>
              </Ring>
            </div>
            <h1 style={{ fontSize: 34, marginTop: 20 }}>{percent >= 80 ? '¡Excelente trabajo!' : percent >= 60 ? '¡Bien hecho!' : 'Sigue practicando'}</h1>
            <p className="muted" style={{ marginTop: 8 }}>{attempt.status === 'suspended' ? 'El intento fue suspendido por integridad.' : 'Tu resultado quedó registrado y tu docente ya puede verlo.'}</p>
            <a href="/app" className="btn lg" style={{ marginTop: 24 }}>Volver al aula</a>
          </motion.div>
        ) : question ? (
          <>
            <div className="row g-8 wrap" style={{ marginBottom: 20 }}>
              {attempt.questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrent(i)}
                  style={{
                    width: 38, height: 38, borderRadius: 12, fontWeight: 800, border: i === current ? '2px solid #fff' : '1px solid rgba(255,255,255,.15)',
                    background: picks[q.id] ? 'var(--grad-brand)' : 'rgba(255,255,255,.06)', color: '#fff',
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.article key={question.id} className="card" style={{ padding: 32 }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <div className="eyebrow">Pregunta {current + 1} de {attempt.questions.length}</div>
                <h2 style={{ fontSize: 26, margin: '12px 0 24px', lineHeight: 1.3 }}>{question.prompt}</h2>
                <div className="stack g-12">
                  {question.options.map((option) => (
                    <button key={option.id} className={`option ${picks[question.id] === option.id ? 'picked' : ''}`} onClick={() => choose(question.id, option.id)} disabled={locked}>
                      <span className="opt-key">{option.label}</span>
                      {option.text}
                    </button>
                  ))}
                </div>
              </motion.article>
            </AnimatePresence>
            <div className="row between" style={{ marginTop: 20 }}>
              <button className="btn glass" disabled={current === 0} onClick={() => setCurrent(current - 1)}><ArrowLeft size={16} /> Anterior</button>
              {current < attempt.questions.length - 1 ? (
                <button className="btn white" onClick={() => setCurrent(current + 1)}>Siguiente <ArrowRight size={16} /></button>
              ) : (
                <button className="btn gold lg" onClick={finish} disabled={locked}><Send size={17} /> Entregar evaluación</button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

const liveColors = [
  { bg: 'linear-gradient(135deg, #ff5d73, #e23b57)', icon: Triangle },
  { bg: 'linear-gradient(135deg, #3ab8ff, #2a7de1)', icon: Diamond },
  { bg: 'linear-gradient(135deg, #ffc83d, #f59e0b)', icon: Circle },
  { bg: 'linear-gradient(135deg, #19c39c, #0e9f7e)', icon: Square },
];

interface LiveQuestion { questionId: string; prompt: string; options: { id: string; label: string; text: string }[]; position: number; total: number; points: number }
interface Hostable { id: string; title: string; kind: string; course: string; questions: number; open: { id: string; code: string; status: string } | null }
interface LiveState {
  id: string;
  code: string;
  status: 'lobby' | 'live' | 'ended';
  title: string;
  courseId: string;
  position: number;
  total: number;
  question: (LiveQuestion & { correctId: string | null; tally: Record<string, number> }) | null;
  participants: { id: string; fullName: string; answered: number; correct: number; points: number; answeredCurrent: boolean }[];
}

/** One socket per room: joins on connect (and again after a reconnect) and hands every event to the latest handlers. */
interface LiveEvents { 'live:question': LiveQuestion; 'live:progress': { answers: number }; 'live:ended': { sessionId: string }; 'live:roster': { sessionId: string } }

function useLiveRoom(code: string | null, handlers: { [K in keyof LiveEvents]?: (payload: LiveEvents[K]) => void }) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    if (!code) return;
    const socket: Socket = io({ auth: { token: getToken() } });
    const join = () => socket.emit('live:join', { code });
    socket.on('connect', join);
    for (const event of ['live:question', 'live:progress', 'live:ended', 'live:roster'] as const) {
      socket.on(event, (payload: unknown) => (latest.current[event] as ((p: unknown) => void) | undefined)?.(payload));
    }
    return () => { socket.disconnect(); };
  }, [code]);
}

export function LivePage() {
  const { user } = useAuth();
  return user?.role === 'student' ? <LiveJoin /> : <LiveHost />;
}

/* ---------- Docente: elegir, abrir y conducir ---------- */

function LiveHost() {
  const [params, setParams] = useSearchParams();
  const roomId = params.get('sala');
  const preselected = params.get('assessment');
  const list = useQuery({ queryKey: ['live-hostable'], queryFn: () => api<Hostable[]>('/api/live/hostable'), enabled: !roomId });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function open(assessmentId: string) {
    setBusy(assessmentId);
    setError('');
    try {
      const session = await api<{ id: string }>('/api/live', { method: 'POST', body: JSON.stringify({ assessmentId }) });
      setParams({ sala: session.id });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const opened = useRef(false);
  useEffect(() => {
    if (!preselected || roomId || opened.current) return;
    opened.current = true;
    void open(preselected);
  });

  if (roomId) return <LiveRoom id={roomId} onLeave={() => setParams({})} />;

  const items = list.data ?? [];
  const courses = [...new Set(items.map((i) => i.course))];
  return (
    <div>
      <PageHeader
        eyebrow="Sala en vivo"
        title="Abre una sala para tu clase"
        subtitle="Elige una evaluación publicada, proyecta el código y lanza las preguntas una por una mientras ves quién responde."
      />
      <div className="live-steps">
        {[
          [ListChecks, 'Elige la evaluación', 'Cualquier práctica o quiz en vivo publicado en tus cursos.'],
          [Hash, 'Proyecta el código', 'Tus estudiantes entran a «Sala en vivo» y lo escriben.'],
          [Play, 'Lanza cada pregunta', 'Ves en tiempo real cuántos respondieron y qué eligieron.'],
          [Trophy, 'Revisa resultados', 'Al cerrar, la nota queda en la planilla de cada estudiante.'],
        ].map(([Icon, title, body], i) => {
          const I = Icon as typeof Hash;
          return (
            <div key={title as string} className="live-step">
              <span className="live-step-n">{i + 1}</span>
              <I size={18} aria-hidden />
              <div><b>{title as string}</b><small>{body as string}</small></div>
            </div>
          );
        })}
      </div>
      {error && <p className="form-error" style={{ margin: '12px 0' }}>{error}</p>}
      {list.isLoading && <div className="card"><p className="muted">Cargando tus evaluaciones…</p></div>}
      {!list.isLoading && !items.length && (
        <Empty icon={Radio} title="Aún no tienes evaluaciones para proyectar" body="Crea una práctica o un quiz en vivo desde la mesa de tu curso y publícalo; aparecerá aquí." />
      )}
      <div className="stack g-20">
        {courses.map((course) => (
          <section key={course}>
            <div className="block-label">{course}</div>
            <div className="live-pick">
              {items.filter((i) => i.course === course).map((item) => (
                <article key={item.id} className={`card live-card${item.id === preselected ? ' picked' : ''}`}>
                  <div className="row g-8 wrap">
                    <span className={`chip ${item.kind === 'live' ? 'coral' : 'violet'}`}>{item.kind === 'live' ? 'Quiz en vivo' : 'Práctica'}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{item.questions} {item.questions === 1 ? 'pregunta' : 'preguntas'}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {item.open ? (
                    <button className="btn" onClick={() => setParams({ sala: item.open!.id })}><Radio size={16} /> Volver a la sala · {item.open.code}</button>
                  ) : (
                    <button className="btn" disabled={busy === item.id || !item.questions} onClick={() => open(item.id)}><Play size={16} /> {busy === item.id ? 'Abriendo…' : 'Abrir sala'}</button>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LiveRoom({ id, onLeave }: { id: string; onLeave: () => void }) {
  const client = useQueryClient();
  const state = useQuery({ queryKey: ['live-state', id], queryFn: () => api<LiveState>(`/api/live/${id}/state`), refetchInterval: 6000 });
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => void client.invalidateQueries({ queryKey: ['live-state', id] });
  useLiveRoom(state.data?.code ?? null, { 'live:roster': refresh, 'live:progress': refresh, 'live:question': refresh, 'live:ended': refresh });

  const s = state.data;
  async function act(path: 'next' | 'end') {
    if (path === 'end' && !confirm('¿Cerrar la sala? Se calificará a cada estudiante con lo que respondió.')) return;
    setBusy(true);
    setReveal(false);
    try {
      await api(`/api/live/${id}/${path}`, { method: 'POST' });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (state.isError) return <Empty icon={Radio} title="No pudimos abrir la sala" body={(state.error as Error).message} />;
  if (!s) return <div className="page-loading" role="status" aria-label="Cargando"><span /><span /><span /></div>;

  const answeredNow = s.participants.filter((p) => p.answeredCurrent).length;
  const last = s.position >= s.total;
  return (
    <div className="live-host">
      <header className="live-bar">
        <button className="btn ghost sm" onClick={onLeave}><ArrowLeft size={15} /> Mis evaluaciones</button>
        <div className="live-title"><b>{s.title}</b><span className="muted">{s.status === 'ended' ? 'Sala cerrada' : s.status === 'lobby' ? 'Esperando estudiantes' : `Pregunta ${s.position} de ${s.total}`}</span></div>
        {s.status !== 'ended' && <button className="btn ghost sm" disabled={busy} onClick={() => act('end')}><Square size={14} /> Cerrar sala</button>}
      </header>

      {s.status !== 'ended' && (
        <div className="live-grid">
          <section className="card live-code">
            <small>Entra en Ludoteka → Sala en vivo y escribe</small>
            <div className="live-code-value" aria-label={`Código ${s.code.split('').join(' ')}`}>{s.code}</div>
            <div className="row g-8 wrap" style={{ justifyContent: 'center' }}>
              <span className="chip mint"><Users size={14} /> {s.participants.length} en la sala</span>
              {s.status === 'live' && <span className="chip violet">{answeredNow} de {s.participants.length} respondieron</span>}
            </div>
            <button className="btn lg" disabled={busy || (!s.participants.length && s.status === 'lobby')} onClick={() => act('next')}>
              {s.status === 'lobby' ? <><Play size={18} /> Empezar</> : last ? <><Trophy size={18} /> Terminar y ver resultados</> : <>Siguiente pregunta <ArrowRight size={18} /></>}
            </button>
            {!s.participants.length && s.status === 'lobby' && <p className="muted" style={{ fontSize: 13 }}>El botón se activa cuando entre el primer estudiante.</p>}
          </section>

          <section className="card live-stage">
            {s.question ? (
              <>
                <h2>{s.question.prompt}</h2>
                <div className="live-tally">
                  {s.question.options.map((o, i) => {
                    const n = s.question!.tally[o.id] ?? 0;
                    const pct = s.participants.length ? Math.round((n / s.participants.length) * 100) : 0;
                    const color = liveColors[i % liveColors.length]!;
                    const right = reveal && o.id === s.question!.correctId;
                    return (
                      <div key={o.id} className={`live-opt${right ? ' right' : ''}${reveal && !right ? ' dim' : ''}`}>
                        <span className="live-opt-ico" style={{ background: color.bg }}><color.icon size={16} fill="#fff" /></span>
                        <span className="live-opt-text">{o.text}</span>
                        <span className="live-opt-bar"><i style={{ width: `${pct}%`, background: color.bg }} /></span>
                        <b className="num">{n}</b>
                        {right && <Check size={18} aria-label="Respuesta correcta" />}
                      </div>
                    );
                  })}
                </div>
                <button className="btn ghost sm" onClick={() => setReveal((r) => !r)}>{reveal ? 'Ocultar respuesta' : 'Mostrar respuesta correcta'}</button>
              </>
            ) : (
              <div className="live-wait">
                <Tile icon={Radio} tone="coral" large />
                <h2>Sala abierta</h2>
                <p className="muted">Cuando estén todos, pulsa «Empezar». Las preguntas aparecen en las pantallas de tus estudiantes al mismo tiempo.</p>
              </div>
            )}
          </section>

          <section className="card live-roster">
            <div className="card-title">En la sala</div>
            {!s.participants.length && <p className="muted" style={{ fontSize: 13.5 }}>Nadie todavía.</p>}
            <ul>
              {s.participants.map((p) => (
                <li key={p.id} className={p.answeredCurrent ? 'done' : ''}>
                  <span className="ellipsis">{p.fullName}</span>
                  {s.status === 'live' && (p.answeredCurrent ? <Check size={15} aria-label="Respondió" /> : <Clock size={15} aria-label="Pensando" />)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {s.status === 'ended' && (
        <section className="card">
          <div className="row between wrap g-12" style={{ marginBottom: 12 }}>
            <div className="card-title">Resultados · {s.title}</div>
            <Link to={`/app/cursos/${s.courseId}/aula`} className="btn sm ghost">Ir al aula del curso</Link>
          </div>
          {!s.participants.length ? (
            <p className="muted">Nadie participó en esta sala.</p>
          ) : (
            <table className="table">
              <thead><tr><th className="num">#</th><th>Estudiante</th><th className="num">Correctas</th><th className="num">Respondidas</th><th className="num">Puntos</th></tr></thead>
              <tbody>
                {s.participants.map((p, i) => (
                  <tr key={p.id}>
                    <td className="num">{i + 1}</td>
                    <td>{p.fullName}</td>
                    <td className="num">{p.correct} / {s.total}</td>
                    <td className="num">{p.answered}</td>
                    <td className="num"><b>{p.points}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- Estudiante: unirse y responder ---------- */

function LiveJoin() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('codigo') ?? '').toUpperCase());
  const [room, setRoom] = useState<{ id: string; code: string; title: string; attemptId: string | null } | null>(null);
  const [question, setQuestion] = useState<LiveQuestion | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [error, setError] = useState('');

  useLiveRoom(room?.code ?? null, {
    'live:question': (payload: LiveQuestion) => { setQuestion(payload); setPicked(null); setProgress(0); },
    'live:progress': (payload: { answers: number }) => setProgress(payload.answers),
    'live:ended': () => setEnded(true),
  });

  useEffect(() => {
    if (!ended || !room?.attemptId) return;
    const load = () => api<{ score: number; maxScore: number }>(`/api/attempts/${room.attemptId}`).then(setResult).catch(() => undefined);
    const timer = window.setTimeout(load, 800);
    return () => window.clearTimeout(timer);
  }, [ended, room?.attemptId]);

  async function join(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const data = await api<{ session: { id: string; code: string; title: string }; attemptId: string | null; current: LiveQuestion | null; answered: string | null }>('/api/live/join', { method: 'POST', body: JSON.stringify({ code }) });
      setRoom({ id: data.session.id, code: data.session.code, title: data.session.title, attemptId: data.attemptId });
      setQuestion(data.current);
      setPicked(data.answered);
    } catch (err) {
      setError((err as Error).message || 'No encontramos esa sala. Revisa el código.');
    }
  }

  async function answer(optionId: string) {
    if (!room || !question || picked) return;
    setPicked(optionId);
    try {
      await api(`/api/live/${room.id}/answer`, { method: 'POST', body: JSON.stringify({ questionId: question.questionId, optionId }) });
    } catch (err) {
      setPicked(null);
      setError((err as Error).message);
    }
  }

  if (!room) {
    return (
      <div>
        <PageHeader eyebrow="Sala en vivo" title="Únete a la sala" subtitle="Tu docente proyecta un código. Escríbelo aquí y responde cada pregunta cuando aparezca." />
        <div className="grid cols-2" style={{ alignItems: 'stretch' }}>
          <section className="hero" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Tile icon={Radio} tone="coral" large />
              <h2 className="display" style={{ fontSize: 34, marginTop: 16 }}>Código de la sala</h2>
              <form onSubmit={join} className="row g-8" style={{ marginTop: 18 }}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  aria-label="Código de la sala"
                  autoComplete="off"
                  className="live-input"
                />
                <button className="btn white lg" type="submit" disabled={code.length < 4}>Entrar</button>
              </form>
              {error && <p className="err" style={{ marginTop: 10, color: '#ff8a9a' }}>{error}</p>}
            </div>
          </section>
          <section className="card" style={{ padding: 28 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Cómo se juega</div>
            <div className="grid cols-2" style={{ gap: 10 }}>
              {liveColors.map((color, i) => (
                <div key={i} className="row g-12" style={{ background: color.bg, color: '#fff', borderRadius: 16, padding: '16px 14px', boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.15)' }}>
                  <color.icon size={22} fill="#fff" />
                  <b>{['Lee la pregunta', 'Elige tu color', 'Responde rápido', 'Suma puntos'][i]}</b>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 16, fontSize: 14, lineHeight: 1.55 }}>Solo tienes un intento por pregunta. Al cerrar la sala tu resultado queda en tus notas.</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="stack g-20">
      <div className="row between wrap g-12">
        <div><div className="eyebrow">Sala {room.code}</div><h1 style={{ fontSize: 26, margin: '4px 0 0' }}>{room.title}</h1></div>
        {question && !ended && (
          <div className="row g-8">
            <span className="chip violet">Pregunta {question.position} / {question.total}</span>
            <span className="chip mint"><Users size={14} /> {progress} respondieron</span>
          </div>
        )}
      </div>

      {!question && !ended && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ display: 'inline-block' }}>
            <Tile icon={Radio} tone="coral" large />
          </motion.div>
          <h2 style={{ marginTop: 16 }}>¡Estás dentro! Esperando a que tu docente empiece…</h2>
        </div>
      )}

      {question && !ended && (
        <AnimatePresence mode="wait">
          <motion.div key={question.questionId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="stack g-20">
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)' }}>{question.prompt}</h2>
            </div>
            <div className="kahoot">
              {question.options.map((option, i) => {
                const color = liveColors[i % liveColors.length]!;
                return (
                  <motion.button
                    key={option.id}
                    whileTap={{ scale: 0.97 }}
                    disabled={Boolean(picked)}
                    style={{ background: color.bg, opacity: picked && picked !== option.id ? 0.4 : 1, outline: picked === option.id ? '4px solid var(--ink)' : 'none' }}
                    onClick={() => answer(option.id)}
                  >
                    <color.icon size={28} fill="#fff" />
                    <span>{option.text}</span>
                  </motion.button>
                );
              })}
            </div>
            {picked && <p style={{ textAlign: 'center', fontWeight: 800 }}>¡Respuesta enviada! Espera la siguiente pregunta.</p>}
            {error && <p className="form-error" style={{ textAlign: 'center' }}>{error}</p>}
          </motion.div>
        </AnimatePresence>
      )}

      {ended && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Tile icon={Trophy} tone="gold" large />
          <h2 style={{ marginTop: 16 }}>¡Sala terminada!</h2>
          {result && <p style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{result.score} de {result.maxScore} puntos</p>}
          <p className="muted" style={{ marginTop: 6 }}>Tu resultado queda registrado en tus notas.</p>
          <Link to="/app" className="btn" style={{ marginTop: 18 }}>Volver al campus</Link>
        </div>
      )}
    </div>
  );
}
