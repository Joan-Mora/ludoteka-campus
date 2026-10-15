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
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartHandshake,
  Layers,
  Library,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { isBoard as isBoardRole } from '@eduquest/contracts';
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
    enabled: Boolean(groupId),
  });
  const ids = (students.data ?? []).map((s) => s.user_id);
  const bulletins = useQuery({
    queryKey: ['bulletin-status', ids.join(',')],
    queryFn: () => api<Record<string, { status: string; at: string }>>(`/api/bulletins/status?students=${ids.join(',')}`),
    enabled: ids.length > 0,
  });
  const stats = useQuery({ queryKey: ['analytics', id], queryFn: () => api<{ title: string; average: number; lessons: number; flaggedAttempts: number }>(`/api/analytics/courses/${id}`) });
  const isBoard = user ? isBoardRole(user.role) : false;
  const canCertify = user?.role === 'teacher' || user?.role === 'admin';
  const canRequest = user?.role === 'teacher' || user?.role === 'coordinator' || user?.role === 'admin';
  const [notice, setNotice] = useState('');
  async function requestBulletin(studentId: string) {
    setNotice('');
    try {
      await api('/api/bulletins/requests', { method: 'POST', body: JSON.stringify({ studentId }) });
      void bulletins.refetch();
    } catch (err) {
      setNotice((err as Error).message);
    }
  }

  const client = useQueryClient();
  const fetchDoc = async (path: string, name: string) => {
    await download(path, name);
    void client.invalidateQueries({ queryKey: ['report-log'] });
  };
  const docs = [
    { icon: FileSpreadsheet, tone: 'violet' as const, title: 'Curso Excel', body: 'Estudiantes, progreso y evaluaciones del curso.', action: () => fetchDoc(`/api/reports/courses/${id}/excel`, 'curso.xlsx') },
    { icon: FileText, tone: 'coral' as const, title: 'Integridad PDF', body: 'Resumen, alertas por tipo y por estudiante.', action: () => fetchDoc(`/api/reports/integrity/${id}/pdf`, 'integridad.pdf') },
    { icon: FileSpreadsheet, tone: 'mint' as const, title: 'Integridad Excel', body: 'Detalle de eventos para análisis.', action: () => fetchDoc(`/api/reports/integrity/${id}/excel`, 'integridad.xlsx') },
    ...(isBoard ? [{ icon: Users, tone: 'sky' as const, title: 'Usuarios Excel', body: 'Listado institucional de cuentas.', action: () => fetchDoc('/api/reports/roster/excel', 'usuarios.xlsx') }] : []),
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

      <Panel icon={GraduationCap} tone="violet" title="Estudiantes" subtitle="Boletín individual y certificado del curso. Rectoría firma ambos antes de que sean oficiales.">
        {notice && <p className="form-error">{notice}</p>}
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Estudiante</th><th className="num">Boletín oficial</th><th className="act">Acciones</th></tr></thead>
          <tbody>
            {(students.data ?? []).map((student) => {
              const bulletin = bulletins.data?.[student.user_id];
              return (
                <tr key={student.user_id}>
                  <td><div className="row g-12"><Avatar name={student.full_name} /><b>{student.full_name}</b></div></td>
                  <td className="num">
                    {bulletin?.status === 'signed' ? <span className="chip mint"><BadgeCheck size={13} /> Firmado</span>
                      : bulletin?.status === 'pending_signature' ? <span className="chip gold">Esperando firma</span>
                      : bulletin?.status === 'rejected' ? <span className="chip coral">Devuelto</span>
                      : <span className="chip">Sin solicitar</span>}
                  </td>
                  <td className="act">
                    <div className="row g-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => fetchDoc(`/api/reports/bulletin/${student.user_id}/pdf`, 'boletin.pdf')}><FileText size={14} /> Boletín</button>
                      {canRequest && bulletin?.status !== 'pending_signature' && (
                        <button className="btn sm ghost" onClick={() => requestBulletin(student.user_id)}><ClipboardCheck size={14} /> Pedir firma</button>
                      )}
                      {canCertify && (issued.includes(student.user_id) ? (
                        <span className="chip gold"><Award size={13} /> En firma</span>
                      ) : (
                        <button
                          className="btn sm"
                          onClick={async () => {
                            setNotice('');
                            try {
                              await api('/api/certificates', { method: 'POST', body: JSON.stringify({ userId: student.user_id, courseId: id }) });
                              setIssued((prev) => [...prev, student.user_id]);
                            } catch (err) {
                              setNotice((err as Error).message);
                            }
                          }}
                        >
                          <Award size={14} /> Certificar
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        {!students.data?.length && <Empty icon={Users} title="Sin estudiantes matriculados" />}
      </Panel>
      <div style={{ marginTop: 18 }}><ReportHistory /></div>
    </div>
  );
}

type ReportRow = { id: string; code: string; kind: string; format: string; title: string; row_count: number; created_at: string; full_name: string | null };

export function ReportHistory() {
  const log = useQuery({ queryKey: ['report-log'], queryFn: () => api<ReportRow[]>('/api/reports/log') });
  return (
    <Panel icon={ClipboardCheck} tone="gold" title="Historial de reportes" subtitle="Cada documento lleva un consecutivo LK verificable con su código QR.">
      <div className="table-scroll"><table className="table">
        <thead><tr><th>N.º</th><th>Documento</th><th className="num">Formato</th><th className="num">Filas</th><th className="num">Generado</th><th>Por</th></tr></thead>
        <tbody>
          {(log.data ?? []).map((row) => (
            <tr key={row.id}>
              <td><Link to={`/verificar-reporte/${row.code}`} style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, color: 'var(--violet)' }}>{row.code}</Link></td>
              <td>{row.title}</td>
              <td className="num"><span className={`chip ${row.format === 'pdf' ? 'coral' : 'mint'}`}>{row.format.toUpperCase()}</span></td>
              <td className="num">{row.row_count}</td>
              <td className="num muted">{new Date(row.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td>{row.full_name ?? 'Sistema'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {!log.data?.length && <Empty icon={FileText} title="Aún no se han generado reportes" />}
    </Panel>
  );
}

export function InstitutionReports() {
  const client = useQueryClient();
  const [days, setDays] = useState(30);
  const fetchDoc = async (path: string, name: string) => {
    await download(path, name);
    void client.invalidateQueries({ queryKey: ['report-log'] });
  };
  return (
    <Panel icon={Download} tone="mint" title="Reportes institucionales" subtitle="Excel con encabezado, fecha, consecutivo y datos de CockroachDB.">
      <div className="stack g-12">
        <div className="row g-8" style={{ flexWrap: 'wrap' }}>
          <label className="muted" style={{ fontWeight: 700, fontSize: 13 }}>Periodo</label>
          {[7, 30, 90].map((d) => (
            <button key={d} className={`btn sm ${days === d ? '' : 'ghost'}`} onClick={() => setDays(d)}>{d} días</button>
          ))}
        </div>
        <button className="btn" onClick={() => fetchDoc(`/api/reports/usage/excel?days=${days}`, 'uso-biblioteca-ia.xlsx')}><FileSpreadsheet size={16} /> Uso de biblioteca e IA</button>
        <button className="btn ghost" onClick={() => fetchDoc('/api/reports/roster/excel', 'usuarios.xlsx')}><Users size={16} /> Usuarios de la institución</button>
      </div>
    </Panel>
  );
}

export function CourseLinks() {
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

export function AdminPage() {
  const client = useQueryClient();
  const years = useQuery({ queryKey: ['years'], queryFn: () => api<{ id: string; name: string }[]>('/api/institution/years') });
  const grades = useQuery({ queryKey: ['grades'], queryFn: () => api<{ id: string; name: string; level: number }[]>('/api/institution/grades') });
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api<{ id: string; name: string; grade_name: string }[]>('/api/institution/groups') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<{ id: string; name: string; code: string }[]>('/api/institution/subjects') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<{ id: string; fullName: string; email: string; role: string }[]>('/api/admin/users') });
  const [tab, setTab] = useState<'guardians' | 'structure' | 'courses'>('structure');

  async function send(path: string, body: unknown, form?: HTMLFormElement) {
    await api(path, { method: 'POST', body: JSON.stringify(body) });
    form?.reset();
    client.invalidateQueries();
  }

  const yearSelect = <label className="field">Año<select name="yearId">{(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>;
  const groupSelect = <label className="field">Grupo<select name="groupId">{(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.grade_name} {g.name}</option>)}</select></label>;

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Institución"
        subtitle="Estructura académica, acudientes y cursos del colegio."
        actions={<Link className="btn ghost" to="/app/admin/usuarios"><Users size={16} /> Gestionar usuarios</Link>}
      />
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={Users} tone="violet" value={users.data?.length ?? 0} label="Cuentas" />
        <Stat icon={Layers} tone="sky" value={groups.data?.length ?? 0} label="Grupos" />
        <Stat icon={Library} tone="gold" value={subjects.data?.length ?? 0} label="Materias" />
        <Stat icon={GraduationCap} tone="mint" value={grades.data?.length ?? 0} label="Grados" />
      </div>

      <div className="row g-8 seg" style={{ marginBottom: 18 }}>
        {([
          ['structure', 'Estructura', Building2],
          ['guardians', 'Acudientes', HeartHandshake],
          ['courses', 'Cursos', BookOpen],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} className={`btn sm ${tab === key ? '' : 'ghost'}`} style={tab === key ? undefined : { border: 0 }} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
        ))}
      </div>

      {tab === 'structure' && <StructureImport onDone={() => client.invalidateQueries()} />}
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
          <Panel icon={GraduationCap} tone="mint" title="Matrícula" subtitle="Las cuentas nuevas se matriculan desde Usuarios">
            <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const d = new FormData(f); send('/api/institution/enrollments', { userId: d.get('userId'), groupId: d.get('groupId'), academicYearId: d.get('yearId') }, f); }}>
              <label className="field">Estudiante<select name="userId">{(users.data ?? []).filter((u) => u.role === 'student').map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></label>
              {groupSelect}
              {yearSelect}
              <button className="btn" type="submit" style={{ width: '100%' }}>Matricular</button>
            </form>
          </Panel>
        </div>
      )}

      {tab === 'guardians' && <GuardianLinks users={users.data ?? []} />}

      {tab === 'courses' && <TeacherBuilder />}
    </div>
  );
}

interface StructurePlan { year: string; grades: string[]; groups: string[]; subjects: string[]; applied: boolean }

function StructureImport({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<StructurePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(dryRun: boolean, picked = file) {
    setBusy(true);
    setError('');
    try {
      const query = `?dryRun=${dryRun ? 1 : 0}${picked ? `&name=${encodeURIComponent(picked.name)}` : ''}`;
      const result = await api<StructurePlan>(`/api/admin/structure/import${query}`, {
        method: 'POST',
        ...(picked ? { body: picked, headers: { 'Content-Type': 'application/octet-stream' } } : {}),
      });
      setPlan(result);
      if (!dryRun) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la estructura');
    } finally {
      setBusy(false);
    }
  }

  const nothing = plan && !plan.grades.length && !plan.groups.length && !plan.subjects.length;
  return (
    <Panel icon={FileSpreadsheet} tone="violet" title="Plantilla de estructura" subtitle="Grados 6.° a 11.°, grupos A y B y materias del plan de estudios" className="structure-import">
      <div className="row g-8 wrap" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={() => download('/api/admin/structure/template.xlsx', 'plantilla-estructura-ludoteka.xlsx')}><Download size={15} /> Descargar plantilla</button>
        <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
          <FileSpreadsheet size={15} /> {file ? file.name : 'Subir plantilla llena'}
          <input type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPlan(null); if (f) run(true, f); }} />
        </label>
        {!file && <button className="btn ghost sm" disabled={busy} onClick={() => run(true, null)}><Wand2 size={15} /> Usar estructura base</button>}
      </div>
      {plan && (
        <div className="stack" style={{ gap: 8, fontSize: 14 }}>
          {nothing ? (
            <p className="ok-text" style={{ margin: 0 }}>{plan.applied ? 'Estructura creada.' : `Todo ya existe en ${plan.year}.`}</p>
          ) : (
            <>
              <p style={{ margin: 0 }}>{plan.applied ? 'Se creó' : 'Se creará'} en <b>{plan.year}</b>:</p>
              {!!plan.grades.length && <p className="muted" style={{ margin: 0 }}>Grados: {plan.grades.join(', ')}</p>}
              {!!plan.groups.length && <p className="muted" style={{ margin: 0 }}>Grupos: {plan.groups.join(', ')}</p>}
              {!!plan.subjects.length && <p className="muted" style={{ margin: 0 }}>Materias: {plan.subjects.join(', ')}</p>}
              {!plan.applied && <button className="btn sm" disabled={busy} onClick={() => run(false)} style={{ width: 'fit-content' }}>Crear lo que falta</button>}
            </>
          )}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </Panel>
  );
}

interface GuardianLinkRow {
  id: string;
  relationship: string;
  status: string;
  guardian_name: string;
  guardian_email: string;
  student_name: string;
  student_email: string;
  is_minor: boolean;
}

function GuardianLinks({ users }: { users: { id: string; fullName: string; email: string; role: string }[] }) {
  const client = useQueryClient();
  const links = useQuery({ queryKey: ['guardian-links'], queryFn: () => api<GuardianLinkRow[]>('/api/admin/guardian-links') });
  const [error, setError] = useState('');

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError('');
    try {
      await api('/api/admin/guardian-links', { method: 'POST', body: JSON.stringify({ guardianEmail: d.get('guardian'), studentEmail: d.get('student'), relationship: d.get('relationship') }) });
      form.reset();
      client.invalidateQueries({ queryKey: ['guardian-links'] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(id: string) {
    await api(`/api/admin/guardian-links/${id}`, { method: 'DELETE' });
    client.invalidateQueries({ queryKey: ['guardian-links'] });
  }

  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <Panel icon={HeartHandshake} tone="mint" title="Vínculos acudiente-estudiante" subtitle="El acudiente autoriza el acceso facial y el tutor IA de los menores (Ley 1581)" className="span-2">
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Acudiente</th><th>Estudiante</th><th className="num">Parentesco</th><th className="num">Estado</th><th className="act" /></tr></thead>
          <tbody>
            {(links.data ?? []).map((link) => (
              <tr key={link.id}>
                <td><b>{link.guardian_name}</b><div className="muted" style={{ fontSize: 12 }}>{link.guardian_email}</div></td>
                <td><b>{link.student_name}</b> {link.is_minor && <span className="chip gold" style={{ marginLeft: 6 }}>Menor</span>}<div className="muted" style={{ fontSize: 12 }}>{link.student_email}</div></td>
                <td className="num" style={{ textTransform: 'capitalize' }}>{link.relationship}</td>
                <td className="num"><span className={`chip ${link.status === 'active' ? 'mint' : 'soft'}`}>{link.status === 'active' ? 'Activo' : link.status === 'revoked' ? 'Revocado' : 'Pendiente'}</span></td>
                <td className="act">{link.status === 'active' && <button className="btn sm ghost" onClick={() => revoke(link.id)}>Revocar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!links.data?.length && <Empty icon={HeartHandshake} title="Sin vínculos" body="Vincula a cada acudiente con su estudiante." />}
      </Panel>
      <Panel icon={UserPlus} tone="violet" title="Nuevo vínculo">
        <form onSubmit={create}>
          <label className="field">Acudiente<select name="guardian" required>{users.filter((u) => u.role === 'guardian').map((u) => <option key={u.id} value={u.email}>{u.fullName}</option>)}</select></label>
          <label className="field">Estudiante<select name="student" required>{users.filter((u) => u.role === 'student').map((u) => <option key={u.id} value={u.email}>{u.fullName}</option>)}</select></label>
          <label className="field">Parentesco
            <select name="relationship">
              {['madre', 'padre', 'tutor', 'abuelo', 'otro'].map((r) => <option key={r} value={r}>{r[0]!.toUpperCase() + r.slice(1)}</option>)}
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn" type="submit" style={{ width: '100%' }}>Vincular</button>
        </form>
      </Panel>
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
