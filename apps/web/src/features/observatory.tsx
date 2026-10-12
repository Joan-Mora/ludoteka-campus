import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookMarked, Database, Download, Grid3x3, History, Loader2, Lock, Search, ShieldCheck, Sparkles, TableProperties } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { MicButton } from '@/shared/voice-ui';
import { Empty, PageHeader, Reveal } from '@/ui';
import { METHOD_INFO, type LearningMethod } from '@eduquest/contracts';
import { MethodChip } from './learning-kit';

interface ViewDoc { name: string; description: string; columns: [string, string][] }
interface Schema { views: ViewDoc[]; examples: string[]; maxRows: number; timeoutMs: number; aiEnabled: boolean }
interface Answer {
  question: string;
  sql: string;
  executed: string;
  scoped: boolean;
  explanation: string;
  chart: string;
  source: string;
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  ms: number;
}
interface HistoryRow { id: string; question: string; sql_text: string | null; status: string; reason: string | null; row_count: number; duration_ms: number | null; created_at: string }
interface CourseCard { id: string; title: string; group_name: string }
interface Mastery {
  course: { id: string; title: string };
  topics: { id: string; name: string; code: string }[];
  students: { id: string; name: string; levels: Record<string, number>; average: number | null }[];
  topicAverages: { topicId: string; average: number | null }[];
}

const STATUS: Record<string, { label: string; tone: string }> = {
  ok: { label: 'Respondida', tone: 'mint' },
  rejected: { label: 'Rechazada', tone: 'coral' },
  error: { label: 'Error', tone: 'coral' },
  no_model: { label: 'Sin IA', tone: 'gold' },
};

const format = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  return String(value);
};

function toCsv(answer: Answer) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [answer.columns.map(escape).join(';'), ...answer.rows.map((r) => answer.columns.map((c) => escape(r[c])).join(';'))].join('\n');
}

export function ObservatoryPage() {
  const [tab, setTab] = useState<'ask' | 'mastery' | 'views'>('ask');
  const schema = useQuery({ queryKey: ['observatory-schema'], queryFn: () => api<Schema>('/api/observatory/schema') });
  return (
    <div>
      <PageHeader eyebrow="Observatorio" title="Pregúntale a los datos" subtitle="Escribe o dicta una pregunta. La IA la convierte en SQL, el servidor la valida y CockroachDB la ejecuta en modo solo lectura." />
      <div className="row g-8" style={{ marginBottom: 18, padding: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'fit-content', flexWrap: 'wrap' }}>
        {([
          ['ask', 'Preguntar', Search],
          ['mastery', 'Maestría por tema', Grid3x3],
          ['views', 'Diccionario de vistas', BookMarked],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} className={`btn sm ${tab === key ? '' : 'ghost'}`} style={tab === key ? undefined : { border: 0 }} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
        ))}
      </div>
      {tab === 'ask' && <AskData schema={schema.data} />}
      {tab === 'mastery' && <MasteryMap />}
      {tab === 'views' && <ViewsDictionary views={schema.data?.views ?? []} />}
    </div>
  );
}

function AskData({ schema }: { schema?: Schema }) {
  const client = useQueryClient();
  const history = useQuery({ queryKey: ['observatory-history'], queryFn: () => api<HistoryRow[]>('/api/observatory/history') });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const numeric = useMemo(
    () => new Set((answer?.columns ?? []).filter((c) => answer!.rows.some((r) => r[c] != null) && answer!.rows.every((r) => r[c] == null || typeof r[c] === 'number' || (typeof r[c] === 'string' && /^-?\d+([.,]\d+)?%?$/.test(r[c] as string))))),
    [answer],
  );
  const [failure, setFailure] = useState<{ message: string; sql?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showExecuted, setShowExecuted] = useState(false);

  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 5) return;
    setQuestion(q);
    setBusy(true);
    setFailure(null);
    setAnswer(null);
    try {
      setAnswer(await api<Answer>('/api/observatory/ask', { method: 'POST', body: JSON.stringify({ question: q }) }));
    } catch (e) {
      const sql = e instanceof ApiException && typeof e.details?.sql === 'string' ? e.details.sql : undefined;
      setFailure({ message: e instanceof Error ? e.message : 'No se pudo responder', sql });
    } finally {
      setBusy(false);
      client.invalidateQueries({ queryKey: ['observatory-history'] });
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function exportCsv() {
    if (!answer) return;
    const blob = new Blob([`\uFEFF${toCsv(answer)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'observatorio-ludoteka.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const numericColumns = answer ? answer.columns.filter((c) => answer.rows.length && answer.rows.every((r) => r[c] === null || typeof r[c] === 'number')) : [];
  const labelColumn = answer?.columns.find((c) => !numericColumns.includes(c));
  const chartable = Boolean(answer && labelColumn && numericColumns.length && answer.rows.length > 1 && answer.rows.length <= 30 && answer.chart !== 'ninguno');

  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="span-2 stack" style={{ gap: 16 }}>
        <form className="card" onSubmit={submit}>
          <div className="row g-8">
            <div className="lib-search">
              <Sparkles size={17} />
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="¿Qué temas tienen la maestría más baja?" maxLength={400} />
            </div>
            <MicButton onText={(text) => setQuestion(text)} />
            <button className="btn" type="submit" disabled={busy || question.trim().length < 5}>{busy ? <Loader2 size={16} className="spin" /> : 'Consultar'}</button>
          </div>
          <div className="row g-8 wrap" style={{ marginTop: 12 }}>
            {schema?.examples.map((example) => <button key={example} type="button" className="chip" onClick={() => ask(example)}>{example}</button>)}
          </div>
          {schema && !schema.aiEnabled && <p className="form-error" style={{ marginTop: 10 }}>El modelo de IA no está configurado; solo funcionan las preguntas de ejemplo.</p>}
        </form>

        {busy && <div className="card row g-8 muted"><Loader2 size={16} className="spin" /> Generando SQL, validando y ejecutando en CockroachDB…</div>}

        {failure && (
          <div className="card" style={{ borderColor: 'var(--coral)' }}>
            <b style={{ color: 'var(--coral)' }}>{failure.message}</b>
            {failure.sql && <pre className="sql">{failure.sql}</pre>}
          </div>
        )}

        {answer && (
          <Reveal>
            <div className="card stack" style={{ gap: 12 }}>
              <div className="row g-8 wrap">
                <span className={`chip ${answer.source === 'ia' ? 'sky' : 'gold'}`}>{answer.source === 'ia' ? <><Sparkles size={12} /> SQL generado por IA</> : 'Consulta de ejemplo'}</span>
                <span className="chip mint"><ShieldCheck size={12} /> Validado · solo lectura</span>
                {answer.scoped && <span className="chip violet"><Lock size={12} /> Limitado a tus grupos</span>}
                <span className="chip">{answer.rows.length}{answer.truncated ? '+' : ''} filas · {answer.ms} ms</span>
                <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={exportCsv}><Download size={14} /> CSV</button>
              </div>
              {answer.explanation && <p style={{ margin: 0 }}>{answer.explanation}</p>}
              <pre className="sql">{showExecuted ? answer.executed : answer.sql}</pre>
              {answer.scoped && (
                <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowExecuted(!showExecuted)}>
                  {showExecuted ? 'Ver SQL generado' : 'Ver SQL ejecutado (con el filtro de grupos)'}
                </button>
              )}
              {chartable && labelColumn && (
                <div className="bars">
                  {(() => {
                    const column = numericColumns[0]!;
                    const max = Math.max(...answer.rows.map((r) => Number(r[column] ?? 0)), 1);
                    return answer.rows.map((row, i) => (
                      <div key={i} className="bar-row">
                        <span className="bar-label" title={String(row[labelColumn])}>{format(row[labelColumn])}</span>
                        <div className="bar-track"><motion.div className="bar-fill" initial={{ width: 0 }} animate={{ width: `${(Number(row[column] ?? 0) / max) * 100}%` }} transition={{ delay: i * 0.03 }} /></div>
                        <b className="bar-value">{format(row[column])}</b>
                      </div>
                    ));
                  })()}
                </div>
              )}
              {answer.rows.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>{answer.columns.map((c) => <th key={c} className={numeric.has(c) ? 'num' : undefined}>{c}</th>)}</tr></thead>
                    <tbody>{answer.rows.map((row, i) => <tr key={i}>{answer.columns.map((c) => <td key={c} className={numeric.has(c) ? 'num' : undefined}>{format(row[c])}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : (
                <Empty icon={TableProperties} title="Sin filas" body="La consulta se ejecutó pero no encontró datos." />
              )}
            </div>
          </Reveal>
        )}
      </div>

      <div className="card">
        <h3 className="row g-8" style={{ marginTop: 0 }}><History size={18} /> Mis consultas</h3>
        <div className="stack" style={{ gap: 6 }}>
          {history.data?.map((h) => (
            <button key={h.id} className="history-row" onClick={() => ask(h.question)} title={h.reason ?? h.sql_text ?? ''}>
              <span className={`chip ${STATUS[h.status]?.tone ?? ''}`}>{STATUS[h.status]?.label ?? h.status}</span>
              <span className="history-q">{h.question}</span>
            </button>
          ))}
          {!history.data?.length && <p className="muted" style={{ fontSize: 13 }}>Aquí quedan tus preguntas, también las rechazadas, con el motivo.</p>}
        </div>
      </div>
    </div>
  );
}

function MasteryMap() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<CourseCard[]>('/api/courses') });
  const [courseId, setCourseId] = useState('');
  const selected = courseId || courses.data?.[0]?.id || '';
  const mastery = useQuery({ queryKey: ['mastery', selected], queryFn: () => api<Mastery>(`/api/courses/${selected}/mastery`), enabled: Boolean(selected) });
  const data = mastery.data;
  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="row g-8 wrap">
        <h3 style={{ margin: 0 }}>Mapa de maestría</h3>
        <select className="lib-select" style={{ marginLeft: 'auto' }} value={selected} onChange={(e) => setCourseId(e.target.value)}>
          {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.group_name}</option>)}
        </select>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Nivel de 1 a 10 por estudiante y tema. Sube con dos aciertos seguidos en Mi ruta o con 80 % en una evaluación.</p>
      {data && (
        <div className="table-wrap">
          <table className="table heat">
            <thead>
              <tr><th>Estudiante</th>{data.topics.map((t) => <th key={t.id} title={t.name} className="num"><span className="heat-head">{t.name}</span></th>)}<th className="num">Promedio</th></tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  {data.topics.map((t) => {
                    const level = s.levels[t.id];
                    return <td key={t.id} className="heat-cell" style={level ? { background: `hsl(${(level - 1) * 13} 75% ${92 - level * 2}%)` } : undefined}>{level ?? '·'}</td>;
                  })}
                  <td className="num"><b>{s.average ?? '—'}</b></td>
                </tr>
              ))}
              <tr>
                <td className="muted">Promedio del grupo</td>
                {data.topicAverages.map((t) => <td key={t.topicId} className="heat-cell"><b>{t.average ?? '—'}</b></td>)}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {data && !data.students.length && <Empty icon={Grid3x3} title="Sin estudiantes" body="Este curso todavía no tiene estudiantes matriculados." />}
      {selected && <MethodDistribution courseId={selected} />}
    </div>
  );
}

interface Distribution {
  total: number;
  pending: number;
  methods: { method: LearningMethod; label: string; students: number; secondary: number; attempts: number; rate: number | null }[];
  students: { id: string; name: string; method: LearningMethod | null; secondary: LearningMethod | null }[];
}

function MethodDistribution({ courseId }: { courseId: string }) {
  const dist = useQuery({ queryKey: ['method-distribution', courseId], queryFn: () => api<Distribution>(`/api/profile/courses/${courseId}/distribution`) });
  const [open, setOpen] = useState<LearningMethod | null>(null);
  const d = dist.data;
  if (!d) return null;
  const answered = d.total - d.pending;
  const max = Math.max(1, ...d.methods.map((m) => m.students));
  return (
    <div className="method-dist">
      <div className="row g-8 wrap">
        <h3 style={{ margin: 0 }}>Cómo aprende el grupo</h3>
        <span className="chip soft" style={{ marginLeft: 'auto' }}>{answered} de {d.total} respondieron «Descubre cómo aprendes»</span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Método principal de cada estudiante y qué tanto aciertan en Mi ruta los retos presentados en cada formato (últimos 60 días).</p>
      <div className="dist-rows">
        {d.methods.map((m) => (
          <button key={m.method} className={`dist-row ${open === m.method ? 'on' : ''}`} onClick={() => setOpen(open === m.method ? null : m.method)} disabled={!m.students}>
            <span className="dist-name"><MethodChip method={m.method} /></span>
            <span className="dist-track"><i style={{ width: `${(m.students / max) * 100}%` }} /></span>
            <b className="dist-n">{m.students}</b>
            <span className="muted dist-rate">{m.rate === null ? 'sin retos' : `${Math.round(m.rate * 100)} % de acierto (${m.attempts})`}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="row g-6 wrap">
          {d.students.filter((s) => s.method === open).map((s) => <span key={s.id} className="chip">{s.name}{s.secondary ? ` · también ${METHOD_INFO[s.secondary].label.toLowerCase()}` : ''}</span>)}
        </div>
      )}
    </div>
  );
}

function ViewsDictionary({ views }: { views: ViewDoc[] }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card row g-12">
        <Database size={20} color="var(--violet)" />
        <p style={{ margin: 0, fontSize: 14 }}>
          La IA solo conoce estas vistas. El servidor rechaza cualquier otra tabla, esquema o sentencia que no sea SELECT, y CockroachDB ejecuta con el rol <code>ludoteka_reader</code>, que solo tiene permiso de lectura sobre ellas.
        </p>
      </div>
      <div className="lib-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {views.map((view) => (
          <div key={view.name} className="card">
            <code style={{ fontWeight: 800, color: 'var(--violet)' }}>{view.name}</code>
            <p className="muted" style={{ margin: '4px 0 10px', fontSize: 13 }}>{view.description}</p>
            <div className="stack" style={{ gap: 3 }}>
              {view.columns.map(([column, type]) => (
                <div key={column} className="row between" style={{ fontSize: 12.5 }}><code>{column}</code><span className="muted">{type}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
