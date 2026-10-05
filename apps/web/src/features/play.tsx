import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BadgeCheck,
  Check,
  Flag,
  Flame,
  Gamepad2,
  Lock,
  MessageCircle,
  PieChart,
  Rocket,
  Star,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/shared/api';
import { Bar, Empty, PageHeader, Reveal, Ring, Tile } from '@/ui';

const badgeIcons: Record<string, LucideIcon> = { flag: Flag, flame: Flame, star: Star, message: MessageCircle };
const badgeTones = ['var(--grad-brand)', 'linear-gradient(135deg, #ff9f43, #ff5d73)', 'var(--grad-gold)', 'var(--grad-sky)', 'var(--grad-mint)'];

export function AchievementsPage() {
  const game = useQuery({
    queryKey: ['me-game'],
    queryFn: () => api<{
      xp: number;
      level: { level: number; title: string; min_xp: number };
      nextLevel: { min_xp: number; title: string } | null;
      streak: { current: number; best: number };
      badges: { code: string; name: string; description: string; icon: string }[];
      catalog: { code: string; name: string; description: string; icon: string }[];
      missions: { code: string; title: string; description: string; progress: number; goal_count: number; xp_reward: number; completed_at: string | null }[];
    }>('/api/gamification/me'),
  });
  const certs = useQuery({
    queryKey: ['certs'],
    queryFn: () => api<{ code: string; title: string; course_title: string | null }[]>('/api/certificates/mine'),
  });
  const owned = new Set(game.data?.badges.map((b) => b.code));
  const xp = game.data?.xp ?? 0;
  const floor = game.data?.level.min_xp ?? 0;
  const next = game.data?.nextLevel?.min_xp ?? xp + 1;
  const ratio = Math.round(((xp - floor) / Math.max(1, next - floor)) * 100);

  return (
    <div className="stack g-24">
      <Reveal>
        <section className="hero">
          <div className="orb" style={{ width: 360, height: 360, right: -100, top: -140, background: 'radial-gradient(circle, rgba(255,200,61,.4), transparent 70%)' }} />
          <div className="row g-24 wrap" style={{ position: 'relative' }}>
            <Ring value={ratio} size={150} stroke={14}>
              <Trophy size={30} color="#ffd66b" />
              <div className="display" style={{ fontSize: 34 }}>N{game.data?.level.level ?? 1}</div>
            </Ring>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="eyebrow" style={{ color: '#ffd66b' }}>Sala de trofeos</div>
              <h1 style={{ marginTop: 8 }}>{game.data?.level.title ?? 'Aprendiz'}</h1>
              <p style={{ marginTop: 8, fontSize: 16 }}>{game.data?.nextLevel ? `Te faltan ${next - xp} XP para llegar a ${game.data.nextLevel.title}.` : 'Alcanzaste el nivel máximo.'}</p>
              <div style={{ marginTop: 16, maxWidth: 420 }}><Bar value={ratio} tone="gold" /></div>
            </div>
            <div className="row g-12 wrap">
              {[
                { icon: Zap, label: 'XP total', value: xp },
                { icon: Flame, label: 'Mejor racha', value: game.data?.streak.best ?? 0 },
                { icon: Award, label: 'Insignias', value: `${owned.size}/${game.data?.catalog.length ?? 0}` },
              ].map((item) => (
                <div key={item.label} className="glass" style={{ padding: '14px 18px', minWidth: 120 }}>
                  <item.icon size={20} color="#ffd66b" />
                  <div className="display" style={{ fontSize: 26, marginTop: 6 }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: '#cfc9ff', fontWeight: 700 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <div>
        <h2 style={{ fontSize: 22, marginBottom: 14 }}>Insignias</h2>
        <div className="grid cols-4">
          {(game.data?.catalog ?? []).map((badge, i) => {
            const Icon = badgeIcons[badge.icon] ?? Award;
            const has = owned.has(badge.code);
            return (
              <Reveal key={badge.code} delay={i * 0.05}>
                <article className={`card hover badge-card ${has ? '' : 'locked'}`}>
                  <motion.div className="badge-medal" style={{ background: badgeTones[i % badgeTones.length] }} whileHover={has ? { rotate: [0, -8, 8, 0], scale: 1.06 } : undefined}>
                    {has ? <Icon size={38} strokeWidth={2.2} /> : <Lock size={30} />}
                  </motion.div>
                  <h3 style={{ fontSize: 17 }}>{badge.name}</h3>
                  <p className="muted" style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{badge.description}</p>
                  <div style={{ marginTop: 12 }}>{has ? <span className="chip mint"><Check size={13} /> Desbloqueada</span> : <span className="chip">Bloqueada</span>}</div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <Reveal className="card">
          <div className="card-head"><div className="row g-12"><Tile icon={Target} tone="mint" /><div className="card-title">Misiones</div></div></div>
          <div className="stack g-16">
            {(game.data?.missions ?? []).map((mission) => {
              const complete = mission.progress >= mission.goal_count;
              return (
                <div key={mission.code} className="row g-16" style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)' }}>
                  <div className={`tile ${complete ? 'mint' : 'gold'}`}>{complete ? <Check size={20} strokeWidth={3} /> : <Star size={19} />}</div>
                  <div style={{ flex: 1 }}>
                    <div className="row between"><b>{mission.title}</b><span className="chip gold"><Zap size={12} /> {mission.xp_reward} XP</span></div>
                    <div style={{ margin: '8px 0 4px' }}><Bar value={(Math.min(mission.progress, mission.goal_count) / Math.max(1, mission.goal_count)) * 100} tone={complete ? 'mint' : 'gold'} thin /></div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{Math.min(mission.progress, mission.goal_count)}/{mission.goal_count} · {mission.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
        <Reveal className="card" delay={0.05}>
          <div className="card-head"><div className="row g-12"><Tile icon={BadgeCheck} tone="violet" /><div className="card-title">Certificados</div></div></div>
          <div className="stack g-12">
            {(certs.data ?? []).map((cert) => (
              <a key={cert.code} href={`/verificar/${cert.code}`} className="row g-12 card hover" style={{ padding: 14 }}>
                <Tile icon={BadgeCheck} tone="gold" />
                <div style={{ flex: 1 }}>
                  <b>{cert.title}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{cert.course_title} · {cert.code}</div>
                </div>
              </a>
            ))}
            {!certs.data?.length && <Empty icon={BadgeCheck} title="Tu primer certificado te espera" body="Llega después de un examen del curso con al menos 60%." />}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function makeRace() {
  const a = 2 + Math.floor(Math.random() * 9);
  const b = 2 + Math.floor(Math.random() * 9);
  return { prompt: `${a} × ${b}`, answer: a * b };
}

type Mode = 'carrera' | 'fracciones';

export function GamesPage() {
  const client = useQueryClient();
  const [mode, setMode] = useState<Mode | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const [result, setResult] = useState<{ xp: number; score: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const race = useMemo(() => Array.from({ length: 6 }, makeRace), [mode]);
  const fractions = [
    { prompt: '¿Cuál es mayor?', left: '1/2', right: '1/3', answer: '1/2' },
    { prompt: '¿Cuál es mayor?', left: '3/4', right: '2/3', answer: '3/4' },
    { prompt: '¿Cuál equivale a 1/2?', left: '2/4', right: '2/5', answer: '2/4' },
    { prompt: '¿Cuál es mayor?', left: '5/8', right: '1/2', answer: '5/8' },
  ];
  const total = mode === 'carrera' ? race.length : fractions.length;

  function begin(next: Mode) {
    setMode(next);
    setIndex(0);
    setScore(0);
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function finish(game: Mode, points: number) {
    const data = await api<{ xp: number }>('/api/gamification/minigames', { method: 'POST', body: JSON.stringify({ game, score: points }) });
    setResult({ xp: data.xp, score: points });
    setMode(null);
    client.invalidateQueries({ queryKey: ['me-game'] });
  }

  function step(ok: boolean, gain: number, game: Mode) {
    setFlash(ok ? 'ok' : 'bad');
    setTimeout(() => setFlash(null), 350);
    const nextScore = score + (ok ? gain : 0);
    if (index + 1 >= total) finish(game, nextScore);
    else { setScore(nextScore); setIndex(index + 1); }
  }

  const games = [
    { id: 'carrera' as const, title: 'Carrera numérica', body: 'Seis multiplicaciones a toda velocidad. Sin calculadora.', icon: Rocket, bg: 'linear-gradient(135deg, #7c5cff, #3a7bff)', tag: '×  Tablas', meta: '6 rondas · 10 pts' },
    { id: 'fracciones' as const, title: 'Fracciones al blanco', body: 'Elige la fracción correcta y da en el centro.', icon: PieChart, bg: 'linear-gradient(135deg, #ff9f43, #ff5d73)', tag: '½  Fracciones', meta: '4 rondas · 15 pts' },
  ];

  return (
    <div>
      <PageHeader eyebrow="Arcade" title="Refuerzo jugando" subtitle="Minijuegos cortos para después de la lección. Suman XP, nunca durante un examen." />

      <AnimatePresence>
        {result && (
          <motion.div className="card" style={{ marginBottom: 20, background: 'var(--grad-night)', color: '#fff', border: 0 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="row g-20 wrap">
              <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring' }}><Tile icon={Trophy} tone="gold" large /></motion.div>
              <div style={{ flex: 1 }}>
                <div className="display" style={{ fontSize: 28 }}>¡Partida terminada!</div>
                <div style={{ color: '#cfc9ff' }}>Puntaje {result.score} · sumaste <b style={{ color: '#ffd66b' }}>+{result.xp} XP</b></div>
              </div>
              <button className="btn white" onClick={() => setResult(null)}>Seguir jugando</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!mode && (
        <div className="grid cols-2">
          {games.map((game, i) => (
            <Reveal key={game.id} delay={i * 0.08}>
              <button className="card hover arcade" style={{ width: '100%' }} onClick={() => begin(game.id)}>
                <div className="arcade-top" style={{ background: game.bg, color: '#fff' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}>
                    <game.icon size={72} strokeWidth={1.8} />
                  </motion.div>
                  <span className="chip" style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,.2)', color: '#fff', border: 0 }}>{game.tag}</span>
                </div>
                <div style={{ padding: 22 }}>
                  <h3 style={{ fontSize: 22 }}>{game.title}</h3>
                  <p className="muted" style={{ marginTop: 6 }}>{game.body}</p>
                  <div className="row between" style={{ marginTop: 16 }}>
                    <span className="chip"><Timer size={13} /> {game.meta}</span>
                    <span className="btn sm"><Gamepad2 size={15} /> Jugar</span>
                  </div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      )}

      {mode && (
        <motion.div
          className="card"
          style={{ padding: 0, overflow: 'hidden', maxWidth: 760, margin: '0 auto' }}
          animate={flash === 'bad' ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div style={{ background: mode === 'carrera' ? games[0]!.bg : games[1]!.bg, color: '#fff', padding: '18px 24px' }}>
            <div className="row between">
              <b>{mode === 'carrera' ? 'Carrera numérica' : 'Fracciones al blanco'}</b>
              <div className="row g-12">
                <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: 0 }}><Zap size={13} /> {score} pts</span>
                <button className="icon-btn" style={{ width: 34, height: 34, background: 'rgba(255,255,255,.15)', borderColor: 'transparent', color: '#fff' }} onClick={() => setMode(null)}><X size={16} /></button>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="bar" style={{ background: 'rgba(255,255,255,.25)' }}><span style={{ width: `${(index / total) * 100}%`, background: '#fff' }} /></div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, opacity: 0.85 }}>Ronda {index + 1} de {total}</div>
            </div>
          </div>
          <div style={{ padding: '40px 28px', textAlign: 'center', background: flash === 'ok' ? 'rgba(25,195,156,.1)' : flash === 'bad' ? 'rgba(255,93,115,.08)' : undefined, transition: 'background .2s' }}>
            {mode === 'carrera' && race[index] && (
              <>
                <AnimatePresence mode="wait">
                  <motion.div key={index} className="big-number" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}>{race[index].prompt}</motion.div>
                </AnimatePresence>
                <form
                  className="row g-12"
                  style={{ justifyContent: 'center', marginTop: 24 }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = inputRef.current;
                    if (!input || input.value === '') return;
                    step(Number(input.value) === race[index]!.answer, 10, 'carrera');
                    input.value = '';
                    input.focus();
                  }}
                >
                  <input ref={inputRef} type="number" autoFocus placeholder="?" style={{ width: 180, textAlign: 'center', fontSize: 32, fontWeight: 800, padding: '12px 16px', borderRadius: 18, border: '2px solid var(--line)', background: 'var(--surface-2)' }} />
                  <button className="btn lg" type="submit">Enviar</button>
                </form>
              </>
            )}
            {mode === 'fracciones' && fractions[index] && (
              <>
                <h2 style={{ fontSize: 30 }}>{fractions[index].prompt}</h2>
                <div className="grid cols-2" style={{ marginTop: 28, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
                  {[fractions[index].left, fractions[index].right].map((value, i) => (
                    <motion.button
                      key={value + index}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => step(value === fractions[index]!.answer, 15, 'fracciones')}
                      style={{ border: 0, borderRadius: 24, padding: '36px 0', color: '#fff', background: i === 0 ? 'var(--grad-brand)' : 'var(--grad-sky)', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.18)' }}
                    >
                      <div className="big-number" style={{ fontSize: 64 }}>{value}</div>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
