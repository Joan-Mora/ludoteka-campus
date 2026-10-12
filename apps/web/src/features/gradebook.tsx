import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarCheck, Check, ClipboardList, Download, Eye, FileSpreadsheet, FileText, Loader2, Plus, Save, Scale, ShieldAlert, Trash2, Users, X } from 'lucide-react';
import { api, ApiException, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Empty, PageHeader, Stat } from '@/ui';

type Source = 'exam' | 'practice' | 'live' | 'assignment' | 'rubric' | 'attendance';
interface Category { name: string; source: Source; weight: number }
interface StudentRow {
  id: string; fullName: string; email: string; grades: Record<string, number | null>; final: number | null; performance: string; coverage: number;
  attendance: { present: number; late: number; absent: number; excused: number; total: number } | null;
}
interface Alert { id: string; student_id: string; full_name: string; kind: string; level: string; detail: string; status: string; created_at: string; resolved_at: string | null }
interface Book {
  course: { id: string; title: string; group: string; subject: string };
  categories: Category[]; isDefault: boolean; students: StudentRow[]; alerts: Alert[];
  summary: { students: number; graded: number; average: number | null; below: number };
}
interface Sheet { date: string; recorded: boolean; students: { id: string; fullName: string; status: string | null; note: string }[]; sessions: { date: string; marked: number; absent: number }[] }
interface Criterion { id: string; name: string; description: string; max_points: number }
interface Rubric { id: string; title: string; assignment_title: string | null; maxPoints: number; criteria: Criterion[]; scores: Record<string, { points: Record<string, number>; total: number; grade: number | null }> }
interface Rubrics { assignments: { id: string; title: string }[]; students: { id: string; fullName: string }[]; rubrics: Rubric[] }

const SOURCES: Record<Source, string> = { exam: 'Exámenes', practice: 'Prácticas', live: 'Quiz en vivo', assignment: 'Tareas', rubric: 'Rúbricas', attendance: 'Asistencia' };
const KIND: Record<string, string> = { low_grade: 'Nota baja', absences: 'Inasistencias', integrity: 'Integridad', inactivity: 'Inactividad' };
const STATUS: { key: string; label: string; short: string; tone: string }[] = [
  { key: 'present', label: 'Presente', short: 'P', tone: 'mint' },
  { key: 'late', label: 'Tarde', short: 'T', tone: 'gold' },
  { key: 'absent', label: 'Ausente', short: 'A', tone: 'coral' },
  { key: 'excused', label: 'Excusa', short: 'E', tone: 'sky' },
];
const perfTone: Record<string, string> = { Superior: 'mint', Alto: 'sky', Básico: 'gold', Bajo: 'coral' };
const todayBogota = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const errorText = (e: unknown, fallback: string) => (e instanceof ApiException ? e.message : fallback);
const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(1));

export function GradebookPage() {
  const { user } = useAuth();
  const readOnly = user?.role !== 'teacher' && user?.role !== 'admin';
  const canTriage = !readOnly || user?.role === 'coordinator';
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  const [params, setParams] = useSearchParams();
  const courseId = params.get('curso') ?? courses.data?.[0]?.id ?? '';
  const [tab, setTab] = useState<'grades' | 'weights' | 'attendance' | 'rubrics' | 'alerts'>('grades');
  const book = useQuery({ queryKey: ['gradebook', courseId], queryFn: () => api<Book>(`/api/gradebook/courses/${courseId}`), enabled: Boolean(courseId) });
  const openAlerts = book.data?.alerts.filter((a) => a.status === 'open').length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Calificaciones"
        title="Libro de calificaciones"
        subtitle="Notas ponderadas en escala 1.0 a 5.0, asistencia, rúbricas y alertas tempranas de riesgo para cada curso."
        actions={
          <select className="note-select" value={courseId} onChange={(e) => setParams({ curso: e.target.value })}>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        }
      />
      {readOnly && <p className="chip sky" style={{ marginBottom: 14, width: 'fit-content' }}><Eye size={13} /> Vista de consulta: las notas, la asistencia y las rúbricas las registra el docente del curso.</p>}
      {courses.data && !courses.data.length && <Empty icon={ClipboardList} title="No tienes cursos" body="Crea un curso para empezar a calificar." />}
      {courseId && (
        <>
          <div className="row g-8" style={{ marginBottom: 18, padding: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'fit-content', flexWrap: 'wrap' }}>
            {([
              ['grades', 'Notas', ClipboardList],
              ['weights', 'Ponderación', Scale],
              ['attendance', 'Asistencia', CalendarCheck],
              ['rubrics', 'Rúbricas', FileText],
              ['alerts', `Alertas${openAlerts ? ` (${openAlerts})` : ''}`, ShieldAlert],
            ] as const).map(([key, label, Icon]) => (
              <button key={key} className={`btn sm ${tab === key ? '' : 'ghost'}`} style={tab === key ? undefined : { border: 0 }} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
            ))}
          </div>
          {book.isLoading && <div className="card"><Loader2 className="spin" /></div>}
          {book.error && <p className="form-error">{errorText(book.error, 'No se pudo cargar el libro')}</p>}
          {book.data && tab === 'grades' && <Grades book={book.data} />}
          {book.data && tab === 'weights' && <Weights key={courseId} book={book.data} readOnly={readOnly} />}
          {tab === 'attendance' && <Attendance key={courseId} courseId={courseId} readOnly={readOnly} />}
          {tab === 'rubrics' && <RubricsTab key={courseId} courseId={courseId} readOnly={readOnly} />}
          {book.data && tab === 'alerts' && <Alerts book={book.data} canTriage={canTriage} />}
        </>
      )}
    </div>
  );
}

function Grades({ book }: { book: Book }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function get(format: 'excel' | 'pdf') {
    setBusy(format);
    try {
      await download(`/api/gradebook/courses/${book.course.id}/report/${format}`, `calificaciones-${book.course.group}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
    } finally {
      setBusy(null);
    }
  }
  const alertsByStudent = useMemo(() => {
    const map = new Map<string, Alert[]>();
    for (const alert of book.alerts) map.set(alert.student_id, [...(map.get(alert.student_id) ?? []), alert]);
    return map;
  }, [book.alerts]);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid cols-4">
        <Stat icon={Users} tone="violet" value={`${book.summary.graded}/${book.summary.students}`} label="Estudiantes con nota" />
        <Stat icon={ClipboardList} tone="mint" value={fmt(book.summary.average)} label="Promedio del curso" />
        <Stat icon={AlertTriangle} tone="coral" value={book.summary.below} label="Por debajo de 3.0" />
        <Stat icon={ShieldAlert} tone="gold" value={book.alerts.filter((a) => a.status === 'open').length} label="Alertas abiertas" />
      </div>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{book.course.title}</div>
            <div className="muted" style={{ fontSize: 13 }}>{book.categories.map((c) => `${c.name} ${c.weight} %`).join(' · ')}{book.isDefault && ' (ponderación institucional)'}</div>
          </div>
          <div className="row g-8">
            <button className="btn sm ghost" disabled={busy !== null} onClick={() => get('excel')}>{busy === 'excel' ? <Loader2 size={14} className="spin" /> : <FileSpreadsheet size={14} />} Excel</button>
            <button className="btn sm ghost" disabled={busy !== null} onClick={() => get('pdf')}>{busy === 'pdf' ? <Loader2 size={14} className="spin" /> : <Download size={14} />} PDF</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Estudiante</th>
                {book.categories.map((c) => <th key={c.source} style={{ textAlign: 'right' }}>{c.name}<div style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{c.weight} %</div></th>)}
                <th style={{ textAlign: 'right' }}>Definitiva</th>
                <th>Desempeño</th>
              </tr>
            </thead>
            <tbody>
              {book.students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.fullName}</div>
                    <div className="row g-4" style={{ marginTop: 2 }}>
                      {(alertsByStudent.get(s.id) ?? []).map((a) => <span key={a.id} className={`chip ${a.level === 'alta' ? 'coral' : 'gold'}`} style={{ padding: '1px 7px', fontSize: 11 }}>{KIND[a.kind]}</span>)}
                    </div>
                  </td>
                  {book.categories.map((c) => <td key={c.source} className={`grade-cell ${s.grades[c.source] != null && s.grades[c.source]! < 3 ? 'low' : ''}`}>{fmt(s.grades[c.source])}</td>)}
                  <td className={`grade-cell final ${s.final != null && s.final < 3 ? 'low' : ''}`}>{fmt(s.final)}</td>
                  <td><span className={`chip ${perfTone[s.performance] ?? ''}`}>{s.performance}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>Superior 4.6-5.0 · Alto 4.0-4.5 · Básico 3.0-3.9 · Bajo menos de 3.0. La definitiva pondera solo las categorías que ya tienen notas.</p>
      </div>
    </div>
  );
}

function Weights({ book, readOnly }: { book: Book; readOnly: boolean }) {
  const client = useQueryClient();
  const [rows, setRows] = useState<Category[]>(book.categories);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const sum = Math.round(rows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0) * 100) / 100;
  const used = new Set(rows.map((r) => r.source));
  const free = (Object.keys(SOURCES) as Source[]).filter((s) => !used.has(s));

  function update(i: number, patch: Partial<Category>) {
    setSaved(false);
    setRows(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/gradebook/courses/${book.course.id}/categories`, { method: 'PUT', body: JSON.stringify({ categories: rows.map((r) => ({ ...r, weight: Number(r.weight) })) }) });
      setSaved(true);
      await client.invalidateQueries({ queryKey: ['gradebook', book.course.id] });
    } catch (e) {
      setError(errorText(e, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <h3 style={{ marginTop: 0 }}>Ponderación del curso</h3>
        <div className="stack" style={{ gap: 6 }}>
          {book.categories.map((c) => (
            <div key={c.source} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span><b>{c.name}</b> <span className="muted">· {SOURCES[c.source]}</span></span>
              <span className="chip">{c.weight} %</span>
            </div>
          ))}
        </div>
        {book.isDefault && <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>El curso usa la ponderación institucional.</p>}
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h3 style={{ marginTop: 0 }}>Ponderación del curso</h3>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>Cada fuente de nota aparece una sola vez y los pesos deben sumar exactamente 100 %. {book.isDefault && 'Ahora se usa la ponderación institucional.'}</p>
      <div className="stack" style={{ gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} className="row g-8">
            <input className="note-select" style={{ flex: 1 }} value={row.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={60} />
            <select className="note-select" value={row.source} onChange={(e) => update(i, { source: e.target.value as Source })}>
              {(Object.keys(SOURCES) as Source[]).filter((s) => s === row.source || !used.has(s)).map((s) => <option key={s} value={s}>{SOURCES[s]}</option>)}
            </select>
            <input className="note-select" style={{ width: 90 }} type="number" min={1} max={100} step={0.5} value={row.weight} onChange={(e) => update(i, { weight: Number(e.target.value) })} />
            <span className="muted">%</span>
            <button className="btn sm ghost" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} title="Quitar"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="row between" style={{ marginTop: 14 }}>
        <button className="btn sm ghost" disabled={!free.length} onClick={() => setRows([...rows, { name: SOURCES[free[0]!], source: free[0]!, weight: 0 }])}><Plus size={14} /> Agregar categoría</button>
        <span className={`chip ${sum === 100 ? 'mint' : 'coral'}`}>Suma: {sum} %</span>
      </div>
      {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      <button className="btn" style={{ marginTop: 14 }} disabled={saving || sum !== 100} onClick={save}>{saving ? <Loader2 size={16} className="spin" /> : saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Guardado' : 'Guardar ponderación'}</button>
    </div>
  );
}

function Attendance({ courseId, readOnly }: { courseId: string; readOnly: boolean }) {
  const client = useQueryClient();
  const [date, setDate] = useState(todayBogota());
  const sheet = useQuery({ queryKey: ['attendance', courseId, date], queryFn: () => api<Sheet>(`/api/gradebook/courses/${courseId}/attendance?date=${date}`), placeholderData: keepPreviousData });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sheet.data && !sheet.isPlaceholderData) setMarks(Object.fromEntries(sheet.data.students.filter((s) => s.status).map((s) => [s.id, s.status!])));
  }, [sheet.data, sheet.isPlaceholderData]);

  async function save() {
    const entries = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
    if (!entries.length) return;
    setSaving(true);
    setMessage(null);
    try {
      await api(`/api/gradebook/courses/${courseId}/attendance`, { method: 'PUT', body: JSON.stringify({ date, entries }) });
      setMessage(`Asistencia del ${date} guardada (${entries.length} estudiantes).`);
      await client.invalidateQueries({ queryKey: ['attendance', courseId] });
      await client.invalidateQueries({ queryKey: ['gradebook', courseId] });
    } catch (e) {
      setMessage(errorText(e, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  const students = sheet.data?.students ?? [];
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="card span-2">
        <div className="card-head">
          <div className="row g-8">
            <input className="note-select" type="date" value={date} max={todayBogota()} onChange={(e) => setDate(e.target.value)} />
            {sheet.data?.recorded && <span className="chip mint"><Check size={12} /> Ya registrada</span>}
          </div>
          {!readOnly && <button className="btn sm ghost" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'present'])))}>Todos presentes</button>}
        </div>
        {sheet.isLoading && <Loader2 className="spin" />}
        {sheet.data && !students.length && <Empty icon={Users} title="Sin estudiantes matriculados" />}
        <div className="stack" style={{ gap: 4 }}>
          {students.map((s) => (
            <div key={s.id} className="row between g-8" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <b style={{ fontSize: 14.5 }}>{s.fullName}</b>
              <div className="row g-4">
                {STATUS.map((st) => (
                  <button key={st.key} className={`att-btn ${marks[s.id] === st.key ? st.tone : ''}`} title={st.label} disabled={readOnly} onClick={() => setMarks({ ...marks, [s.id]: st.key })}>{st.short}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {message && <p className="chip mint" style={{ marginTop: 12, width: 'fit-content' }}>{message}</p>}
        {!readOnly && <button className="btn" style={{ marginTop: 14 }} disabled={saving || !Object.keys(marks).length} onClick={save}>{saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Guardar asistencia</button>}
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>P presente · T tarde (cuenta media) · A ausente · E excusa (no cuenta). Desde 15 % de inasistencias se genera una alerta.</p>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Clases registradas</h3>
        {!sheet.data?.sessions.length && <p className="muted" style={{ fontSize: 14 }}>Todavía no hay registros.</p>}
        <div className="stack" style={{ gap: 4 }}>
          {sheet.data?.sessions.map((s) => (
            <button key={s.date} className={`note-row ${s.date === date ? 'active' : ''}`} onClick={() => setDate(s.date)}>
              <b>{new Date(`${s.date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
              <span className="note-snippet">{s.marked} registrados{s.absent ? ` · ${s.absent} ausentes` : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RubricsTab({ courseId, readOnly }: { courseId: string; readOnly: boolean }) {
  const data = useQuery({ queryKey: ['rubrics', courseId], queryFn: () => api<Rubrics>(`/api/gradebook/courses/${courseId}/rubrics`) });
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const rubrics = data.data?.rubrics ?? [];
  const current = rubrics.find((r) => r.id === (open ?? rubrics[0]?.id));
  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="stack" style={{ gap: 10 }}>
        {!readOnly && <button className="btn sm" onClick={() => setCreating(!creating)}>{creating ? <X size={14} /> : <Plus size={14} />} {creating ? 'Cerrar' : 'Nueva rúbrica'}</button>}
        {creating && data.data && <RubricForm courseId={courseId} assignments={data.data.assignments} onDone={(id) => { setCreating(false); setOpen(id); }} />}
        {rubrics.map((r) => (
          <button key={r.id} className={`note-row ${current?.id === r.id ? 'active' : ''}`} onClick={() => setOpen(r.id)}>
            <b>{r.title}</b>
            <span className="note-snippet">{r.criteria.length} criterios · {r.maxPoints} puntos{r.assignment_title ? ` · ${r.assignment_title}` : ''}</span>
          </button>
        ))}
        {data.data && !rubrics.length && !creating && <p className="muted" style={{ fontSize: 14 }}>Crea una rúbrica para calificar exposiciones, proyectos o talleres.</p>}
      </div>
      <div className="span-2">
        {current && data.data ? <RubricMatrix key={current.id} courseId={courseId} rubric={current} students={data.data.students} readOnly={readOnly} /> : <div className="card"><Empty icon={FileText} title="Sin rúbricas" body="Las notas de rúbrica cuentan en la categoría «Rúbricas» si la incluyes en la ponderación." /></div>}
      </div>
    </div>
  );
}

function RubricForm({ courseId, assignments, onDone }: { courseId: string; assignments: { id: string; title: string }[]; onDone: (id: string) => void }) {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [criteria, setCriteria] = useState([{ name: 'Dominio del tema', maxPoints: 10 }, { name: 'Claridad', maxPoints: 5 }]);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await api<{ id: string }>(`/api/gradebook/courses/${courseId}/rubrics`, { method: 'POST', body: JSON.stringify({ title, assignmentId: assignmentId || undefined, criteria }) });
      await client.invalidateQueries({ queryKey: ['rubrics', courseId] });
      onDone(created.id);
    } catch (e) {
      setError(errorText(e, 'No se pudo crear la rúbrica'));
    }
  }

  return (
    <form className="card stack" style={{ gap: 8 }} onSubmit={submit}>
      <input className="note-select" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (p. ej. Exposición)" maxLength={120} />
      <select className="note-select" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
        <option value="">Sin tarea asociada</option>
        {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
      </select>
      {criteria.map((c, i) => (
        <div key={i} className="row g-4">
          <input className="note-select" style={{ flex: 1, minWidth: 0 }} value={c.name} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Criterio" maxLength={80} />
          <input className="note-select" style={{ width: 64 }} type="number" min={1} max={100} value={c.maxPoints} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, maxPoints: Number(e.target.value) } : x)))} />
          <button type="button" className="btn sm ghost" disabled={criteria.length === 1} onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}><X size={13} /></button>
        </div>
      ))}
      <button type="button" className="btn sm ghost" disabled={criteria.length >= 8} onClick={() => setCriteria([...criteria, { name: '', maxPoints: 5 }])}><Plus size={13} /> Criterio</button>
      {error && <p className="form-error">{error}</p>}
      <button className="btn sm" disabled={title.trim().length < 3}>Crear rúbrica</button>
    </form>
  );
}

function RubricMatrix({ courseId, rubric, students, readOnly }: { courseId: string; rubric: Rubric; students: { id: string; fullName: string }[]; readOnly: boolean }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  const value = (studentId: string, criterionId: string) => draft[studentId]?.[criterionId] ?? (rubric.scores[studentId]?.points[criterionId]?.toString() ?? '');

  async function save(studentId: string) {
    const scores = rubric.criteria
      .map((c) => ({ criterionId: c.id, raw: value(studentId, c.id) }))
      .filter((s) => s.raw !== '')
      .map((s) => ({ criterionId: s.criterionId, points: Number(s.raw) }));
    if (!scores.length) return;
    try {
      const result = await api<{ grade: number | null }>(`/api/gradebook/rubrics/${rubric.id}/scores`, { method: 'PUT', body: JSON.stringify({ studentId, scores }) });
      setStatus({ ...status, [studentId]: `✓ ${fmt(result.grade)}` });
      setDraft(({ [studentId]: _, ...rest }) => rest);
      await client.invalidateQueries({ queryKey: ['rubrics', courseId] });
      client.invalidateQueries({ queryKey: ['gradebook', courseId] });
    } catch (e) {
      setStatus({ ...status, [studentId]: errorText(e, 'Error') });
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar la rúbrica «${rubric.title}» y sus puntajes?`)) return;
    await api(`/api/gradebook/rubrics/${rubric.id}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['rubrics', courseId] });
    client.invalidateQueries({ queryKey: ['gradebook', courseId] });
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{rubric.title}</div>
          <div className="muted" style={{ fontSize: 13 }}>{rubric.maxPoints} puntos en total · la nota es 1 + 4 × (puntos / máximo)</div>
        </div>
        {!readOnly && <button className="btn sm ghost" onClick={remove}><Trash2 size={14} /></button>}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Estudiante</th>
              {rubric.criteria.map((c) => <th key={c.id} style={{ textAlign: 'center' }}>{c.name}<div style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>máx. {c.max_points}</div></th>)}
              <th style={{ textAlign: 'right' }}>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const score = rubric.scores[s.id];
              const dirty = Boolean(draft[s.id]);
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>{s.fullName}</td>
                  {rubric.criteria.map((c) => {
                    const v = value(s.id, c.id);
                    const over = v !== '' && Number(v) > c.max_points;
                    return (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <input
                          className={`score-input ${over ? 'over' : ''}`}
                          type="number"
                          min={0}
                          max={c.max_points}
                          value={v}
                          readOnly={readOnly}
                          onChange={(e) => setDraft({ ...draft, [s.id]: { ...draft[s.id], [c.id]: e.target.value } })}
                        />
                      </td>
                    );
                  })}
                  <td className={`grade-cell final ${score?.grade != null && score.grade < 3 ? 'low' : ''}`}>{fmt(score?.grade)}</td>
                  <td>
                    {dirty ? <button className="btn sm" onClick={() => save(s.id)}><Save size={13} /></button> : <span className="muted" style={{ fontSize: 12 }}>{status[s.id] ?? ''}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Alerts({ book, canTriage }: { book: Book; canTriage: boolean }) {
  const client = useQueryClient();
  const all = useQuery({ queryKey: ['alerts', book.course.id], queryFn: () => api<Alert[]>(`/api/gradebook/courses/${book.course.id}/alerts`) });
  const [showResolved, setShowResolved] = useState(false);
  const list = (all.data ?? book.alerts).filter((a) => showResolved || a.status !== 'resolved');

  async function update(id: string, status: 'acknowledged' | 'resolved') {
    await api(`/api/gradebook/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await client.invalidateQueries({ queryKey: ['alerts', book.course.id] });
    client.invalidateQueries({ queryKey: ['gradebook', book.course.id] });
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Alertas tempranas</div>
          <div className="muted" style={{ fontSize: 13 }}>Se recalculan al abrir el libro: nota menor a 3.0, 15 % o más de inasistencias, 3 o más eventos de integridad en 60 días o 14 días sin actividad. Se cierran solas cuando la causa desaparece.</div>
        </div>
        <label className="check" style={{ margin: 0, whiteSpace: 'nowrap' }}><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Ver resueltas</label>
      </div>
      {!list.length && <Empty icon={Check} title="Sin alertas" body="Ningún estudiante cumple hoy los criterios de riesgo." />}
      <div className="stack" style={{ gap: 8 }}>
        {list.map((a) => (
          <div key={a.id} className={`alert-row ${a.level}`}>
            <span className={`chip ${a.level === 'alta' ? 'coral' : 'gold'}`}>{a.level === 'alta' ? 'Alta' : 'Media'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{a.full_name} · {KIND[a.kind] ?? a.kind}</div>
              <div className="muted" style={{ fontSize: 13 }}>{a.detail} · desde {new Date(a.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</div>
            </div>
            {a.status === 'open' && (canTriage ? <button className="btn sm ghost" onClick={() => update(a.id, 'acknowledged')}>En seguimiento</button> : <span className="chip gold">Abierta</span>)}
            {a.status === 'acknowledged' && <span className="chip sky">En seguimiento</span>}
            {a.status === 'resolved' ? <span className="chip mint">Resuelta</span> : canTriage && <button className="btn sm" onClick={() => update(a.id, 'resolved')}><Check size={13} /> Resolver</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
