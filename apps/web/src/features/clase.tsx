import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import { CheckCircle2, Crown, Flame, Loader2, QrCode, Timer, Users } from 'lucide-react';
import { api, ApiException, download, getToken } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { PageHeader } from '@/ui';
import { CoopBoard, PlayBoard } from './clase-plays';

type Activity = string;

interface SessionRow {
  id: string;
  code: string;
  title: string;
  gradeName: string;
  groupCode: string;
  activity: Activity;
  activities?: ActivityInfo[];
  status: 'open' | 'closed';
  openedAt: string;
  joined: number;
}

interface Option { id: string; text: string }
interface Item { id: string; topic: string; prompt: string; options: Option[]; input?: boolean }
interface Scene { id: string; text: string; prompt?: string; options?: Option[]; end?: boolean }
interface ActivityInfo { id: Activity; label: string; hint: string }

export function ClassPage() {
  const { user } = useAuth();
  if (user?.role === 'teacher' || user?.role === 'admin') return <Desk />;
  if (user?.isGuest) return <Play />;
  return <div className="card"><h1>Esta clase es para invitados</h1><p className="muted">Entra con el código QR de tu docente.</p></div>;
}

function Desk() {
  const client = useQueryClient();
  const sessions = useQuery({ queryKey: ['guest-sessions'], queryFn: () => api<SessionRow[]>('/api/clase/sesiones') });
  const [grade, setGrade] = useState(8);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = (sessions.data ?? []).find((s) => s.id === openId) ?? (sessions.data ?? []).find((s) => s.status === 'open') ?? null;

  async function create() {
    setBusy(true);
    setError('');
    try {
      const row = await api<SessionRow>('/api/clase/sesiones', { method: 'POST', body: JSON.stringify({ grade }) });
      setOpenId(row.id);
      void client.invalidateQueries({ queryKey: ['guest-sessions'] });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo abrir');
    } finally {
      setBusy(false);
    }
  }

  async function setActivity(activity: Activity) {
    if (!current) return;
    await api(`/api/clase/sesiones/${current.id}`, { method: 'PATCH', body: JSON.stringify({ activity }) });
    void client.invalidateQueries({ queryKey: ['guest-sessions'] });
    void client.invalidateQueries({ queryKey: ['guest-board', current.id] });
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader eyebrow="Clase de hoy" title="Sesiones de invitados" subtitle="El grupo escanea el QR, escribe su nombre y entra como Estudiante (Invitado · grado). La sesión no se borra." />
      <div className="card">
        <p><b>Para 50 estudiantes durante las dos horas</b> el plan gratuito de Render se duerme y se queda corto de memoria. Antes de la clase hay que pasar el servicio a un plan que no se apague (Starter o superior) y abrir la página unos minutos antes para que no arranque en frío.</p>
      </div>
      <div className="card">
        <div className="row g-8 wrap">
          <label className="field" style={{ margin: 0 }}>Grado
            <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>{[6, 7, 8, 9].map((g) => <option key={g} value={g}>{['', '', '', '', '', '', 'Sexto', 'Séptimo', 'Octavo', 'Noveno'][g]}</option>)}</select>
          </label>
          <button className="btn" disabled={busy} onClick={create}>{busy ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />} Abrir sesión</button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
      {current && <Live session={current} onActivity={setActivity} onClose={async () => { await api(`/api/clase/sesiones/${current.id}/cerrar`, { method: 'POST' }); void client.invalidateQueries({ queryKey: ['guest-sessions'] }); }} />}
      <div className="card">
        <h2 style={{ fontSize: 18 }}>Sesiones guardadas</h2>
        <div className="stack g-8" style={{ marginTop: 12 }}>
          {(sessions.data ?? []).map((row) => (
            <label key={row.id} className="row g-8" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={picked.includes(row.id)} onChange={() => setPicked(picked.includes(row.id) ? picked.filter((id) => id !== row.id) : [...picked, row.id])} />
              <button className="btn sm ghost" onClick={() => setOpenId(row.id)}>{row.title}</button>
              <span className="chip">{row.groupCode}</span>
              <span className="muted">{row.status === 'open' ? 'Abierta' : 'Cerrada'} · {row.joined} estudiantes</span>
            </label>
          ))}
          {!sessions.data?.length && <p className="muted">Todavía no hay sesiones.</p>}
        </div>
        <div className="row g-8 wrap" style={{ marginTop: 14 }}>
          <label className="field" style={{ margin: 0 }}>Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field" style={{ margin: 0 }}>Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn sm" onClick={() => download(exportUrl(picked, from, to), 'sesiones-invitados.xlsx')}>Exportar informe</button>
        </div>
        <p className="hint">Sin marcas exporta el rango de fechas. Con marcas, solo esas sesiones. Una sola sesión también se exporta así.</p>
      </div>
    </div>
  );
}

function exportUrl(ids: string[], from: string, to: string) {
  const params = new URLSearchParams();
  if (ids.length) params.set('ids', ids.join(','));
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const q = params.toString();
  return `/api/clase/informe.xlsx${q ? `?${q}` : ''}`;
}

function Live({ session, onActivity, onClose }: { session: SessionRow; onActivity: (a: Activity) => void; onClose: () => void }) {
  const board = useQuery({
    queryKey: ['guest-board', session.id],
    queryFn: () => api<{ students: Student[]; best: Student | null }>(`/api/clase/sesiones/${session.id}/tablero`),
    refetchInterval: session.status === 'open' ? 4000 : false,
  });
  const link = `${window.location.origin}/invitado/${session.code}`;
  return (
    <div className="card">
      <div className="row between wrap g-8">
        <div>
          <h2 style={{ fontSize: 20 }}>{session.title}</h2>
          <p className="muted">{session.gradeName} · grupo {session.groupCode} · {session.joined} dentro</p>
        </div>
        {session.status === 'open' && <button className="btn ghost" onClick={onClose}>Cerrar sesión</button>}
      </div>
      {session.status === 'open' && <Qr link={link} code={session.code} />}
      <div className="seg-tabs" style={{ marginTop: 14 }}>
        {(session.activities ?? []).map((item) => (
          <button key={item.id} className={session.activity === item.id ? 'on' : ''} disabled={session.status !== 'open'} onClick={() => onActivity(item.id)} title={item.hint}>{item.label}</button>
        ))}
      </div>
      {board.data?.best && (
        <p className="row g-8" style={{ marginTop: 14 }}><Crown size={16} /> Mejor de la sesión: <b>{board.data.best.name}</b> · {board.data.best.score} puntos</p>
      )}
      <div className="stack g-8" style={{ marginTop: 12 }}>
        {(board.data?.students ?? []).map((student) => (
          <details key={student.id} className="bank-q">
            <summary className="row between"><b>{student.name}</b><span>{student.score} pts · {Math.round(student.seconds / 60)} min</span></summary>
            <p className="muted">Diagnóstico {student.games.diagnostico?.score ?? '—'} · Fábrica {student.games.fabrica?.score ?? '—'} · Dos elementos {student.games.elementos?.score ?? '—'} · Casos {student.games.casos?.score ?? '—'}</p>
            {student.wrongs.length > 0 && <p>Se le dificultó: {[...new Set(student.wrongs)].join(', ')}</p>}
          </details>
        ))}
        {!board.data?.students.length && <p className="muted">Cuando escaneen el código aparecen aquí.</p>}
      </div>
    </div>
  );
}

interface Student {
  id: string;
  name: string;
  score: number;
  seconds: number;
  wrongs: string[];
  games: Record<string, { score: number; done: boolean } | undefined>;
}

function Qr({ link, code }: { link: string; code: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { QRCode.toString(link, { type: 'svg', margin: 1, width: 220 }).then(setSvg).catch(() => setSvg('')); }, [link]);
  return (
    <div className="row g-12 wrap" style={{ marginTop: 12, alignItems: 'center' }}>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <p><b>Código {code}</b></p>
        <p className="muted" style={{ wordBreak: 'break-all' }}>{link}</p>
      </div>
    </div>
  );
}

function Play() {
  const client = useQueryClient();
  const mine = useQuery({ queryKey: ['guest-mine'], queryFn: () => api<Mine>('/api/clase/mia'), refetchInterval: 5000 });
  const id = mine.data?.session.id;
  useEffect(() => {
    if (!id) return;
    const socket = io({ auth: { token: getToken() } });
    socket.emit('clase:join', { sessionId: id });
    socket.on('clase', () => { void client.invalidateQueries({ queryKey: ['guest-mine'] }); });
    return () => { socket.disconnect(); };
  }, [id, client]);
  if (mine.isLoading) return <p className="muted row g-6"><Loader2 className="spin" size={16} /> Entrando a la clase…</p>;
  if (mine.isError) return <p className="form-error">{mine.error instanceof ApiException ? mine.error.message : 'No hay clase'}</p>;
  const data = mine.data!;
  const label = (data.session.activities ?? []).find((a) => a.id === data.activity);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <PageHeader eyebrow={`${data.session.gradeName} · grupo ${data.session.groupCode}`} title={label?.label ?? 'La clase'} subtitle={data.session.status === 'closed' ? 'Esta sesión ya cerró. Tus resultados quedan guardados.' : label?.hint} />
      {data.session.status === 'open' && (data.activity === 'diagnostico' || data.activity === 'final') && <Diagnostic play={data.play} done={data.runs[data.activity]} path={data.activity === 'final' ? '/api/clase/final' : '/api/clase/diagnostico'} />}
      {data.session.status === 'open' && data.play && 'kind' in (data.play as object) && data.activity !== 'elementos' && (
        <PlayBoard play={data.play as Record<string, unknown>} onMove={async (move) => {
          const result = await api<{ message: string }>('/api/clase/jugar', { method: 'POST', body: JSON.stringify(move) });
          void client.invalidateQueries({ queryKey: ['guest-mine'] });
          return result.message;
        }} />
      )}
      {data.session.status === 'open' && data.activity === 'elementos' && <Elements sessionId={data.session.id} />}
      <div className="card">
        <h2 style={{ fontSize: 18 }}>Tu resultado</h2>
        <div className="row g-8 wrap" style={{ marginTop: 10 }}>
          {(data.session.activities ?? []).map((item) => {
            const run = data.runs[item.id];
            return <span key={item.id} className="chip">{item.label}: {run?.done ? run.score : 'en curso o pendiente'}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

interface Run { score: number; correct: number; total: number; done: boolean }
interface Mine {
  session: SessionRow;
  activity: Activity;
  runs: Record<string, Run | undefined>;
  play: { items?: Item[]; picks?: Record<string, string>; done?: boolean; startedAt?: string | null; seconds?: number; scene?: Scene; score?: number } | null;
}

function Diagnostic({ play, done, path }: { play: Mine['play']; done?: Run; path: string }) {
  const client = useQueryClient();
  const [picks, setPicks] = useState<Record<string, string>>(play?.picks ?? {});
  const [review, setReview] = useState<{ prompt: string; ok: boolean; explain: string }[] | null>(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(20 * 60);
  useEffect(() => {
    if (!play?.startedAt || play.done) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(play.startedAt!).getTime() + (play.seconds ?? 0) * 1000 - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [play?.startedAt, play?.seconds, play?.done]);
  if (done?.done && !review) return <p className="card">Diagnóstico listo: <b>{done.score}</b> de 100 ({done.correct}/{done.total}).</p>;
  async function send(save: boolean) {
    setError('');
    try {
      const result = await api<{ review?: { prompt: string; ok: boolean; explain: string }[] }>(path, { method: 'POST', body: JSON.stringify({ picks, save: path.endsWith('diagnostico') && save }) });
      if (!save) setReview(result.review ?? []);
      void client.invalidateQueries({ queryKey: ['guest-mine'] });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo enviar');
    }
  }
  if (review) return <Review rows={review} />;
  return (
    <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); void send(false); }}>
      <p className="row g-6"><Timer size={16} /> {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
      {(play?.items ?? []).map((item, index) => (
        <fieldset key={item.id} className="stack g-8">
          <legend><b>{index + 1}. {item.prompt}</b></legend>
          {item.input || !item.options.length ? (
            <input value={picks[item.id] ?? ''} onChange={(e) => setPicks({ ...picks, [item.id]: e.target.value })} placeholder="Tu respuesta" />
          ) : item.options.map((option) => (
            <label key={option.id} className="row g-8"><input type="radio" name={item.id} checked={picks[item.id] === option.id} onChange={() => { const next = { ...picks, [item.id]: option.id }; setPicks(next); if (path.endsWith('diagnostico')) void api(path, { method: 'POST', body: JSON.stringify({ picks: next, save: true }) }); }} /> {option.text}</label>
          ))}
        </fieldset>
      ))}
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit">Entregar</button>
    </form>
  );
}

function Factory({ play }: { play: Mine['play'] }) {
  const client = useQueryClient();
  const [note, setNote] = useState('');
  const scene = play?.scene;
  if (!scene) return null;
  if (scene.end) return <div className="card"><CheckCircle2 /> <p>{scene.text}</p><p>Puntos: {play?.score ?? 0}</p></div>;
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p>{scene.text}</p>
      {scene.prompt && <h2 style={{ fontSize: 22 }}>{scene.prompt}</h2>}
      <div className="stack g-8">
        {scene.options?.map((option) => (
          <button key={option.id} className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={async () => {
            const result = await api<{ correct: boolean; explain?: string }>('/api/clase/fabrica', { method: 'POST', body: JSON.stringify({ choice: option.id }) });
            setNote(result.correct ? `Bien. ${result.explain ?? ''}` : `La compuerta se trabó. ${result.explain ?? ''}`);
            void client.invalidateQueries({ queryKey: ['guest-mine'] });
          }}>{option.text}</button>
        ))}
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}

function Cases({ play }: { play: Mine['play'] }) {
  const client = useQueryClient();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [review, setReview] = useState<{ prompt: string; ok: boolean; explain: string }[] | null>(null);
  const [left, setLeft] = useState(90);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!play?.startedAt || play.done) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(play.startedAt!).getTime() + 90_000 - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [play?.startedAt, play?.done]);
  if (play?.done && !review) return <p className="card">Ya jugaste ¿Qué caso es? en esta sesión.</p>;
  if (review) return <Review rows={review} />;
  return (
    <form className="card stack" style={{ gap: 14 }} onSubmit={async (e) => {
      e.preventDefault();
      try {
        const result = await api<{ review: { prompt: string; ok: boolean; explain: string }[] }>('/api/clase/casos', { method: 'POST', body: JSON.stringify({ picks }) });
        setReview(result.review);
        void client.invalidateQueries({ queryKey: ['guest-mine'] });
      } catch (err) {
        setError(err instanceof ApiException ? err.message : 'No se pudo enviar');
      }
    }}>
      <p className="row g-6"><Timer size={16} /> {left}s</p>
      {(play?.items ?? []).map((item) => (
        <fieldset key={item.id}>
          <legend><b>{item.prompt}</b></legend>
          <div className="row g-8 wrap" style={{ marginTop: 8 }}>
            {item.options.map((option) => (
              <button type="button" key={option.id} className={`chip ${picks[item.id] === option.id ? 'violet' : ''}`} onClick={() => setPicks({ ...picks, [item.id]: option.id })}>{option.text}</button>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit">Enviar</button>
    </form>
  );
}

function Elements({ sessionId }: { sessionId: string }) {
  const client = useQueryClient();
  const pair = useQuery({ queryKey: ['guest-pair', sessionId], queryFn: () => api<PairResponse>('/api/clase/pareja'), refetchInterval: 2000 });
  const [note, setNote] = useState('');
  useEffect(() => {
    const socket = io({ auth: { token: getToken() } });
    socket.emit('clase:join', { sessionId });
    socket.on('clase', () => { void client.invalidateQueries({ queryKey: ['guest-pair', sessionId] }); });
    return () => { socket.disconnect(); };
  }, [sessionId, client]);
  const mine = pair.data?.pair;
  async function choose(choice: string) {
    const result = await api<{ correct: boolean; explain?: string }>('/api/clase/pareja/respuesta', { method: 'POST', body: JSON.stringify({ choice }) });
    setNote(result.correct ? result.explain ?? 'Abrió' : result.explain ?? 'No abrió');
    void client.invalidateQueries({ queryKey: ['guest-pair', sessionId] });
  }
  if (!mine) {
    return (
      <div className="card stack" style={{ gap: 10 }}>
        <p>Busca a alguien del grupo. Uno abre la mesa y el otro se sienta.</p>
        <button className="btn" onClick={() => api('/api/clase/pareja', { method: 'POST', body: '{}' }).then(() => client.invalidateQueries({ queryKey: ['guest-pair', sessionId] }))}><Users size={16} /> Abrir una mesa</button>
        {(pair.data?.waiting ?? []).map((row) => (
          <button key={row.id} className="btn ghost" onClick={() => api('/api/clase/pareja', { method: 'POST', body: JSON.stringify({ pairId: row.id }) }).then(() => client.invalidateQueries({ queryKey: ['guest-pair', sessionId] }))}>Sentarme con {row.name}</button>
        ))}
      </div>
    );
  }
  if ('equation' in mine) {
    return <CoopBoard play={mine as { equation?: string; turn?: string; yours?: boolean; role?: string; round?: number; rounds?: number; waiting?: boolean; log?: string[] }} onMove={async (move) => {
      const result = await api<{ message?: string }>('/api/clase/jugar', { method: 'POST', body: JSON.stringify(move) });
      void client.invalidateQueries({ queryKey: ['guest-pair', sessionId] });
      return result.message ?? '';
    }} />;
  }
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="row g-8">{mine.side === 'fire' ? <Flame size={16} /> : <span />} Eres el camino {mine.side === 'fire' ? 'de fuego (factorizar)' : 'de agua (fracciones)'} · puerta {mine.gate} de {mine.total}</p>
      {mine.waiting && <p>Esperando a que alguien se siente en tu mesa.</p>}
      {mine.done && <p><CheckCircle2 /> Recorrieron las seis puertas. Tus puntos: {mine.score}</p>}
      {!mine.waiting && !mine.done && mine.you && (
        <>
          <h2 style={{ fontSize: 22 }}>{mine.you.prompt}</h2>
          <p className="muted">{mine.partnerSolved ? 'Tu pareja ya abrió su cerradura.' : 'Tu pareja todavía no abre la suya.'}</p>
          {mine.you.solved ? <p>Tu cerradura está abierta. Espera la otra.</p> : mine.you.options.map((option) => (
            <button key={option.id} className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => choose(option.id)}>{option.text}</button>
          ))}
        </>
      )}
      {note && <p>{note}</p>}
    </div>
  );
}

interface PairResponse {
  pair: { side: 'fire' | 'water'; waiting: boolean; gate?: number; total?: number; done: boolean; score: number; partnerSolved?: boolean; equation?: string; turn?: string; yours?: boolean; role?: string; round?: number; rounds?: number; log?: string[]; you: { prompt: string; solved: boolean; options: Option[] } | null } | null;
  waiting: { id: string; name: string }[];
}

function Review({ rows }: { rows: { prompt: string; ok: boolean; explain: string }[] }) {
  const ok = rows.filter((r) => r.ok).length;
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <h2 style={{ fontSize: 20 }}>{ok} de {rows.length}</h2>
      {rows.map((row) => <p key={row.prompt}><b>{row.ok ? 'Bien' : 'A corregir'} · {row.prompt}.</b> {row.explain}</p>)}
    </div>
  );
}
