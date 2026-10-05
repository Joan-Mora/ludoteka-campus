import { FormEvent, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  Library,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { api, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Avatar, Empty, PageHeader, Reveal, Ring, Stat, Tile, type Tone } from '@/ui';

function Panel({ icon, tone, title, subtitle, children, className, delay }: { icon: LucideIcon; tone: Tone; title: string; subtitle?: string; children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal className={`card ${className ?? ''}`} delay={delay}>
      <div className="row g-12" style={{ marginBottom: 18 }}>
        <Tile icon={icon} tone={tone} />
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 13 }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </Reveal>
  );
}

export function BankPage() {
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<{ id: string; name: string }[]>('/api/institution/subjects') });
  const [subjectId, setSubjectId] = useState('');
  const questions = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: () => api<{ id: string; prompt: string; active: boolean; code: string }[]>(`/api/questions${subjectId ? `?subjectId=${subjectId}` : ''}`),
  });
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  const client = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(''), 2600);
  }

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await api('/api/questions', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: String(data.get('subjectId')),
        prompt: String(data.get('prompt')),
        explanation: String(data.get('explanation') || ''),
        options: ['A', 'B', 'C', 'D'].map((label) => ({
          label,
          text: String(data.get(`opt${label}`)),
          correct: data.get('correct') === label,
        })),
      }),
    });
    client.invalidateQueries({ queryKey: ['questions'] });
    form.reset();
    flash('Pregunta guardada en el banco');
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await api('/api/assessments', {
      method: 'POST',
      body: JSON.stringify({
        courseId: String(data.get('courseId')),
        title: String(data.get('title')),
        kind: String(data.get('kind')),
        questionIds: picked,
      }),
    });
    setPicked([]);
    form.reset();
    flash('Evaluación publicada en el curso');
  }

  async function drafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api('/api/tutor/drafts', { method: 'POST', body: JSON.stringify({ courseId: String(data.get('courseId')), topic: String(data.get('topic')), count: 2 }) });
    client.invalidateQueries({ queryKey: ['questions'] });
    flash('Borradores generados (inactivos)');
  }

  const list = (questions.data ?? []).filter((q) => q.prompt.toLowerCase().includes(filter.toLowerCase()));
  const active = (questions.data ?? []).filter((q) => q.active).length;

  return (
    <div>
      <PageHeader eyebrow="Docencia" title="Banco de preguntas" subtitle="Crea, genera con IA y arma evaluaciones en segundos." />
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="row g-8 card" style={{ padding: 14, marginBottom: 18, borderColor: 'var(--mint)', background: 'rgba(25,195,156,.08)' }}>
            <CheckCircle2 size={18} color="var(--mint)" /> <b>{notice}</b>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Stat icon={Library} tone="violet" value={questions.data?.length ?? 0} label="Preguntas en el banco" />
        <Stat icon={CheckCircle2} tone="mint" value={active} label="Activas" />
        <Stat icon={ClipboardCheck} tone="gold" value={picked.length} label="Seleccionadas para evaluar" />
      </div>

      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2 stack" style={{ gap: 18 }}>
          <Reveal className="card">
            <div className="row between wrap g-12" style={{ marginBottom: 16 }}>
              <div className="row g-12"><Tile icon={Layers} tone="violet" /><div className="card-title">Preguntas</div></div>
              <div className="row g-8">
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ padding: '9px 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                  <option value="">Todas las materias</option>
                  {(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
                <div className="search" style={{ width: 220, padding: '8px 12px' }}>
                  <Search size={15} />
                  <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar" style={{ border: 0, outline: 'none', background: 'transparent', width: '100%' }} />
                </div>
              </div>
            </div>
            <div className="stack g-8" style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
              {list.map((question) => {
                const on = picked.includes(question.id);
                return (
                  <label key={question.id} className="row g-12" style={{ padding: '12px 14px', borderRadius: 14, border: on ? '1.5px solid var(--violet)' : '1px solid var(--line)', background: on ? 'rgba(124,92,255,.07)' : 'var(--surface-2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => setPicked((prev) => (prev.includes(question.id) ? prev.filter((id) => id !== question.id) : [...prev, question.id]))} style={{ width: 18, height: 18, accentColor: 'var(--violet)' }} />
                    <span className="chip" style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{question.code}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{question.prompt}</span>
                    {!question.active && <span className="chip gold">Borrador</span>}
                  </label>
                );
              })}
              {!list.length && <Empty icon={Library} title="Sin preguntas" />}
            </div>
          </Reveal>

          <Panel icon={Plus} tone="mint" title="Nueva pregunta" subtitle="Opción múltiple con cuatro alternativas." delay={0.05}>
            <form onSubmit={createQuestion}>
              <label className="field">Materia
                <select name="subjectId" required>
                  <option value="">Elige</option>
                  {(subjects.data ?? []).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              <label className="field">Enunciado<textarea name="prompt" rows={3} required /></label>
              <div className="grid cols-2" style={{ gap: 12 }}>
                {['A', 'B', 'C', 'D'].map((label) => <label className="field" key={label} style={{ marginBottom: 0 }}>Opción {label}<input name={`opt${label}`} required /></label>)}
              </div>
              <div className="grid cols-2" style={{ gap: 12, marginTop: 14 }}>
                <label className="field">Correcta
                  <select name="correct" defaultValue="A">{['A', 'B', 'C', 'D'].map((label) => <option key={label}>{label}</option>)}</select>
                </label>
                <label className="field">Explicación<input name="explanation" /></label>
              </div>
              <button className="btn" type="submit"><Plus size={16} /> Guardar pregunta</button>
            </form>
          </Panel>
        </div>

        <div className="stack" style={{ gap: 18, position: 'sticky', top: 90 }}>
          <Panel icon={ClipboardCheck} tone="gold" title="Armar evaluación" subtitle={`${picked.length} preguntas marcadas`} delay={0.05}>
            <form onSubmit={createAssessment}>
              <label className="field">Curso
                <select name="courseId">{(courses.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
              </label>
              <label className="field">Título<input name="title" required /></label>
              <label className="field">Tipo
                <select name="kind"><option value="practice">Práctica</option><option value="exam">Examen</option><option value="live">En vivo</option></select>
              </label>
              <button className="btn" type="submit" disabled={!picked.length} style={{ width: '100%' }}>Publicar evaluación</button>
            </form>
          </Panel>
          <Panel icon={Wand2} tone="violet" title="Generar con IA" subtitle="Crea borradores inactivos para revisar." delay={0.1}>
            <form onSubmit={drafts}>
              <label className="field">Curso
                <select name="courseId">{(courses.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select>
              </label>
              <label className="field">Tema<input name="topic" placeholder="Ej. fracciones equivalentes" required /></label>
              <button className="btn soft" type="submit" style={{ width: '100%' }}><Sparkles size={16} /> Pedir borradores</button>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const violationLabel: Record<string, string> = {
  fullscreen_exit: 'Salió de pantalla completa',
  visibility_hidden: 'Cambió de pestaña',
  blur: 'Perdió el foco',
  escape: 'Presionó Escape',
};

export function IntegrityPage() {
  const { id = '' } = useParams();
  const events = useQuery({
    queryKey: ['integrity', id],
    queryFn: () => api<{ id: string; full_name: string; type: string; at: string; assessment_title: string }[]>(`/api/courses/${id}/integrity`),
    refetchInterval: 4000,
  });
  const rows = events.data ?? [];
  const people = new Set(rows.map((r) => r.full_name)).size;
  return (
    <div>
      <PageHeader
        eyebrow="Monitoreo"
        title="Integridad del curso"
        subtitle="Se actualiza sola cada 4 segundos mientras el examen está abierto."
        actions={
          <span className="chip mint" style={{ padding: '8px 14px' }}>
            <motion.span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mint)' }} animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} /> En vivo
          </span>
        }
      />
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Stat icon={ShieldAlert} tone="coral" value={rows.length} label="Alertas registradas" />
        <Stat icon={Users} tone="violet" value={people} label="Estudiantes con alertas" />
        <Stat icon={ShieldCheck} tone="mint" value={rows.length ? 'Atento' : 'Tranquilo'} label="Estado del curso" />
      </div>
      <Reveal className="card">
        <div className="card-head"><div className="row g-12"><Tile icon={AlertTriangle} tone="coral" /><div className="card-title">Línea de tiempo</div></div></div>
        <div className="list">
          <AnimatePresence initial={false}>
            {rows.map((event) => (
              <motion.div key={event.id} className="list-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <Avatar name={event.full_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{event.full_name}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{event.assessment_title}</div>
                </div>
                <span className="chip coral">{violationLabel[event.type] ?? event.type}</span>
                <span className="muted" style={{ fontSize: 13, fontWeight: 700, width: 84, textAlign: 'right' }}>{new Date(event.at).toLocaleTimeString('es-CO')}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {!rows.length && <Empty icon={ShieldCheck} title="Sin alertas" body="Todo en orden por ahora." />}
        </div>
      </Reveal>
    </div>
  );
}

export function ReportsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [issued, setIssued] = useState<string[]>([]);
  const course = useQuery({ queryKey: ['course', id], queryFn: () => api<{ group_id: string }>(`/api/courses/${id}`) });
  const groupId = course.data?.group_id;
  const students = useQuery({
    queryKey: ['enroll', groupId],
    queryFn: () => api<{ user_id: string; full_name: string }[]>(`/api/institution/enrollments?groupId=${groupId}`),
    enabled: Boolean(groupId) && (user?.role === 'admin' || user?.role === 'directivo' || user?.role === 'teacher'),
  });
  const stats = useQuery({ queryKey: ['analytics', id], queryFn: () => api<{ title: string; average: number; lessons: number; flaggedAttempts: number }>(`/api/analytics/courses/${id}`) });
  const isBoard = user?.role === 'admin' || user?.role === 'directivo';

  const docs = [
    { icon: FileText, tone: 'coral' as const, title: 'Integridad PDF', body: 'Alertas del curso con fecha e ID.', action: () => download(`/api/reports/integrity/${id}/pdf`, 'integridad.pdf') },
    { icon: FileSpreadsheet, tone: 'mint' as const, title: 'Integridad Excel', body: 'Detalle para análisis en hoja de cálculo.', action: () => download(`/api/reports/integrity/${id}/excel`, 'integridad.xlsx') },
    ...(isBoard ? [{ icon: Users, tone: 'sky' as const, title: 'Usuarios Excel', body: 'Listado institucional de cuentas.', action: () => download('/api/reports/roster/excel', 'usuarios.xlsx') }] : []),
  ];

  return (
    <div>
      <PageHeader eyebrow="Analítica" title={stats.data ? `Reportes · ${stats.data.title}` : 'Reportes'} subtitle="Descarga documentos oficiales y emite certificados verificables." />
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Reveal className="card hover" delay={0}>
          <div className="row g-16">
            <Ring value={stats.data?.average ?? 0} size={72} stroke={9} track="var(--bg-2)"><b>{stats.data?.average ?? 0}%</b></Ring>
            <div><div className="stat-value" style={{ fontSize: 20 }}>Promedio</div><div className="stat-label">Evaluaciones cerradas</div></div>
          </div>
        </Reveal>
        <Reveal delay={0.05}><Stat icon={BookOpen} tone="violet" value={stats.data?.lessons ?? '—'} label="Lecciones" /></Reveal>
        <Reveal delay={0.1}><Stat icon={ShieldAlert} tone="coral" value={stats.data?.flaggedAttempts ?? '—'} label="Intentos con alertas" /></Reveal>
        <Reveal delay={0.15}><Stat icon={Users} tone="sky" value={students.data?.length ?? '—'} label="Estudiantes" /></Reveal>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        {docs.map((doc, i) => (
          <Reveal key={doc.title} delay={i * 0.05}>
            <button className="card hover" style={{ width: '100%', textAlign: 'left' }} onClick={doc.action}>
              <div className="row between"><Tile icon={doc.icon} tone={doc.tone} large /><Download size={18} color="var(--muted)" /></div>
              <h3 style={{ fontSize: 18, marginTop: 14 }}>{doc.title}</h3>
              <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>{doc.body}</p>
            </button>
          </Reveal>
        ))}
      </div>

      <Panel icon={GraduationCap} tone="violet" title="Estudiantes" subtitle="Boletín individual y certificado del curso.">
        <table className="table">
          <thead><tr><th>Estudiante</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
          <tbody>
            {(students.data ?? []).map((student) => (
              <tr key={student.user_id}>
                <td><div className="row g-12"><Avatar name={student.full_name} /><b>{student.full_name}</b></div></td>
                <td style={{ textAlign: 'right' }}>
                  <div className="row g-8" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm ghost" onClick={() => download(`/api/reports/bulletin/${student.user_id}/pdf`, 'boletin.pdf')}><FileText size={14} /> Boletín</button>
                    {issued.includes(student.user_id) ? (
                      <span className="chip mint"><BadgeCheck size={13} /> Emitido</span>
                    ) : (
                      <button className="btn sm" onClick={async () => { await api('/api/certificates', { method: 'POST', body: JSON.stringify({ userId: student.user_id, courseId: id }) }); setIssued((prev) => [...prev, student.user_id]); }}><Award size={14} /> Certificar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!students.data?.length && <Empty icon={Users} title="Sin estudiantes matriculados" />}
      </Panel>
    </div>
  );
}

export function RectoriaPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<{ students: number; teachers: number; courses: number; completedAttempts: number }>('/api/institution/overview') });
  const board = useQuery({ queryKey: ['inst'], queryFn: () => api<{ byGrade: { level: number; name: string; students: number }[] }>('/api/analytics/institution') });
  const grades = board.data?.byGrade ?? [];
  const max = Math.max(1, ...grades.map((g) => g.students));
  return (
    <div className="stack g-24">
      <Reveal>
        <section className="hero">
          <div className="orb" style={{ width: 380, height: 380, right: -120, top: -160, background: 'radial-gradient(circle, rgba(58,184,255,.45), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <div className="eyebrow" style={{ color: '#ffd66b' }}>Rectoría</div>
            <h1 style={{ marginTop: 8 }}>Panorama institucional</h1>
            <p style={{ marginTop: 8, fontSize: 16, maxWidth: 560 }}>Indicadores del Colegio Francisco Arango en tiempo real para decidir con datos.</p>
          </div>
        </section>
      </Reveal>
      <div className="grid cols-4">
        <Reveal delay={0.05}><Stat icon={GraduationCap} tone="violet" value={overview.data?.students ?? '—'} label="Estudiantes" /></Reveal>
        <Reveal delay={0.1}><Stat icon={Users} tone="sky" value={overview.data?.teachers ?? '—'} label="Docentes" /></Reveal>
        <Reveal delay={0.15}><Stat icon={BookOpen} tone="gold" value={overview.data?.courses ?? '—'} label="Cursos" /></Reveal>
        <Reveal delay={0.2}><Stat icon={ClipboardCheck} tone="mint" value={overview.data?.completedAttempts ?? '—'} label="Evaluaciones cerradas" /></Reveal>
      </div>
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <Panel icon={Building2} tone="violet" title="Matrícula por grado" className="span-2">
          <div className="row g-16" style={{ alignItems: 'flex-end', height: 240, padding: '10px 4px 0' }}>
            {grades.map((grade, i) => (
              <div key={grade.level} className="stack g-8" style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <b style={{ fontSize: 14 }}>{grade.students}</b>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (grade.students / max) * 100)}%` }}
                  transition={{ delay: 0.2 + i * 0.07, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                  style={{ width: '100%', maxWidth: 64, borderRadius: '12px 12px 6px 6px', background: 'var(--grad-brand)', boxShadow: '0 10px 20px -10px rgba(124,92,255,.8)' }}
                />
                <span className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>{grade.name}</span>
              </div>
            ))}
            {!grades.length && <Empty icon={Building2} title="Sin datos de matrícula" />}
          </div>
        </Panel>
        <CourseLinks />
      </div>
    </div>
  );
}

function CourseLinks() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  return (
    <Panel icon={BookOpen} tone="gold" title="Ir a un curso" delay={0.1}>
      <div className="stack g-8">
        {(courses.data ?? []).map((course) => (
          <Link key={course.id} to={`/app/cursos/${course.id}/aula`} className="row between" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', fontWeight: 700 }}>
            {course.title} <span style={{ color: 'var(--violet)' }}>→</span>
          </Link>
        ))}
        {!courses.data?.length && <Empty icon={BookOpen} title="Sin cursos" />}
      </div>
    </Panel>
  );
}

const roleName: Record<string, string> = { student: 'Estudiante', teacher: 'Docente', directivo: 'Directivo', admin: 'Admin', guardian: 'Acudiente' };
const roleTone: Record<string, string> = { student: 'violet', teacher: 'sky', directivo: 'gold', admin: 'coral', guardian: 'mint' };

export function AdminPage() {
  const client = useQueryClient();
  const years = useQuery({ queryKey: ['years'], queryFn: () => api<{ id: string; name: string }[]>('/api/institution/years') });
  const grades = useQuery({ queryKey: ['grades'], queryFn: () => api<{ id: string; name: string; level: number }[]>('/api/institution/grades') });
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api<{ id: string; name: string; grade_name: string }[]>('/api/institution/groups') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<{ id: string; name: string; code: string }[]>('/api/institution/subjects') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<{ id: string; fullName: string; email: string; role: string }[]>('/api/admin/users') });
  const [tab, setTab] = useState<'people' | 'structure' | 'courses'>('people');

  async function send(path: string, body: unknown, form?: HTMLFormElement) {
    await api(path, { method: 'POST', body: JSON.stringify(body) });
    form?.reset();
    client.invalidateQueries();
  }

  const yearSelect = <label className="field">Año<select name="yearId">{(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>;
  const groupSelect = <label className="field">Grupo<select name="groupId">{(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.grade_name} {g.name}</option>)}</select></label>;

  return (
    <div>
      <PageHeader eyebrow="Administración" title="Institución" subtitle="Cuentas, estructura académica y cursos del colegio." />
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={Users} tone="violet" value={users.data?.length ?? 0} label="Cuentas" />
        <Stat icon={Layers} tone="sky" value={groups.data?.length ?? 0} label="Grupos" />
        <Stat icon={Library} tone="gold" value={subjects.data?.length ?? 0} label="Materias" />
        <Stat icon={GraduationCap} tone="mint" value={grades.data?.length ?? 0} label="Grados" />
      </div>

      <div className="row g-8" style={{ marginBottom: 18, padding: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'fit-content' }}>
        {([
          ['people', 'Personas', Users],
          ['structure', 'Estructura', Building2],
          ['courses', 'Cursos', BookOpen],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} className={`btn sm ${tab === key ? '' : 'ghost'}`} style={tab === key ? undefined : { border: 0 }} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
        ))}
      </div>

      {tab === 'people' && (
        <div className="grid cols-3" style={{ alignItems: 'start' }}>
          <Panel icon={Users} tone="violet" title="Cuentas" subtitle={`${users.data?.length ?? 0} usuarios`} className="span-2">
            <table className="table">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead>
              <tbody>
                {(users.data ?? []).map((u) => (
                  <tr key={u.id}>
                    <td><div className="row g-12"><Avatar name={u.fullName} /><b>{u.fullName}</b></div></td>
                    <td className="muted">{u.email}</td>
                    <td><span className={`chip ${roleTone[u.role] ?? ''}`}>{roleName[u.role] ?? u.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <div className="stack" style={{ gap: 18 }}>
            <Panel icon={UserPlus} tone="mint" title="Nueva cuenta">
              <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const d = new FormData(f); send('/api/admin/users', { fullName: d.get('fullName'), email: d.get('email'), password: d.get('password'), role: d.get('role'), isMinor: d.get('isMinor') === 'on' }, f); }}>
                <label className="field">Nombre<input name="fullName" required /></label>
                <label className="field">Correo<input name="email" type="email" required /></label>
                <label className="field">Clave<input name="password" required /></label>
                <label className="field">Rol<select name="role">{Object.entries(roleName).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="check"><input name="isMinor" type="checkbox" /> Es menor de edad</label>
                <button className="btn" type="submit" style={{ width: '100%' }}>Crear cuenta</button>
              </form>
            </Panel>
            <Panel icon={GraduationCap} tone="sky" title="Matrícula">
              <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const d = new FormData(f); send('/api/institution/enrollments', { userId: d.get('userId'), groupId: d.get('groupId'), academicYearId: d.get('yearId') }, f); }}>
                <label className="field">Estudiante<select name="userId">{(users.data ?? []).filter((u) => u.role === 'student').map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></label>
                {groupSelect}
                {yearSelect}
                <button className="btn" type="submit" style={{ width: '100%' }}>Matricular</button>
              </form>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'structure' && (
        <div className="grid cols-3" style={{ alignItems: 'start' }}>
          <Panel icon={Layers} tone="sky" title="Grupos">
            <div className="row g-8 wrap" style={{ marginBottom: 16 }}>
              {(groups.data ?? []).map((g) => <span key={g.id} className="chip sky">{g.grade_name} {g.name}</span>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const d = new FormData(f); send('/api/institution/groups', { name: d.get('name'), gradeId: d.get('gradeId'), academicYearId: d.get('yearId') }, f); }}>
              <label className="field">Nombre<input name="name" required /></label>
              <label className="field">Grado<select name="gradeId">{(grades.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
              {yearSelect}
              <button className="btn" type="submit" style={{ width: '100%' }}>Crear grupo</button>
            </form>
          </Panel>
          <Panel icon={Library} tone="gold" title="Materias">
            <div className="row g-8 wrap" style={{ marginBottom: 16 }}>
              {(subjects.data ?? []).map((s) => <span key={s.id} className="chip gold">{s.code} · {s.name}</span>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const d = new FormData(f); send('/api/institution/subjects', { code: d.get('code'), name: d.get('name'), area: d.get('area') }, f); }}>
              <label className="field">Código<input name="code" required /></label>
              <label className="field">Nombre<input name="name" required /></label>
              <label className="field">Área<input name="area" required /></label>
              <button className="btn" type="submit" style={{ width: '100%' }}>Crear materia</button>
            </form>
          </Panel>
          <Panel icon={Users} tone="violet" title="Asignación docente">
            <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const d = new FormData(f); send('/api/institution/teaching', { teacherId: d.get('teacherId'), subjectId: d.get('subjectId'), groupId: d.get('groupId'), academicYearId: d.get('yearId') }, f); }}>
              <label className="field">Docente<select name="teacherId">{(users.data ?? []).filter((u) => u.role === 'teacher').map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></label>
              <label className="field">Materia<select name="subjectId">{(subjects.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              {groupSelect}
              {yearSelect}
              <button className="btn" type="submit" style={{ width: '100%' }}>Asignar</button>
            </form>
          </Panel>
        </div>
      )}

      {tab === 'courses' && <TeacherBuilder />}
    </div>
  );
}

function TeacherBuilder() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<{ id: string; name: string }[]>('/api/institution/subjects') });
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api<{ id: string; name: string; academic_year_id?: string }[]>('/api/institution/groups') });
  const years = useQuery({ queryKey: ['years'], queryFn: () => api<{ id: string; name: string }[]>('/api/institution/years') });
  const client = useQueryClient();
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <Panel icon={BookOpen} tone="violet" title="Cursos abiertos" className="span-2">
        <div className="grid cols-2" style={{ gap: 12 }}>
          {(courses.data ?? []).map((c) => (
            <Link key={c.id} to={`/app/cursos/${c.id}`} className="card hover row g-12" style={{ padding: 14 }}>
              <Tile icon={BookOpen} tone="violet" />
              <b style={{ flex: 1 }}>{c.title}</b>
            </Link>
          ))}
        </div>
        {!courses.data?.length && <Empty icon={BookOpen} title="Aún no hay cursos" />}
      </Panel>
      <Panel icon={Plus} tone="mint" title="Nuevo curso">
        <form onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const d = new FormData(f);
          await api('/api/courses', { method: 'POST', body: JSON.stringify({ title: d.get('title'), description: d.get('description'), subjectId: d.get('subjectId'), groupId: d.get('groupId'), academicYearId: d.get('yearId') }) });
          f.reset();
          client.invalidateQueries({ queryKey: ['courses'] });
        }}>
          <label className="field">Título<input name="title" required /></label>
          <label className="field">Descripción<input name="description" /></label>
          <label className="field">Materia<select name="subjectId">{(subjects.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field">Grupo<select name="groupId">{(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="field">Año<select name="yearId">{(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
          <button className="btn" type="submit" style={{ width: '100%' }}>Abrir curso</button>
        </form>
      </Panel>
    </div>
  );
}
