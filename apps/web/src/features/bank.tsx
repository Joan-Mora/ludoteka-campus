import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Library,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Empty, PageHeader, Sheet } from '@/ui';

interface Option { id: string; label: string; text: string; is_correct: boolean; position: number }
interface Question {
  id: string;
  code: string;
  subject_id: string;
  grade_id: string | null;
  prompt: string;
  difficulty: 'baja' | 'media' | 'alta';
  explanation: string;
  active: boolean;
  created_at: string;
  subject: string;
  grade: string | null;
  author: string | null;
  can_edit: boolean;
  uses: number;
  options: Option[];
}
interface Subject { id: string; name: string }
interface Course { id: string; title: string; subject_id: string; subject: string }

type Status = 'all' | 'active' | 'draft';

const DIFFICULTY: Record<Question['difficulty'], { label: string; tone: string }> = {
  baja: { label: 'Fácil', tone: 'mint' },
  media: { label: 'Media', tone: 'sky' },
  alta: { label: 'Difícil', tone: 'coral' },
};

const KINDS = [
  { key: 'practice', label: 'Práctica', body: 'Se puede repetir; al terminar cada estudiante ve la solución.' },
  { key: 'exam', label: 'Examen', body: 'Un solo intento, con tiempo límite y modo examen.' },
  { key: 'live', label: 'En vivo', body: 'La proyectas desde la Sala en vivo y el grupo responde a la vez.' },
] as const;

const errorText = (e: unknown, fallback: string) => (e instanceof ApiException ? e.message : fallback);

export function BankPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => api<Subject[]>('/api/institution/subjects') });
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<Course[]>('/api/courses') });
  const questions = useQuery({ queryKey: ['questions'], queryFn: () => api<Question[]>('/api/questions') });
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [building, setBuilding] = useState(false);
  const [notice, setNotice] = useState('');

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3200);
  }
  const refresh = () => client.invalidateQueries({ queryKey: ['questions'] });

  const all = questions.data ?? [];
  const inSubject = all.filter((q) => !subjectId || q.subject_id === subjectId);
  const counts = { all: inSubject.length, active: inSubject.filter((q) => q.active).length, draft: inSubject.filter((q) => !q.active).length };
  const list = inSubject
    .filter((q) => (status === 'all' ? true : status === 'active' ? q.active : !q.active))
    .filter((q) => !filter.trim() || `${q.prompt} ${q.code}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const pickedQuestions = picked.map((id) => all.find((q) => q.id === id)).filter((q): q is Question => Boolean(q));

  /** Subjects a teacher can ask drafts for: the ones they teach. Admin gets every subject. */
  const draftSubjects = useMemo(() => {
    if (user?.role === 'admin') return subjects.data ?? [];
    const mine = new Map((courses.data ?? []).map((c) => [c.subject_id, c.subject]));
    return [...mine].map(([id, name]) => ({ id, name }));
  }, [user?.role, subjects.data, courses.data]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="bank">
      <PageHeader
        eyebrow="Docencia"
        title="Banco de preguntas"
        subtitle="Preguntas de opción múltiple que reúsas en prácticas, exámenes, la Sala en vivo y la Arena."
        actions={
          <div className="row g-8 wrap">
            <button className="btn ghost" onClick={() => setDrafting(true)}><Wand2 size={16} /> Pedir borradores a la IA</button>
            <button className="btn" onClick={() => setEditing('new')}><Plus size={16} /> Nueva pregunta</button>
          </div>
        }
      />

      <ol className="bank-steps">
        <li>
          <b>Escribe o genera</b>
          <span>Crea una pregunta o pide borradores a la IA.</span>
          <em>{counts.all} en el banco</em>
        </li>
        <li className={counts.draft ? 'todo' : ''}>
          <b>Revisa los borradores</b>
          <span>Llegan apagados: edítalos y actívalos.</span>
          <button className="linkish" onClick={() => setStatus('draft')}>{counts.draft} por revisar</button>
        </li>
        <li className={picked.length ? 'todo' : ''}>
          <b>Arma la evaluación</b>
          <span>Marca preguntas activas y publícalas en un curso.</span>
          <em>{picked.length} marcadas</em>
        </li>
      </ol>

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bank-notice">
            <CheckCircle2 size={18} /> <b>{notice}</b>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bank-toolbar">
        <div className="seg-tabs" role="tablist" aria-label="Estado">
          {([['all', 'Todas'], ['active', 'Activas'], ['draft', 'Borradores']] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={status === key} className={status === key ? 'on' : ''} onClick={() => setStatus(key)}>
              {label} <span className="seg-count">{counts[key]}</span>
            </button>
          ))}
        </div>
        <select className="lib-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Materia">
          <option value="">Todas las materias</option>
          {(subjects.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="lib-search">
          <Search size={16} aria-hidden />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar en el enunciado o el código" aria-label="Buscar pregunta" />
        </label>
      </div>

      <div className="bank-list">
        {list.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            picked={picked.includes(q.id)}
            onPick={() => toggle(q.id)}
            onEdit={() => setEditing(q)}
            onChanged={(text, gone) => { if (gone) setPicked((prev) => prev.filter((id) => id !== q.id)); refresh(); flash(text); }}
          />
        ))}
        {questions.isLoading && <p className="muted"><Loader2 size={14} className="spin" /> Cargando el banco…</p>}
        {!questions.isLoading && !list.length && (
          <Empty
            icon={Library}
            title={status === 'draft' ? 'Sin borradores por revisar' : 'No hay preguntas con ese filtro'}
            body={status === 'draft' ? 'Pide borradores a la IA o escribe una pregunta nueva.' : 'Cambia la materia, el estado o la búsqueda.'}
          />
        )}
      </div>

      <AnimatePresence>
        {picked.length > 0 && (
          <motion.div className="bank-tray" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            <ClipboardCheck size={20} />
            <b>{picked.length} {picked.length === 1 ? 'pregunta marcada' : 'preguntas marcadas'}</b>
            <button className="btn sm ghost" onClick={() => setPicked([])}>Quitar marcas</button>
            <button className="btn sm" onClick={() => setBuilding(true)}>Armar evaluación</button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva pregunta' : 'Editar pregunta'}>
        {editing !== null && (
          <QuestionEditor
            question={editing === 'new' ? null : editing}
            subjects={subjects.data ?? []}
            defaultSubject={subjectId}
            onDone={(text) => { setEditing(null); refresh(); flash(text); }}
          />
        )}
      </Sheet>

      <Sheet open={drafting} onClose={() => setDrafting(false)} title="Pedir borradores a la IA">
        {drafting && (
          <DraftForm
            subjects={draftSubjects}
            defaultSubject={subjectId}
            onDone={(n) => { setDrafting(false); refresh(); setStatus('draft'); flash(`${n} ${n === 1 ? 'borrador listo' : 'borradores listos'} para revisar`); }}
          />
        )}
      </Sheet>

      <Sheet open={building} onClose={() => setBuilding(false)} title="Armar evaluación">
        {building && (
          <AssessmentForm
            courses={courses.data ?? []}
            questions={pickedQuestions}
            onRemove={(id) => setPicked((prev) => prev.filter((x) => x !== id))}
            onDone={(title) => { setBuilding(false); setPicked([]); flash(`«${title}» quedó publicada en el curso`); }}
          />
        )}
      </Sheet>
    </div>
  );
}

function QuestionCard({ question: q, picked, onPick, onEdit, onChanged }: {
  question: Question; picked: boolean; onPick: () => void; onEdit: () => void; onChanged: (text: string, gone: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const difficulty = DIFFICULTY[q.difficulty] ?? DIFFICULTY.media;

  async function run(work: () => Promise<[string, boolean]>) {
    setBusy(true);
    setError('');
    try {
      onChanged(...(await work()));
    } catch (e) {
      setError(errorText(e, 'No se pudo completar'));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }
  const setActive = (active: boolean) => run(async () => {
    await api(`/api/questions/${q.id}/active`, { method: 'POST', body: JSON.stringify({ active }) });
    return [active ? 'Pregunta activada: ya puedes marcarla para una evaluación' : 'Pregunta apagada: ya no entra en evaluaciones nuevas', !active];
  });
  const remove = () => run(async () => {
    const result = await api<{ archived: boolean }>(`/api/questions/${q.id}`, { method: 'DELETE' });
    return [result.archived ? 'Pregunta retirada del banco; las evaluaciones que ya la usan siguen igual' : 'Pregunta eliminada', true];
  });

  return (
    <article className={`bank-q ${picked ? 'picked' : ''} ${q.active ? '' : 'draft'}`}>
      <label className="bank-pick" title={q.active ? 'Marcar para la evaluación' : 'Actívala para poder usarla en una evaluación'}>
        <input type="checkbox" checked={picked} disabled={!q.active} onChange={onPick} aria-label="Usar en la evaluación" />
      </label>
      <div className="bank-q-body">
        <div className="row g-6 wrap bank-q-tags">
          {!q.active && <span className="chip gold">Borrador</span>}
          <span className="chip violet">{q.subject}</span>
          {q.grade && <span className="chip">{q.grade}</span>}
          <span className={`chip ${difficulty.tone}`}>{difficulty.label}</span>
          {q.uses > 0 && <span className="chip soft">En {q.uses} {q.uses === 1 ? 'evaluación' : 'evaluaciones'}</span>}
        </div>
        <p className="bank-q-prompt">{q.prompt}</p>
        <button className="linkish row g-4" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} /> {open ? 'Ocultar opciones' : `Ver las ${q.options.length} opciones`}
        </button>
        {open && (
          <div className="bank-q-options">
            {q.options.map((o) => (
              <div key={o.id} className={o.is_correct ? 'ok' : ''}>
                <b>{o.label}</b> <span>{o.text}</span> {o.is_correct && <CheckCircle2 size={14} aria-label="Correcta" />}
              </div>
            ))}
            {q.explanation && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{q.explanation}</p>}
          </div>
        )}
        <div className="bank-q-foot">
          <span className="muted">{q.code}{q.author ? ` · ${q.author}` : ''}</span>
          {q.can_edit ? (
            confirming ? (
              <span className="row g-6 bank-confirm">
                {q.uses > 0 ? 'Se retirará del banco; las evaluaciones que la usan no cambian.' : '¿Eliminarla para siempre?'}
                <button className="btn sm ghost danger" disabled={busy} onClick={remove}>{busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Eliminar</button>
                <button className="btn sm ghost" onClick={() => setConfirming(false)}>Cancelar</button>
              </span>
            ) : (
              <span className="row g-6">
                {q.active
                  ? <button className="btn sm ghost" disabled={busy} onClick={() => setActive(false)} title="Deja de aparecer para evaluaciones nuevas"><Power size={14} /> Apagar</button>
                  : <button className="btn sm" disabled={busy} onClick={() => setActive(true)}><CheckCircle2 size={14} /> Activar</button>}
                <button className="btn sm ghost" onClick={onEdit}><Pencil size={14} /> Editar</button>
                <button className="btn sm ghost" onClick={() => setConfirming(true)} aria-label="Eliminar"><Trash2 size={14} /></button>
              </span>
            )
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>Solo lectura: es de otra materia</span>
          )}
        </div>
        {error && <p className="form-error" style={{ margin: '8px 0 0' }}>{error}</p>}
      </div>
    </article>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function QuestionEditor({ question, subjects, defaultSubject, onDone }: { question: Question | null; subjects: Subject[]; defaultSubject: string; onDone: (text: string) => void }) {
  const [subjectId, setSubjectId] = useState(question?.subject_id ?? defaultSubject);
  const [difficulty, setDifficulty] = useState<Question['difficulty']>(question?.difficulty ?? 'media');
  const [prompt, setPrompt] = useState(question?.prompt ?? '');
  const [options, setOptions] = useState<string[]>(question?.options.map((o) => o.text) ?? ['', '', '', '']);
  const [correct, setCorrect] = useState(Math.max(0, question?.options.findIndex((o) => o.is_correct) ?? 0));
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!subjectId) return setError('Elige la materia');
    if (options.some((o) => !o.trim())) return setError('Completa todas las opciones o quita las que sobran');
    setBusy(true);
    setError('');
    try {
      const body = JSON.stringify({
        subjectId,
        ...(question?.grade_id ? { gradeId: question.grade_id } : {}),
        prompt,
        difficulty,
        explanation,
        options: options.map((text, i) => ({ label: LETTERS[i], text, correct: i === correct })),
      });
      if (question) await api(`/api/questions/${question.id}`, { method: 'PUT', body });
      else await api('/api/questions', { method: 'POST', body });
      onDone(question ? 'Cambios guardados' : 'Pregunta guardada y activa');
    } catch (e) {
      setError(errorText(e, 'No se pudo guardar'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="bank-editor">
      {question && question.uses > 0 && (
        <p className="hint" style={{ marginTop: 0 }}>Está en {question.uses} {question.uses === 1 ? 'evaluación' : 'evaluaciones'}: los cambios se ven allí también, pero las notas ya puestas no se recalculan.</p>
      )}
      <div className="grid cols-2" style={{ gap: 12 }}>
        <label className="field">Materia
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            <option value="">Elige</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="field">Dificultad
          <div className="seg-tabs mini" role="radiogroup" aria-label="Dificultad" style={{ margin: 0 }}>
            {(Object.keys(DIFFICULTY) as Question['difficulty'][]).map((d) => (
              <button type="button" key={d} role="radio" aria-checked={difficulty === d} className={difficulty === d ? 'on' : ''} onClick={() => setDifficulty(d)}>{DIFFICULTY[d].label}</button>
            ))}
          </div>
        </div>
      </div>
      <label className="field">Enunciado
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} required minLength={4} maxLength={1000} placeholder="¿Cuál es la fracción equivalente a 2/4?" />
      </label>
      <div className="field" style={{ marginBottom: 6 }}>Opciones <span className="muted" style={{ fontWeight: 500 }}>Toca el círculo de la respuesta correcta.</span></div>
      <div className="stack" style={{ gap: 8 }}>
        {options.map((text, i) => (
          <div key={i} className={`bank-opt ${correct === i ? 'ok' : ''}`}>
            <label className="bank-opt-radio" title="Respuesta correcta">
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`La opción ${LETTERS[i]} es la correcta`} />
              <b>{LETTERS[i]}</b>
            </label>
            <input value={text} onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))} placeholder={`Opción ${LETTERS[i]}`} maxLength={300} aria-label={`Opción ${LETTERS[i]}`} />
            {options.length > 2 && (
              <button type="button" className="icon-btn sm" aria-label={`Quitar la opción ${LETTERS[i]}`} onClick={() => {
                setOptions(options.filter((_, j) => j !== i));
                setCorrect(correct === i ? 0 : correct > i ? correct - 1 : correct);
              }}><X size={15} /></button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setOptions([...options, ''])}><Plus size={14} /> Añadir opción</button>}
      <label className="field" style={{ marginTop: 14 }}>Explicación <span className="muted" style={{ fontWeight: 500 }}>Opcional. El estudiante la ve después de responder.</span>
        <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} maxLength={1000} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} {question ? 'Guardar cambios' : 'Guardar pregunta'}</button>
    </form>
  );
}

function DraftForm({ subjects, defaultSubject, onDone }: { subjects: Subject[]; defaultSubject: string; onDone: (count: number) => void }) {
  const [subjectId, setSubjectId] = useState(subjects.some((s) => s.id === defaultSubject) ? defaultSubject : subjects[0]?.id ?? '');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ questions: unknown[] }>('/api/tutor/drafts', { method: 'POST', body: JSON.stringify({ subjectId, topic, count }) });
      onDone(result.questions.length);
    } catch (e) {
      setError(errorText(e, 'No se pudieron generar los borradores'));
    } finally {
      setBusy(false);
    }
  }

  if (!subjects.length) return <Empty icon={Wand2} title="Sin materias a cargo" body="Los borradores se piden para las materias que dictas." />;
  return (
    <form onSubmit={submit}>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>La IA propone preguntas con cuatro opciones. Llegan como borradores apagados: nadie las ve hasta que las revisas y las activas.</p>
      <label className="field">Materia
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="field">Tema<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Fracciones equivalentes" required minLength={2} maxLength={200} /></label>
      <div className="field">Cuántas
        <div className="seg-tabs mini" role="radiogroup" aria-label="Cantidad" style={{ margin: 0 }}>
          {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={count === n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>)}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !topic.trim()} style={{ width: '100%' }}>{busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {busy ? 'Redactando…' : 'Pedir borradores'}</button>
    </form>
  );
}

function AssessmentForm({ courses, questions, onRemove, onDone }: { courses: Course[]; questions: Question[]; onRemove: (id: string) => void; onDone: (title: string) => void }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['key']>('practice');
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/assessments', {
        method: 'POST',
        body: JSON.stringify({ courseId, title, kind, timeLimitSec: minutes * 60, questionIds: questions.map((q) => q.id) }),
      });
      onDone(title);
    } catch (e) {
      setError(errorText(e, 'No se pudo publicar la evaluación'));
    } finally {
      setBusy(false);
    }
  }

  if (!courses.length) return <Empty icon={ClipboardCheck} title="Sin cursos a cargo" body="Las evaluaciones se publican en un curso que dictes." />;
  return (
    <form onSubmit={submit}>
      <label className="field">Curso
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <label className="field">Título<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz de fracciones" required minLength={3} maxLength={120} /></label>
      <div className="field">Tipo</div>
      <div className="bank-kinds" role="radiogroup" aria-label="Tipo de evaluación">
        {KINDS.map((k) => (
          <button type="button" key={k.key} role="radio" aria-checked={kind === k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
            <b>{k.label}</b><span>{k.body}</span>
          </button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 14 }}>Tiempo límite
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutos</option>)}
        </select>
      </label>
      <div className="field" style={{ marginBottom: 6 }}>Preguntas ({questions.length})</div>
      <ol className="bank-picked">
        {questions.map((q) => (
          <li key={q.id}>
            <span>{q.prompt}</span>
            <button type="button" className="icon-btn sm" aria-label="Quitar de la evaluación" onClick={() => onRemove(q.id)}><X size={14} /></button>
          </li>
        ))}
      </ol>
      {error && <p className="form-error">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !questions.length || !title.trim()} style={{ width: '100%', marginTop: 12 }}>
        {busy ? <Loader2 size={16} className="spin" /> : <ClipboardCheck size={16} />} Publicar en el curso
      </button>
    </form>
  );
}
