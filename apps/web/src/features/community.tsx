import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  Crown,
  Download,
  Eye,
  FileText,
  HeartHandshake,
  Lock,
  MessageCircle,
  MessagesSquare,
  Megaphone,
  Pin,
  PinOff,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABELS } from '@eduquest/contracts';
import { api, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { joinDictation } from '@/shared/voice';
import { Avatar, Bar, Empty, PageHeader, Reveal, Stat, Tile, type Tone } from '@/ui';
import { DigestControl, FamilyDetail, useFamily, type FamilyChild } from './governance';

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const CATEGORIES: { key: string; label: string; tone: Tone }[] = [
  { key: 'general', label: 'General', tone: 'violet' },
  { key: 'academico', label: 'Académico', tone: 'sky' },
  { key: 'evento', label: 'Evento', tone: 'gold' },
  { key: 'convivencia', label: 'Convivencia', tone: 'mint' },
  { key: 'urgente', label: 'Urgente', tone: 'coral' },
];
const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0]!;

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string, LucideIcon][] }) {
  return (
    <div className="row g-8" style={{ marginBottom: 18, padding: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'fit-content' }}>
      {items.map(([key, label, Icon]) => (
        <button key={key} className={`btn sm ${value === key ? '' : 'ghost'}`} style={value === key ? undefined : { border: 0 }} onClick={() => onChange(key)}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

function Panel({ icon, tone, title, subtitle, children, className, actions }: { icon: LucideIcon; tone: Tone; title: string; subtitle?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <Reveal className={`card ${className ?? ''}`}>
      <div className="row g-12" style={{ marginBottom: 16 }}>
        <Tile icon={icon} tone={tone} />
        <div style={{ flex: 1 }}>
          <div className="card-title">{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 13 }}>{subtitle}</div>}
        </div>
        {actions}
      </div>
      {children}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Cartelera                                                           */
/* ------------------------------------------------------------------ */

interface NewsItem {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  requiresAck: boolean;
  official?: boolean;
  publishAt: string;
  expiresAt: string | null;
  author: string;
  scheduled: boolean;
  expired: boolean;
  readAt: string | null;
  acknowledgedAt: string | null;
  canManage: boolean;
  audience: { kind: string; value: string; label: string }[];
  stats?: { reads: number; acks: number };
}

export function NewsPage() {
  const { user } = useAuth();
  const canPublish = user && ['teacher', 'admin', 'coordinator', 'rector'].includes(user.role);
  const canForum = user && user.role !== 'guardian';
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'news' | 'forums'>(params.get('hilo') && canForum ? 'forums' : 'news');
  return (
    <div>
      <PageHeader eyebrow="Cartelera" title="Novedades y foros" subtitle="Circulares del colegio, avisos de tus cursos y conversación por materia." />
      {canForum && (
        <Tabs value={tab} onChange={setTab} items={[['news', 'Novedades', Megaphone], ['forums', 'Foros de curso', MessagesSquare]]} />
      )}
      {tab === 'news' ? <NewsBoard canPublish={Boolean(canPublish)} /> : <Forums />}
    </div>
  );
}

function NewsBoard({ canPublish }: { canPublish: boolean }) {
  const client = useQueryClient();
  const news = useQuery({ queryKey: ['news'], queryFn: () => api<NewsItem[]>('/api/news') });
  const [filter, setFilter] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [params] = useSearchParams();
  const linked = params.get('aviso');
  const opened = useRef(false);
  const items = (news.data ?? []).filter((n) => filter === 'all' || (filter === 'unread' ? !n.readAt && !n.canManage : n.category === filter));
  const unread = (news.data ?? []).filter((n) => !n.readAt && !n.canManage).length;
  const pendingAck = (news.data ?? []).filter((n) => n.requiresAck && !n.acknowledgedAt && !n.canManage).length;

  function refresh() {
    client.invalidateQueries({ queryKey: ['news'] });
    client.invalidateQueries({ queryKey: ['campus'] });
  }

  async function expand(item: NewsItem) {
    const next = open === item.id ? null : item.id;
    setOpen(next);
    if (next && !item.readAt && !item.canManage && !item.scheduled) {
      await api(`/api/news/${item.id}/read`, { method: 'POST' });
      refresh();
      client.invalidateQueries({ queryKey: ['notifications'] });
    }
  }

  useEffect(() => {
    if (!linked || opened.current || !news.data) return;
    const item = news.data.find((n) => n.id === linked);
    if (!item) return;
    opened.current = true;
    void expand(item);
    window.setTimeout(() => document.getElementById(`aviso-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  });

  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className={canPublish ? 'span-2 stack' : 'span-2 stack'} style={{ gap: 14, gridColumn: canPublish ? undefined : '1 / -1' }}>
        <div className="row g-8 wrap">
          <button className={`chip ${filter === 'all' ? 'violet' : ''}`} onClick={() => setFilter('all')}>Todas</button>
          <button className={`chip ${filter === 'unread' ? 'violet' : ''}`} onClick={() => setFilter('unread')}>Sin leer {unread > 0 && `(${unread})`}</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} className={`chip ${filter === c.key ? c.tone : ''}`} onClick={() => setFilter(c.key)}>{c.label}</button>
          ))}
          {pendingAck > 0 && <span className="chip coral" style={{ marginLeft: 'auto' }}><BellRing size={13} /> {pendingAck} por confirmar</span>}
        </div>
        {items.map((item, i) => (
          <NewsCard key={item.id} item={item} open={open === item.id} onToggle={() => expand(item)} onChange={refresh} delay={i * 0.03} />
        ))}
        {!news.isLoading && !items.length && <Empty icon={Megaphone} title="No hay novedades aquí" body="Cuando el colegio o tus docentes publiquen algo, aparecerá en esta cartelera." />}
      </div>
      {canPublish && <Composer onDone={refresh} />}
    </div>
  );
}

function NewsCard({ item, open, onToggle, onChange, delay }: { item: NewsItem; open: boolean; onToggle: () => void; onChange: () => void; delay: number }) {
  const cat = categoryOf(item.category);
  const [receipts, setReceipts] = useState(false);
  const unread = !item.readAt && !item.canManage;

  async function ack() {
    await api(`/api/news/${item.id}/ack`, { method: 'POST' });
    onChange();
  }
  async function pin() {
    await api(`/api/news/${item.id}/pin`, { method: 'PATCH', body: JSON.stringify({ pinned: !item.pinned }) });
    onChange();
  }
  async function remove() {
    if (!confirm('¿Eliminar esta novedad para todos?')) return;
    await api(`/api/news/${item.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <Reveal delay={delay} className={`card news-card${unread ? ' unread' : ''}${item.pinned ? ' pinned' : ''}${item.official ? ' official' : ''}`}>
      <button id={`aviso-${item.id}`} className="news-head" onClick={onToggle} aria-expanded={open}>
        <Tile icon={item.official ? Crown : item.category === 'urgente' ? BellRing : item.category === 'evento' ? CalendarClock : Megaphone} tone={item.official ? 'gold' : cat.tone} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div className="row g-8 wrap" style={{ marginBottom: 4 }}>
            {item.official && <span className="chip gold"><Crown size={12} /> Comunicado oficial de Rectoría</span>}
            {item.pinned && <span className="chip gold"><Pin size={12} /> Fijada</span>}
            <span className={`chip ${cat.tone}`}>{cat.label}</span>
            {item.scheduled && <span className="chip sky"><CalendarClock size={12} /> Programada · {when(item.publishAt)}</span>}
            {item.expired && <span className="chip">Vencida</span>}
            {item.requiresAck && (item.acknowledgedAt ? <span className="chip mint"><CheckCheck size={12} /> Confirmada</span> : !item.canManage && <span className="chip coral">Requiere confirmación</span>)}
          </div>
          <div className="news-title">{item.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>{item.author} · {when(item.publishAt)}</div>
        </div>
        {unread && <span className="news-dot" aria-label="Sin leer" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <p className="news-body">{item.body}</p>
            <div className="row g-8 wrap" style={{ marginTop: 12 }}>
              {item.audience.map((a) => <span key={`${a.kind}:${a.value}`} className="chip">{a.label}</span>)}
            </div>
            <div className="row g-8 wrap" style={{ marginTop: 14 }}>
              <SpeakButton text={`${item.title}. ${item.body}`} label="Escuchar" />
              {item.requiresAck && !item.acknowledgedAt && !item.canManage && !item.scheduled && (
                <button className="btn sm" onClick={ack}><CheckCircle2 size={15} /> Confirmo que la leí</button>
              )}
              {item.canManage && (
                <>
                  <span className="chip violet" style={{ marginLeft: 'auto' }}><Eye size={13} /> {item.stats?.reads ?? 0} leídas{item.requiresAck ? ` · ${item.stats?.acks ?? 0} confirmadas` : ''}</span>
                  <button className="btn sm ghost" onClick={() => setReceipts(!receipts)}>Ver acuses</button>
                  <button className="btn sm ghost" onClick={pin} title={item.pinned ? 'Desfijar' : 'Fijar arriba'}>{item.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
                  <button className="btn sm ghost" onClick={remove} title="Eliminar"><Trash2 size={15} /></button>
                </>
              )}
            </div>
            {receipts && <Receipts id={item.id} requiresAck={item.requiresAck} />}
          </motion.div>
        )}
      </AnimatePresence>
    </Reveal>
  );
}

function Receipts({ id, requiresAck }: { id: string; requiresAck: boolean }) {
  const data = useQuery({
    queryKey: ['news-receipts', id],
    queryFn: () => api<{ total: number; read: number; acknowledged: number; people: { userId: string; name: string; role: string; readAt: string | null; acknowledgedAt: string | null }[] }>(`/api/news/${id}/receipts`),
  });
  if (!data.data) return <p className="muted" style={{ marginTop: 12 }}>Cargando acuses…</p>;
  const pct = data.data.total ? Math.round((data.data.read * 100) / data.data.total) : 0;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="row between" style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        <span>{data.data.read} de {data.data.total} la leyeron{requiresAck ? ` · ${data.data.acknowledged} confirmaron` : ''}</span>
        <span>{pct}%</span>
      </div>
      <Bar value={pct} tone="mint" thin />
      <div className="table-scroll" style={{ maxHeight: 260, overflowY: 'auto', marginTop: 10 }}>
        <table className="table">
          <thead><tr><th>Persona</th><th>Leída</th>{requiresAck && <th>Confirmada</th>}</tr></thead>
          <tbody>
            {data.data.people.map((p) => (
              <tr key={p.userId}>
                <td><b>{p.name}</b> <span className="muted" style={{ fontSize: 12 }}>{roleLabel[p.role] ?? p.role}</span></td>
                <td className={p.readAt ? '' : 'muted'}>{p.readAt ? when(p.readAt) : 'Pendiente'}</td>
                {requiresAck && <td className={p.acknowledgedAt ? '' : 'muted'}>{p.acknowledgedAt ? when(p.acknowledgedAt) : 'Pendiente'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const roleLabel: Record<string, string> = ROLE_LABELS;
const toGrade = (percent: number) => Math.round((1 + (4 * percent) / 100) * 10) / 10;
const roleAudience: Record<string, string> = { student: 'Estudiantes', guardian: 'Acudientes', teacher: 'Docentes', coordinator: 'Coordinación', rector: 'Rectoría' };

interface Targets { allowAll: boolean; canOfficial?: boolean; roles: string[]; groups: { id: string; label: string }[]; courses: { id: string; title: string }[] }
type Target = { kind: 'all' } | { kind: 'role' | 'group' | 'course'; value: string };
const targetKey = (t: Target) => `${t.kind}:${'value' in t ? t.value : ''}`;

function Composer({ onDone }: { onDone: () => void }) {
  const targets = useQuery({ queryKey: ['news-targets'], queryFn: () => api<Targets>('/api/news/targets') });
  const [params] = useSearchParams();
  const officialPreset = params.get('oficial') === '1';
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Target[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => new Set(audience.map(targetKey)), [audience]);

  function toggle(target: Target) {
    const key = targetKey(target);
    setAudience((current) => (current.some((t) => targetKey(t) === key) ? current.filter((t) => targetKey(t) !== key) : [...current, target]));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError('');
    if (!audience.length) return setError('Elige a quién va dirigida.');
    const publishAt = String(d.get('publishAt') || '');
    const expiresAt = String(d.get('expiresAt') || '');
    setBusy(true);
    try {
      await api('/api/news', {
        method: 'POST',
        body: JSON.stringify({
          title: d.get('title'),
          body,
          category: d.get('category'),
          pinned: d.get('pinned') === 'on',
          requiresAck: d.get('requiresAck') === 'on',
          official: d.get('official') === 'on',
          publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          audience,
        }),
      });
      form.reset();
      setBody('');
      setAudience([]);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const t = targets.data;
  return (
    <Panel icon={Megaphone} tone="violet" title="Publicar novedad" subtitle="Llega como notificación a cada destinatario">
      <form onSubmit={submit}>
        <label className="field">Título<input name="title" required minLength={3} maxLength={160} /></label>
        <label className="field">
          <span className="row between">Mensaje <MicButton label="Dictar" onText={(text) => setBody((b) => joinDictation(b, text))} /></span>
          <textarea name="body" rows={5} required value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
        </label>
        <label className="field">Categoría
          <select name="category" defaultValue="general">{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        </label>
        <div className="field">
          Destinatarios
          <div className="row g-8 wrap">
            {t?.allowAll && <button type="button" className={`chip ${selected.has('all:') ? 'violet' : ''}`} onClick={() => toggle({ kind: 'all' })}>Toda la comunidad</button>}
            {t?.roles.map((r) => <button type="button" key={r} className={`chip ${selected.has(`role:${r}`) ? 'violet' : ''}`} onClick={() => toggle({ kind: 'role', value: r })}>{roleAudience[r] ?? r}</button>)}
            {t?.groups.map((g) => <button type="button" key={g.id} className={`chip ${selected.has(`group:${g.id}`) ? 'sky' : ''}`} onClick={() => toggle({ kind: 'group', value: g.id })}>{g.label}</button>)}
            {t?.courses.map((c) => <button type="button" key={c.id} className={`chip ${selected.has(`course:${c.id}`) ? 'mint' : ''}`} onClick={() => toggle({ kind: 'course', value: c.id })}>{c.title}</button>)}
          </div>
        </div>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <label className="field">Publicar el<input name="publishAt" type="datetime-local" /></label>
          <label className="field">Vence el<input name="expiresAt" type="datetime-local" /></label>
        </div>
        <label className="check"><input name="pinned" type="checkbox" /> Fijar arriba</label>
        <label className="check"><input name="requiresAck" type="checkbox" /> Pedir confirmación de lectura</label>
        {t?.canOfficial && (
          <label className="check"><input name="official" type="checkbox" defaultChecked={officialPreset} /> <Crown size={15} color="var(--gold)" /> Comunicado oficial de Rectoría</label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Publicando…' : 'Publicar'}</button>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Foros                                                               */
/* ------------------------------------------------------------------ */

interface ThreadSummary { id: string; title: string; body: string; pinned: boolean; locked: boolean; posts_count: number; last_post_at: string; author: string; answered: boolean }
interface ThreadDetail extends ThreadSummary {
  moderator: boolean;
  canAnswer: boolean;
  canPost?: boolean;
  course_id: string;
  created_at: string;
  posts: { id: string; body: string; is_answer: boolean; created_at: string; author_id: string; author: string; role: string }[];
}

function Forums() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string; subject: string; group_name: string }[]>('/api/courses') });
  const [params] = useSearchParams();
  const [courseId, setCourseId] = useState<string>('');
  const [threadId, setThreadId] = useState<string | null>(params.get('hilo'));
  const active = courseId || courses.data?.[0]?.id || '';

  if (!courses.isLoading && !courses.data?.length) return <Empty icon={BookOpen} title="Sin cursos" body="Los foros viven dentro de cada curso." />;
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="card stack" style={{ gap: 6, padding: 12 }}>
        <div className="nav-label" style={{ color: 'var(--muted)' }}>Cursos</div>
        {(courses.data ?? []).map((c) => (
          <button key={c.id} className={`btn sm ${active === c.id ? '' : 'ghost'}`} style={{ justifyContent: 'flex-start', border: active === c.id ? undefined : 0 }} onClick={() => { setCourseId(c.id); setThreadId(null); }}>
            <BookOpen size={15} /> {c.title}
          </button>
        ))}
      </div>
      <div className="span-2">
        {active && (threadId ? <ThreadView id={threadId} onBack={() => setThreadId(null)} /> : <ThreadList courseId={active} onOpen={setThreadId} />)}
      </div>
    </div>
  );
}

function ThreadList({ courseId, onOpen }: { courseId: string; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const canPost = user != null && ['student', 'teacher', 'admin'].includes(user.role);
  const client = useQueryClient();
  const data = useQuery({ queryKey: ['forum', courseId], queryFn: () => api<{ moderator: boolean; threads: ThreadSummary[] }>(`/api/courses/${courseId}/forum`) });
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError('');
    try {
      const created = await api<{ id: string }>(`/api/courses/${courseId}/forum`, { method: 'POST', body: JSON.stringify({ title: d.get('title'), body }) });
      setBody('');
      setComposing(false);
      client.invalidateQueries({ queryKey: ['forum', courseId] });
      onOpen(created.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel icon={MessagesSquare} tone="sky" title="Foro del curso" subtitle={`${data.data?.threads.length ?? 0} temas`} actions={canPost ? <button className="btn sm" onClick={() => setComposing(!composing)}><MessageCircle size={15} /> Nuevo tema</button> : undefined}>
      {composing && (
        <form onSubmit={create} className="card" style={{ padding: 16, marginBottom: 16, background: 'var(--surface-2)' }}>
          <label className="field">Título<input name="title" required minLength={3} maxLength={160} placeholder="¿Cómo se simplifica 18/24?" /></label>
          <label className="field">
            <span className="row between">Pregunta o idea <MicButton label="Dictar" onText={(text) => setBody((b) => joinDictation(b, text))} /></span>
            <textarea rows={4} required value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit">Publicar tema</button>
        </form>
      )}
      <div className="stack" style={{ gap: 8 }}>
        {(data.data?.threads ?? []).map((t) => (
          <button key={t.id} className="thread-row" onClick={() => onOpen(t.id)}>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div className="row g-8 wrap">
                {t.pinned && <Pin size={14} color="var(--gold)" />}
                {t.locked && <Lock size={14} />}
                <b>{t.title}</b>
                {t.answered && <span className="chip mint"><CheckCircle2 size={12} /> Resuelto</span>}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{t.author} · última actividad {when(t.last_post_at)}</div>
            </div>
            <span className="chip"><MessageCircle size={12} /> {t.posts_count}</span>
          </button>
        ))}
        {!data.isLoading && !data.data?.threads.length && <Empty icon={MessagesSquare} title="Aún no hay temas" body="Abre el primero: una duda, un truco o una idea para la clase." />}
      </div>
    </Panel>
  );
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const data = useQuery({ queryKey: ['thread', id], queryFn: () => api<ThreadDetail>(`/api/forum/threads/${id}`) });
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const thread = data.data;

  function refresh() {
    client.invalidateQueries({ queryKey: ['thread', id] });
    if (thread) client.invalidateQueries({ queryKey: ['forum', thread.course_id] });
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api(`/api/forum/threads/${id}/posts`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function moderate(patch: { pinned?: boolean; locked?: boolean }) {
    await api(`/api/forum/threads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    refresh();
  }

  if (!thread) return <div className="card muted">Cargando tema…</div>;
  return (
    <div className="card">
      <div className="row g-8" style={{ marginBottom: 14 }}>
        <button className="btn sm ghost" onClick={onBack}><ChevronLeft size={15} /> Temas</button>
        <div style={{ flex: 1 }} />
        {thread.moderator && (
          <>
            <button className="btn sm ghost" onClick={() => moderate({ pinned: !thread.pinned })}>{thread.pinned ? <PinOff size={15} /> : <Pin size={15} />} {thread.pinned ? 'Desfijar' : 'Fijar'}</button>
            <button className="btn sm ghost" onClick={() => moderate({ locked: !thread.locked })}>{thread.locked ? <Unlock size={15} /> : <Lock size={15} />} {thread.locked ? 'Reabrir' : 'Cerrar'}</button>
          </>
        )}
      </div>
      <div className="card-title" style={{ fontSize: 22 }}>{thread.title}</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{thread.author} · {when(thread.created_at)}</div>
      <p className="news-body">{thread.body}</p>
      <div className="stack" style={{ gap: 10, marginTop: 18 }}>
        {thread.posts.map((post) => (
          <div key={post.id} className={`post${post.is_answer ? ' answer' : ''}`}>
            <Avatar name={post.author} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row g-8 wrap">
                <b>{post.author}</b>
                {post.role === 'teacher' && <span className="chip sky">Docente</span>}
                {post.is_answer && <span className="chip mint"><CheckCircle2 size={12} /> Respuesta</span>}
                <span className="muted" style={{ fontSize: 12 }}>{when(post.created_at)}</span>
              </div>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{post.body}</p>
              <div className="row g-8" style={{ marginTop: 6 }}>
                {thread.canAnswer && (
                  <button className="btn sm ghost" onClick={async () => { await api(`/api/forum/posts/${post.id}/answer`, { method: 'POST' }); refresh(); }}>
                    <CheckCircle2 size={14} /> {post.is_answer ? 'Quitar marca' : 'Marcar respuesta'}
                  </button>
                )}
                {(thread.moderator || post.author_id === user?.id) && (
                  <button className="btn sm ghost" onClick={async () => { await api(`/api/forum/posts/${post.id}`, { method: 'DELETE' }); refresh(); }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!thread.posts.length && <p className="muted">Nadie ha respondido todavía.</p>}
      </div>
      {thread.canPost === false ? (
        <p className="chip" style={{ marginTop: 16 }}><Eye size={13} /> Coordinación y rectoría leen y moderan los foros; participan docentes y estudiantes.</p>
      ) : thread.locked && !thread.moderator ? (
        <p className="chip" style={{ marginTop: 16 }}><Lock size={13} /> El docente cerró este tema.</p>
      ) : (
        <form onSubmit={send} style={{ marginTop: 18 }}>
          <label className="field">
            <span className="row between">Tu respuesta <MicButton label="Dictar" onText={(text) => setReply((r) => joinDictation(r, text))} /></span>
            <textarea rows={3} required value={reply} onChange={(e) => setReply(e.target.value)} maxLength={6000} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit" disabled={!reply.trim()}>Responder</button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Acudiente                                                           */
/* ------------------------------------------------------------------ */

interface GuardianStudent {
  id: string;
  fullName: string;
  relationship: string;
  isMinor: boolean;
  group: string | null;
  authorizations: { scope: 'facial' | 'ai_tutor' | 'data_processing'; label: string; granted: boolean | null; decidedAt: string | null; version: string | null }[];
}
interface Overview {
  lessons: { completed: number; total: number };
  xp: number;
  badges: number;
  flaggedAttempts: number;
  pendingAssignments: number;
  average: number | null;
  lastActivity: string | null;
  recent: { id: string; title: string; kind: string; course: string; percent: number; at: string }[];
}

const scopeHelp: Record<string, { icon: LucideIcon; text: string }> = {
  data_processing: { icon: ShieldCheck, text: 'Registrar notas, progreso y asistencia para el seguimiento académico.' },
  ai_tutor: { icon: Sparkles, text: 'Conversar con el compañero de IA (Luka o Luna). Los mensajes se envían sin nombre ni datos personales.' },
  facial: { icon: ScanFace, text: 'Iniciar sesión con el rostro. Se guarda un vector cifrado, nunca la foto. Revocar borra la plantilla.' },
};

export function GuardianPage() {
  const data = useQuery({ queryKey: ['guardian-students'], queryFn: () => api<{ policyVersion: string; students: GuardianStudent[] }>('/api/guardian/students') });
  const family = useFamily();
  const students = data.data?.students ?? [];
  return (
    <div>
      <PageHeader
        eyebrow="Familia"
        title="Seguimiento familiar"
        subtitle="Lo que viene, notas, asistencia, citaciones y mensajes con los docentes de tus hijos."
        actions={
          <>
            <Link className="btn ghost" to="/app/mensajes"><MessageCircle size={16} /> Mensajes</Link>
            <Link className="btn ghost" to="/app/novedades"><Megaphone size={16} /> Cartelera</Link>
          </>
        }
      />
      {family.data && <DigestControl digest={family.data.digest} />}
      {!data.isLoading && !students.length && (
        <Empty icon={HeartHandshake} title="Aún no tienes estudiantes vinculados" body="Coordinación vincula tu cuenta con la de tu hijo o acudido." />
      )}
      <div className="stack" style={{ gap: 22 }}>
        {students.map((s) => (
          <StudentCard key={s.id} student={s} policyVersion={data.data!.policyVersion} family={family.data?.children.find((c) => c.id === s.id)} />
        ))}
      </div>
    </div>
  );
}

function StudentCard({ student, policyVersion, family }: { student: GuardianStudent; policyVersion: string; family?: FamilyChild }) {
  const client = useQueryClient();
  const overview = useQuery({ queryKey: ['overview', student.id], queryFn: () => api<Overview>(`/api/analytics/students/${student.id}/overview`) });
  const [busy, setBusy] = useState<string | null>(null);
  const o = overview.data;
  const lessonPct = o && o.lessons.total ? Math.round((o.lessons.completed * 100) / o.lessons.total) : 0;

  async function decide(scope: string, granted: boolean) {
    if (!granted && scope === 'facial' && !confirm('Se borrará la plantilla facial de tu acudido. ¿Continuar?')) return;
    setBusy(scope);
    try {
      await api('/api/guardian/authorizations', { method: 'POST', body: JSON.stringify({ studentId: student.id, scope, granted }) });
      client.invalidateQueries({ queryKey: ['guardian-students'] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Reveal className="card">
      <div className="row g-16 wrap" style={{ marginBottom: 18 }}>
        <Avatar name={student.fullName} large />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="card-title" style={{ fontSize: 22 }}>{student.fullName}</div>
          <div className="row g-8 wrap" style={{ marginTop: 4 }}>
            <span className="chip violet">{student.group ?? 'Sin matrícula activa'}</span>
            <span className="chip" style={{ textTransform: 'capitalize' }}>{student.relationship}</span>
            {student.isMinor && <span className="chip gold">Menor de edad</span>}
            {o?.lastActivity && <span className="chip">Última actividad {when(o.lastActivity)}</span>}
          </div>
        </div>
        <button className="btn" onClick={() => download(`/api/reports/bulletin/${student.id}/pdf`, `boletin-${student.fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`)}>
          <Download size={16} /> Boletín PDF
        </button>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={BookOpen} tone="violet" value={o ? `${o.lessons.completed}/${o.lessons.total}` : '—'} label="Lecciones" extra={<Bar value={lessonPct} thin />} />
        <Stat icon={CheckCircle2} tone="mint" value={o?.average != null ? toGrade(o.average).toFixed(1) : '—'} label="Promedio reciente (1 a 5)" />
        <Stat icon={FileText} tone="sky" value={o?.pendingAssignments ?? '—'} label="Tareas pendientes" />
        <Stat icon={Zap} tone="gold" value={o?.xp ?? '—'} label={`XP · ${o?.badges ?? 0} insignias`} />
      </div>

      {family && <FamilyDetail child={family} />}

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card-title" style={{ fontSize: 16, marginBottom: 10 }}>Evaluaciones recientes</div>
          {o?.recent.length ? (
            <div className="table-scroll"><table className="table">
              <thead><tr><th>Evaluación</th><th>Curso</th><th style={{ textAlign: 'right' }}>Resultado</th></tr></thead>
              <tbody>
                {o.recent.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.title}</b><div className="muted" style={{ fontSize: 12 }}>{when(r.at)}</div></td>
                    <td className="muted">{r.course}</td>
                    <td style={{ textAlign: 'right' }}><span className={`chip ${toGrade(r.percent) >= 4 ? 'mint' : toGrade(r.percent) >= 3 ? 'gold' : 'coral'}`}>{toGrade(r.percent).toFixed(1)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : (
            <p className="muted">Todavía no presenta evaluaciones.</p>
          )}
          {o && o.flaggedAttempts > 0 && (
            <p className="chip coral" style={{ marginTop: 10 }}>Hubo {o.flaggedAttempts} evaluación(es) con alertas de integridad. El docente puede darte detalles.</p>
          )}
        </div>
        <div>
          <div className="card-title" style={{ fontSize: 16, marginBottom: 4 }}>Autorizaciones</div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>Política {policyVersion} · Ley 1581 de 2012. Cada decisión queda registrada con fecha.</p>
          <div className="stack" style={{ gap: 10 }}>
            {student.authorizations.map((a) => {
              const help = scopeHelp[a.scope]!;
              return (
                <div key={a.scope} className="auth-row">
                  <Tile icon={help.icon} tone={a.granted ? 'mint' : a.granted === false ? 'coral' : 'soft'} size={18} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 14 }}>{a.label}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{help.text}</div>
                    <div style={{ fontSize: 12, marginTop: 2, fontWeight: 700, color: a.granted ? '#0c8f71' : a.granted === false ? '#d6304a' : 'var(--muted)' }}>
                      {a.granted == null ? 'Sin decidir' : `${a.granted ? 'Autorizado' : 'No autorizado'} · ${when(a.decidedAt)}`}
                    </div>
                  </div>
                  <div className="row g-8">
                    <button className={`btn sm ${a.granted ? '' : 'ghost'}`} disabled={busy === a.scope || a.granted === true} onClick={() => decide(a.scope, true)}>Autorizar</button>
                    <button className={`btn sm ghost`} disabled={busy === a.scope || a.granted === false} onClick={() => decide(a.scope, false)}>Revocar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
