import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Circle, Clock, Diamond, Hash, Radio, Send, ShieldCheck, Square, Triangle, Users } from 'lucide-react';
import { api } from '@/shared/api';
import { getToken } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { PageHeader, Ring, Tile } from '@/ui';

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

export function LivePage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [question, setQuestion] = useState<{ questionId: string; prompt: string; options: { id: string; label: string; text: string }[]; position: number; total: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isStaff = user?.role !== 'student';

  useEffect(() => {
    const socket: Socket = io({ auth: { token: getToken() } });
    socket.on('live:question', (payload) => { setQuestion(payload); setEnded(false); setPicked(null); setProgress(0); });
    socket.on('live:progress', (payload: { answers: number }) => setProgress(payload.answers));
    socket.on('live:ended', () => setEnded(true));
    return () => { socket.disconnect(); };
  }, []);

  async function openRoom() {
    const assessmentId = params.get('assessment');
    if (!assessmentId) return;
    const session = await api<{ id: string; code: string }>('/api/live', { method: 'POST', body: JSON.stringify({ assessmentId }) });
    setCode(session.code);
    setSessionId(session.id);
    const socket = io({ auth: { token: getToken() } });
    socket.emit('live:join', { code: session.code });
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    try {
      const data = await api<{ session: { id: string; code: string } }>('/api/live/join', { method: 'POST', body: JSON.stringify({ code }) });
      setSessionId(data.session.id);
      setError('');
      const socket = io({ auth: { token: getToken() } });
      socket.emit('live:join', { code: data.session.code });
    } catch {
      setError('No encontramos esa sala. Revisa el código.');
    }
  }

  async function next() {
    await api(`/api/live/${sessionId}/next`, { method: 'POST' });
  }

  async function answer(optionId: string) {
    if (!question || picked) return;
    setPicked(optionId);
    await api(`/api/live/${sessionId}/answer`, { method: 'POST', body: JSON.stringify({ questionId: question.questionId, optionId }) });
  }

  return (
    <div>
      <PageHeader eyebrow="Sala en vivo" title="Quiz en tiempo real" subtitle="Todo el grupo responde a la vez. Rápido, visual y con marcador." />

      {!sessionId && (
        <div className="grid cols-2" style={{ alignItems: 'stretch' }}>
          <section className="hero" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Tile icon={Radio} tone="coral" large />
              <h2 className="display" style={{ fontSize: 36, marginTop: 16 }}>Únete a la sala</h2>
              <p style={{ marginTop: 8 }}>Escribe el código que proyecta tu docente.</p>
              <form onSubmit={join} className="row g-8" style={{ marginTop: 22 }}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  style={{ flex: 1, minWidth: 0, fontSize: 24, fontWeight: 800, letterSpacing: '.2em', textAlign: 'center', padding: '14px', borderRadius: 16, border: '2px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff' }}
                />
                <button className="btn white lg" type="submit">Entrar</button>
              </form>
              {error && <p className="err" style={{ marginTop: 10, color: '#ff8a9a' }}>{error}</p>}
            </div>
          </section>
          {!isStaff && (
            <section className="card" style={{ padding: 28 }}>
              <div className="card-title" style={{ marginBottom: 16 }}>Cómo se juega</div>
              <div className="grid cols-2" style={{ gap: 10 }}>
                {liveColors.map((color, i) => (
                  <div key={i} className="row g-12" style={{ background: color.bg, color: '#fff', borderRadius: 16, padding: '16px 14px', boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.15)' }}>
                    <color.icon size={22} fill="#fff" />
                    <b>{['Lee la pregunta', 'Elige tu color', 'Responde rápido', 'Suma XP'][i]}</b>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 16, fontSize: 14, lineHeight: 1.55 }}>
                Cuando el docente lance una pregunta aparecerá aquí al instante. Solo tienes un intento por pregunta.
              </p>
            </section>
          )}
          {isStaff && (
            <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 32 }}>
              <Tile icon={Users} tone="violet" large />
              <h2 style={{ fontSize: 26, marginTop: 16 }}>Abrir una sala</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                {params.get('assessment') ? 'La evaluación está lista. Abre la sala y comparte el código con el grupo.' : 'Elige una evaluación desde la mesa del curso con «Abrir en vivo».'}
              </p>
              {params.get('assessment') && <button className="btn lg" style={{ marginTop: 20, alignSelf: 'flex-start' }} onClick={openRoom}><Radio size={18} /> Abrir sala</button>}
            </section>
          )}
        </div>
      )}

      {sessionId && (
        <div className="stack g-20">
          <div className="row between wrap g-12">
            {code && (
              <div className="card row g-16" style={{ padding: '14px 20px' }}>
                <Hash size={22} color="var(--violet)" />
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>CÓDIGO DE LA SALA</div>
                  <div className="display" style={{ fontSize: 32, letterSpacing: '.18em' }}>{code}</div>
                </div>
              </div>
            )}
            <div className="row g-8">
              {question && <span className="chip violet" style={{ fontSize: 14, padding: '8px 14px' }}>Pregunta {question.position} / {question.total}</span>}
              <span className="chip mint" style={{ fontSize: 14, padding: '8px 14px' }}><Users size={14} /> {progress} respuestas</span>
              {isStaff && <button className="btn" onClick={next}>Siguiente pregunta <ArrowRight size={16} /></button>}
            </div>
          </div>

          {!question && !ended && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ display: 'inline-block' }}>
                <Tile icon={Radio} tone="coral" large />
              </motion.div>
              <h2 style={{ marginTop: 16 }}>{isStaff ? 'Pulsa «Siguiente pregunta» para empezar' : 'Esperando a que el docente inicie…'}</h2>
            </div>
          )}

          {question && !ended && (
            <AnimatePresence mode="wait">
              <motion.div key={question.questionId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="stack g-20">
                <div className="card" style={{ padding: '36px 28px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: 'clamp(24px, 3vw, 34px)' }}>{question.prompt}</h2>
                </div>
                <div className="kahoot">
                  {question.options.map((option, i) => {
                    const color = liveColors[i % liveColors.length]!;
                    return (
                      <motion.button
                        key={option.id}
                        whileHover={{ scale: picked ? 1 : 1.02 }}
                        whileTap={{ scale: 0.97 }}
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
              </motion.div>
            </AnimatePresence>
          )}

          {ended && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <Tile icon={Check} tone="mint" large />
              <h2 style={{ marginTop: 16 }}>La sala cerró</h2>
              <p className="muted" style={{ marginTop: 6 }}>Gracias por participar.</p>
              <Link to="/app" className="btn" style={{ marginTop: 18 }}>Volver al inicio</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
