import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Crown,
  FileSpreadsheet,
  Flame,
  FlaskConical,
  Globe2,
  Languages,
  Lock,
  Megaphone,
  PenLine,
  Play,
  Plus,
  Radio,
  ShieldCheck,
  Sigma,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiException, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Avatar, Bar, DateTile, Empty, PageHeader, pickGradient, Reveal, Ring, Stat, Tile } from '@/ui';
import { CampusHome, MobileHub } from './campus';
import { useLayout } from '@/app/layout';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { appendToField } from '@/shared/voice';

interface Progress { completed: number; total: number }
interface CourseCard { id: string; title: string; description: string; subject: string; group_name: string; grade_level: number; demo?: boolean; progress: Progress }
interface GameMe {
  xp: number;
  level: { level: number; title: string; min_xp: number };
  nextLevel: { min_xp: number; title: string } | null;
  streak: { current: number; best: number };
  badges: { code: string }[];
  missions: { code: string; title: string; description: string; goal_count: number; progress: number; reward_xp?: number }[];
}
interface CourseDetail {
  id: string;
  title: string;
  description: string;
  group_id: string;
  units: { id: string; title: string; summary: string; lessons: { id: string; title: string; estimatedMin: number; completed: boolean }[] }[];
}

function subjectIcon(subject: string): LucideIcon {
  if (/mat/i.test(subject)) return Sigma;
  if (/natural/i.test(subject)) return FlaskConical;
  if (/social/i.test(subject)) return Globe2;
  if (/ingl/i.test(subject)) return Languages;
  return BookOpen;
}

function pct(progress: Progress) {
  return progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
}

function CourseTile({ course, index }: { course: CourseCard; index: number }) {
  const Icon = subjectIcon(course.subject);
  const value = pct(course.progress);
  return (
    <Reveal delay={index * 0.06}>
      <Link to={`/app/cursos/${course.id}`} className="card hover course-card" style={{ display: 'block' }}>
        <div className="course-cover" style={{ background: pickGradient(course.id) }}>
          <Icon className="big-ico" size={150} strokeWidth={1.5} />
          <div style={{ position: 'relative' }}>
            <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: 0 }}>{course.subject} · {course.grade_level}° {course.group_name}</span>
            {course.demo && <span className="chip" style={{ background: 'rgba(0,0,0,.22)', color: '#fff', border: 0, marginLeft: 6 }}>Demo</span>}
          </div>
        </div>
        <div className="course-body">
          <h3 style={{ fontSize: 19 }}>{course.title}</h3>
          <p className="muted" style={{ fontSize: 14, marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description}</p>
          <div className="row g-12" style={{ marginTop: 16 }}>
            <div style={{ flex: 1 }}><Bar value={value} /></div>
            <b style={{ fontSize: 14 }}>{value}%</b>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>{course.progress.completed} de {course.progress.total} lecciones</div>
        </div>
      </Link>
    </Reveal>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<CourseCard[]>('/api/courses') });
  const game = useQuery({ queryKey: ['me-game'], queryFn: () => api<GameMe>('/api/gamification/me'), enabled: isStudent });
  const feed = useQuery({ queryKey: ['feed'], queryFn: () => api<{ announcements: { id: string; title: string; body: string; course_title: string }[]; events: { id: string; title: string; starts_at: string; course_title: string }[] }>('/api/home/feed') });
  const firstCourse = courses.data?.[0];
  const detail = useQuery({ queryKey: ['course', firstCourse?.id], enabled: Boolean(firstCourse), queryFn: () => api<CourseDetail>(`/api/courses/${firstCourse!.id}`) });
  const nextLesson = detail.data?.units.flatMap((unit) => unit.lessons.map((lesson) => ({ ...lesson, unit: unit.title }))).find((lesson) => !lesson.completed);

  const xp = game.data?.xp ?? 0;
  const next = game.data?.nextLevel?.min_xp ?? xp + 1;
  const floor = game.data?.level.min_xp ?? 0;
  const ratio = Math.min(100, Math.round(((xp - floor) / Math.max(1, next - floor)) * 100));
  const firstName = user?.fullName.split(' ')[0];
  const totalDone = (courses.data ?? []).reduce((sum, c) => sum + c.progress.completed, 0);
  const totalLessons = (courses.data ?? []).reduce((sum, c) => sum + c.progress.total, 0);
  const layout = useLayout();

  return (
    <div className="home-grid">
      <div className="home-main">
      {layout === 'mobile' ? <MobileHub /> : <CampusHome />}

      {isStudent && game.data && (
        <Reveal className="card next-strip">
          <Ring value={ratio} size={84} stroke={10} track="var(--bg-2)">
            <div className="display" style={{ fontSize: 26, lineHeight: 1 }}>{game.data.level.level}</div>
          </Ring>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="eyebrow">Nivel {game.data.level.level} · {game.data.level.title}</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>
              {nextLesson ? <>Siguiente estación: {nextLesson.title}</> : 'Completaste todas las estaciones disponibles'}
            </div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{game.data.nextLevel ? `${next - xp} XP para ${game.data.nextLevel.title}` : 'Nivel máximo alcanzado'} · racha de {game.data.streak.current} {game.data.streak.current === 1 ? 'día' : 'días'}</div>
          </div>
          {nextLesson && <Link to={`/app/lecciones/${nextLesson.id}`} className="btn lg"><Play size={17} fill="currentColor" /> Continuar</Link>}
        </Reveal>
      )}

      <div className="grid cols-4">
        {isStudent && game.data ? (
          <>
            <Reveal delay={0.05}><Stat icon={Zap} tone="gold" value={xp} label="XP acumulada" /></Reveal>
            <Reveal delay={0.1}><Stat icon={Flame} tone="coral" value={game.data.streak.current} label="Días de racha" /></Reveal>
            <Reveal delay={0.15}><Stat icon={Trophy} tone="violet" value={game.data.badges.length} label="Insignias ganadas" /></Reveal>
            <Reveal delay={0.2}><Stat icon={Target} tone="mint" value={`${totalDone}/${totalLessons}`} label="Lecciones completas" /></Reveal>
          </>
        ) : (
          <>
            <Reveal delay={0.05}><Stat icon={BookOpen} tone="violet" value={courses.data?.length ?? 0} label="Cursos activos" /></Reveal>
            <Reveal delay={0.1}><Stat icon={Megaphone} tone="coral" value={feed.data?.announcements.length ?? 0} label="Anuncios publicados" /></Reveal>
            <Reveal delay={0.15}><Stat icon={CalendarDays} tone="sky" value={feed.data?.events.length ?? 0} label="Eventos próximos" /></Reveal>
            <Reveal delay={0.2}><Stat icon={Target} tone="mint" value={totalLessons} label="Lecciones publicadas" /></Reveal>
          </>
        )}
      </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="row between">
            <h2 style={{ fontSize: 22 }}>{isStudent ? 'Mis cursos' : 'Cursos a cargo'}</h2>
            <Link to="/app/cursos" className="row g-4" style={{ color: 'var(--violet-2)', fontWeight: 800, fontSize: 14 }}>Ver todos <ArrowRight size={15} /></Link>
          </div>
          <div className="auto-grid">
            {(courses.data ?? []).map((course, i) => <CourseTile key={course.id} course={course} index={i} />)}
            {!courses.isLoading && !courses.data?.length && <div className="card full-row"><Empty icon={BookOpen} title="Aún no tienes cursos" body="Cuando te asignen a un grupo aparecerán aquí." /></div>}
          </div>

          {(user?.role === 'teacher' || user?.role === 'admin') && firstCourse && (
            <Reveal className="card">
              <div className="card-head">
                <div className="row g-12"><Tile icon={ClipboardList} tone="violet" /><div className="card-title">Tu semana docente</div></div>
                <span className="chip violet">{firstCourse.title}</span>
              </div>
              <div className="stack g-12">
                {[
                  { to: `/app/cursos/${firstCourse.id}/aula`, icon: PenLine, tone: 'gold' as const, title: 'Revisar entregas', body: 'Califica tareas y deja retroalimentación.' },
                  { to: `/app/cursos/${firstCourse.id}/aula`, icon: Radio, tone: 'sky' as const, title: 'Lanzar un quiz en vivo', body: 'Abre una sala y proyecta el código al grupo.' },
                  { to: `/app/integridad/${firstCourse.id}`, icon: ShieldCheck, tone: 'mint' as const, title: 'Monitorear integridad', body: 'Alertas del examen en tiempo real.' },
                  { to: `/app/reportes/${firstCourse.id}`, icon: BarChart3, tone: 'coral' as const, title: 'Boletines y certificados', body: 'Descarga PDF y Excel con fecha e ID.' },
                ].map((item) => (
                  <Link key={item.title} to={item.to} className="row g-16 card hover" style={{ padding: 14 }}>
                    <Tile icon={item.icon} tone={item.tone} />
                    <div style={{ flex: 1 }}>
                      <b>{item.title}</b>
                      <div className="muted" style={{ fontSize: 13.5 }}>{item.body}</div>
                    </div>
                    <ArrowRight size={18} color="var(--muted)" />
                  </Link>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </div>

      <aside className="home-rail">
          {isStudent && game.data && (
            <Reveal className="card">
              <div className="card-head">
                <div className="row g-12"><Tile icon={Target} tone="mint" /><div className="card-title">Misiones de la semana</div></div>
                <span className="chip gold"><Zap size={13} /> Recompensas XP</span>
              </div>
              <div className="stack g-16">
                {game.data.missions.map((mission) => {
                  const value = Math.round((Math.min(mission.progress, mission.goal_count) / Math.max(1, mission.goal_count)) * 100);
                  const complete = mission.progress >= mission.goal_count;
                  return (
                    <div key={mission.code} className="row g-16">
                      <div className={`tile ${complete ? 'mint' : 'soft'}`} style={{ width: 38, height: 38, borderRadius: 12 }}>
                        {complete ? <Check size={18} strokeWidth={3} /> : <Star size={17} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row between" style={{ marginBottom: 6 }}>
                          <b style={{ fontSize: 14.5 }}>{mission.title}</b>
                          <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{Math.min(mission.progress, mission.goal_count)}/{mission.goal_count}</span>
                        </div>
                        <Bar value={value} tone={complete ? 'mint' : 'gold'} thin />
                        <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>{mission.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          )}
          <Reveal className="card" delay={0.1}>
            <div className="card-head"><div className="row g-12"><Tile icon={Megaphone} tone="coral" /><div className="card-title">Tablón</div></div></div>
            <div className="list">
              {(feed.data?.announcements ?? []).map((item) => (
                <div key={item.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="chip violet" style={{ marginBottom: 6 }}>{item.course_title}</div>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <p className="muted" style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{item.body}</p>
                  </div>
                </div>
              ))}
              {!feed.data?.announcements.length && <Empty icon={Megaphone} title="Sin anuncios" />}
            </div>
          </Reveal>
          <Reveal className="card" delay={0.15}>
            <div className="card-head"><div className="row g-12"><Tile icon={CalendarDays} tone="sky" /><div className="card-title">Agenda</div></div></div>
            <div className="list">
              {(feed.data?.events ?? []).map((item) => (
                <div key={item.id} className="list-row">
                  <DateTile date={item.starts_at} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{item.course_title} · {new Date(item.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              {!feed.data?.events.length && <Empty icon={CalendarDays} title="Agenda despejada" />}
            </div>
          </Reveal>
      </aside>
    </div>
  );
}

export function CoursesPage() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<CourseCard[]>('/api/courses') });
  return (
    <div>
      <PageHeader eyebrow="Aprender" title="Mis cursos" subtitle="Cada curso es un mapa de aventura con unidades, lecciones y retos." />
      <div className="grid cols-3">
        {(courses.data ?? []).map((course, i) => <CourseTile key={course.id} course={course} index={i} />)}
      </div>
      {!courses.isLoading && !courses.data?.length && <div className="card"><Empty icon={BookOpen} title="Aún no tienes cursos" /></div>}
    </div>
  );
}

const unitTones = [
  'linear-gradient(135deg, #7c5cff, #5b3df5)',
  'linear-gradient(135deg, #19c39c, #0e9f7e)',
  'linear-gradient(135deg, #ff9f43, #ff6b3d)',
  'linear-gradient(135deg, #3ab8ff, #3a7bff)',
  'linear-gradient(135deg, #ff5d73, #d9468f)',
  'linear-gradient(135deg, #b24bf3, #7c5cff)',
];
const offsets = [0, 70, 110, 70, 0, -70, -110, -70];

export function CoursePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const course = useQuery({ queryKey: ['course', id], queryFn: () => api<CourseDetail>(`/api/courses/${id}`) });
  const board = useQuery({ queryKey: ['board', course.data?.group_id], enabled: Boolean(course.data), queryFn: () => api<{ position: number; fullName: string; xp: number }[]>(`/api/gamification/leaderboard?groupId=${course.data?.group_id}`) });
  if (!course.data) return <div className="card"><Empty icon={BookOpen} title="Cargando el curso…" /></div>;

  const lessons = course.data.units.flatMap((unit) => unit.lessons);
  const done = lessons.filter((lesson) => lesson.completed).length;
  const nextId = lessons.find((lesson) => !lesson.completed)?.id;
  let counter = 0;

  return (
    <div>
      <Reveal>
        <section className="hero" style={{ background: pickGradient(id), marginBottom: 24 }}>
          <div className="row between wrap g-24" style={{ position: 'relative' }}>
            <div style={{ maxWidth: 620 }}>
              <Link to="/app/cursos" className="row g-4" style={{ color: 'rgba(255,255,255,.85)', fontWeight: 700, fontSize: 14 }}><ArrowLeft size={15} /> Cursos</Link>
              <h1 style={{ marginTop: 10 }}>{course.data.title}</h1>
              <p style={{ color: 'rgba(255,255,255,.88)', marginTop: 8, fontSize: 16 }}>{course.data.description}</p>
              <div className="row g-8 wrap" style={{ marginTop: 18 }}>
                <Link to={`/app/cursos/${id}/aula`} className="btn white"><ClipboardList size={17} /> Tareas y evaluaciones</Link>
                {nextId && <Link to={`/app/lecciones/${nextId}`} className="btn glass"><Play size={16} fill="currentColor" /> Siguiente lección</Link>}
              </div>
            </div>
            <Ring value={lessons.length ? (done / lessons.length) * 100 : 0} size={130} stroke={12} color="#fff" track="rgba(255,255,255,.25)">
              <div className="display" style={{ fontSize: 34 }}>{done}/{lessons.length}</div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>lecciones</div>
            </Ring>
          </div>
        </section>
      </Reveal>

      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2 map-wrap">
          {course.data.units.map((unit, unitIndex) => (
            <div key={unit.id}>
              <Reveal delay={unitIndex * 0.05}>
                <div className="unit-banner" style={{ background: unitTones[unitIndex % unitTones.length] }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', opacity: 0.85 }}>UNIDAD {unitIndex + 1}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>{unit.title}</div>
                    <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{unit.summary}</div>
                  </div>
                  <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: 0 }}>
                    {unit.lessons.filter((l) => l.completed).length}/{unit.lessons.length}
                  </span>
                </div>
              </Reveal>
              <div className="path">
                {unit.lessons.map((lesson) => {
                  const offset = offsets[counter++ % offsets.length]!;
                  const state = lesson.completed ? 'done' : lesson.id === nextId ? 'next' : 'todo';
                  return (
                    <motion.div
                      key={lesson.id}
                      className="node-wrap"
                      style={{ x: offset }}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: Math.min(counter, 14) * 0.05 }}
                    >
                      {state === 'next' && <span className="start-tag">¡EMPIEZA!</span>}
                      <button className={`node ${state}`} onClick={() => navigate(`/app/lecciones/${lesson.id}`)} title={lesson.title}>
                        {state === 'done' ? <Check size={32} strokeWidth={3.4} /> : state === 'next' ? <Star size={30} fill="#fff" /> : <Lock size={24} />}
                      </button>
                      <div className="node-label">{lesson.title}</div>
                      <div className="muted row g-4" style={{ fontSize: 12, fontWeight: 600 }}><Clock size={12} /> {lesson.estimatedMin} min</div>
                    </motion.div>
                  );
                })}
                {!unit.lessons.length && <p className="muted">Sin lecciones todavía.</p>}
              </div>
            </div>
          ))}
          <TeacherCompose courseId={id} />
        </div>

        <aside className="stack" style={{ gap: 18, position: 'sticky', top: 90 }}>
          <Reveal className="card">
            <div className="card-head">
              <div className="row g-12"><Tile icon={Crown} tone="gold" /><div className="card-title">Liga del grupo</div></div>
            </div>
            <div className="stack g-8">
              {(board.data ?? []).slice(0, 10).map((row) => {
                const medal = row.position === 1 ? '#ffc83d' : row.position === 2 ? '#c7cbe0' : row.position === 3 ? '#e59a5b' : null;
                const me = row.fullName === user?.fullName;
                return (
                  <div key={row.position} className="row g-12" style={{ padding: '10px 12px', borderRadius: 14, background: me ? 'rgba(124,92,255,.1)' : 'var(--surface-2)', border: me ? '1.5px solid var(--violet)' : '1px solid transparent' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: medal ?? 'var(--bg-2)', color: medal ? '#fff' : 'var(--muted)' }}>{row.position}</div>
                    <Avatar name={row.fullName} />
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.fullName}</div>
                    <b style={{ fontSize: 14 }}>{row.xp} <span className="muted" style={{ fontSize: 12 }}>XP</span></b>
                  </div>
                );
              })}
              {!board.data?.length && <Empty icon={Trophy} title="La liga empieza pronto" />}
            </div>
          </Reveal>
          <Reveal className="card" delay={0.1}>
            <div className="row g-12" style={{ marginBottom: 12 }}><Tile icon={Sparkles} tone="violet" /><div className="card-title">¿Atascado?</div></div>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>El tutor IA te da pistas paso a paso sin darte la respuesta.</p>
            <Link to={`/app/tutor?course=${id}`} className="btn soft" style={{ marginTop: 14, width: '100%' }}>Abrir tutor</Link>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

export function LessonPage() {
  const { id = '' } = useParams();
  const client = useQueryClient();
  const lesson = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api<{ id: string; title: string; bodyMd: string; courseId: string; unitTitle: string }>(`/api/lessons/${id}`),
  });
  const done = useMutation({
    mutationFn: () => api(`/api/lessons/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['me-game'] });
      client.invalidateQueries({ queryKey: ['course'] });
      client.invalidateQueries({ queryKey: ['courses'] });
    },
  });
  if (!lesson.data) return <div className="card"><Empty icon={BookOpen} title="Abriendo la lección…" /></div>;
  const paragraphs = lesson.data.bodyMd.split(/\n\n+/);
  const minutes = Math.max(2, Math.round(lesson.data.bodyMd.split(/\s+/).length / 120));
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <Reveal className="span-2">
        <article className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: pickGradient(lesson.data.courseId), padding: '30px 36px', color: '#fff' }}>
            <Link to={`/app/cursos/${lesson.data.courseId}`} className="row g-4" style={{ color: 'rgba(255,255,255,.85)', fontWeight: 700, fontSize: 14 }}><ArrowLeft size={15} /> Volver al mapa</Link>
            <div className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: 0, marginTop: 16 }}>{lesson.data.unitTitle}</div>
            <h1 style={{ fontSize: 'clamp(28px, 3vw, 40px)', marginTop: 10 }}>{lesson.data.title}</h1>
            <div className="row g-16" style={{ marginTop: 12, fontSize: 14, fontWeight: 600, opacity: 0.9 }}>
              <span className="row g-4"><Clock size={15} /> {minutes} min de lectura</span>
              <span className="row g-4"><Zap size={15} /> +25 XP</span>
              <span className="lesson-listen"><SpeakButton text={`${lesson.data.title}. ${lesson.data.bodyMd}`} label="Escuchar lección" /></span>
            </div>
          </div>
          <div className="reader" style={{ padding: '32px 36px' }}>
            {paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
          <div style={{ padding: '0 36px 32px' }}>
            {done.isSuccess ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="row g-16" style={{ padding: 20, borderRadius: 20, background: 'rgba(25,195,156,.12)', border: '1.5px solid var(--mint)' }}>
                <Tile icon={Check} tone="mint" large />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>¡Estación completada!</div>
                  <div className="muted">El mapa y tu experiencia ya se actualizaron.</div>
                </div>
                <Link to={`/app/cursos/${lesson.data.courseId}`} className="btn mint">Siguiente <ArrowRight size={16} /></Link>
              </motion.div>
            ) : (
              <button className="btn lg" style={{ width: '100%' }} onClick={() => done.mutate()} disabled={done.isPending}>
                <Check size={19} strokeWidth={3} /> {done.isPending ? 'Guardando…' : 'Marcar estación completa'}
              </button>
            )}
          </div>
        </article>
      </Reveal>
      <aside className="stack" style={{ gap: 18, position: 'sticky', top: 90 }}>
        <Reveal className="card" delay={0.1}>
          <div className="row g-12" style={{ marginBottom: 12 }}><Tile icon={Sparkles} tone="violet" /><div className="card-title">Tutor IA</div></div>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>¿Algo no quedó claro? Pide una pista sobre esta lección.</p>
          <Link to={`/app/tutor?lesson=${lesson.data.id}&course=${lesson.data.courseId}`} className="btn soft" style={{ marginTop: 14, width: '100%' }}>Pedir una pista</Link>
        </Reveal>
        <Reveal className="card" delay={0.15}>
          <div className="row g-12" style={{ marginBottom: 12 }}><Tile icon={ClipboardList} tone="sky" /><div className="card-title">Pon a prueba lo aprendido</div></div>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>Practica con la evaluación del curso y gana XP extra.</p>
          <Link to={`/app/cursos/${lesson.data.courseId}/aula`} className="btn ghost" style={{ marginTop: 14, width: '100%' }}>Ir a evaluaciones</Link>
        </Reveal>
      </aside>
    </div>
  );
}

const kindMeta: Record<string, { label: string; tone: 'mint' | 'coral' | 'sky'; icon: LucideIcon }> = {
  practice: { label: 'Práctica', tone: 'mint', icon: Target },
  exam: { label: 'Examen', tone: 'coral', icon: ShieldCheck },
  live: { label: 'En vivo', tone: 'sky', icon: Radio },
};

export function CourseDesk() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const client = useQueryClient();
  const isStudent = user?.role === 'student';
  const canTeach = user?.role === 'teacher' || user?.role === 'admin';
  const desk = useQuery({
    queryKey: ['desk', id],
    queryFn: () => api<{
      assignments: { id: string; title: string; instructions: string; max_score: number }[];
      submissions: { id: string; assignment_id: string; full_name: string; body: string; status: string; score: number | null }[];
    }>(`/api/courses/${id}/assignments`),
  });
  const assessments = useQuery({ queryKey: ['assessments', id], queryFn: () => api<{ id: string; title: string; kind: string }[]>(`/api/courses/${id}/assessments`) });
  const events = useQuery({ queryKey: ['events', id], queryFn: () => api<{ id: string; title: string; starts_at: string; kind: string }[]>(`/api/courses/${id}/events`) });
  const [error, setError] = useState('');
  async function submit(assignmentId: string, body: string) {
    try {
      await api(`/api/assignments/${assignmentId}/submit`, { method: 'POST', body: JSON.stringify({ body }) });
      client.invalidateQueries({ queryKey: ['desk', id] });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se envió');
    }
  }
  async function start(assessmentId: string) {
    try {
      const attempt = await api<{ id: string }>(`/api/assessments/${assessmentId}/start`, { method: 'POST' });
      window.location.href = `/examen/${attempt.id}`;
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo iniciar');
    }
  }
  return (
    <div>
      <PageHeader
        eyebrow="Mesa del curso"
        title="Tareas, evaluaciones y agenda"
        subtitle="Todo lo que se entrega, se evalúa y se programa en este curso."
        actions={
          <>
            <Link to={`/app/cursos/${id}`} className="btn ghost"><ArrowLeft size={16} /> Mapa</Link>
            {!isStudent && <Link to={`/app/integridad/${id}`} className="btn soft"><ShieldCheck size={16} /> Integridad</Link>}
            {!isStudent && <Link to={`/app/reportes/${id}`} className="btn"><BarChart3 size={16} /> Reportes</Link>}
          </>
        }
      />
      {error && <p className="err" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2 stack" style={{ gap: 18 }}>
          <Reveal className="card">
            <div className="card-head"><div className="row g-12"><Tile icon={ClipboardList} tone="violet" /><div className="card-title">Evaluaciones</div></div></div>
            <div className="grid cols-2" style={{ gap: 12 }}>
              {(assessments.data ?? []).map((item) => {
                const meta = kindMeta[item.kind] ?? kindMeta.practice!;
                return (
                  <div key={item.id} className="card" style={{ padding: 18, background: 'var(--surface-2)' }}>
                    <div className="row between">
                      <Tile icon={meta.icon} tone={meta.tone} />
                      <span className={`chip ${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginTop: 14 }}>{item.title}</div>
                    <div className="row g-8 wrap" style={{ marginTop: 14 }}>
                      {isStudent && item.kind !== 'live' && <button className="btn sm" onClick={() => start(item.id)}><Play size={14} fill="currentColor" /> Comenzar</button>}
                      {isStudent && item.kind === 'live' && <Link to="/app/en-vivo" className="btn sm"><Radio size={14} /> Unirme</Link>}
                      {canTeach && <Link to={`/app/en-vivo?assessment=${item.id}`} className="btn sm"><Radio size={14} /> Abrir en vivo</Link>}
                      {!isStudent && (
                        <button className="btn sm ghost" onClick={() => download(`/api/reports/assessments/${item.id}/excel`, 'resultados.xlsx')}><FileSpreadsheet size={14} /> Excel</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!assessments.data?.length && <div className="span-2"><Empty icon={ClipboardList} title="Sin evaluaciones" /></div>}
            </div>
          </Reveal>

          <Reveal className="card" delay={0.05}>
            <div className="card-head"><div className="row g-12"><Tile icon={PenLine} tone="gold" /><div className="card-title">Tareas</div></div></div>
            <div className="stack g-16">
              {(desk.data?.assignments ?? []).map((assignment) => {
                const subs = desk.data?.submissions.filter((s) => s.assignment_id === assignment.id) ?? [];
                const mine = isStudent ? subs[0] : undefined;
                return (
                  <div key={assignment.id} style={{ padding: 18, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                    <div className="row between wrap g-8">
                      <b style={{ fontSize: 16 }}>{assignment.title}</b>
                      <span className="chip">Máx. {assignment.max_score} pts</span>
                    </div>
                    <p className="muted" style={{ marginTop: 6, lineHeight: 1.55 }}>{assignment.instructions}</p>
                    {isStudent && mine && (
                      <div className="row g-8" style={{ marginTop: 12 }}>
                        <span className={`chip ${mine.score != null ? 'mint' : 'violet'}`}>{mine.score != null ? `Calificada · ${mine.score}` : 'Entregada'}</span>
                      </div>
                    )}
                    {isStudent && (
                      <form style={{ marginTop: 14 }} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); submit(assignment.id, String(new FormData(event.currentTarget).get('body'))); }}>
                        <label className="field">Tu entrega<textarea id={`entrega-${assignment.id}`} name="body" rows={4} placeholder="Escribe o dicta tu respuesta y explica tu razonamiento…" required /></label>
                        <div className="row g-8">
                          <button className="btn" type="submit">{mine ? 'Reenviar' : 'Entregar'}</button>
                          <MicButton label="Dictar" onText={(text) => appendToField(`entrega-${assignment.id}`, text)} />
                        </div>
                      </form>
                    )}
                    {!isStudent && (
                      <div className="stack g-12" style={{ marginTop: 14 }}>
                        {subs.map((submission) =>
                          canTeach ? (
                            <GradeBox key={submission.id} submission={submission} onDone={() => client.invalidateQueries({ queryKey: ['desk', id] })} />
                          ) : (
                            <div key={submission.id} className="row between g-8" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                              <b>{submission.full_name}</b>
                              <span className={`chip ${submission.score != null ? 'mint' : 'gold'}`}>{submission.score != null ? `Nota ${submission.score}` : 'Por calificar'}</span>
                            </div>
                          ),
                        )}
                        {!subs.length && <p className="muted" style={{ fontSize: 14 }}>Aún no hay entregas.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              {!desk.data?.assignments.length && <Empty icon={PenLine} title="Sin tareas" />}
            </div>
          </Reveal>
        </div>

        <Reveal className="card" delay={0.1}>
          <div className="card-head"><div className="row g-12"><Tile icon={CalendarDays} tone="sky" /><div className="card-title">Calendario</div></div></div>
          <div className="list">
            {(events.data ?? []).map((event) => (
              <div key={event.id} className="list-row">
                <DateTile date={event.starts_at} />
                <div>
                  <div style={{ fontWeight: 800 }}>{event.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{new Date(event.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · {event.kind}</div>
                </div>
              </div>
            ))}
            {!events.data?.length && <Empty icon={CalendarDays} title="Sin eventos" />}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function TeacherCompose({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [unitId, setUnitId] = useState('');
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return null;
  return (
    <form className="card" style={{ marginTop: 12, border: '2px dashed var(--line)', background: 'var(--surface-2)' }} onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      if (!unitId) {
        const unit = await api<{ id: string }>(`/api/courses/${courseId}/units`, { method: 'POST', body: JSON.stringify({ title: String(data.get('title')), summary: String(data.get('summary') || '') }) });
        setUnitId(unit.id);
      } else {
        await api(`/api/units/${unitId}/lessons`, { method: 'POST', body: JSON.stringify({ title: String(data.get('title')), bodyMd: String(data.get('summary') || 'Nueva estación.') }) });
      }
      client.invalidateQueries({ queryKey: ['course', courseId] });
      form.reset();
    }}>
      <div className="row g-12" style={{ marginBottom: 16 }}>
        <Tile icon={Plus} tone="violet" />
        <div>
          <div className="card-title">{unitId ? 'Nueva lección' : 'Nueva unidad'}</div>
          <div className="muted" style={{ fontSize: 13 }}>{unitId ? 'Se agregará a la unidad recién creada.' : 'Crea una unidad y luego agrégale lecciones.'}</div>
        </div>
      </div>
      <label className="field">Título<input name="title" required /></label>
      <label className="field">{unitId ? 'Contenido' : 'Resumen'}<textarea name="summary" rows={3} /></label>
      <button className="btn" type="submit"><Plus size={16} /> {unitId ? 'Agregar lección' : 'Agregar unidad'}</button>
    </form>
  );
}

function GradeBox({ submission, onDone }: { submission: { id: string; full_name: string; body: string; status: string; score: number | null }; onDone: () => void }) {
  return (
    <form className="card" style={{ padding: 16 }} onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await api(`/api/submissions/${submission.id}/grade`, { method: 'POST', body: JSON.stringify({ score: Number(data.get('score')), feedback: String(data.get('feedback') || '') }) });
      onDone();
    }}>
      <div className="row g-12">
        <Avatar name={submission.full_name} />
        <div style={{ flex: 1 }}>
          <b>{submission.full_name}</b>
          <div><span className={`chip ${submission.score != null ? 'mint' : 'gold'}`}>{submission.score != null ? `Nota ${submission.score}` : submission.status}</span></div>
        </div>
      </div>
      <p style={{ margin: '12px 0', lineHeight: 1.55, color: 'var(--ink-2)' }}>{submission.body}</p>
      <div className="row g-8 wrap" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0, width: 110 }}>Nota<input name="score" type="number" min={0} max={100} required /></label>
        <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>Comentario<input name="feedback" /></label>
        <button className="btn" type="submit">Calificar</button>
      </div>
    </form>
  );
}
