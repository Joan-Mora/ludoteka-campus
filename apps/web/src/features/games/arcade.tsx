import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Crown, Gamepad2, Loader2, Medal, Sparkles, Timer, Trophy, X, Zap } from 'lucide-react';
import { ARCADE_INFO, type ArcadeGame } from '@eduquest/contracts';
import { api, ApiException } from '@/shared/api';
import { normalize } from '@/shared/voice';
import { Bar, Empty, PageHeader, Reveal, Tile } from '@/ui';
import type { AnswerResponse, Feedback, PublicItem } from './boards';
import { BOARDS, MULTI_STEP, gameInfo } from './registry';

interface GameCard {
  code: ArcadeGame;
  title: string;
  rounds: number;
  seconds: number;
  topic: { id: string; name: string; level: number } | null;
  best: number;
  plays: number;
}

interface Overview {
  games: GameCard[];
  daily: { date: string; game: ArcadeGame; title: string; played: boolean; score: number | null; correct: number | null; total: number | null };
  xpToday: number;
  xpCap: number;
}

interface Session {
  id: string;
  game: ArcadeGame;
  level: number;
  daily: boolean;
  seconds: number;
  total: number;
  items: PublicItem[];
}

interface Result {
  score: number;
  correct: number;
  total: number;
  xp: number;
  dailyBonus: number;
  capped: boolean;
  perfect: boolean;
  best: number;
  newBest: boolean;
}

interface Ranking {
  scope: 'week' | 'daily';
  group: string | null;
  rows: { position: number; name: string; points: number; games: number; me: boolean }[];
}

export function GamesPage() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const topicFilter = params.get('tema');
  const overview = useQuery({ queryKey: ['arcade'], queryFn: () => api<Overview>('/api/arcade') });
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<(Result & { game: ArcadeGame; daily: boolean }) | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(game: ArcadeGame, daily = false, topicId?: string) {
    setStarting(daily ? 'daily' : game);
    setError(null);
    try {
      const next = await api<Session>('/api/arcade/sessions', { method: 'POST', body: JSON.stringify({ game, daily, topicId }) });
      setResult(null);
      setSession(next);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudo empezar la partida');
    } finally {
      setStarting(null);
    }
  }

  const spoken = useRef(false);
  useEffect(() => {
    const wanted = params.get('buscar');
    const games = overview.data?.games;
    if (!wanted || !games || spoken.current) return;
    spoken.current = true;
    const term = normalize(wanted);
    const words = term.split(' ').filter((w) => w.length > 3);
    const haystack = (g: GameCard) => normalize(`${g.code} ${g.title} ${ARCADE_INFO[g.code].tag} ${ARCADE_INFO[g.code].body} ${g.topic?.name ?? ''}`);
    const found =
      games.find((g) => normalize(g.code) === term || term.includes(normalize(g.code))) ??
      games.find((g) => g.topic && (normalize(g.topic.name).includes(term) || term.includes(normalize(g.topic.name)))) ??
      games.find((g) => words.some((w) => haystack(g).includes(w.replace(/s$/, ''))));
    setParams({}, { replace: true });
    if (found) void start(found.code, false, found.topic?.id);
    else setError(`No encontré un juego de «${wanted}». Estos son los del Arcade.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, overview.data]);

  function finished(res: Result) {
    if (session) setResult({ ...res, game: session.game, daily: session.daily });
    setSession(null);
    client.invalidateQueries({ queryKey: ['arcade'] });
    client.invalidateQueries({ queryKey: ['arcade-ranking'] });
    client.invalidateQueries({ queryKey: ['me-game'] });
  }

  if (session) return <GameRunner session={session} onFinish={finished} onQuit={() => setSession(null)} />;

  const data = overview.data;
  const games = data?.games ?? [];
  const focus = topicFilter ? games.filter((g) => g.topic?.id === topicFilter) : [];
  const ordered = focus.length ? [...focus, ...games.filter((g) => !focus.includes(g))] : games;
  const daily = data?.daily;
  const dailyLook = daily ? gameInfo(daily.game) : null;

  return (
    <div className="stack g-24">
      <PageHeader eyebrow="Arcade" title="Juegos con trampa cero" subtitle="Las preguntas salen del servidor y él mismo califica. Diez juegos ligados a tus temas, un reto diario y el ranking de tu grupo." />

      <AnimatePresence>
        {result && <ResultCard result={result} onAgain={() => { const r = result; setResult(null); if (!r.daily) void start(r.game); }} onClose={() => setResult(null)} />}
      </AnimatePresence>
      {error && <p className="form-error">{error}</p>}

      <div className="arcade-top-row">
        {daily && dailyLook && (
          <Reveal className="daily-card">
            <div className="daily-art" style={{ background: dailyLook.bg }}>
              <dailyLook.icon size={64} strokeWidth={1.8} />
              <span className="chip daily-chip"><CalendarDays size={13} /> Reto del día</span>
            </div>
            <div className="daily-body">
              <div className="eyebrow">Hoy para todo el colegio</div>
              <h2>{daily.title}</h2>
              <p className="muted">Las mismas preguntas para todos, nivel 4. Una sola partida al día y +15 XP extra si aciertas al menos una.</p>
              {daily.played ? (
                <div className="row g-8 wrap">
                  <span className="chip mint"><Trophy size={13} /> {daily.score} puntos · {daily.correct}/{daily.total}</span>
                  <span className="chip">Vuelve mañana por otro</span>
                </div>
              ) : (
                <button className="btn" onClick={() => start(daily.game, true)} disabled={!!starting}>
                  {starting === 'daily' ? <Loader2 size={16} className="spin" /> : <Zap size={16} />} Jugar el reto de hoy
                </button>
              )}
            </div>
          </Reveal>
        )}
        <Reveal className="card arcade-side" delay={0.05}>
          <div className="row g-12"><Tile icon={Zap} tone="gold" /><div><div className="card-title">XP del Arcade hoy</div><div className="muted" style={{ fontSize: 13 }}>Tope de {data?.xpCap ?? 150} XP diarios para que el juego no reemplace la clase.</div></div></div>
          <div style={{ margin: '14px 0 6px' }}><Bar value={((data?.xpToday ?? 0) / (data?.xpCap ?? 150)) * 100} tone="gold" /></div>
          <div className="muted" style={{ fontSize: 13 }}>{data?.xpToday ?? 0} de {data?.xpCap ?? 150} XP</div>
          <RankingPanel />
        </Reveal>
      </div>

      {focus.length > 0 && (
        <div className="row g-8 wrap">
          <span className="chip violet"><Sparkles size={13} /> Juegos de {focus[0]!.topic?.name}</span>
          <button className="chip" onClick={() => setParams({})}><X size={12} /> Ver todos</button>
        </div>
      )}

      {overview.isLoading && <p className="muted"><Loader2 size={14} className="spin" /> Cargando juegos…</p>}
      {!overview.isLoading && !ordered.length && (
        <div className="card">
          <h2 style={{ fontSize: 20 }}>Los juegos de práctica están en la clase</h2>
          <p className="muted">Los juegos cortos de opción múltiple salieron del Arcade. Ahora cada grado juega con fichas, balanzas, barras, rectas o matrices, y el docente los abre desde Sesiones de invitados.</p>
        </div>
      )}
      <div className="arcade-grid">
        {ordered.map((game, i) => {
          const info = gameInfo(game.code);
          const featured = focus.includes(game);
          return (
            <Reveal key={game.code} delay={Math.min(i, 8) * 0.04}>
              <article className={`card arcade ${featured ? 'featured' : ''}`}>
                <div className="arcade-top" style={{ background: info.bg, color: '#fff' }}>
                  <div className="arcade-dots" />
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut', delay: i * 0.15 }}>
                    <info.icon size={60} strokeWidth={1.8} />
                  </motion.div>
                  <span className="chip arcade-tag">{info.tag}</span>
                  {game.best > 0 && <span className="chip arcade-best"><Medal size={12} /> {game.best}</span>}
                </div>
                <div className="arcade-body">
                  <h3>{info.title}</h3>
                  <p className="muted">{info.body}</p>
                  <div className="row g-8 wrap" style={{ marginTop: 10 }}>
                    {game.topic && <Link to={`/app/ruta?tema=${game.topic.id}`} className="chip violet">{game.topic.name} · N{game.topic.level}</Link>}
                    {!game.topic && <span className="chip">Glosario de la biblioteca</span>}
                    <span className="chip"><Timer size={12} /> {game.rounds} rondas · {game.seconds} s</span>
                  </div>
                  <div className="row between" style={{ marginTop: 14 }}>
                    <span className="muted" style={{ fontSize: 13 }}>{game.plays ? `${game.plays} partidas · récord ${game.best}` : 'Sin partidas todavía'}</span>
                    <button className="btn sm" onClick={() => start(game.code, false, featured ? topicFilter ?? undefined : undefined)} disabled={!!starting}>
                      {starting === game.code ? <Loader2 size={15} className="spin" /> : <Gamepad2 size={15} />} Jugar
                    </button>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function RankingPanel() {
  const [scope, setScope] = useState<'week' | 'daily'>('week');
  const ranking = useQuery({ queryKey: ['arcade-ranking', scope], queryFn: () => api<Ranking>(`/api/arcade/ranking?scope=${scope}`) });
  return (
    <div className="ranking">
      <div className="row between" style={{ margin: '18px 0 10px' }}>
        <b><Crown size={15} /> Ranking {ranking.data?.group ? `de ${ranking.data.group}` : 'del grupo'}</b>
        <div className="seg-tabs mini" role="tablist" aria-label="Ranking">
          <button role="tab" aria-selected={scope === 'week'} className={scope === 'week' ? 'on' : ''} onClick={() => setScope('week')}>Semana</button>
          <button role="tab" aria-selected={scope === 'daily'} className={scope === 'daily' ? 'on' : ''} onClick={() => setScope('daily')}>Reto de hoy</button>
        </div>
      </div>
      {ranking.data?.rows.length ? (
        <ol className="rank-list">
          {ranking.data.rows.slice(0, 8).map((row) => (
            <li key={row.position} className={row.me ? 'me' : ''}>
              <span className={`rank-pos p${row.position}`}>{row.position}</span>
              <span className="rank-name">{row.name}{row.me && ' (tú)'}</span>
              <b>{row.points}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>{scope === 'week' ? 'Nadie ha jugado esta semana. ¡Estrena el ranking!' : 'Nadie ha jugado el reto de hoy.'}</p>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{scope === 'week' ? 'Suma de tu mejor puntaje en cada juego desde el lunes.' : 'Puntaje del reto del día.'}</p>
    </div>
  );
}

function ResultCard({ result, onAgain, onClose }: { result: Result & { game: ArcadeGame; daily: boolean }; onAgain: () => void; onClose: () => void }) {
  const info = gameInfo(result.game);
  return (
    <motion.div className="card result-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="row g-20 wrap">
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring' }}><Tile icon={result.perfect ? Crown : Trophy} tone="gold" large /></motion.div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="display" style={{ fontSize: 26 }}>{result.perfect ? '¡Partida perfecta!' : '¡Partida terminada!'}</div>
          <div className="result-line">
            {info.title}: {result.correct}/{result.total} correctas · {result.score} puntos · <b>+{result.xp} XP</b>
            {result.dailyBonus > 0 && ` (incluye +${result.dailyBonus} del reto)`}
          </div>
          <div className="row g-8 wrap" style={{ marginTop: 8 }}>
            {result.newBest && <span className="chip gold"><Medal size={12} /> Nuevo récord</span>}
            {!result.newBest && result.best > 0 && <span className="chip">Récord: {result.best}</span>}
            {result.capped && <span className="chip">Llegaste al tope de XP del Arcade por hoy</span>}
          </div>
        </div>
        <div className="row g-8">
          {!result.daily && <button className="btn white" onClick={onAgain}>Otra vez</button>}
          <button className="btn ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </motion.div>
  );
}

function GameRunner({ session, onFinish, onQuit }: { session: Session; onFinish: (result: Result) => void; onQuit: () => void }) {
  const info = gameInfo(session.game);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(session.seconds);
  const [shake, setShake] = useState(false);
  const ending = useRef(false);
  const started = useRef(Date.now());
  const item = session.items[index];
  const Board = item ? BOARDS[item.ui] : null;

  async function finish() {
    if (ending.current) return;
    ending.current = true;
    const res = await api<Result>(`/api/arcade/sessions/${session.id}/finish`, { method: 'POST' });
    onFinish(res);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, session.seconds - Math.floor((Date.now() - started.current) / 1000));
      setLeft(remaining);
      if (remaining === 0) void finish();
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const next = () => {
    setFeedback(null);
    if (index + 1 >= session.items.length) void finish();
    else setIndex(index + 1);
  };

  async function send(answer: string): Promise<AnswerResponse> {
    try {
      return await api<AnswerResponse>(`/api/arcade/sessions/${session.id}/answer`, { method: 'POST', body: JSON.stringify({ index, answer }) });
    } catch (e) {
      if (e instanceof ApiException && (e.code === 'TIME_UP' || e.code === 'FINISHED')) void finish();
      throw e;
    }
  }

  async function submit(answer: string) {
    if (feedback) return;
    let res: AnswerResponse;
    try {
      res = await send(answer);
    } catch {
      return;
    }
    setFeedback({ ok: res.ok, answer: res.answer, explanation: res.explanation, points: res.points, given: answer });
    if (res.ok) setCorrect((c) => c + 1);
    else { setShake(true); setTimeout(() => setShake(false), 400); }
    setScore((s) => s + (res.points ?? 0));
    setTimeout(next, res.ok ? 900 : 2200);
  }

  async function sendStep(answer: string): Promise<AnswerResponse> {
    let res: AnswerResponse;
    try {
      res = await send(answer);
    } catch {
      return { ok: false };
    }
    if (!res.ok) { setShake(true); setTimeout(() => setShake(false), 400); }
    if (item?.ui === 'memory' && res.ok) setCorrect((res.matched?.length ?? 0) / 2);
    if (item?.ui === 'hangman' && res.done && res.solved) setCorrect((c) => c + 1);
    return res;
  }

  const urgent = left <= 10;
  return (
    <div className="runner-wrap">
      <motion.div className="card runner" animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
        <div className="runner-head" style={{ background: info.bg }}>
          <div className="row between">
            <div className="row g-12">
              <info.icon size={26} />
              <div>
                <b>{info.title}</b>
                <div className="runner-sub">{session.daily ? 'Reto del día' : info.topic ? `Nivel ${session.level}` : 'Glosario de la biblioteca'}</div>
              </div>
            </div>
            <div className="row g-8">
              <span className={`chip runner-chip ${urgent ? 'urgent' : ''}`}><Timer size={13} /> {left} s</span>
              <span className="chip runner-chip"><Zap size={13} /> {score}</span>
              <button className="icon-btn runner-close" onClick={onQuit} aria-label="Salir del juego"><X size={16} /></button>
            </div>
          </div>
          <div className="runner-bar"><span style={{ width: `${(index / session.items.length) * 100}%` }} /></div>
          <div className="runner-sub">{item?.ui === 'memory' ? `${correct} de ${session.total} parejas` : `Ronda ${index + 1} de ${session.items.length} · ${correct} correctas`}</div>
        </div>
        {session.game === 'torre' && <Tower height={correct} total={session.total} />}
        <div className={`runner-body ${feedback ? (feedback.ok ? 'ok' : 'bad') : ''}`}>
          {Board && item && <Board key={index} item={item} feedback={feedback} submit={submit} send={sendStep} complete={next} />}
          <AnimatePresence>
            {feedback && !MULTI_STEP.includes(item!.ui) && (
              <motion.div className={`runner-feedback ${feedback.ok ? 'ok' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <b>{feedback.ok ? `¡Bien! +${feedback.points ?? 0}` : 'Casi'}</b>
                {!feedback.ok && feedback.explanation && <span>{feedback.explanation}</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      {!session.items.length && <Empty icon={Gamepad2} title="Sin preguntas" body="Vuelve a intentarlo en un momento." />}
    </div>
  );
}

function Tower({ height, total }: { height: number; total: number }) {
  return (
    <div className="tower" aria-label={`Torre de ${height} bloques`}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span key={i} className={`tower-block ${i < height ? 'on' : ''}`} initial={false} animate={i < height ? { y: 0, opacity: 1 } : { y: -6, opacity: 0.25 }} />
      ))}
    </div>
  );
}
