import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenCheck, Brain, Check, Flag, Layers, Loader2, NotebookPen, Plus, RotateCcw, Save, Sparkles, Target, Timer, Trash2, X } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { useCompanion } from '@/shared/companion';
import { Bar, Empty, PageHeader, Reveal, Ring, Stat } from '@/ui';

interface PageRow { id: string; title: string; course_id: string | null; course_title: string | null; updated_at: string; summarized: boolean; snippet: string; cards: number }
interface Goal { id: string; kind: string; period: string; target: number; progress: number; done: boolean }
interface Focus { running: { id: string; planned_min: number; started_at: string } | null; minutesToday: number; serverNow: number }
interface Overview { pages: PageRow[]; cards: { due: number; total: number; reviewedToday: number }; goals: Goal[]; focus: Focus }
interface Card { id: string; front: string; back: string; source: string; due_at: string; interval_days: number; repetitions: number; page_title?: string | null }
interface PageDetail {
  id: string; title: string; body: string; course_id: string | null; summary: string | null; summary_source: string | null;
  key_points: { ideas?: string[]; cards?: { front: string; back: string }[] } | null; cards: Card[];
}

const GOAL_LABEL: Record<string, string> = { flashcards: 'Tarjetas repasadas', focus_minutes: 'Minutos de enfoque', lessons: 'Lecciones completadas', route: 'Retos de mi ruta' };
const GRADES = [
  { grade: 1, label: 'Otra vez', hint: 'mañana', tone: 'coral' },
  { grade: 3, label: 'Difícil', hint: 'pronto', tone: 'gold' },
  { grade: 4, label: 'Bien', hint: 'más días', tone: 'sky' },
  { grade: 5, label: 'Fácil', hint: 'mucho después', tone: 'mint' },
] as const;

const errorText = (e: unknown, fallback: string) => (e instanceof ApiException ? e.message : fallback);

export function StudyPage() {
  const companion = useCompanion();
  const overview = useQuery({ queryKey: ['study'], queryFn: () => api<Overview>('/api/study') });
  const [tab, setTab] = useState<'notes' | 'review'>('notes');
  const data = overview.data;
  return (
    <div>
      <PageHeader eyebrow="Cuaderno" title="Tu cuaderno de estudio" subtitle={`Escribe o dicta tus apuntes, pídele a ${companion.name} un resumen y repasa con tarjetas que vuelven justo cuando las vas a olvidar.`} />
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Stat icon={Layers} tone="violet" value={data?.cards.due ?? '—'} label="Tarjetas para hoy" />
        <Stat icon={BookOpenCheck} tone="mint" value={data?.cards.reviewedToday ?? '—'} label="Repasadas hoy" />
        <Stat icon={Timer} tone="gold" value={data ? `${data.focus.minutesToday} min` : '—'} label="Enfoque hoy" />
      </div>
      <div className="row g-8" style={{ marginBottom: 18, padding: 6, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, width: 'fit-content' }}>
        {([['notes', 'Apuntes', NotebookPen], ['review', `Repasar${data?.cards.due ? ` (${data.cards.due})` : ''}`, Brain]] as const).map(([key, label, Icon]) => (
          <button key={key} className={`btn sm ${tab === key ? '' : 'ghost'}`} style={tab === key ? undefined : { border: 0 }} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
        ))}
      </div>
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2">{tab === 'notes' ? <Notes pages={data?.pages ?? []} /> : <Review />}</div>
        <div className="stack" style={{ gap: 16 }}>
          <FocusTimer focus={data?.focus} />
          <Goals goals={data?.goals ?? []} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Apuntes ---------- */

function Notes({ pages }: { pages: PageRow[] }) {
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const current = selected ?? pages[0]?.id ?? 'new';
  return (
    <div className="notebook">
      <div className="notebook-list">
        <button className="btn sm" style={{ width: '100%' }} onClick={() => setSelected('new')}><Plus size={15} /> Nuevo apunte</button>
        {pages.map((page) => (
          <button key={page.id} className={`note-row ${current === page.id ? 'active' : ''}`} onClick={() => setSelected(page.id)}>
            <b>{page.title}</b>
            <span className="note-snippet">{page.snippet || 'Sin contenido'}</span>
            <span className="row g-4" style={{ marginTop: 4 }}>
              {page.summarized && <span className="chip violet" style={{ padding: '2px 7px', fontSize: 11 }}><Sparkles size={10} /> Resumen</span>}
              {page.cards > 0 && <span className="chip" style={{ padding: '2px 7px', fontSize: 11 }}>{page.cards} tarjetas</span>}
            </span>
          </button>
        ))}
      </div>
      <Editor key={current} pageId={current === 'new' ? null : current} onSaved={setSelected} />
    </div>
  );
}

function Editor({ pageId, onSaved }: { pageId: string | null; onSaved: (id: string | null) => void }) {
  const companion = useCompanion();
  const client = useQueryClient();
  const page = useQuery({ queryKey: ['study-page', pageId], queryFn: () => api<PageDetail>(`/api/study/pages/${pageId}`), enabled: Boolean(pageId) });
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState<'save' | 'summary' | 'cards' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (page.data && !loaded.current) {
      loaded.current = true;
      setTitle(page.data.title);
      setBody(page.data.body);
      setCourseId(page.data.course_id ?? '');
    }
  }, [page.data]);

  const dirty = !pageId || !page.data || title !== page.data.title || body !== page.data.body || courseId !== (page.data.course_id ?? '');

  async function save(): Promise<string | null> {
    if (!title.trim()) {
      setError('Ponle un título al apunte');
      return null;
    }
    setBusy('save');
    setError(null);
    try {
      const payload = JSON.stringify({ title, body, courseId: courseId || null });
      let id = pageId;
      if (id) await api(`/api/study/pages/${id}`, { method: 'PUT', body: payload });
      else id = (await api<{ id: string }>('/api/study/pages', { method: 'POST', body: payload })).id;
      await client.invalidateQueries({ queryKey: ['study'] });
      await client.invalidateQueries({ queryKey: ['study-page', id] });
      loaded.current = false;
      return id;
    } catch (e) {
      setError(errorText(e, 'No se pudo guardar'));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveAndSelect() {
    const id = await save();
    if (id && id !== pageId) onSaved(id);
  }

  async function summarize() {
    const id = dirty ? await save() : pageId;
    if (!id) return;
    setBusy('summary');
    setError(null);
    try {
      const result = await api<{ source: string }>(`/api/study/pages/${id}/summary`, { method: 'POST' });
      setNotice(result.source === 'ia' ? `${companion.name} resumió tu apunte.` : 'La IA no respondió; hice un resumen automático con tus propias frases.');
      await client.invalidateQueries({ queryKey: ['study-page', id] });
      await client.invalidateQueries({ queryKey: ['study'] });
      if (id !== pageId) onSaved(id);
    } catch (e) {
      setError(errorText(e, 'No se pudo resumir'));
    } finally {
      setBusy(null);
    }
  }

  async function makeCards() {
    setBusy('cards');
    try {
      const result = await api<{ created: number }>(`/api/study/pages/${pageId}/cards`, { method: 'POST' });
      setNotice(result.created ? `Se crearon ${result.created} tarjetas. Ya las puedes repasar.` : 'Esas tarjetas ya estaban creadas.');
      await client.invalidateQueries({ queryKey: ['study-page', pageId] });
      await client.invalidateQueries({ queryKey: ['study'] });
    } catch (e) {
      setError(errorText(e, 'No se pudieron crear las tarjetas'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!pageId || !confirm('¿Eliminar este apunte? Sus tarjetas se conservan.')) return;
    await api(`/api/study/pages/${pageId}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['study'] });
    onSaved(null);
  }

  if (pageId && page.isLoading) return <div className="card"><Loader2 className="spin" /></div>;
  const detail = page.data;
  const suggested = detail?.key_points?.cards ?? [];
  return (
    <div className="stack" style={{ gap: 14, minWidth: 0 }}>
      <div className="card">
        <input className="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del apunte" maxLength={160} />
        <div className="row g-8 wrap" style={{ margin: '8px 0 10px' }}>
          <select className="note-select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Sin curso</option>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <span style={{ marginLeft: 'auto' }} className="row g-8">
            <MicButton label="Dictar" continuous onText={(text) => setBody((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${text}` : prev + text))} />
            {body && <SpeakButton text={body.slice(0, 1500)} label="Leer" />}
          </span>
        </div>
        <textarea className="note-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Escribe tus apuntes…\n\nTip: las líneas «término: definición» se vuelven tarjetas aunque la IA no esté disponible.'} maxLength={20000} />
        {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
        <div className="row g-8 wrap" style={{ marginTop: 10 }}>
          <button className="btn" onClick={saveAndSelect} disabled={busy !== null || !dirty}>{busy === 'save' ? <Loader2 size={16} className="spin" /> : <Save size={16} />} {dirty ? 'Guardar' : 'Guardado'}</button>
          <button className="btn ghost" onClick={summarize} disabled={busy !== null || body.trim().length < 60} title={body.trim().length < 60 ? 'Escribe al menos 60 caracteres' : undefined}>
            {busy === 'summary' ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Resumir con {companion.name}
          </button>
          <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{body.length.toLocaleString('es-CO')} / 20.000</span>
          {pageId && <button className="btn sm ghost" onClick={remove} title="Eliminar"><Trash2 size={15} /></button>}
        </div>
      </div>
      {notice && <p className="chip mint" style={{ width: 'fit-content' }}>{notice}</p>}
      {detail?.summary && (
        <Reveal>
          <div className="card summary-card">
            <div className="row between g-8">
              <h3 style={{ margin: 0 }}><Sparkles size={17} /> Resumen</h3>
              <span className="row g-8">
                <span className={`chip ${detail.summary_source === 'ia' ? 'violet' : ''}`}>{detail.summary_source === 'ia' ? 'Hecho por IA' : 'Automático'}</span>
                <SpeakButton text={detail.summary} />
              </span>
            </div>
            <p style={{ lineHeight: 1.6 }}>{detail.summary}</p>
            {!!detail.key_points?.ideas?.length && (
              <ul className="idea-list">{detail.key_points.ideas.map((idea, i) => <li key={i}>{idea}</li>)}</ul>
            )}
            {suggested.length > 0 && (
              <>
                <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Tarjetas sugeridas</div>
                <div className="grid cols-2" style={{ gap: 8 }}>
                  {suggested.map((card, i) => (
                    <div key={i} className="mini-card"><b>{card.front}</b><span>{card.back}</span></div>
                  ))}
                </div>
                <button className="btn sm" style={{ marginTop: 12 }} onClick={makeCards} disabled={busy !== null}>{busy === 'cards' ? <Loader2 size={14} className="spin" /> : <Layers size={14} />} Crear estas tarjetas</button>
              </>
            )}
          </div>
        </Reveal>
      )}
      {pageId && <CardList pageId={pageId} cards={detail?.cards ?? []} />}
    </div>
  );
}

function CardList({ pageId, cards }: { pageId: string; cards: Card[] }) {
  const companion = useCompanion();
  const client = useQueryClient();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/study/cards', { method: 'POST', body: JSON.stringify({ front, back, pageId }) });
      setFront('');
      setBack('');
      await client.invalidateQueries({ queryKey: ['study-page', pageId] });
      await client.invalidateQueries({ queryKey: ['study'] });
    } catch (e) {
      setError(errorText(e, 'No se pudo crear la tarjeta'));
    }
  }

  async function remove(id: string) {
    await api(`/api/study/cards/${id}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['study-page', pageId] });
    await client.invalidateQueries({ queryKey: ['study'] });
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Tarjetas de este apunte</h3>
      <form className="row g-8 wrap" onSubmit={add} style={{ marginBottom: 12 }}>
        <input className="note-select" style={{ flex: 1, minWidth: 160 }} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Pregunta" maxLength={300} />
        <input className="note-select" style={{ flex: 1, minWidth: 160 }} value={back} onChange={(e) => setBack(e.target.value)} placeholder="Respuesta" maxLength={600} />
        <button className="btn sm" disabled={!front.trim() || !back.trim()}><Plus size={14} /> Agregar</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {cards.length === 0 && <p className="muted" style={{ fontSize: 14, margin: 0 }}>Aún no hay tarjetas. Crea una o pídele a {companion.name} un resumen.</p>}
      <div className="stack" style={{ gap: 6 }}>
        {cards.map((card) => (
          <div key={card.id} className="row g-12" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{card.front}</div>
              <div className="muted" style={{ fontSize: 13 }}>{card.back}</div>
            </div>
            <span className="chip" style={{ fontSize: 11 }}>{new Date(card.due_at) <= new Date() ? 'Para hoy' : `Vuelve ${new Date(card.due_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}</span>
            <button className="btn sm ghost" onClick={() => remove(card.id)} title="Eliminar"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Repaso SM-2 ---------- */

function Review() {
  const client = useQueryClient();
  const cards = useQuery({ queryKey: ['study-due'], queryFn: () => api<Card[]>('/api/study/cards?scope=due') });
  const [flipped, setFlipped] = useState(false);
  const [sending, setSending] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const queue = cards.data ?? [];
  const card = queue[0];

  async function grade(value: number) {
    if (!card) return;
    setSending(true);
    try {
      const result = await api<{ intervalDays: number }>(`/api/study/cards/${card.id}/review`, { method: 'POST', body: JSON.stringify({ grade: value }) });
      setLast(result.intervalDays === 1 ? 'Vuelve mañana' : `Vuelve en ${result.intervalDays} días`);
      setDone((n) => n + 1);
      setFlipped(false);
      client.setQueryData<Card[]>(['study-due'], (prev) => prev?.slice(1));
      client.invalidateQueries({ queryKey: ['study'] });
      client.invalidateQueries({ queryKey: ['me-game'] });
    } finally {
      setSending(false);
    }
  }

  if (cards.isLoading) return <div className="card"><Loader2 className="spin" /></div>;
  if (!card) {
    return (
      <div className="card">
        <Empty icon={Check} title={done ? `¡Listo! Repasaste ${done} tarjetas` : 'No tienes tarjetas para hoy'} body="Las tarjetas regresan según qué tan bien las recuerdas (algoritmo SM-2)." />
        {done > 0 && <button className="btn ghost" style={{ margin: '0 auto', display: 'flex' }} onClick={() => { setDone(0); cards.refetch(); }}><RotateCcw size={15} /> Buscar más</button>}
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>{queue.length} por repasar{done ? ` · ${done} hechas` : ''}</span>
        {last && <span className="chip mint">{last}</span>}
      </div>
      <AnimatePresence mode="wait">
        <motion.button
          key={card.id + String(flipped)}
          className={`flashcard ${flipped ? 'back' : ''}`}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={() => setFlipped(!flipped)}
        >
          <span className="eyebrow">{flipped ? 'Respuesta' : card.page_title ?? 'Pregunta'}</span>
          <span className="flashcard-text">{flipped ? card.back : card.front}</span>
          {!flipped && <span className="muted" style={{ fontSize: 13 }}>Piensa la respuesta y toca para voltear</span>}
        </motion.button>
      </AnimatePresence>
      {flipped ? (
        <div className="grade-row">
          {GRADES.map((g) => (
            <button key={g.grade} className={`grade-btn ${g.tone}`} disabled={sending} onClick={() => grade(g.grade)}>
              <b>{g.label}</b><span>{g.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="row g-8" style={{ justifyContent: 'center' }}>
          <button className="btn lg" onClick={() => setFlipped(true)}>Ver respuesta</button>
          <SpeakButton text={card.front} label="Leer" size="md" />
        </div>
      )}
    </div>
  );
}

/* ---------- Enfoque ---------- */

function FocusTimer({ focus }: { focus?: Focus }) {
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const finishing = useRef(false);
  const running = focus?.running ?? null;
  const offset = focus ? focus.serverNow - Date.now() : 0;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const total = running ? running.planned_min * 60 : 0;
  const elapsed = running ? Math.max(0, Math.floor((now + offset - new Date(running.started_at).getTime()) / 1000)) : 0;
  const remaining = Math.max(0, total - elapsed);

  async function act(path: string, body?: object) {
    setBusy(true);
    try {
      const result = await api<{ status?: string; minutes?: number }>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      if (result.status === 'done') setMessage(`¡Bien! Sumaste ${result.minutes} minutos de enfoque.`);
      else if (result.status === 'abandoned') setMessage('Sesión cancelada.');
      else setMessage(null);
      await client.invalidateQueries({ queryKey: ['study'] });
      client.invalidateQueries({ queryKey: ['me-game'] });
    } catch (e) {
      setMessage(errorText(e, 'No se pudo actualizar la sesión'));
    } finally {
      setBusy(false);
      finishing.current = false;
    }
  }

  useEffect(() => {
    if (running && remaining === 0 && !finishing.current) {
      finishing.current = true;
      void act(`/api/study/focus/${running.id}/finish`);
    }
  }, [running, remaining]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}><Timer size={17} /> Enfoque</h3>
        <span className="chip">{focus?.minutesToday ?? 0} min hoy</span>
      </div>
      {running ? (
        <div className="stack" style={{ alignItems: 'center', gap: 12 }}>
          <Ring value={total ? (elapsed / total) * 100 : 0} size={140} stroke={12} track="var(--surface-2)">
            <div style={{ textAlign: 'center' }}><b style={{ fontSize: 30, fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</b><div className="muted" style={{ fontSize: 12 }}>de {running.planned_min} min</div></div>
          </Ring>
          <div className="row g-8">
            <button className="btn sm" disabled={busy} onClick={() => act(`/api/study/focus/${running.id}/finish`)}><Flag size={14} /> Terminar</button>
            <button className="btn sm ghost" disabled={busy} onClick={() => act(`/api/study/focus/${running.id}/cancel`)}><X size={14} /> Cancelar</button>
          </div>
          <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', margin: 0 }}>Cuenta como máximo el tiempo planeado. Terminar antes de 1 minuto no suma.</p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>Elige un bloque sin distracciones. Cada 5 minutos completos suman 2 XP (máximo 20).</p>
          <div className="row g-8">
            {[15, 25, 45].map((min) => (
              <button key={min} className="btn sm ghost" style={{ flex: 1 }} disabled={busy} onClick={() => act('/api/study/focus', { plannedMin: min })}>{min} min</button>
            ))}
          </div>
        </>
      )}
      {message && <p className="chip mint" style={{ marginTop: 10, width: 'fit-content' }}>{message}</p>}
    </div>
  );
}

/* ---------- Metas ---------- */

function Goals({ goals }: { goals: Goal[] }) {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState('flashcards');
  const [period, setPeriod] = useState('daily');
  const [target, setTarget] = useState(10);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api('/api/study/goals', { method: 'POST', body: JSON.stringify({ kind, period, target }) });
    setAdding(false);
    await client.invalidateQueries({ queryKey: ['study'] });
  }

  async function remove(id: string) {
    await api(`/api/study/goals/${id}`, { method: 'DELETE' });
    await client.invalidateQueries({ queryKey: ['study'] });
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}><Target size={17} /> Metas</h3>
        <button className="btn sm ghost" onClick={() => setAdding(!adding)}>{adding ? <X size={14} /> : <Plus size={14} />}</button>
      </div>
      {adding && (
        <form onSubmit={save} className="stack" style={{ gap: 8, marginBottom: 12 }}>
          <select className="note-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(GOAL_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <div className="row g-8">
            <select className="note-select" style={{ flex: 1 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Cada día</option>
              <option value="weekly">Cada semana</option>
            </select>
            <input className="note-select" style={{ width: 90 }} type="number" min={1} max={1000} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </div>
          <button className="btn sm">Guardar meta</button>
        </form>
      )}
      {!goals.length && !adding && <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Ponte una meta diaria o semanal; si ya existe una del mismo tipo, se reemplaza.</p>}
      <div className="stack" style={{ gap: 12 }}>
        {goals.map((goal) => (
          <div key={goal.id}>
            <div className="row between" style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>
              <span>{GOAL_LABEL[goal.kind]} · {goal.period === 'daily' ? 'hoy' : 'semana'}</span>
              <span className="row g-4">
                {goal.done ? <span className="chip mint" style={{ padding: '2px 8px' }}><Check size={12} /> {goal.progress}/{goal.target}</span> : <span className="muted">{goal.progress}/{goal.target}</span>}
                <button className="btn sm ghost" style={{ padding: 4 }} onClick={() => remove(goal.id)} title="Quitar meta"><X size={12} /></button>
              </span>
            </div>
            <Bar value={(goal.progress / goal.target) * 100} tone={goal.done ? 'mint' : 'gold'} thin />
          </div>
        ))}
      </div>
    </div>
  );
}
