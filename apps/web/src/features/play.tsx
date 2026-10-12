import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Award,
  BadgeCheck,
  Book,
  BookOpen,
  Bookmark,
  Brain,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Compass,
  Crown,
  FileCheck,
  Flame,
  Footprints,
  Gamepad2,
  GraduationCap,
  Grid3x3,
  Heart,
  HeartHandshake,
  Layers,
  Library,
  Lightbulb,
  Lock,
  Map as MapIcon,
  Medal,
  MessageCircle,
  MessagesSquare,
  PieChart,
  Radio,
  Shield,
  Shuffle,
  Sparkles,
  SpellCheck,
  Star,
  Sunrise,
  Swords,
  Target,
  Timer,
  Trophy,
  UserCheck,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/shared/api';
import { Bar, Empty, Reveal, Ring, Tile } from '@/ui';

export interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  hidden: boolean;
  seasonal: boolean;
  tier: number;
  maxTier: number;
  thresholds: number[];
  progress: number;
  next: number | null;
  unit: string;
  earnedAt: string | null;
  isNew: boolean;
}

interface GameProfile {
  xp: number;
  level: { level: number; title: string; min_xp: number };
  nextLevel: { min_xp: number; title: string } | null;
  streak: { current: number; best: number; lastActivityOn: string | null };
  achievements: Achievement[];
  unseen: number;
  season: { id: string; name: string; startsOn: string; endsOn: string } | null;
  pastSeasons: { season: string; name: string; badges: number; golds: number }[];
  missions: { code: string; title: string; description: string; progress: number; goal_count: number; xp_reward: number; completed_at: string | null }[];
}

const ICONS: Record<string, LucideIcon> = {
  award: Award, book: Book, bookmark: Bookmark, brain: Brain, calendar: Calendar, 'calendar-check': CalendarCheck, 'calendar-days': CalendarDays,
  clipboard: ClipboardCheck, compass: Compass, crown: Crown, 'file-check': FileCheck, flame: Flame, footprints: Footprints, gamepad: Gamepad2,
  graduation: GraduationCap, grid: Grid3x3, heart: Heart, 'heart-handshake': HeartHandshake, layers: Layers, library: Library, lightbulb: Lightbulb,
  lock: Lock, map: MapIcon, medal: Medal, message: MessageCircle, messages: MessagesSquare, pie: PieChart, radio: Radio, shield: Shield, shuffle: Shuffle,
  sparkles: Sparkles, spell: SpellCheck, star: Star, stars: Sparkles, sunrise: Sunrise, swords: Swords, target: Target, timer: Timer, trophy: Trophy,
  'user-check': UserCheck, video: Video, zap: Zap,
};

const SHELVES: { id: string; title: string; body: string; icon: LucideIcon }[] = [
  { id: 'constancia', title: 'Constancia', body: 'Volver cada día es lo que más suma.', icon: Flame },
  { id: 'dominio', title: 'Dominio', body: 'Lecciones, evaluaciones y el sendero de Mi ruta.', icon: GraduationCap },
  { id: 'exploracion', title: 'Exploración', body: 'Usar todo el campus: Cuaderno, Luka y Mi espacio.', icon: Compass },
  { id: 'colaboracion', title: 'Colaboración', body: 'Foros, Arena por equipos y clases en vivo.', icon: HeartHandshake },
  { id: 'arcade', title: 'Arcade', body: 'Partidas verificadas y el reto del día.', icon: Gamepad2 },
  { id: 'biblioteca', title: 'Biblioteca', body: 'Leer, ver y guardar recursos.', icon: BookOpen },
  { id: 'perfil', title: 'Cómo aprendo', body: 'Conocer y aprovechar tu forma de aprender.', icon: Lightbulb },
];

const TIER_NAMES = ['Por ganar', 'Bronce', 'Plata', 'Oro'];
type Filter = 'all' | 'earned' | 'pending' | 'new';

function tierClass(badge: Achievement) {
  if (!badge.tier) return 'none';
  if (badge.maxTier === 1) return 'gold';
  return ['none', 'bronze', 'silver', 'gold'][badge.tier] ?? 'gold';
}

function tierLabel(badge: Achievement) {
  if (!badge.tier) return badge.hidden ? 'Secreta' : 'Por ganar';
  if (badge.maxTier === 1) return 'Única';
  return TIER_NAMES[badge.tier] ?? 'Oro';
}

function Medallion({ badge, fresh, index }: { badge: Achievement; fresh: boolean; index: number }) {
  const Icon = ICONS[badge.icon] ?? Award;
  const secret = badge.hidden && !badge.tier;
  const floor = badge.tier ? badge.thresholds[badge.tier - 1] ?? 0 : 0;
  const ratio = badge.next ? Math.max(0, Math.min(100, ((badge.progress - floor) / Math.max(1, badge.next - floor)) * 100)) : 100;
  return (
    <Reveal delay={Math.min(index, 8) * 0.03}>
      <article className={`trophy tier-${tierClass(badge)} ${secret ? 'secret' : ''} ${fresh ? 'fresh' : ''}`} data-code={badge.code}>
        {fresh && <span className="trophy-new">Nuevo</span>}
        <motion.div className="trophy-medal" whileHover={badge.tier ? { rotate: [0, -6, 6, 0], scale: 1.05 } : undefined}>
          {secret ? <Lock size={28} /> : <Icon size={32} strokeWidth={2.1} />}
        </motion.div>
        <h3>{badge.name}</h3>
        <p>{badge.description}</p>
        {!secret && badge.maxTier > 1 && (
          <div className="trophy-pips" aria-label={`Nivel ${badge.tier} de ${badge.maxTier}`}>
            {badge.thresholds.map((value, i) => (
              <span key={value} className={i < badge.tier ? `on t${i + 1}` : ''} title={`${TIER_NAMES[i + 1]}: ${value} ${badge.unit}`} />
            ))}
          </div>
        )}
        <div className="trophy-foot">
          <span className={`trophy-tier ${tierClass(badge)}`}>{tierLabel(badge)}</span>
          {!secret && badge.next !== null && (
            <span className="trophy-count">
              {Math.min(badge.progress, badge.next)}/{badge.next} {badge.unit}
            </span>
          )}
          {!secret && badge.next === null && badge.tier > 0 && <span className="trophy-count done"><Check size={13} /> Completa</span>}
        </div>
        {!secret && badge.next !== null && <Bar value={ratio} tone={badge.tier ? 'gold' : undefined} thin />}
      </article>
    </Reveal>
  );
}

export function AchievementsPage() {
  const client = useQueryClient();
  const game = useQuery({ queryKey: ['me-game'], queryFn: () => api<GameProfile>('/api/gamification/me') });
  const certs = useQuery({
    queryKey: ['certs'],
    queryFn: () => api<{ code: string; title: string; course_title: string | null }[]>('/api/certificates/mine'),
  });
  const [filter, setFilter] = useState<Filter>('all');
  const [fresh, setFresh] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!game.data || fresh) return;
    setFresh(new Set(game.data.achievements.filter((a) => a.isNew).map((a) => a.code)));
    if (game.data.unseen > 0) {
      void api('/api/gamification/seen', { method: 'POST' })
        .then(() => Promise.all(['me-game', 'campus', 'notifications'].map((key) => client.invalidateQueries({ queryKey: [key] }))))
        .catch(() => undefined);
    }
  }, [game.data, fresh, client]);

  const data = game.data;
  const all = data?.achievements ?? [];
  const isFresh = (code: string) => Boolean(fresh?.has(code));
  const visible = (badge: Achievement) =>
    filter === 'all' || (filter === 'earned' && badge.tier > 0) || (filter === 'pending' && badge.tier === 0) || (filter === 'new' && isFresh(badge.code));

  const xp = data?.xp ?? 0;
  const floor = data?.level.min_xp ?? 0;
  const nextXp = data?.nextLevel?.min_xp ?? xp + 1;
  const ratio = Math.round(((xp - floor) / Math.max(1, nextXp - floor)) * 100);
  const permanent = all.filter((a) => !a.seasonal);
  const points = permanent.reduce((sum, a) => sum + a.tier, 0);
  const maxPoints = permanent.reduce((sum, a) => sum + a.maxTier, 0);
  const golds = permanent.filter((a) => a.tier > 0 && a.tier === a.maxTier).length;
  const earned = permanent.filter((a) => a.tier > 0).length;
  const seasonal = all.filter((a) => a.seasonal);
  const closest = permanent
    .filter((a) => !a.hidden && a.next !== null)
    .map((a) => {
      const base = a.tier ? a.thresholds[a.tier - 1] ?? 0 : 0;
      return { badge: a, ratio: (a.progress - base) / Math.max(1, (a.next ?? 0) - base) };
    })
    .sort((x, y) => y.ratio - x.ratio)
    .slice(0, 3);
  const newCount = fresh?.size ?? 0;

  return (
    <div className="stack g-24 trophy-room">
      <Reveal>
        <section className="hero facade m-laton" data-at="/app/logros" data-building="trofeos">
          <div className="orb" style={{ width: 360, height: 360, right: -100, top: -140, background: 'radial-gradient(circle, rgba(255,200,61,.4), transparent 70%)' }} />
          <div className="row g-24 wrap" style={{ position: 'relative' }}>
            <Ring value={ratio} size={150} stroke={14}>
              <Trophy size={30} color="#ffd66b" />
              <div className="display" style={{ fontSize: 34 }}>N{data?.level.level ?? 1}</div>
            </Ring>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span className="placa"><Trophy size={14} aria-hidden="true" /> Sala de trofeos</span>
              <h1>{data?.level.title ?? 'Aprendiz'}</h1>
              <p style={{ marginTop: 8, fontSize: 16 }}>{data?.nextLevel ? `Te faltan ${nextXp - xp} XP para llegar a ${data.nextLevel.title}.` : 'Alcanzaste el nivel máximo.'}</p>
              <div style={{ marginTop: 16, maxWidth: 420 }}><Bar value={ratio} tone="gold" /></div>
            </div>
            <div className="trophy-stats">
              {[
                { icon: Zap, label: 'XP total', value: xp },
                { icon: Flame, label: data?.streak.current ? 'Racha actual' : 'Racha (rota)', value: `${data?.streak.current ?? 0} d` },
                { icon: Award, label: 'Insignias', value: `${earned}/${permanent.length}` },
                { icon: Crown, label: 'De oro', value: golds },
              ].map((item) => (
                <div key={item.label} className="glass">
                  <item.icon size={18} color="#ffd66b" />
                  <div className="display">{item.value}</div>
                  <div className="lbl">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {data && (
        <div className="trophy-top">
          <Reveal className="card trophy-season">
            <div className="card-head">
              <div className="row g-12">
                <Tile icon={CalendarDays} tone="gold" />
                <div>
                  <div className="card-title">Temporada {data.season?.name ?? 'sin periodo activo'}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {data.season ? `Del ${data.season.startsOn} al ${data.season.endsOn}. Se reinicia con cada periodo.` : 'Las insignias de temporada se activan cuando empieza un periodo.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="trophy-shelf season">
              {seasonal.map((badge, i) => <Medallion key={badge.code} badge={badge} fresh={isFresh(badge.code)} index={i} />)}
            </div>
            {data.pastSeasons.length > 0 && (
              <div className="trophy-past">
                <b>Temporadas anteriores</b>
                {data.pastSeasons.map((s) => (
                  <span key={s.season} className="chip"><Medal size={13} /> {s.name}: {s.badges} insignias · {s.golds} de oro</span>
                ))}
              </div>
            )}
          </Reveal>
          <Reveal className="card trophy-next" delay={0.05}>
            <div className="card-head"><div className="row g-12"><Tile icon={Target} tone="mint" /><div className="card-title">Más cerca de subir</div></div></div>
            <div className="stack g-12">
              {closest.map(({ badge }) => {
                const Icon = ICONS[badge.icon] ?? Award;
                return (
                  <div key={badge.code} className="trophy-close">
                    <span className={`trophy-mini tier-${tierClass(badge)}`}><Icon size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{badge.name}</b>
                      <div className="muted" style={{ fontSize: 12.5 }}>{badge.maxTier > 1 ? TIER_NAMES[badge.tier + 1] : 'Desbloquear'}: {badge.progress}/{badge.next} {badge.unit}</div>
                    </div>
                  </div>
                );
              })}
              {!closest.length && <Empty icon={Crown} title="Todo en oro" body="Ya no te quedan niveles por subir." />}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Puntos de colección: <b>{points}/{maxPoints}</b> (bronce 1, plata 2, oro 3).</div>
          </Reveal>
        </div>
      )}

      <div className="seg-tabs" role="tablist" aria-label="Filtrar insignias">
        {([
          ['all', 'Todas'],
          ['earned', 'Ganadas'],
          ['pending', 'Por ganar'],
          ['new', 'Nuevas'],
        ] as [Filter, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
            {label}
            {id === 'new' && newCount > 0 && <span className="seg-badge">{newCount}</span>}
          </button>
        ))}
      </div>

      {SHELVES.map((shelf) => {
        const items = permanent.filter((a) => a.category === shelf.id).filter(visible);
        if (!items.length) return null;
        const mine = permanent.filter((a) => a.category === shelf.id);
        return (
          <section key={shelf.id} className="trophy-section" aria-label={shelf.title}>
            <header>
              <Tile icon={shelf.icon} tone="violet" />
              <div style={{ flex: 1 }}>
                <h2>{shelf.title}</h2>
                <p className="muted">{shelf.body}</p>
              </div>
              <span className="chip">{mine.filter((a) => a.tier > 0).length}/{mine.length}</span>
            </header>
            <div className="trophy-shelf">
              {items.map((badge, i) => <Medallion key={badge.code} badge={badge} fresh={isFresh(badge.code)} index={i} />)}
            </div>
          </section>
        );
      })}
      {data && filter === 'new' && newCount === 0 && <Empty icon={Sparkles} title="Nada nuevo por ahora" body="Cuando ganes o subas una insignia aparecerá aquí." />}

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <Reveal className="card">
          <div className="card-head"><div className="row g-12"><Tile icon={Target} tone="mint" /><div className="card-title">Misiones de la semana</div></div></div>
          <div className="stack g-16">
            {(data?.missions ?? []).map((mission) => {
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
