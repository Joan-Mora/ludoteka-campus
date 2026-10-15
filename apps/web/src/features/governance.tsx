import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Brain,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  FileSignature,
  FileText,
  GraduationCap,
  Mail,
  MailCheck,
  Megaphone,
  MessageCircle,
  NotebookPen,
  Percent,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_LABELS } from '@eduquest/contracts';
import { api, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Avatar, Bar, Empty, PageHeader, Reveal, Sheet, Stat, Tile, type Tone } from '@/ui';
import { DateTimeField } from '@/ui/date-time';
import { CourseLinks, InstitutionReports, ReportHistory } from './staff';

const when = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const day = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short' }) : '—';

function Panel({ icon, tone, title, subtitle, children, actions, className }: { icon: LucideIcon; tone: Tone; title: string; subtitle?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <Reveal className={`card ${className ?? ''}`}>
      <div className="row g-12" style={{ marginBottom: 16 }}>
        <Tile icon={icon} tone={tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 13 }}>{subtitle}</div>}
        </div>
        {actions}
      </div>
      {children}
    </Reveal>
  );
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string, LucideIcon, number?][] }) {
  return (
    <div className="seg-tabs" role="tablist">
      {items.map(([key, label, Icon, badge]) => (
        <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>
          <Icon size={15} /> {label}
          {badge ? <span className="seg-badge">{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

const LEVEL_TONE: Record<string, Tone> = { alta: 'coral', media: 'gold' };
const STATUS_LABEL: Record<string, string> = { open: 'Abierta', acknowledged: 'En seguimiento', resolved: 'Cerrada' };
const STATUS_TONE: Record<string, Tone> = { open: 'coral', acknowledged: 'sky', resolved: 'mint' };
const MEETING_LABEL: Record<string, string> = { scheduled: 'Por confirmar', confirmed: 'Confirmada', declined: 'No asistirá', held: 'Realizada', cancelled: 'Cancelada' };
const MEETING_TONE: Record<string, Tone> = { scheduled: 'gold', confirmed: 'mint', declined: 'coral', held: 'violet', cancelled: 'soft' };

/* ------------------------------------------------------------------ */
/* Coordinación                                                        */
/* ------------------------------------------------------------------ */

interface AlertRow {
  id: string;
  kind: string;
  kindLabel: string;
  level: string;
  detail: string;
  status: string;
  createdAt: string;
  student: { id: string; fullName: string };
  course: { id: string; title: string; group: string; teacher: string };
  notes: number;
  lastNote: string | null;
  lastNoteAt: string | null;
  upcomingMeetings: number;
  guardians: number;
}
interface Meeting {
  id: string;
  scheduledAt: string;
  mode: string;
  place: string;
  reason: string;
  status: string;
  responseNote: string | null;
  outcome: string | null;
  student: { id: string; fullName: string };
  guardian: { id: string; fullName: string };
  organizer: string;
}
interface AlertDetail {
  id: string;
  kindLabel: string;
  level: string;
  detail: string;
  status: string;
  createdAt: string;
  student: { id: string; fullName: string };
  course: { id: string; title: string };
  notes: { id: string; body: string; author: string; createdAt: string }[];
  guardians: { id: string; fullName: string; email: string; relationship: string }[];
  meetings: Meeting[];
}

const COORD_TABS = { alerts: '/app/coordinacion', attendance: '/app/coordinacion/asistencia', meetings: '/app/coordinacion/citaciones' } as const;
const COORD_HEAD = {
  alerts: ['Mesa de seguimiento', 'Alertas académicas y de convivencia de todos los grupos, con su bitácora.'],
  attendance: ['Asistencia consolidada', 'Faltas y llegadas tarde por grupo, y quiénes superan el umbral institucional.'],
  meetings: ['Citaciones con acudientes', 'Agenda, confirmaciones y actas de las reuniones con las familias.'],
} as const;

export function CoordinationPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = (Object.entries(COORD_TABS).find(([, to]) => to === pathname.replace(/\/$/, ''))?.[0] ?? 'alerts') as keyof typeof COORD_TABS;
  const setTab = (next: keyof typeof COORD_TABS) => navigate(COORD_TABS[next]);
  const [meetingFor, setMeetingFor] = useState<{ studentId: string; studentName: string; alertId?: string } | null>(null);
  const summary = useQuery({ queryKey: ['coord-alerts', 'active'], queryFn: () => api<{ summary: Record<string, number>; alerts: AlertRow[] }>('/api/coordination/alerts') });
  const s = summary.data?.summary;
  return (
    <div>
      <PageHeader
        eyebrow="Coordinación"
        title={COORD_HEAD[tab][0]}
        subtitle={COORD_HEAD[tab][1]}
        actions={<button className="btn" onClick={() => setMeetingFor({ studentId: '', studentName: '' })}><CalendarClock size={16} /> Nueva citación</button>}
      />
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Reveal delay={0}><Stat icon={AlertTriangle} tone="coral" value={s?.open ?? '—'} label="Alertas abiertas" /></Reveal>
        <Reveal delay={0.05}><Stat icon={NotebookPen} tone="sky" value={s?.acknowledged ?? '—'} label="En seguimiento" /></Reveal>
        <Reveal delay={0.1}><Stat icon={CheckCircle2} tone="mint" value={s?.resolved ?? '—'} label="Cerradas" /></Reveal>
        <Reveal delay={0.15}><Stat icon={CalendarCheck} tone="gold" value={summary.data ? summary.data.alerts.reduce((n, a) => n + a.upcomingMeetings, 0) : '—'} label="Citaciones próximas" /></Reveal>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['alerts', 'Seguimiento', ShieldCheck, s?.open],
          ['attendance', 'Asistencia', UserCheck],
          ['meetings', 'Citaciones', CalendarClock],
        ]}
      />
      {tab === 'alerts' && <AlertDesk onMeet={setMeetingFor} />}
      {tab === 'attendance' && <AttendanceBoard onMeet={setMeetingFor} />}
      {tab === 'meetings' && <MeetingsBoard />}
      <Sheet open={meetingFor != null} onClose={() => setMeetingFor(null)} title="Citar a los acudientes">
        {meetingFor && <MeetingForm preset={meetingFor} onDone={() => setMeetingFor(null)} />}
      </Sheet>
    </div>
  );
}

function AlertDesk({ onMeet }: { onMeet: (preset: { studentId: string; studentName: string; alertId?: string }) => void }) {
  const [status, setStatus] = useState<'active' | 'open' | 'acknowledged' | 'resolved'>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ['coord-alerts', status],
    queryFn: () => api<{ alerts: AlertRow[] }>(`/api/coordination/alerts${status === 'active' ? '' : `?status=${status}`}`),
  });
  const alerts = data.data?.alerts ?? [];
  return (
    <>
      <div className="row g-8 wrap" style={{ marginBottom: 14 }}>
        {([['active', 'Activas'], ['open', 'Abiertas'], ['acknowledged', 'En seguimiento'], ['resolved', 'Cerradas']] as const).map(([key, label]) => (
          <button key={key} className={`chip ${status === key ? 'violet' : ''}`} onClick={() => setStatus(key)}>{label}</button>
        ))}
      </div>
      <div className="alert-grid">
        {alerts.map((a, i) => (
          <Reveal key={a.id} delay={Math.min(i, 8) * 0.03} className={`card alert-card level-${a.level}`}>
            <div className="row g-8 wrap" style={{ marginBottom: 8 }}>
              <span className={`chip ${LEVEL_TONE[a.level] ?? 'gold'}`}>{a.kindLabel} · {a.level}</span>
              <span className={`chip ${STATUS_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              {a.upcomingMeetings > 0 && <span className="chip mint"><CalendarCheck size={12} /> Citación</span>}
            </div>
            <div className="row g-12">
              <Avatar name={a.student.fullName} />
              <div style={{ minWidth: 0 }}>
                <b>{a.student.fullName}</b>
                <div className="muted" style={{ fontSize: 13 }}>{a.course.group} · {a.course.title} · {a.course.teacher}</div>
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 14 }}>{a.detail}</p>
            {a.lastNote && <p className="alert-note"><NotebookPen size={13} /> {a.lastNote}</p>}
            <div className="row g-8 wrap" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => setOpenId(a.id)}><NotebookPen size={14} /> Bitácora ({a.notes})</button>
              {a.status !== 'resolved' && (
                <button className="btn sm ghost" disabled={!a.guardians} title={a.guardians ? undefined : 'Sin acudientes vinculados'} onClick={() => onMeet({ studentId: a.student.id, studentName: a.student.fullName, alertId: a.id })}>
                  <CalendarClock size={14} /> Citar
                </button>
              )}
              <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{day(a.createdAt)}</span>
            </div>
          </Reveal>
        ))}
      </div>
      {!data.isLoading && !alerts.length && <Empty icon={ShieldCheck} title="Nada pendiente aquí" body="Las alertas aparecen cuando un docente abre su cuaderno de calificaciones y el sistema detecta riesgo." />}
      <Sheet open={openId != null} onClose={() => setOpenId(null)} title="Bitácora de la alerta">
        {openId && <AlertLog id={openId} onMeet={onMeet} />}
      </Sheet>
    </>
  );
}

function AlertLog({ id, onMeet }: { id: string; onMeet: (preset: { studentId: string; studentName: string; alertId?: string }) => void }) {
  const client = useQueryClient();
  const data = useQuery({ queryKey: ['coord-alert', id], queryFn: () => api<AlertDetail>(`/api/coordination/alerts/${id}`) });
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const a = data.data;

  async function save(status?: 'acknowledged' | 'resolved') {
    setError('');
    setBusy(true);
    try {
      await api(`/api/coordination/alerts/${id}/notes`, { method: 'POST', body: JSON.stringify({ body, status }) });
      setBody('');
      void client.invalidateQueries({ queryKey: ['coord-alert', id] });
      void client.invalidateQueries({ queryKey: ['coord-alerts'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!a) return <p className="muted">Cargando…</p>;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <div className="row g-8 wrap">
          <span className={`chip ${LEVEL_TONE[a.level] ?? 'gold'}`}>{a.kindLabel} · {a.level}</span>
          <span className={`chip ${STATUS_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
        </div>
        <div className="card-title" style={{ marginTop: 8 }}>{a.student.fullName}</div>
        <div className="muted" style={{ fontSize: 13 }}>{a.course.title} · desde {day(a.createdAt)}</div>
        <p style={{ marginBottom: 0 }}>{a.detail}</p>
      </div>
      {a.status !== 'resolved' && (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save(); }}>
          <label className="field">Nueva anotación
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Qué se habló, con quién y qué se acordó." />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="row g-8 wrap">
            <button className="btn sm" type="submit" disabled={busy || body.trim().length < 2}><NotebookPen size={14} /> Anotar</button>
            <button className="btn sm mint" type="button" disabled={busy || body.trim().length < 2} onClick={() => save('resolved')}><CheckCircle2 size={14} /> Anotar y cerrar</button>
            <button className="btn sm ghost" type="button" disabled={!a.guardians.length} onClick={() => onMeet({ studentId: a.student.id, studentName: a.student.fullName, alertId: a.id })}><CalendarClock size={14} /> Citar acudientes</button>
          </div>
        </form>
      )}
      <div>
        <div className="block-label">Acudientes</div>
        {a.guardians.length ? a.guardians.map((g) => (
          <div key={g.id} className="row g-8" style={{ padding: '6px 0' }}><Avatar name={g.fullName} /><div><b>{g.fullName}</b><div className="muted" style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{g.relationship}</div></div></div>
        )) : <p className="muted">Sin acudientes vinculados. Administración puede vincularlos.</p>}
      </div>
      <div>
        <div className="block-label">Bitácora</div>
        <ol className="timeline">
          {a.notes.map((n) => (
            <li key={n.id}><b>{n.author}</b> <span className="muted">· {when(n.createdAt)}</span><p>{n.body}</p></li>
          ))}
          {!a.notes.length && <li className="muted">Sin anotaciones todavía.</li>}
        </ol>
      </div>
      {a.meetings.length > 0 && (
        <div>
          <div className="block-label">Citaciones del estudiante</div>
          {a.meetings.map((m) => <MeetingLine key={m.id} meeting={m} />)}
        </div>
      )}
    </div>
  );
}

function MeetingLine({ meeting, actions }: { meeting: Meeting; actions?: ReactNode }) {
  return (
    <div className="meeting-line">
      <Tile icon={meeting.status === 'declined' || meeting.status === 'cancelled' ? CalendarX : CalendarCheck} tone={MEETING_TONE[meeting.status] ?? 'soft'} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row g-8 wrap"><b>{when(meeting.scheduledAt)}</b><span className={`chip ${MEETING_TONE[meeting.status]}`}>{MEETING_LABEL[meeting.status]}</span></div>
        <div className="muted" style={{ fontSize: 13 }}>{meeting.student.fullName} · acudiente {meeting.guardian.fullName} · {meeting.mode === 'virtual' ? 'Virtual' : 'Presencial'}{meeting.place ? ` · ${meeting.place}` : ''}</div>
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{meeting.reason}</div>
        {meeting.responseNote && <div className="muted" style={{ fontSize: 12.5 }}>Respuesta: {meeting.responseNote}</div>}
        {meeting.outcome && <div className="muted" style={{ fontSize: 12.5 }}>Resultado: {meeting.outcome}</div>}
      </div>
      {actions}
    </div>
  );
}

function StudentPicker({ onPick }: { onPick: (s: { id: string; fullName: string }) => void }) {
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['coord-students', q],
    queryFn: () => api<{ id: string; fullName: string; group: string | null; guardians: number }[]>(`/api/coordination/students?q=${encodeURIComponent(q)}`),
  });
  return (
    <div className="field">
      Estudiante
      <div className="lib-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" /></div>
      <div className="stack" style={{ gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {(results.data ?? []).map((s) => (
          <button key={s.id} type="button" className="thread-row" disabled={!s.guardians} onClick={() => onPick(s)} style={{ padding: 10 }}>
            <Avatar name={s.fullName} />
            <div style={{ flex: 1, textAlign: 'left' }}><b>{s.fullName}</b><div className="muted" style={{ fontSize: 12.5 }}>{s.group ?? 'Sin grupo'} · {s.guardians ? `${s.guardians} acudiente(s)` : 'sin acudientes'}</div></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MeetingForm({ preset, onDone }: { preset: { studentId: string; studentName: string; alertId?: string }; onDone: () => void }) {
  const client = useQueryClient();
  const [student, setStudent] = useState(preset.studentId ? { id: preset.studentId, fullName: preset.studentName } : null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [when, setWhen] = useState<Date | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!student) return setError('Elige el estudiante.');
    const d = new FormData(e.currentTarget);
    if (!when) return setError('Elige la fecha y la hora.');
    setBusy(true);
    setError('');
    try {
      const res = await api<{ created: number }>('/api/coordination/meetings', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          scheduledAt: when.toISOString(),
          mode: d.get('mode'),
          place: d.get('place'),
          reason: d.get('reason'),
          alertId: preset.alertId,
        }),
      });
      setSent(res.created);
      void client.invalidateQueries({ queryKey: ['coord-meetings'] });
      void client.invalidateQueries({ queryKey: ['coord-alerts'] });
      void client.invalidateQueries({ queryKey: ['coord-alert'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="empty">
        <Tile icon={MailCheck} tone="mint" large />
        <div style={{ fontWeight: 800, color: 'var(--ink)' }}>Citación enviada</div>
        <p>{sent === 1 ? 'El acudiente recibió' : `Los ${sent} acudientes recibieron`} un aviso en el campus y un correo para confirmar su asistencia.</p>
        <button className="btn" onClick={onDone}>Listo</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit}>
      {student ? (
        <div className="row g-12" style={{ marginBottom: 14 }}>
          <Avatar name={student.fullName} />
          <b style={{ flex: 1 }}>{student.fullName}</b>
          {!preset.studentId && <button type="button" className="btn sm ghost" onClick={() => setStudent(null)}>Cambiar</button>}
        </div>
      ) : (
        <StudentPicker onPick={setStudent} />
      )}
      <DateTimeField label="Fecha y hora" placeholder="Elige el día" value={when} onChange={setWhen} min={new Date()} />

      <div className="grid cols-2" style={{ gap: 10 }}>
        <label className="field">Modalidad<select name="mode" defaultValue="presencial"><option value="presencial">Presencial</option><option value="virtual">Virtual</option></select></label>
        <label className="field">Lugar o enlace<input name="place" maxLength={200} placeholder="Sala de coordinación" /></label>
      </div>
      <label className="field">Motivo<textarea name="reason" rows={3} required minLength={3} maxLength={600} placeholder="Seguimiento del rendimiento en matemáticas y de las inasistencias." /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}><Send size={15} /> {busy ? 'Enviando…' : 'Enviar citación'}</button>
    </form>
  );
}

interface AttendanceData {
  days: number;
  threshold: { count: number; rate: number };
  groups: { id: string; name: string; students: number; sessions: number; absent: number; late: number; excused: number; rate: number | null }[];
  students: { id: string; fullName: string; group: string; total: number; absent: number; late: number; absentRate: number; lastAbsent: string | null }[];
  trend: { day: string; total: number; absent: number }[];
}

function AttendanceBoard({ onMeet }: { onMeet: (preset: { studentId: string; studentName: string }) => void }) {
  const [days, setDays] = useState(30);
  const data = useQuery({ queryKey: ['coord-attendance', days], queryFn: () => api<AttendanceData>(`/api/coordination/attendance?days=${days}`) });
  const a = data.data;
  const maxAbsent = Math.max(1, ...(a?.trend ?? []).map((t) => t.absent));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row g-8 wrap">
        {[30, 60, 90].map((d) => <button key={d} className={`chip ${days === d ? 'violet' : ''}`} onClick={() => setDays(d)}>Últimos {d} días</button>)}
        {a && <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>Umbral: {a.threshold.count} faltas o {Math.round(a.threshold.rate * 100)} % de las clases</span>}
      </div>
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <Panel icon={Users} tone="sky" title="Asistencia por grupo" subtitle="Presentes más medio punto por llegada tarde; las excusas no cuentan." className="span-2">
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Grupo</th><th className="num">Clases</th><th className="num">Faltas</th><th className="num">Tardes</th><th style={{ width: '34%' }}>Asistencia</th></tr></thead>
            <tbody>
              {(a?.groups ?? []).map((g) => (
                <tr key={g.id}>
                  <td><b>{g.name}</b><div className="muted" style={{ fontSize: 12 }}>{g.students} estudiantes</div></td>
                  <td className="num">{g.sessions}</td>
                  <td className="num">{g.absent}</td>
                  <td className="num">{g.late}</td>
                  <td><div className="row g-8"><div style={{ flex: 1 }}><Bar value={g.rate ?? 0} tone={(g.rate ?? 0) >= 90 ? 'mint' : 'gold'} thin /></div><b>{g.rate != null ? `${g.rate}%` : '—'}</b></div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {!data.isLoading && !a?.groups.length && <Empty icon={UserCheck} title="Sin asistencia registrada en este periodo" />}
        </Panel>
        <Panel icon={BarChart3} tone="violet" title="Faltas por día">
          <div className="mini-bars" aria-label="Faltas por día">
            {(a?.trend ?? []).map((t) => (
              <div key={t.day} title={`${t.day}: ${t.absent} faltas de ${t.total}`}>
                <motion.span initial={{ height: 0 }} animate={{ height: `${Math.max(6, (t.absent / maxAbsent) * 100)}%` }} />
              </div>
            ))}
          </div>
          {!a?.trend.length && <p className="muted">Sin registros.</p>}
        </Panel>
      </div>
      <Panel icon={AlertTriangle} tone="coral" title="Estudiantes sobre el umbral" subtitle="Candidatos a citación con el acudiente.">
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Estudiante</th><th>Grupo</th><th className="num">Faltas</th><th className="num">% de faltas</th><th className="num">Última falta</th><th className="act" /></tr></thead>
          <tbody>
            {(a?.students ?? []).map((s) => (
              <tr key={s.id}>
                <td><div className="row g-8"><Avatar name={s.fullName} /><b>{s.fullName}</b></div></td>
                <td className="muted">{s.group}</td>
                <td className="num"><span className="chip coral">{s.absent} de {s.total}</span></td>
                <td className="num">{s.absentRate}%</td>
                <td className="num muted">{s.lastAbsent ?? '—'}</td>
                <td className="act"><button className="btn sm ghost" onClick={() => onMeet({ studentId: s.id, studentName: s.fullName })}><CalendarClock size={14} /> Citar</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!data.isLoading && !a?.students.length && <Empty icon={CheckCircle2} title="Nadie supera el umbral" body="Buen indicador: ningún estudiante acumula faltas por encima del límite institucional." />}
      </Panel>
    </div>
  );
}

function MeetingsBoard() {
  const client = useQueryClient();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const data = useQuery({ queryKey: ['coord-meetings', scope], queryFn: () => api<Meeting[]>(`/api/coordination/meetings?scope=${scope}`) });
  async function close(id: string, status: 'held' | 'cancelled') {
    const outcome = prompt(status === 'held' ? '¿Qué se acordó en la reunión?' : '¿Por qué se cancela?') ?? undefined;
    if (outcome === undefined) return;
    await api(`/api/coordination/meetings/${id}`, { method: 'PATCH', body: JSON.stringify({ status, outcome: outcome || undefined }) });
    void client.invalidateQueries({ queryKey: ['coord-meetings'] });
  }
  return (
    <Panel icon={CalendarClock} tone="gold" title="Citaciones" actions={
      <div className="row g-8">
        <button className={`chip ${scope === 'upcoming' ? 'violet' : ''}`} onClick={() => setScope('upcoming')}>Próximas</button>
        <button className={`chip ${scope === 'past' ? 'violet' : ''}`} onClick={() => setScope('past')}>Historial</button>
      </div>
    }>
      <div className="stack" style={{ gap: 10 }}>
        {(data.data ?? []).map((m) => (
          <MeetingLine
            key={m.id}
            meeting={m}
            actions={['scheduled', 'confirmed', 'declined'].includes(m.status) ? (
              <div className="row g-8 wrap">
                <button className="btn sm" onClick={() => close(m.id, 'held')}><CheckCircle2 size={14} /> Realizada</button>
                <button className="btn sm ghost" onClick={() => close(m.id, 'cancelled')}><XCircle size={14} /> Cancelar</button>
              </div>
            ) : undefined}
          />
        ))}
      </div>
      {!data.isLoading && !data.data?.length && <Empty icon={CalendarClock} title={scope === 'upcoming' ? 'No hay citaciones próximas' : 'Sin historial'} />}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Rectoría                                                            */
/* ------------------------------------------------------------------ */

interface Metrics {
  average: number | null;
  passRate: number | null;
  attendance: number | null;
  absences: number;
  alerts: number;
  highAlerts: number;
  aiUses: number;
  aiUsers: number;
  graded: number;
}
interface Dashboard {
  periods: { id: string; name: string; from: string; to: string }[];
  selected: { id: string; name: string; from: string; to: string; current: boolean };
  previous: { id: string; name: string } | null;
  overall: Metrics & { students: number; deltaAverage: number | null; deltaPassRate: number | null; deltaAttendance: number | null; deltaAlerts: number | null; deltaAiUses: number | null };
  byGrade: (Metrics & { level: number; name: string; students: number })[];
  groups: (Metrics & { id: string; name: string; grade: string; students: number; deltaAverage: number | null; deltaPassRate: number | null; deltaAttendance: number | null })[];
  aiByFeature: { feature: string; uses: number }[];
  riskByKind: { kind: string; count: number }[];
}
interface Signatures {
  certificates: { id: string; code: string; title: string; requestedAt: string; student: { id: string; fullName: string }; course: string | null; requestedBy: string | null }[];
  bulletins: { id: string; requestedAt: string; student: { id: string; fullName: string }; group: string | null; period: string | null; requestedBy: string }[];
  recent: { kind: string; id: string; title: string; student: string; status: string; at: string; note: string | null }[];
}

const FEATURE_LABEL: Record<string, string> = { tutor: 'Tutor', ruta: 'Mi ruta', observatorio: 'Observatorio', cuaderno: 'Cuaderno', biblioteca: 'Biblioteca', banco: 'Banco de preguntas', preguntas: 'Banco de preguntas', foros: 'Foros' };

function aiByModule(rows: Dashboard['aiByFeature']) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = r.feature.split('.')[0]!;
    const label = FEATURE_LABEL[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
    totals.set(label, (totals.get(label) ?? 0) + r.uses);
  }
  return [...totals].map(([label, uses]) => ({ label, uses })).sort((a, b) => b.uses - a.uses);
}
const KIND_LABEL: Record<string, string> = { low_grade: 'Nota baja', absences: 'Inasistencias', integrity: 'Integridad', inactivity: 'Inactividad' };

function Delta({ value, unit = '', invert }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value == null) return null;
  if (value === 0) return <span className="delta">= sin cambio</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`delta ${good ? 'up' : 'down'}`}><Icon size={13} /> {value > 0 ? '+' : ''}{value}{unit}</span>;
}

const RECTOR_TABS = { board: '/app/rectoria', sign: '/app/rectoria/firmas', news: '/app/rectoria/comunicados', reports: '/app/rectoria/reportes' } as const;
const RECTOR_TITLE = { board: 'Tablero estratégico', sign: 'Sala de firmas', news: 'Comunicados oficiales', reports: 'Archivo de reportes' } as const;

export function RectoriaPage() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = (Object.entries(RECTOR_TABS).find(([, to]) => to === pathname.replace(/\/$/, ''))?.[0] ?? 'board') as keyof typeof RECTOR_TABS;
  const setTab = (next: keyof typeof RECTOR_TABS) => navigate(RECTOR_TABS[next]);
  const [period, setPeriod] = useState<string>('');
  const dash = useQuery({ queryKey: ['rectoria', period], queryFn: () => api<Dashboard>(`/api/rectoria/dashboard${period ? `?period=${period}` : ''}`) });
  const sigs = useQuery({ queryKey: ['rectoria-signatures'], queryFn: () => api<Signatures>('/api/rectoria/signatures'), enabled: user?.role === 'rector' });
  const pending = (sigs.data?.certificates.length ?? 0) + (sigs.data?.bulletins.length ?? 0);
  const d = dash.data;
  return (
    <div className="stack" style={{ gap: 22 }}>
      <Reveal>
        <section className="hero rector-hero" data-at={RECTOR_TABS[tab]}>
          <div className="orb" style={{ width: 380, height: 380, right: -120, top: -160, background: 'radial-gradient(circle, rgba(255,214,107,.4), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div className="eyebrow" style={{ color: '#ffd66b' }}><Crown size={14} /> Rectoría</div>
            <h1 style={{ marginTop: 8 }}>{RECTOR_TITLE[tab]}</h1>
            <p style={{ marginTop: 8, fontSize: 16, maxWidth: 620 }}>
              {d ? `${d.selected.name} · ${d.selected.from} a ${d.selected.to}${d.previous ? ` · comparado con ${d.previous.name}` : ''}` : 'Indicadores por periodo para decidir con datos.'}
            </p>
            <div className="row g-8 wrap" style={{ marginTop: 14 }}>
              {(d?.periods ?? []).map((p) => (
                <button key={p.id} className={`btn sm ${d?.selected.id === p.id ? 'white' : 'glass'}`} onClick={() => setPeriod(p.id)}>{p.name}</button>
              ))}
            </div>
          </div>
        </section>
      </Reveal>
      <Tabs
        value={tab}
        onChange={setTab}
        items={user?.role === 'rector'
          ? [
              ['board', 'Indicadores', BarChart3],
              ['sign', 'Por firmar', FileSignature, pending],
              ['news', 'Comunicados', Megaphone],
              ['reports', 'Reportes', FileText],
            ]
          : [
              ['board', 'Indicadores', BarChart3],
              ['reports', 'Reportes', FileText],
            ]}
      />
      {tab === 'board' && d && <RectorBoard d={d} />}
      {tab === 'board' && dash.isLoading && <p className="muted">Calculando indicadores…</p>}
      {tab === 'sign' && <SignatureQueue data={sigs.data} canSign={user?.role === 'rector'} onChange={() => void sigs.refetch()} />}
      {tab === 'news' && <OfficialNews />}
      {tab === 'reports' && (
        <div className="grid cols-3" style={{ alignItems: 'start' }}>
          <div className="span-2"><ReportHistory /></div>
          <div className="stack" style={{ gap: 18 }}><InstitutionReports /><CourseLinks /></div>
        </div>
      )}
    </div>
  );
}

function RectorBoard({ d }: { d: Dashboard }) {
  const o = d.overall;
  const maxAvg = 5;
  const ai = aiByModule(d.aiByFeature);
  const totalAi = Math.max(1, ...ai.map((f) => f.uses));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid cols-5-auto">
        <Reveal><Stat icon={GraduationCap} tone="violet" value={o.average != null ? o.average.toFixed(1) : '—'} label="Promedio (1 a 5)" extra={<Delta value={o.deltaAverage} />} /></Reveal>
        <Reveal delay={0.04}><Stat icon={Percent} tone="mint" value={o.passRate != null ? `${o.passRate}%` : '—'} label="Aprobación" extra={<Delta value={o.deltaPassRate} unit=" pts" />} /></Reveal>
        <Reveal delay={0.08}><Stat icon={UserCheck} tone="sky" value={o.attendance != null ? `${o.attendance}%` : '—'} label="Asistencia" extra={<Delta value={o.deltaAttendance} unit=" pts" />} /></Reveal>
        <Reveal delay={0.12}><Stat icon={AlertTriangle} tone="coral" value={o.alerts} label={`Alertas · ${o.highAlerts} altas`} extra={<Delta value={o.deltaAlerts} invert />} /></Reveal>
        <Reveal delay={0.16}><Stat icon={Sparkles} tone="gold" value={o.aiUses} label={`Usos de IA · ${o.aiUsers} estudiantes`} extra={<Delta value={o.deltaAiUses} />} /></Reveal>
      </div>
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <Panel icon={BarChart3} tone="violet" title="Promedio por grado" subtitle="Escala institucional 1,0 a 5,0; aprueba desde 3,0." className="span-2">
          <div className="row bar-chart" style={{ alignItems: 'flex-end', height: 220, padding: '10px 4px 0' }}>
            {d.byGrade.map((g, i) => (
              <div key={g.level} className="stack" style={{ gap: 8, flex: 1, minWidth: 0, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <b style={{ fontSize: 14 }}>{g.average != null ? g.average.toFixed(1) : '—'}</b>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, ((g.average ?? 0) / maxAvg) * 100)}%` }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                  style={{ width: '100%', maxWidth: 64, borderRadius: '12px 12px 6px 6px', background: (g.average ?? 0) >= 3 ? 'var(--grad-brand)' : 'linear-gradient(180deg,#ff8a9a,#ff4d6a)' }}
                />
                <span className="muted ellipsis" style={{ fontSize: 12.5, fontWeight: 700, maxWidth: '100%' }}>{g.name}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{g.passRate != null ? `${g.passRate}% aprueba` : 'sin notas'}</span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="stack" style={{ gap: 18 }}>
          <Panel icon={Sparkles} tone="gold" title="Uso de IA por función">
            <div className="stack" style={{ gap: 10 }}>
              {ai.map((f) => (
                <div key={f.label}>
                  <div className="row between" style={{ fontSize: 13, fontWeight: 700 }}><span>{f.label}</span><span>{f.uses}</span></div>
                  <Bar value={(f.uses * 100) / totalAi} tone="gold" thin />
                </div>
              ))}
              {!ai.length && <p className="muted">Sin uso registrado en el periodo.</p>}
            </div>
          </Panel>
          <Panel icon={AlertTriangle} tone="coral" title="Riesgo por tipo">
            <div className="row g-8 wrap">
              {d.riskByKind.map((r) => <span key={r.kind} className="chip coral">{KIND_LABEL[r.kind] ?? r.kind}: {r.count}</span>)}
              {!d.riskByKind.length && <p className="muted">Sin alertas en el periodo.</p>}
            </div>
          </Panel>
        </div>
      </div>
      <Panel icon={Users} tone="sky" title="Comparación entre grupos" subtitle={d.previous ? `Las flechas comparan con ${d.previous.name}.` : 'Elige un periodo para comparar con el anterior.'}>
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Grupo</th><th className="num">Estudiantes</th><th className="num">Promedio</th><th className="num">Aprobación</th><th className="num">Asistencia</th><th className="num">Alertas</th><th className="num">Usos de IA</th></tr></thead>
          <tbody>
            {d.groups.map((g) => (
              <tr key={g.id}>
                <td><b>{g.name}</b></td>
                <td className="num">{g.students}</td>
                <td className="num">{g.average != null ? g.average.toFixed(1) : '—'}<Delta value={g.deltaAverage} /></td>
                <td className="num">{g.passRate != null ? `${g.passRate}%` : '—'}<Delta value={g.deltaPassRate} unit=" pts" /></td>
                <td className="num">{g.attendance != null ? `${g.attendance}%` : '—'}<Delta value={g.deltaAttendance} unit=" pts" /></td>
                <td className="num">{g.alerts ? <span className={`chip ${g.highAlerts ? 'coral' : 'gold'}`}>{g.alerts}</span> : '0'}</td>
                <td className="num">{g.aiUses}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}

function SignatureQueue({ data, canSign, onChange }: { data: Signatures | undefined; canSign: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function decide(kind: 'certificates' | 'bulletins', id: string, approve: boolean) {
    const note = approve ? undefined : prompt('¿Por qué lo devuelves? El solicitante verá esta nota.') ?? '';
    if (!approve && !note) return;
    setBusy(id);
    setError('');
    try {
      await api(`/api/rectoria/signatures/${kind}/${id}`, { method: 'POST', body: JSON.stringify({ approve, note }) });
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const actions = (kind: 'certificates' | 'bulletins', id: string) =>
    canSign ? (
      <div className="row g-8">
        <button className="btn sm mint" disabled={busy === id} onClick={() => decide(kind, id, true)}><FileSignature size={14} /> Firmar</button>
        <button className="btn sm ghost" disabled={busy === id} onClick={() => decide(kind, id, false)}>Devolver</button>
      </div>
    ) : <span className="chip">Solo rectoría firma</span>;
  return (
    <div className="stack" style={{ gap: 18 }}>
      {error && <p className="form-error">{error}</p>}
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <Panel icon={BadgeCheck} tone="violet" title="Certificados" subtitle="Los pide el docente cuando el estudiante aprueba el examen del curso.">
          <div className="stack" style={{ gap: 10 }}>
            {(data?.certificates ?? []).map((c) => (
              <div key={c.id} className="sign-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{c.student.fullName}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{c.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Pedido por {c.requestedBy ?? '—'} · {day(c.requestedAt)}</div>
                </div>
                {actions('certificates', c.id)}
              </div>
            ))}
            {data && !data.certificates.length && <Empty icon={BadgeCheck} title="Sin certificados pendientes" />}
          </div>
        </Panel>
        <Panel icon={FileText} tone="sky" title="Boletines" subtitle="Revisa el PDF antes de firmar.">
          <div className="stack" style={{ gap: 10 }}>
            {(data?.bulletins ?? []).map((b) => (
              <div key={b.id} className="sign-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{b.student.fullName}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{b.group ?? 'Sin grupo'} · {b.period ?? 'Periodo actual'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Pedido por {b.requestedBy} · {day(b.requestedAt)}</div>
                </div>
                <button className="btn sm ghost" onClick={() => download(`/api/reports/bulletin/${b.student.id}/pdf`, 'boletin.pdf')}><FileText size={14} /> Ver</button>
                {actions('bulletins', b.id)}
              </div>
            ))}
            {data && !data.bulletins.length && <Empty icon={FileText} title="Sin boletines pendientes" />}
          </div>
        </Panel>
      </div>
      <Panel icon={ClipboardCheck} tone="gold" title="Decisiones recientes">
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Documento</th><th>Estudiante</th><th>Decisión</th><th>Fecha</th></tr></thead>
          <tbody>
            {(data?.recent ?? []).map((r) => (
              <tr key={`${r.kind}-${r.id}`}>
                <td>{r.title}</td>
                <td>{r.student}</td>
                <td>{r.status === 'signed' ? <span className="chip mint">Firmado</span> : <span className="chip coral" title={r.note ?? ''}>Devuelto</span>}</td>
                <td className="muted">{when(r.at)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {data && !data.recent.length && <p className="muted">Aún no hay decisiones.</p>}
      </Panel>
    </div>
  );
}

function OfficialNews() {
  const news = useQuery({ queryKey: ['news'], queryFn: () => api<{ id: string; title: string; official?: boolean; publishAt: string; stats?: { reads: number; acks: number }; requiresAck: boolean }[]>('/api/news') });
  const official = (news.data ?? []).filter((n) => n.official);
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <Panel icon={Megaphone} tone="gold" title="Comunicados oficiales" subtitle="Llevan el sello de Rectoría en la cartelera y llegan como notificación." className="span-2">
        <div className="stack" style={{ gap: 10 }}>
          {official.map((n) => (
            <div key={n.id} className="sign-row">
              <Tile icon={Crown} tone="gold" size={18} />
              <div style={{ flex: 1 }}><b>{n.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{when(n.publishAt)}</div></div>
              {n.stats && <span className="chip violet">{n.stats.reads} leídas{n.requiresAck ? ` · ${n.stats.acks} confirmadas` : ''}</span>}
            </div>
          ))}
          {!news.isLoading && !official.length && <Empty icon={Megaphone} title="Aún no hay comunicados oficiales" />}
        </div>
      </Panel>
      <Panel icon={Send} tone="violet" title="Publicar">
        <p className="muted" style={{ marginTop: 0 }}>Redacta en la cartelera y marca «Comunicado oficial de Rectoría». Puedes pedir confirmación de lectura a familias y docentes.</p>
        <Link className="btn" to="/app/novedades?oficial=1" style={{ width: '100%' }}><Megaphone size={16} /> Ir a la cartelera</Link>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mensajes acudiente ↔ docente                                        */
/* ------------------------------------------------------------------ */

interface ThreadRow { student: { id: string; fullName: string }; counterpart: { id: string; fullName: string }; lastAt: string; lastBody: string; unread: number; total: number }
interface Contact { student: { id: string; fullName: string; group: string | null }; people: { id: string; fullName: string; detail: string }[] }
interface Message { id: string; body: string; author: string; mine: boolean; readAt: string | null; createdAt: string }
interface Colleague { id: string; fullName: string; role: string; roleLabel: string; detail: string | null }
interface StaffThread { counterpart: { id: string; fullName: string; role: string; roleLabel: string }; lastAt: string; lastBody: string; unread: number }

/** One conversation: polls for new messages, marks them read on open and posts with the given payload. */
function ChatThread({ queryKey, url, postUrl, payload, title, threadsKey }: {
  queryKey: unknown[];
  url: string;
  postUrl: string;
  payload: Record<string, string>;
  title?: ReactNode;
  threadsKey: string;
}) {
  const client = useQueryClient();
  const data = useQuery({
    queryKey,
    queryFn: async () => {
      const rows = await api<Message[]>(url);
      void client.invalidateQueries({ queryKey: [threadsKey] });
      void client.invalidateQueries({ queryKey: ['messages-unread'] });
      void client.invalidateQueries({ queryKey: ['campus'] });
      return rows;
    },
    refetchInterval: 20_000,
  });
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [data.data?.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const rows = await api<Message[]>(postUrl, { method: 'POST', body: JSON.stringify({ ...payload, body }) });
      client.setQueryData(queryKey, rows);
      void client.invalidateQueries({ queryKey: [threadsKey] });
      setBody('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="msg-thread">
      {title && <div className="card-title" style={{ marginBottom: 10 }}>{title}</div>}
      <div className="msg-log" aria-live="polite">
        {(data.data ?? []).map((m) => (
          <div key={m.id} className={`msg-bubble ${m.mine ? 'mine' : ''}`}>
            {!m.mine && <b>{m.author}</b>}
            <p>{m.body}</p>
            <small>{when(m.createdAt)}{m.mine && m.readAt ? ' · leído' : ''}</small>
          </div>
        ))}
        {!data.isLoading && !data.data?.length && <p className="muted" style={{ textAlign: 'center' }}>Escribe el primer mensaje. Queda registrado para ambos.</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="msg-form">
        <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Escribe tu mensaje…" aria-label="Mensaje" />
        <button className="btn" type="submit" disabled={!body.trim()}><Send size={15} /> Enviar</button>
      </form>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}

export function MessageThread({ studentId, counterpartId, title }: { studentId: string; counterpartId: string; title?: string }) {
  return (
    <ChatThread
      queryKey={['messages', studentId, counterpartId]}
      url={`/api/messages/${studentId}/${counterpartId}`}
      postUrl="/api/messages"
      payload={{ studentId, counterpartId }}
      title={title}
      threadsKey="message-threads"
    />
  );
}

const ROLE_TONE: Record<string, Tone> = { teacher: 'violet', coordinator: 'mint', rector: 'gold', admin: 'sky' };

function RoleChip({ role, label }: { role: string; label: string }) {
  return <span className={`chip ${ROLE_TONE[role] ?? 'soft'}`} style={{ fontSize: 11.5 }}>{label}</span>;
}

/** Conversations with families: guardians talk to their children's teachers and vice versa. */
function FamilyInbox({ composing, setComposing }: { composing: boolean; setComposing: (v: boolean) => void }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const threads = useQuery({ queryKey: ['message-threads'], queryFn: () => api<ThreadRow[]>('/api/messages/threads') });
  const contacts = useQuery({ queryKey: ['message-contacts'], queryFn: () => api<Contact[]>('/api/messages/contacts') });
  const studentId = params.get('estudiante') ?? '';
  const counterpartId = params.get('con') ?? '';
  const guardian = user?.role === 'guardian';

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts.data ?? []) for (const p of c.people) map.set(`${c.student.id}:${p.id}`, `${p.fullName} · ${c.student.fullName}`);
    for (const t of threads.data ?? []) map.set(`${t.student.id}:${t.counterpart.id}`, `${t.counterpart.fullName} · ${t.student.fullName}`);
    return map;
  }, [contacts.data, threads.data]);

  useEffect(() => {
    if (studentId && !counterpartId && contacts.data) {
      const first = contacts.data.find((c) => c.student.id === studentId)?.people[0];
      if (first) setParams({ estudiante: studentId, con: first.id }, { replace: true });
    }
  }, [studentId, counterpartId, contacts.data, setParams]);

  const open = (s: string, c: string) => {
    setComposing(false);
    setParams({ estudiante: s, con: c });
  };

  return (
    <>
      <div className="inbox">
        <div className="card inbox-list">
          {(threads.data ?? []).map((t) => {
            const active = t.student.id === studentId && t.counterpart.id === counterpartId;
            return (
              <button key={`${t.student.id}:${t.counterpart.id}`} className={`inbox-row ${active ? 'on' : ''}`} onClick={() => open(t.student.id, t.counterpart.id)}>
                <Avatar name={t.counterpart.fullName} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div className="row between"><b className="ellipsis">{t.counterpart.fullName}</b>{t.unread > 0 && <span className="seg-badge">{t.unread}</span>}</div>
                  <div className="muted ellipsis" style={{ fontSize: 12.5 }}>{guardian ? 'Docente' : 'Acudiente'} · sobre {t.student.fullName}</div>
                  <div className="muted ellipsis" style={{ fontSize: 12.5 }}>{t.lastBody}</div>
                </div>
              </button>
            );
          })}
          {!threads.isLoading && !threads.data?.length && <Empty icon={Mail} title="Sin conversaciones" body="Empieza una con «Nuevo mensaje»." />}
        </div>
        <div className="card">
          {studentId && counterpartId ? (
            <MessageThread key={`${studentId}:${counterpartId}`} studentId={studentId} counterpartId={counterpartId} title={people.get(`${studentId}:${counterpartId}`)} />
          ) : (
            <Empty icon={MessageCircle} title="Elige una conversación" body={guardian ? 'O escribe a un docente con «Nuevo mensaje».' : 'O escribe a un acudiente con «Nuevo mensaje».'} />
          )}
        </div>
      </div>
      <Sheet open={composing} onClose={() => setComposing(false)} title={guardian ? 'Escribir a un docente' : 'Escribir a un acudiente'}>
        <div className="stack" style={{ gap: 14 }}>
          {(contacts.data ?? []).map((c) => (
            <div key={c.student.id}>
              <div className="block-label">{c.student.fullName}{c.student.group ? ` · ${c.student.group}` : ''}</div>
              <div className="stack" style={{ gap: 6 }}>
                {c.people.map((p) => (
                  <button key={p.id} className="thread-row" style={{ padding: 10 }} onClick={() => open(c.student.id, p.id)}>
                    <Avatar name={p.fullName} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div className="row g-8 wrap"><b>{p.fullName}</b><RoleChip role={guardian ? 'teacher' : 'guardian'} label={guardian ? 'Docente' : 'Acudiente'} /></div>
                      <div className="muted" style={{ fontSize: 12.5, textTransform: guardian ? undefined : 'capitalize' }}>{p.detail}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!contacts.isLoading && !contacts.data?.length && <Empty icon={Users} title="Sin contactos" body={guardian ? 'Tus hijos aún no tienen cursos con docente asignado.' : 'Tus estudiantes aún no tienen acudientes vinculados.'} />}
        </div>
      </Sheet>
    </>
  );
}

/** Conversations between staff: teachers, coordination, rector and admin. */
function StaffInbox({ composing, setComposing }: { composing: boolean; setComposing: (v: boolean) => void }) {
  const [params, setParams] = useSearchParams();
  const threads = useQuery({ queryKey: ['staff-threads'], queryFn: () => api<StaffThread[]>('/api/staff-messages/threads') });
  const contacts = useQuery({ queryKey: ['staff-contacts'], queryFn: () => api<Colleague[]>('/api/staff-messages/contacts'), staleTime: 5 * 60_000 });
  const otherId = params.get('colega') ?? '';
  const [query, setQuery] = useState('');
  const other = contacts.data?.find((c) => c.id === otherId) ?? threads.data?.find((t) => t.counterpart.id === otherId)?.counterpart;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (contacts.data ?? []).filter((c) => !q || `${c.fullName} ${c.roleLabel} ${c.detail ?? ''}`.toLowerCase().includes(q));
    const map = new Map<string, Colleague[]>();
    for (const c of list) map.set(c.roleLabel, [...(map.get(c.roleLabel) ?? []), c]);
    return [...map.entries()];
  }, [contacts.data, query]);

  const open = (id: string) => {
    setComposing(false);
    setQuery('');
    setParams({ vista: 'colegas', colega: id });
  };

  return (
    <>
      <div className="inbox">
        <div className="card inbox-list">
          {(threads.data ?? []).map((t) => (
            <button key={t.counterpart.id} className={`inbox-row ${t.counterpart.id === otherId ? 'on' : ''}`} onClick={() => open(t.counterpart.id)}>
              <Avatar name={t.counterpart.fullName} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="row between"><b className="ellipsis">{t.counterpart.fullName}</b>{t.unread > 0 && <span className="seg-badge">{t.unread}</span>}</div>
                <div style={{ margin: '2px 0' }}><RoleChip role={t.counterpart.role} label={t.counterpart.roleLabel} /></div>
                <div className="muted ellipsis" style={{ fontSize: 12.5 }}>{t.lastBody}</div>
              </div>
            </button>
          ))}
          {!threads.isLoading && !threads.data?.length && <Empty icon={Mail} title="Sin conversaciones" body="Escribe a un colega con «Nuevo mensaje»." />}
        </div>
        <div className="card">
          {otherId ? (
            <ChatThread
              key={otherId}
              queryKey={['staff-messages', otherId]}
              url={`/api/staff-messages/${otherId}`}
              postUrl="/api/staff-messages"
              payload={{ recipientId: otherId }}
              threadsKey="staff-threads"
              title={other ? <span className="row g-8 wrap">{other.fullName} <RoleChip role={other.role} label={other.roleLabel} /></span> : undefined}
            />
          ) : (
            <Empty icon={MessageCircle} title="Elige una conversación" body="O escribe a un docente o directivo con «Nuevo mensaje»." />
          )}
        </div>
      </div>
      <Sheet open={composing} onClose={() => setComposing(false)} title="Escribir a un colega">
        <div className="stack" style={{ gap: 14 }}>
          <label className="lib-search">
            <Search size={16} aria-hidden />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca por nombre, rol o asignatura" aria-label="Buscar colega" />
          </label>
          {groups.map(([label, people]) => (
            <div key={label}>
              <div className="block-label">{label}</div>
              <div className="stack" style={{ gap: 6 }}>
                {people.map((p) => (
                  <button key={p.id} className="thread-row" style={{ padding: 10 }} onClick={() => open(p.id)}>
                    <Avatar name={p.fullName} />
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div className="row g-8 wrap"><b>{p.fullName}</b><RoleChip role={p.role} label={p.roleLabel} /></div>
                      {p.detail && <div className="muted ellipsis" style={{ fontSize: 12.5 }}>{p.detail}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!contacts.isLoading && !groups.length && <Empty icon={Users} title="Nadie con ese nombre" body="Prueba con otra búsqueda." />}
        </div>
      </Sheet>
    </>
  );
}

export function MessagesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [composing, setComposing] = useState(false);
  const role = user?.role;
  const families = role === 'guardian' || role === 'teacher';
  const staff = role !== 'guardian' && role !== 'student';
  const view = !families || (staff && (params.get('vista') === 'colegas' || params.has('colega'))) ? 'colegas' : 'familias';
  const unread = useQuery({ queryKey: ['staff-threads'], queryFn: () => api<StaffThread[]>('/api/staff-messages/threads'), enabled: staff });
  const staffUnread = (unread.data ?? []).reduce((n, t) => n + t.unread, 0);

  const subtitle = role === 'guardian'
    ? 'Conversa con los docentes de tus hijos. Cada mensaje queda registrado.'
    : role === 'teacher'
      ? 'Familias de tus estudiantes y colegas del colegio, cada uno con su nombre y rol.'
      : 'Escribe a docentes y directivos del colegio; verás el nombre, el rol y lo que enseña cada uno.';

  return (
    <div>
      <PageHeader
        eyebrow={role === 'guardian' ? 'Familia' : role ? ROLE_LABELS[role] : undefined}
        title="Mensajes"
        subtitle={subtitle}
        actions={<button className="btn" onClick={() => setComposing(true)}><MessageCircle size={16} /> Nuevo mensaje</button>}
      />
      {families && staff && (
        <div style={{ marginBottom: 16 }}>
          <Tabs
            value={view}
            onChange={(v) => setParams(v === 'colegas' ? { vista: 'colegas' } : {})}
            items={[['familias', 'Familias', Users], ['colegas', 'Colegas', Mail, staffUnread || undefined]]}
          />
        </div>
      )}
      {view === 'colegas'
        ? <StaffInbox composing={composing} setComposing={setComposing} />
        : <FamilyInbox composing={composing} setComposing={setComposing} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Familia (se muestra dentro de la página del acudiente)              */
/* ------------------------------------------------------------------ */

export interface FamilyChild {
  id: string;
  fullName: string;
  group: string | null;
  upcoming: { kind: string; id: string; title: string; course: string; at: string }[];
  grades: { kind: string; title: string; course: string; grade: number; at: string }[];
  attendance: { days: number; total: number; absent: number; late: number; excused: number };
  teachers: { id: string; fullName: string; subjects: string }[];
  alerts: { id: string; kind: string; level: string; detail: string; status: string; course: string }[];
  meetings: { id: string; scheduledAt: string; mode: string; place: string; reason: string; status: string; responseNote: string | null; outcome: string | null; organizer: string }[];
  unreadMessages: number;
  learningProfile: { method: string; label: string; secondary: string | null; takenAt: string } | null;
}
export interface FamilyData { children: FamilyChild[]; digest: { enabled: boolean; lastSentAt: string | null } }

export function useFamily() {
  return useQuery({ queryKey: ['family'], queryFn: () => api<FamilyData>('/api/family/children') });
}

export function DigestControl({ digest }: { digest: FamilyData['digest'] }) {
  const client = useQueryClient();
  const [state, setState] = useState('');
  async function toggle() {
    await api('/api/family/digest', { method: 'PUT', body: JSON.stringify({ enabled: !digest.enabled }) });
    void client.invalidateQueries({ queryKey: ['family'] });
  }
  async function sendNow() {
    setState('Enviando…');
    try {
      await api('/api/family/digest', { method: 'POST' });
      setState('Enviado a tu correo');
      void client.invalidateQueries({ queryKey: ['family'] });
    } catch (err) {
      setState((err as Error).message);
    }
  }
  return (
    <div className="digest">
      <label className="check" style={{ margin: 0 }}>
        <input type="checkbox" checked={digest.enabled} onChange={toggle} /> Resumen semanal por correo (viernes)
      </label>
      <button className="btn sm ghost" onClick={sendNow}><Mail size={14} /> Enviármelo ahora</button>
      {state && <span className="muted" style={{ fontSize: 12.5 }}>{state}</span>}
    </div>
  );
}

const UPCOMING_LABEL: Record<string, string> = { assignment: 'Tarea', exam: 'Examen', class: 'Clase', event: 'Evento' };

export function FamilyDetail({ child }: { child: FamilyChild }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function respond(id: string, attending: boolean) {
    const note = attending ? undefined : prompt('¿Quieres dejar una nota para coordinación? (opcional)') ?? undefined;
    setBusy(id);
    try {
      await api(`/api/family/meetings/${id}/respond`, { method: 'POST', body: JSON.stringify({ attending, note: note || undefined }) });
      void client.invalidateQueries({ queryKey: ['family'] });
    } finally {
      setBusy(null);
    }
  }
  const open = child.meetings.filter((m) => ['scheduled', 'confirmed', 'declined'].includes(m.status) && new Date(m.scheduledAt).getTime() > Date.now());
  return (
    <div className="family-grid">
      {open.length > 0 && (
        <div className="family-block meeting-callout">
          <div className="block-label"><CalendarClock size={13} /> Citaciones</div>
          {open.map((m) => (
            <div key={m.id} className="meeting-line">
              <Tile icon={CalendarClock} tone={MEETING_TONE[m.status] ?? 'gold'} size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row g-8 wrap"><b>{when(m.scheduledAt)}</b><span className={`chip ${MEETING_TONE[m.status]}`}>{MEETING_LABEL[m.status]}</span></div>
                <div className="muted" style={{ fontSize: 13 }}>{m.organizer} · {m.mode === 'virtual' ? 'Virtual' : 'Presencial'}{m.place ? ` · ${m.place}` : ''}</div>
                <div style={{ fontSize: 13.5 }}>{m.reason}</div>
              </div>
              <div className="row g-8 wrap">
                <button className="btn sm mint" disabled={busy === m.id || m.status === 'confirmed'} onClick={() => respond(m.id, true)}><CheckCircle2 size={14} /> Asistiré</button>
                <button className="btn sm ghost" disabled={busy === m.id || m.status === 'declined'} onClick={() => respond(m.id, false)}>No puedo</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="family-block">
        <div className="block-label"><CalendarClock size={13} /> Lo que viene (14 días)</div>
        <ol className="timeline">
          {child.upcoming.map((u) => (
            <li key={`${u.kind}-${u.id}`}><span className="chip sky">{UPCOMING_LABEL[u.kind] ?? 'Evento'}</span> <b>{u.title}</b><p className="muted">{u.course} · {when(u.at)}</p></li>
          ))}
          {!child.upcoming.length && <li className="muted">Nada programado.</li>}
        </ol>
      </div>
      <div className="family-block">
        <div className="block-label"><GraduationCap size={13} /> Notas recientes</div>
        <ol className="timeline">
          {child.grades.map((g, i) => (
            <li key={i}><span className={`chip ${g.grade >= 4 ? 'mint' : g.grade >= 3 ? 'gold' : 'coral'}`}>{g.grade.toFixed(1)}</span> <b>{g.title}</b><p className="muted">{g.course} · {day(g.at)}</p></li>
          ))}
          {!child.grades.length && <li className="muted">Aún no hay notas.</li>}
        </ol>
      </div>
      <div className="family-block">
        <div className="block-label"><UserCheck size={13} /> Asistencia ({child.attendance.days} días)</div>
        <div className="row g-8 wrap">
          <span className={`chip ${child.attendance.absent ? 'coral' : 'mint'}`}>{child.attendance.absent} faltas</span>
          <span className="chip gold">{child.attendance.late} tardes</span>
          <span className="chip">{child.attendance.excused} excusas</span>
          <span className="chip">{child.attendance.total} registros</span>
        </div>
        {child.alerts.length > 0 && (
          <>
            <div className="block-label" style={{ marginTop: 14 }}><AlertTriangle size={13} /> Alertas académicas</div>
            {child.alerts.map((a) => <p key={a.id} style={{ margin: '4px 0', fontSize: 13.5 }}><span className={`chip ${LEVEL_TONE[a.level] ?? 'gold'}`}>{a.kind}</span> {a.course}: {a.detail}</p>)}
          </>
        )}
      </div>
      <div className="family-block">
        <div className="block-label"><Brain size={13} /> Cómo aprende</div>
        {child.learningProfile ? (
          <p style={{ margin: 0 }}>
            <b>{child.learningProfile.label}</b>
            {child.learningProfile.secondary && <span className="muted"> · también {child.learningProfile.secondary.toLowerCase()}</span>}
            <br /><span className="muted" style={{ fontSize: 12.5 }}>Según «Descubre cómo aprendes», {day(child.learningProfile.takenAt)}. En casa ayuda estudiar de esa forma.</span>
          </p>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Aún no responde «Descubre cómo aprendes». Cuando lo haga verás aquí su forma preferida de estudiar.</p>
        )}
      </div>
      <div className="family-block">
        <div className="block-label"><MessageCircle size={13} /> Docentes {child.unreadMessages > 0 && <span className="seg-badge">{child.unreadMessages}</span>}</div>
        <div className="stack" style={{ gap: 6 }}>
          {child.teachers.map((t) => (
            <Link key={t.id} to={`/app/mensajes?estudiante=${child.id}&con=${t.id}`} className="thread-row" style={{ padding: 10 }}>
              <Avatar name={t.fullName} />
              <div style={{ flex: 1, minWidth: 0 }}><b>{t.fullName}</b><div className="muted ellipsis" style={{ fontSize: 12.5 }}>{t.subjects}</div></div>
              <MessageCircle size={16} />
            </Link>
          ))}
          {!child.teachers.length && <p className="muted">Sin docentes asignados.</p>}
        </div>
      </div>
    </div>
  );
}
