import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import {
  ArrowRight,
  Check,
  Circle,
  Crown,
  Diamond,
  Hand,
  Loader2,
  Lock,
  LockOpen,
  Maximize2,
  Pause,
  Play,
  Plus,
  Shuffle,
  Square,
  Swords,
  Timer,
  Triangle,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { api, ApiException, getToken } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { SpeakButton } from '@/shared/voice-ui';
import { Empty, PageHeader, Reveal, Ring, Tile } from '@/ui';

type Phase = 'lobby' | 'question' | 'vote' | 'feedback' | 'table' | 'podium' | 'ended';
interface Member { id: string; name: string }
interface Team { id: string; name: string; color: string; score: number | null; captainId: string | null; locked: boolean; members: Member[] }
interface Option { id: string; label: string; text: string }
interface RevealRow { teamId: string; optionId: string | null; order: number; correct: boolean | null; points: number | null }
interface ArenaState {
  id: string;
  code: string;
  title: string;
  status: Phase;
  index: number;
  total: number;
  teamSize: number;
  questionSec: number;
  serverNow: number;
  endsAt: number | null;
  durationMs: number;
  paused: boolean;
  pausedRemaining: number | null;
  role: 'host' | 'player';
  teams: Team[];
  question: { prompt: string; options: Option[]; correctId: string | null; explanation: string | null } | null;
  reveal: RevealRow[];
  me: { teamId: string; captain: boolean; vote: string | null; lock: string | null; commandAt: number | null; teamVotes: Record<string, string[]> } | null;
  ranking: { teamId: string; rank: number; score: number; correct: number }[] | null;
}
interface RoomCard { id: string; code: string; title: string; status: Phase; created_at: string; course_title: string; players: number; joined: boolean; questions: number }

const OPTION_STYLES = [
  { bg: 'linear-gradient(135deg, #ff5d73, #e23b57)', icon: Triangle },
  { bg: 'linear-gradient(135deg, #3ab8ff, #2a7de1)', icon: Diamond },
  { bg: 'linear-gradient(135deg, #ffc83d, #f59e0b)', icon: Circle },
  { bg: 'linear-gradient(135deg, #19c39c, #0e9f7e)', icon: Square },
];

const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Sala de espera',
  question: 'Pregunta en curso',
  vote: 'Abriendo candados',
  feedback: 'Retroalimentación',
  table: 'Tabla de posiciones',
  podium: 'Podio',
  ended: 'Terminada',
};

function joinUrl(code: string) {
  return `${window.location.origin}/app/arena?codigo=${code}`;
}

function errorText(e: unknown, fallback: string) {
  return e instanceof ApiException ? e.message : fallback;
}

/* ---------- Estado en vivo ---------- */

function useArena(id: string) {
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: ['arena', id], queryFn: () => api<ArenaState>(`/api/arena/rooms/${id}`), refetchInterval: 15_000, retry: false });
  useEffect(() => {
    if (query.data) setOffset(query.data.serverNow - Date.now());
  }, [query.data]);
  useEffect(() => {
    const socket = io({ auth: (cb) => cb({ token: getToken() }) });
    socket.on('connect', () => client.invalidateQueries({ queryKey: ['arena', id] }));
    socket.on('arena:state', (state: ArenaState) => {
      if (state.id === id) client.setQueryData(['arena', id], state);
    });
    return () => {
      socket.disconnect();
    };
  }, [id, client]);
  return { ...query, offset };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function remainingMs(state: ArenaState, offset: number, now: number) {
  if (state.paused) return state.pausedRemaining ?? 0;
  if (state.endsAt === null) return 0;
  return Math.max(0, state.endsAt - (now + offset));
}

function Countdown({ state, offset, size = 76 }: { state: ArenaState; offset: number; size?: number }) {
  const now = useNow(state.status === 'question' && !state.paused);
  const left = remainingMs(state, offset, now);
  const seconds = Math.ceil(left / 1000);
  return (
    <Ring value={(left / Math.max(1, state.durationMs)) * 100} size={size} stroke={Math.round(size / 9)} color={seconds <= 5 ? '#ff5d73' : 'url(#ringGrad)'} track="rgba(124,92,255,.18)">
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: size / 3.4 }}>{state.paused ? <Pause size={size / 3.2} /> : seconds}</div>
    </Ring>
  );
}

function QrCode({ text, size = 180 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#140f2e', light: '#ffffff' } }).then(setSvg).catch(() => setSvg(''));
  }, [text]);
  return <div className="qr" style={{ width: size, height: size }} aria-label={`Código QR para unirse: ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ---------- Piezas compartidas ---------- */

function teamOf(state: ArenaState, teamId: string) {
  return state.teams.find((team) => team.id === teamId);
}

function optionLabel(state: ArenaState, optionId: string | null) {
  const index = state.question?.options.findIndex((option) => option.id === optionId) ?? -1;
  return index >= 0 ? state.question!.options[index]! : null;
}

function OptionGrid({ state, onPick, disabled }: { state: ArenaState; onPick?: (optionId: string) => void; disabled?: boolean }) {
  const revealed = state.question?.correctId ?? null;
  return (
    <div className="kahoot arena-options">
      {state.question?.options.map((option, i) => {
        const style = OPTION_STYLES[i % OPTION_STYLES.length]!;
        const voters = state.me?.teamVotes[option.id] ?? [];
        const mine = state.me?.vote === option.id || state.me?.lock === option.id;
        const cls = [revealed ? (revealed === option.id ? 'correct' : 'dim') : '', mine && !revealed ? 'voted' : ''].join(' ');
        return (
          <motion.button
            key={option.id}
            type="button"
            className={cls}
            style={{ background: style.bg }}
            whileTap={onPick && !disabled ? { scale: 0.97 } : undefined}
            disabled={!onPick || disabled}
            onClick={() => onPick?.(option.id)}
          >
            <style.icon size={26} fill="#fff" />
            <span style={{ flex: 1 }}>
              <small className="opt-label">{option.label}</small> {option.text}
              {!!voters.length && (
                <span className="voters">{voters.map((name) => <span key={name}>{name.split(' ')[0]}</span>)}</span>
              )}
            </span>
            {revealed === option.id && <Check size={26} />}
            {state.me?.lock === option.id && !revealed && <Lock size={22} />}
          </motion.button>
        );
      })}
    </div>
  );
}

function LockStrip({ state }: { state: ArenaState }) {
  return (
    <div className="lock-strip">
      {state.teams.map((team) => (
        <motion.div key={team.id} className={`lock-pill ${team.locked ? 'on' : ''}`} style={{ borderColor: team.color }} animate={team.locked ? { scale: [1, 1.12, 1] } : {}}>
          {team.locked ? <Lock size={15} color={team.color} /> : <LockOpen size={15} />} {team.name}
        </motion.div>
      ))}
    </div>
  );
}

function RevealList({ state, highlight }: { state: ArenaState; highlight?: string }) {
  const ordered = [...state.reveal].sort((a, b) => a.order - b.order);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {ordered.map((row) => {
        const team = teamOf(state, row.teamId);
        const option = optionLabel(state, row.optionId);
        return (
          <motion.div
            key={row.teamId}
            className={`reveal-row ${row.teamId === highlight ? 'mine' : ''} ${row.correct === true ? 'ok' : row.correct === false ? 'bad' : ''}`}
            style={{ borderLeftColor: team?.color }}
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: state.status === 'vote' ? (row.order - 1) * 0.8 : 0 }}
          >
            <motion.span initial={{ rotate: 0 }} animate={{ rotate: state.status === 'vote' ? [0, -18, 0] : 0 }} transition={{ delay: (row.order - 1) * 0.8 + 0.2 }}>
              <LockOpen size={20} color={team?.color} />
            </motion.span>
            <b style={{ minWidth: 120 }}>{team?.name}</b>
            <span style={{ flex: 1 }}>{option ? <><b>{option.label}.</b> {option.text}</> : <span className="muted">Sin respuesta</span>}</span>
            {row.correct !== null && (row.correct ? <span className="chip mint">+{row.points}</span> : <span className="chip coral">0</span>)}
          </motion.div>
        );
      })}
    </div>
  );
}

function Leaderboard({ state, highlight }: { state: ArenaState; highlight?: string }) {
  const teams = [...state.teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = Math.max(1, ...teams.map((team) => team.score ?? 0));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {teams.map((team, i) => (
        <motion.div key={team.id} layout className={`leader-row ${team.id === highlight ? 'mine' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
          <span className="leader-pos">{i + 1}</span>
          <b style={{ minWidth: 130 }}>{team.name}</b>
          <div className="leader-bar">
            <motion.span style={{ background: team.color }} initial={{ width: 0 }} animate={{ width: `${((team.score ?? 0) / top) * 100}%` }} transition={{ duration: 0.9, delay: i * 0.08 }} />
          </div>
          <b style={{ minWidth: 54, textAlign: 'right' }}>{team.score ?? '—'}</b>
        </motion.div>
      ))}
    </div>
  );
}

function Podium({ state, highlight }: { state: ArenaState; highlight?: string }) {
  const ranking = state.ranking ?? [];
  const slots = [ranking[1], ranking[0], ranking[2]];
  const delays = [1.0, 1.8, 0.2];
  return (
    <div>
      <div className="podium">
        {slots.map((entry, i) => {
          if (!entry) return <div key={i} />;
          const team = teamOf(state, entry.teamId);
          return (
            <motion.div key={entry.teamId} className={`podium-step p${entry.rank} ${entry.teamId === highlight ? 'mine' : ''}`} initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delays[i], type: 'spring', stiffness: 120 }}>
              <div className="podium-team">
                {entry.rank === 1 && <Crown size={30} color="#ffc83d" />}
                <b>{team?.name}</b>
                <small>{entry.score} pts · {entry.correct} aciertos</small>
                <span className="podium-members">{team?.members.map((m) => m.name.split(' ')[0]).join(', ')}</span>
              </div>
              <div className="podium-block" style={{ background: team?.color }}>{entry.rank}</div>
            </motion.div>
          );
        })}
      </div>
      {ranking.length > 3 && (
        <div className="stack" style={{ gap: 6, marginTop: 18 }}>
          {ranking.slice(3).map((entry) => (
            <div key={entry.teamId} className="row between" style={{ padding: '6px 10px' }}>
              <span>{entry.rank}. {teamOf(state, entry.teamId)?.name}</span>
              <b>{entry.score} pts</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Suspense() {
  return (
    <div style={{ textAlign: 'center', padding: '30px 0' }}>
      <motion.div animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ display: 'inline-block' }}>
        <Trophy size={72} color="#ffc83d" />
      </motion.div>
      <h2 style={{ marginTop: 14 }}>¿Quién ganó?</h2>
      <p className="muted">El docente revelará el podio en un momento.</p>
    </div>
  );
}

/** Lo que ve el proyector; el moderador ve lo mismo en miniatura. */
function Stage({ state, offset, big }: { state: ArenaState; offset: number; big?: boolean }) {
  const last = state.index + 1 >= state.total;
  return (
    <div className={`stage ${big ? 'big' : ''}`}>
      {state.status === 'lobby' && (
        <div className="stage-lobby">
          <div style={{ textAlign: 'center' }}>
            <div className="muted-light">Entra a <b>{window.location.host}/app/arena</b> o escanea</div>
            <div className="arena-code">{state.code}</div>
            <QrCode text={joinUrl(state.code)} size={big ? 260 : 150} />
          </div>
          <div className="arena-teams">
            {state.teams.map((team) => (
              <motion.div key={team.id} layout className="team-card" style={{ borderTopColor: team.color }}>
                <b style={{ color: team.color }}>{team.name}</b>
                <div className="team-members">
                  <AnimatePresence>
                    {team.members.map((member) => (
                      <motion.span key={member.id} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>{member.name.split(' ')[0]}</motion.span>
                    ))}
                  </AnimatePresence>
                  {!team.members.length && <span className="empty-slot">Esperando…</span>}
                </div>
              </motion.div>
            ))}
            {!state.teams.length && <p className="muted-light">Aún no entra nadie. Comparte el código.</p>}
          </div>
        </div>
      )}

      {state.question && (state.status === 'question' || state.status === 'vote' || state.status === 'feedback') && (
        <div className="stack" style={{ gap: big ? 24 : 14 }}>
          <div className="row between g-12">
            <span className="chip violet">Pregunta {state.index + 1} de {state.total}</span>
            {state.status === 'question' && <Countdown state={state} offset={offset} size={big ? 110 : 64} />}
          </div>
          <h2 className="stage-prompt">{state.question.prompt}</h2>
          {state.status !== 'vote' && <OptionGrid state={state} />}
          {state.status === 'question' && (state.paused ? <div className="paused-banner"><Pause size={18} /> En pausa</div> : <LockStrip state={state} />)}
          {state.status === 'vote' && (
            <>
              <h3 className="row g-8" style={{ margin: 0 }}><LockOpen size={20} /> Abriendo candados…</h3>
              <RevealList state={state} />
            </>
          )}
          {state.status === 'feedback' && (
            <>
              {state.question.explanation && <p className="stage-explain">{state.question.explanation}</p>}
              <RevealList state={state} />
            </>
          )}
        </div>
      )}

      {state.status === 'table' && (
        <div>
          <h2 style={{ marginTop: 0 }}>Tabla tras {state.index + 1} de {state.total} preguntas</h2>
          <Leaderboard state={state} />
          {last && <p className="muted-light">Siguiente: el podio.</p>}
        </div>
      )}
      {state.status === 'podium' && <Suspense />}
      {state.status === 'ended' && <Podium state={state} />}
    </div>
  );
}

/* ---------- Página principal: unirse o crear ---------- */

export function ArenaPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const canCreate = user?.role === 'teacher' || user?.role === 'admin';
  const rooms = useQuery({ queryKey: ['arena-rooms'], queryFn: () => api<RoomCard[]>('/api/arena/rooms'), refetchInterval: 10_000 });
  const open = rooms.data?.filter((room) => room.status !== 'ended') ?? [];
  const past = rooms.data?.filter((room) => room.status === 'ended') ?? [];

  return (
    <div>
      <PageHeader eyebrow="Arena" title="Arena por equipos" subtitle="Equipos de hasta 5, capitán rotativo y candados que se abren en vivo. La respuesta correcta solo aparece cuando todos cierran." />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2 stack" style={{ gap: 16 }}>
          {isStudent && <JoinCard />}
          {canCreate && <CreateRoom />}
          {!isStudent && !canCreate && <Empty icon={Swords} title="Solo lectura" body="Coordinación ve las salas recientes del colegio." />}
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <h3 style={{ margin: 0 }}>{isStudent ? 'Salas abiertas de tus cursos' : 'Salas recientes'}</h3>
          {!open.length && <p className="muted" style={{ margin: 0 }}>No hay salas abiertas.</p>}
          {open.map((room) => <RoomRow key={room.id} room={room} isStudent={isStudent} />)}
          {!!past.length && <h3 style={{ margin: '12px 0 0' }}>Terminadas</h3>}
          {past.slice(0, 6).map((room) => <RoomRow key={room.id} room={room} isStudent={isStudent} />)}
        </div>
      </div>
    </div>
  );
}

function RoomRow({ room, isStudent }: { room: RoomCard; isStudent: boolean }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function enter() {
    if (!isStudent || room.joined) return navigate(`/app/arena/${room.id}`);
    try {
      const joined = await api<{ id: string }>('/api/arena/join', { method: 'POST', body: JSON.stringify({ code: room.code }) });
      navigate(`/app/arena/${joined.id}`);
    } catch (e) {
      setError(errorText(e, 'No se pudo entrar'));
    }
  }
  return (
    <div className="card topic-card">
      <div className="row between g-8">
        <b style={{ fontSize: 14 }}>{room.title}</b>
        <span className={`chip ${room.status === 'ended' ? '' : room.status === 'lobby' ? 'mint' : 'coral'}`}>{PHASE_LABEL[room.status]}</span>
      </div>
      <div className="muted" style={{ fontSize: 12.5, margin: '6px 0 10px' }}>{room.course_title} · {room.questions} preguntas · {room.players} jugadores · código {room.code}</div>
      {(room.status !== 'ended' || !isStudent || room.joined) && (
        <button className="btn sm ghost" onClick={enter}>{isStudent && !room.joined ? 'Unirme' : room.status === 'ended' ? 'Ver podio' : 'Entrar'} <ArrowRight size={14} /></button>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function JoinCard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('codigo')?.toUpperCase() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function join(value: string) {
    setBusy(true);
    setError('');
    try {
      const joined = await api<{ id: string }>('/api/arena/join', { method: 'POST', body: JSON.stringify({ code: value }) });
      navigate(`/app/arena/${joined.id}`);
    } catch (e) {
      setError(errorText(e, 'No encontramos esa sala'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const fromQr = params.get('codigo');
    if (fromQr && /^[A-Za-z2-9]{6}$/.test(fromQr)) void join(fromQr.toUpperCase());
    // El código del QR se usa una sola vez al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length === 6) void join(code);
  }

  return (
    <section className="hero">
      <div style={{ position: 'relative' }}>
        <Tile icon={Swords} tone="coral" large />
        <h2 className="display" style={{ fontSize: 34, marginTop: 16 }}>Únete a tu equipo</h2>
        <p style={{ marginTop: 8 }}>Escribe el código que proyecta tu docente o escanea el QR con la cámara.</p>
        <form onSubmit={submit} className="row g-8" style={{ marginTop: 20 }}>
          <input className="arena-code-input" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="CÓDIGO" aria-label="Código de la sala" />
          <button className="btn white lg" type="submit" disabled={busy || code.length !== 6}>{busy ? <Loader2 size={18} className="spin" /> : 'Entrar'}</button>
        </form>
        {error && <p style={{ marginTop: 10, color: '#ff8a9a', fontWeight: 700 }}>{error}</p>}
      </div>
    </section>
  );
}

function CreateRoom() {
  const navigate = useNavigate();
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  const [courseId, setCourseId] = useState('');
  const selected = courseId || courses.data?.[0]?.id || '';
  const assessments = useQuery({
    queryKey: ['assessments', selected],
    queryFn: () => api<{ id: string; title: string; kind: string }[]>(`/api/courses/${selected}/assessments`),
    enabled: Boolean(selected),
  });
  const [assessmentId, setAssessmentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const title = String(data.get('title') ?? '').trim();
      const room = await api<{ id: string }>('/api/arena/rooms', {
        method: 'POST',
        body: JSON.stringify({
          courseId: selected,
          ...(title ? { title } : {}),
          ...(assessmentId ? { assessmentId } : { count: Number(data.get('count')) }),
          teamSize: Number(data.get('teamSize')),
          questionSec: Number(data.get('questionSec')),
        }),
      });
      navigate(`/app/arena/${room.id}`);
    } catch (e) {
      setError(errorText(e, 'No se pudo abrir la sala'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ marginTop: 0 }} className="row g-8"><Plus size={18} /> Abrir una sala</h3>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <label className="field">Curso
          <select value={selected} onChange={(e) => { setCourseId(e.target.value); setAssessmentId(''); }}>
            {courses.data?.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <label className="field">Preguntas
          <select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
            <option value="">Al azar del banco de la materia</option>
            {assessments.data?.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
        <label className="field">Título (opcional)
          <input name="title" maxLength={120} placeholder="Arena de fracciones" />
        </label>
        {!assessmentId && (
          <label className="field">Cantidad
            <select name="count" defaultValue="8">{[5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n} preguntas</option>)}</select>
          </label>
        )}
        <label className="field">Integrantes por equipo
          <select name="teamSize" defaultValue="5">{[2, 3, 4, 5].map((n) => <option key={n} value={n}>Hasta {n}</option>)}</select>
        </label>
        <label className="field">Tiempo por pregunta
          <select name="questionSec" defaultValue="45">{[20, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{n} segundos</option>)}</select>
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !selected}>{busy ? <Loader2 size={16} className="spin" /> : <Swords size={16} />} Abrir sala</button>
    </form>
  );
}

/* ---------- Sala ---------- */

export function ArenaRoomPage() {
  const { id = '' } = useParams();
  const arena = useArena(id);
  if (arena.error) {
    return (
      <div>
        <PageHeader eyebrow="Arena" title="No puedes ver esta sala" subtitle={errorText(arena.error, 'La sala no existe')} />
        <Link className="btn" to="/app/arena">Volver a la Arena</Link>
      </div>
    );
  }
  if (!arena.data) return <p className="muted"><Loader2 size={16} className="spin" /> Conectando con la sala…</p>;
  return arena.data.role === 'host' ? <ModeratorView state={arena.data} offset={arena.offset} /> : <PlayerView state={arena.data} offset={arena.offset} />;
}

export function ArenaProjectorPage() {
  const { id = '' } = useParams();
  const arena = useArena(id);
  const state = arena.data;
  return (
    <div className="kiosk projector">
      <div className="kiosk-top">
        <div className="row g-12">
          <img src="/favicon.svg" alt="" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <b style={{ fontSize: 20 }}>{state?.title ?? 'Arena'}</b>
        </div>
        {state && <span className="chip violet" style={{ fontSize: 15 }}>{PHASE_LABEL[state.status]} · código {state.code}</span>}
      </div>
      <div className="projector-body">
        {arena.error && <p>{errorText(arena.error, 'No se pudo abrir la sala')}</p>}
        {state && <Stage state={state} offset={arena.offset} big />}
      </div>
    </div>
  );
}

function nextLabel(state: ArenaState) {
  const last = state.index + 1 >= state.total;
  switch (state.status) {
    case 'lobby': return 'Empezar';
    case 'question': return 'Cerrar candados';
    case 'vote': return 'Mostrar respuesta';
    case 'feedback': return last ? 'Ir al podio' : 'Ver tabla';
    case 'table': return last ? 'Ir al podio' : 'Siguiente pregunta';
    case 'podium': return 'Revelar podio';
    default: return null;
  }
}

function ModeratorView({ state, offset }: { state: ArenaState; offset: number }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const players = state.teams.reduce((sum, team) => sum + team.members.length, 0);
  const teams = state.teams.filter((team) => team.members.length).length;
  const label = nextLabel(state);

  async function control(action: 'rebalance' | 'start' | 'next' | 'pause' | 'resume' | 'extra') {
    setBusy(true);
    setError('');
    try {
      const fresh = await api<ArenaState>(`/api/arena/rooms/${state.id}/control`, { method: 'POST', body: JSON.stringify({ action }) });
      client.setQueryData(['arena', state.id], fresh);
    } catch (e) {
      setError(errorText(e, 'No se pudo aplicar'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Arena · moderador"
        title={state.title}
        subtitle={`${players} ${players === 1 ? 'jugador' : 'jugadores'} en ${teams} ${teams === 1 ? 'equipo' : 'equipos'} · ${state.total} preguntas · ${state.questionSec} s por pregunta`}
        actions={<button className="btn ghost" onClick={() => window.open(`/arena/${state.id}/proyector`, '_blank', 'noopener')}><Maximize2 size={16} /> Abrir proyector</button>}
      />
      <div className="card row between wrap g-12" style={{ marginBottom: 16 }}>
        <div className="row g-12 wrap">
          <span className="chip violet" style={{ fontSize: 14, padding: '8px 14px' }}>Código {state.code}</span>
          <span className="chip">{PHASE_LABEL[state.status]}</span>
          {state.status === 'question' && <Countdown state={state} offset={offset} size={48} />}
        </div>
        <div className="row g-8 wrap">
          {state.status === 'lobby' && <button className="btn ghost" disabled={busy || !players} onClick={() => control('rebalance')}><Shuffle size={16} /> Equipos parejos</button>}
          {state.status === 'question' && (state.paused
            ? <button className="btn ghost" disabled={busy} onClick={() => control('resume')}><Play size={16} /> Reanudar</button>
            : <button className="btn ghost" disabled={busy} onClick={() => control('pause')}><Pause size={16} /> Pausa</button>)}
          {state.status === 'question' && <button className="btn ghost" disabled={busy} onClick={() => control('extra')}><Timer size={16} /> +15 s</button>}
          {label && <button className={`btn ${state.status === 'podium' ? 'gold' : ''}`} disabled={busy || (state.status === 'lobby' && !players)} onClick={() => control(state.status === 'lobby' ? 'start' : 'next')}>{busy ? <Loader2 size={16} className="spin" /> : state.status === 'podium' ? <Trophy size={16} /> : <ArrowRight size={16} />} {label}</button>}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2">
          <Stage state={state} offset={offset} />
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>Equipos</h3>
          {state.teams.map((team) => (
            <div key={team.id} className="card team-side" style={{ borderLeftColor: team.color }}>
              <div className="row between">
                <b>{team.name}</b>
                <span className="row g-8">
                  {state.status === 'question' && (team.locked ? <span className="chip mint"><Lock size={12} /> Cerrado</span> : <span className="chip"><LockOpen size={12} /> Abierto</span>)}
                  <b>{team.score ?? '—'}</b>
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {team.members.map((member) => (
                  <span key={member.id} className="row g-4" style={{ display: 'inline-flex', marginRight: 10 }}>
                    {member.id === team.captainId && <Crown size={12} color="#e0a800" />}{member.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!state.teams.length && <p className="muted">Proyecta el código y espera a los equipos.</p>}
        </div>
      </div>
    </div>
  );
}

function PlayerView({ state, offset }: { state: ArenaState; offset: number }) {
  const client = useQueryClient();
  const team = state.me ? teamOf(state, state.me.teamId) : undefined;
  const captain = team?.members.find((member) => member.id === team.captainId);
  const now = useNow(state.status === 'question' && !state.me?.captain && !state.me?.lock);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = state.reveal.find((row) => row.teamId === state.me?.teamId);
  const myRank = state.ranking?.find((row) => row.teamId === state.me?.teamId);
  const commandIn = state.me?.commandAt ? Math.ceil((state.me.commandAt - (now + offset)) / 1000) : null;
  const locked = Boolean(state.me?.lock);

  async function act(path: string, body?: object) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/arena/rooms/${state.id}/${path}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      await client.invalidateQueries({ queryKey: ['arena', state.id] });
    } catch (e) {
      setError(errorText(e, 'No se pudo enviar'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="player">
      <div className="row between wrap g-12" style={{ marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Arena · {state.title}</div>
          <h1 className="row g-8" style={{ margin: '4px 0 0', fontSize: 26 }}>
            <span className="team-dot" style={{ background: team?.color }} /> {team?.name ?? 'Sin equipo'}
          </h1>
        </div>
        <div className="row g-12">
          {state.status !== 'lobby' && state.status !== 'ended' && <span className="chip violet">Pregunta {state.index + 1} / {state.total}</span>}
          {state.status === 'question' && <Countdown state={state} offset={offset} size={56} />}
        </div>
      </div>

      {state.status === 'lobby' && (
        <Reveal>
          <div className="card" style={{ textAlign: 'center', padding: 36 }}>
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ display: 'inline-block' }}>
              <Tile icon={Users} tone="violet" large />
            </motion.div>
            <h2 style={{ marginTop: 14 }}>¡Estás dentro!</h2>
            <p className="muted">Tu equipo: {team?.members.map((m) => m.name).join(', ')}. Cuando el docente empiece verás la primera pregunta.</p>
          </div>
        </Reveal>
      )}

      {state.status === 'question' && state.question && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="card row g-12" style={{ padding: '22px 22px' }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: 'clamp(19px, 2.4vw, 26px)' }}>{state.question.prompt}</h2>
            <SpeakButton text={state.question.prompt} label="Leer" />
          </div>
          {state.paused && <div className="paused-banner"><Pause size={18} /> El docente pausó la pregunta</div>}
          <OptionGrid state={state} disabled={locked || state.paused || busy} onPick={(optionId) => act('vote', { optionId })} />
          <div className={`card captain-bar ${locked ? 'locked' : ''}`}>
            {locked ? (
              <span className="row g-8"><Lock size={18} /> Candado cerrado con la opción <b>{optionLabel(state, state.me!.lock)?.label}</b>. Espera a los demás equipos.</span>
            ) : state.me?.captain ? (
              <>
                <span className="row g-8"><Crown size={18} color="#e0a800" /> Eres el capitán: escucha los votos y cierra el candado.</span>
                <button className="btn" disabled={!state.me.vote || busy || state.paused} onClick={() => act('lock', { optionId: state.me!.vote })}>
                  <Lock size={16} /> Cerrar con {optionLabel(state, state.me.vote)?.label ?? '…'}
                </button>
              </>
            ) : (
              <>
                <span className="row g-8"><Crown size={18} color="#e0a800" /> Capitán: <b>{captain?.name ?? '—'}</b>. Vota para ayudarle.</span>
                <button className="btn ghost" disabled={busy || state.paused || (commandIn !== null && commandIn > 0)} onClick={() => act('command')}>
                  <Hand size={16} /> {commandIn !== null && commandIn > 0 ? `Tomar el mando en ${commandIn} s` : 'Tomar el mando'}
                </button>
              </>
            )}
          </div>
          <LockStrip state={state} />
        </div>
      )}

      {(state.status === 'vote' || state.status === 'feedback') && state.question && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="card"><h2 style={{ margin: 0, fontSize: 22 }}>{state.question.prompt}</h2></div>
          {state.status === 'feedback' && mine && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`card verdict ${mine.correct ? 'ok' : 'bad'}`}>
              {mine.correct ? <><Check size={28} /> ¡Correcto! +{mine.points} puntos</> : <><X size={28} /> Esta vez no. La respuesta era {optionLabel(state, state.question.correctId)?.label}.</>}
            </motion.div>
          )}
          {state.status === 'feedback' && <OptionGrid state={state} />}
          {state.status === 'feedback' && state.question.explanation && <p className="hint">{state.question.explanation}</p>}
          <div className="card">
            <h3 className="row g-8" style={{ marginTop: 0 }}><LockOpen size={18} /> {state.status === 'vote' ? 'Abriendo candados…' : 'Lo que eligió cada equipo'}</h3>
            <RevealList state={state} highlight={state.me?.teamId} />
          </div>
        </div>
      )}

      {state.status === 'table' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Tabla de posiciones</h3>
          <Leaderboard state={state} highlight={state.me?.teamId} />
        </div>
      )}

      {state.status === 'podium' && <div className="card"><Suspense /></div>}

      {state.status === 'ended' && (
        <div className="card">
          <h2 style={{ marginTop: 0, textAlign: 'center' }}>{myRank?.rank === 1 ? '¡Tu equipo ganó la Arena!' : myRank ? `Tu equipo quedó en el puesto ${myRank.rank}` : 'La Arena terminó'}</h2>
          <Podium state={state} highlight={state.me?.teamId} />
          <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>Sumaste XP por jugar, por cada acierto del equipo y por el podio.</p>
          <div style={{ textAlign: 'center' }}><Link className="btn" to="/app/arena">Volver a la Arena</Link></div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
