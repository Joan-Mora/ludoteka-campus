import { FormEvent, useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CloudUpload,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Globe2,
  Image as ImageIcon,
  Library,
  Link2,
  Loader2,
  Lock,
  MessageSquareQuote,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { useCompanion } from '@/shared/companion';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { joinDictation } from '@/shared/voice';
import { RichText, Sources, type Citation } from '@/shared/rich-text';
import { Empty, PageHeader, Reveal, Tile, type Tone } from '@/ui';

interface Item {
  id: string;
  title: string;
  description: string;
  kind: string;
  url: string;
  format: string | null;
  bytes: number;
  pages: number | null;
  visibility: string;
  status: string;
  subject: string;
  subject_id: string;
  grade: string | null;
  course: string | null;
  uploader: string | null;
  created_at: string;
  views: number;
  saved: boolean;
  tags: string[];
  thumbnail: string | null;
  canManage: boolean;
}
interface Catalog { subjects: { id: string; name: string }[]; grades: { id: string; name: string }[]; tags: { tag: string; n: number }[]; uploads: boolean }

const KINDS: { key: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { key: 'pdf', label: 'PDF', icon: FileText, tone: 'coral' },
  { key: 'image', label: 'Imagen', icon: ImageIcon, tone: 'sky' },
  { key: 'video', label: 'Video', icon: Film, tone: 'violet' },
  { key: 'doc', label: 'Documento', icon: BookOpen, tone: 'gold' },
  { key: 'link', label: 'Enlace', icon: Link2, tone: 'mint' },
];
const kindOf = (key: string) => KINDS.find((k) => k.key === key) ?? KINDS[3]!;
const VISIBILITY: Record<string, { label: string; icon: LucideIcon }> = {
  public: { label: 'Pública', icon: Globe2 },
  institution: { label: 'Colegio', icon: Users },
  course: { label: 'Solo el curso', icon: Lock },
};
const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes > 0 ? `${Math.ceil(bytes / 1024)} KB` : '');

function youtubeId(url: string) {
  return /(?:youtu\.be\/|v=|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
}

export function LibraryPage() {
  const { user } = useAuth();
  const staff = user && ['teacher', 'admin'].includes(user.role);
  const [tab, setTab] = useState<'items' | 'ask' | 'glossary'>('items');
  const companion = useCompanion();
  return (
    <div>
      <PageHeader eyebrow="Biblioteca" title="Biblioteca del campus" subtitle={`Guías, lecturas y videos del colegio. Pregúntale a ${companion.name} y te responde citando la página.`} />
      <div className="row g-8 seg" style={{ marginBottom: 18 }}>
        {([
          ['items', 'Recursos', Library],
          ['ask', 'Pregúntale a la biblioteca', MessageSquareQuote],
          ['glossary', 'Glosario', BookOpen],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} className={`btn sm ${tab === key ? '' : 'ghost'}`} style={tab === key ? undefined : { border: 0 }} onClick={() => setTab(key)}><Icon size={15} /> {label}</button>
        ))}
      </div>
      {tab === 'items' && <Catalogue staff={Boolean(staff)} />}
      {tab === 'ask' && <AskPanel />}
      {tab === 'glossary' && <Glossary staff={Boolean(staff)} />}
    </div>
  );
}

function Catalogue({ staff }: { staff: boolean }) {
  const catalog = useQuery({ queryKey: ['library-catalog'], queryFn: () => api<Catalog>('/api/library/catalog') });
  const [q, setQ] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [saved, setSaved] = useState(false);
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(subjectId ? { subjectId } : {}), ...(kind ? { kind } : {}), ...(tag ? { tag } : {}), ...(saved ? { saved: '1' } : {}) });
  const items = useQuery({ queryKey: ['library', params.toString()], queryFn: () => api<Item[]>(`/api/library/items?${params}`), refetchInterval: (query) => (query.state.data?.some((i) => i.status === 'processing') ? 4000 : false) });
  const [uploading, setUploading] = useState(false);

  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="span-2 stack" style={{ gap: 14, gridColumn: staff ? undefined : '1 / -1' }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row g-8">
            <div className="lib-search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por título, etiqueta o dentro de los PDF…" />
            </div>
            <MicButton onText={(text) => setQ(text.replace(/[.,]$/, ''))} />
          </div>
          <div className="row g-8 wrap" style={{ marginTop: 12 }}>
            <button className={`chip ${!subjectId ? 'violet' : ''}`} onClick={() => setSubjectId('')}>Todas las materias</button>
            {catalog.data?.subjects.map((s) => <button key={s.id} className={`chip ${subjectId === s.id ? 'violet' : ''}`} onClick={() => setSubjectId(subjectId === s.id ? '' : s.id)}>{s.name}</button>)}
          </div>
          <div className="row g-8 wrap" style={{ marginTop: 8 }}>
            {KINDS.map((k) => <button key={k.key} className={`chip ${kind === k.key ? k.tone : ''}`} onClick={() => setKind(kind === k.key ? '' : k.key)}><k.icon size={12} /> {k.label}</button>)}
            <button className={`chip ${saved ? 'gold' : ''}`} onClick={() => setSaved(!saved)}><Bookmark size={12} /> Guardados</button>
            {catalog.data?.tags.slice(0, 10).map((t) => <button key={t.tag} className={`chip ${tag === t.tag ? 'mint' : ''}`} onClick={() => setTag(tag === t.tag ? '' : t.tag)}>#{t.tag}</button>)}
          </div>
        </div>
        <div className="lib-grid">
          {items.data?.map((item, i) => <ItemCard key={item.id} item={item} delay={i * 0.03} />)}
        </div>
        {!items.isLoading && !items.data?.length && <Empty icon={Library} title="Sin resultados" body={q ? 'Prueba con otras palabras o quita algún filtro.' : 'Todavía no hay recursos publicados.'} />}
      </div>
      {staff && (
        <div className="stack" style={{ gap: 18 }}>
          <Uploader catalog={catalog.data} onBusy={setUploading} />
          {uploading && <p className="muted" style={{ fontSize: 13 }}>Subiendo directo a Cloudinary; el servidor solo firma y guarda los metadatos.</p>}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, delay }: { item: Item; delay: number }) {
  const client = useQueryClient();
  const k = kindOf(item.format === 'youtube' ? 'video' : item.kind);
  const yt = item.format === 'youtube' ? youtubeId(item.url) : null;
  const cover = item.thumbnail ?? (yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null);
  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (item.saved) await api(`/api/library/items/${item.id}/bookmark`, { method: 'DELETE' });
    else await api(`/api/library/items/${item.id}/bookmark`, { method: 'POST', body: JSON.stringify({}) });
    client.invalidateQueries({ queryKey: ['library'] });
  }
  return (
    <Reveal delay={delay}>
      <Link to={`/app/biblioteca/${item.id}`} className="lib-card">
        <div className="lib-cover">
          {cover ? <img src={cover} alt="" loading="lazy" /> : <Tile icon={k.icon} tone={k.tone} large />}
          <span className={`chip ${k.tone} lib-kind`}><k.icon size={12} /> {k.label}</span>
          {item.status === 'processing' && <span className="chip sky lib-status"><Loader2 size={12} className="spin" /> Indexando</span>}
          {item.status === 'failed' && <span className="chip coral lib-status">Sin texto</span>}
          <button className={`lib-save ${item.saved ? 'on' : ''}`} onClick={toggleSave} title={item.saved ? 'Quitar de guardados' : 'Guardar'}>
            {item.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        </div>
        <div style={{ padding: 14 }}>
          <div className="lib-title">{item.title}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{item.subject}{item.pages ? ` · ${item.pages} págs.` : ''}{item.bytes ? ` · ${size(item.bytes)}` : ''}</div>
          <div className="row g-4 wrap" style={{ marginTop: 8 }}>
            {item.tags.slice(0, 3).map((t) => <span key={t} className="chip" style={{ fontSize: 11, padding: '3px 8px' }}>#{t}</span>)}
            <span className="muted row g-4" style={{ fontSize: 12, marginLeft: 'auto' }}><Eye size={12} /> {item.views}</span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

function Uploader({ catalog, onBusy }: { catalog?: Catalog; onBusy: (busy: boolean) => void }) {
  const client = useQueryClient();
  const courses = useQuery({ queryKey: ['courses'], queryFn: () => api<{ id: string; title: string }[]>('/api/courses') });
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState('institution');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [drag, setDrag] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (f.size > 52428800) return setError('El archivo supera 50 MB.');
    setError('');
    setFile(f);
    const title = formRef.current?.elements.namedItem('title') as HTMLInputElement | null;
    if (title && !title.value) title.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  }

  function uploadToCloudinary(ticket: { uploadUrl: string; fields: Record<string, string | number> }, f: File) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const form = new FormData();
      form.append('file', f);
      Object.entries(ticket.fields).forEach(([key, value]) => form.append(key, String(value)));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', ticket.uploadUrl);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded * 100) / e.total));
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data?.error?.message ?? 'Cloudinary rechazó el archivo'));
      };
      xhr.onerror = () => reject(new Error('No hubo conexión con Cloudinary'));
      xhr.send(form);
    });
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError('');
    setDone('');
    const base = {
      title: String(d.get('title') ?? ''),
      description: String(d.get('description') ?? ''),
      subjectId: String(d.get('subjectId') ?? ''),
      gradeId: (d.get('gradeId') as string) || undefined,
      visibility,
      courseId: visibility === 'course' ? String(d.get('courseId') ?? '') : undefined,
      tags: String(d.get('tags') ?? '').split(/[,#]/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2),
    };
    onBusy(true);
    try {
      if (mode === 'file') {
        if (!file) throw new Error('Elige un archivo.');
        const ticket = await api<{ uploadUrl: string; fields: Record<string, string | number> }>('/api/library/uploads/ticket', { method: 'POST' });
        setProgress(0);
        const up = await uploadToCloudinary(ticket, file);
        await api('/api/library/items', {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            upload: {
              publicId: up.public_id, version: up.version, signature: up.signature, secureUrl: up.secure_url,
              resourceType: up.resource_type, format: up.format, bytes: up.bytes, etag: up.etag, pages: up.pages,
            },
          }),
        });
      } else {
        await api('/api/library/items', { method: 'POST', body: JSON.stringify({ ...base, link: d.get('link') }) });
      }
      form.reset();
      setFile(null);
      setDone(mode === 'file' && file?.type === 'application/pdf' ? 'Publicado. La IA está leyendo el PDF para poder citarlo.' : 'Publicado.');
      client.invalidateQueries({ queryKey: ['library'] });
      client.invalidateQueries({ queryKey: ['library-catalog'] });
      client.invalidateQueries({ queryKey: ['campus'] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
      onBusy(false);
    }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); };

  return (
    <Reveal className="card">
      <div className="row g-12" style={{ marginBottom: 14 }}>
        <Tile icon={CloudUpload} tone="violet" />
        <div style={{ flex: 1 }}>
          <div className="card-title">Publicar recurso</div>
          <div className="muted" style={{ fontSize: 13 }}>Hasta 50 MB · PDF, imagen, video o documento</div>
        </div>
      </div>
      {catalog && !catalog.uploads && <p className="form-error">Cloudinary no está configurado en el servidor; solo puedes publicar enlaces.</p>}
      <div className="row g-8" style={{ marginBottom: 12 }}>
        <button type="button" className={`btn sm ${mode === 'file' ? '' : 'ghost'}`} onClick={() => setMode('file')}><CloudUpload size={14} /> Archivo</button>
        <button type="button" className={`btn sm ${mode === 'link' ? '' : 'ghost'}`} onClick={() => setMode('link')}><Link2 size={14} /> Enlace o video</button>
      </div>
      <form ref={formRef} onSubmit={submit}>
        {mode === 'file' ? (
          <label className={`dropzone${drag ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
            <input type="file" accept=".pdf,image/*,video/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(e) => pick(e.target.files?.[0])} hidden />
            <CloudUpload size={26} />
            <b>{file ? file.name : 'Arrastra el archivo o toca para elegir'}</b>
            {file && <span className="muted">{size(file.size)}</span>}
            {progress !== null && <div className="bar thin" style={{ width: '100%', marginTop: 8 }}><span style={{ width: `${progress}%` }} /></div>}
          </label>
        ) : (
          <label className="field">Enlace<input name="link" type="url" required placeholder="https://www.youtube.com/watch?v=…" /></label>
        )}
        <label className="field">Título<input name="title" required minLength={3} maxLength={200} /></label>
        <label className="field">Descripción<textarea name="description" rows={2} maxLength={2000} /></label>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <label className="field">Materia<select name="subjectId" required>{catalog?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field">Grado<select name="gradeId"><option value="">Todos</option>{catalog?.grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        </div>
        <label className="field">Visibilidad
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="institution">Todo el colegio</option>
            <option value="course">Solo un curso</option>
            <option value="public">Pública (también en la página de inicio)</option>
          </select>
        </label>
        {visibility === 'course' && <label className="field">Curso<select name="courseId" required>{courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
        <label className="field">Etiquetas<input name="tags" placeholder="fracciones, repaso" /></label>
        {error && <p className="form-error">{error}</p>}
        {done && <p className="chip mint" style={{ marginBottom: 12 }}>{done}</p>}
        <button className="btn" type="submit" disabled={progress !== null} style={{ width: '100%' }}>
          {progress !== null ? `Subiendo ${progress}%` : 'Publicar'}
        </button>
      </form>
    </Reveal>
  );
}

function AskPanel({ itemId, compact }: { itemId?: string; compact?: boolean }) {
  const companion = useCompanion();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; citations: Citation[]; source: string } | null>(null);
  async function ask(e?: FormEvent) {
    e?.preventDefault();
    if (question.trim().length < 3) return;
    setBusy(true);
    try {
      setAnswer(await api('/api/library/ask', { method: 'POST', body: JSON.stringify({ question, itemId }) }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={compact ? '' : 'card'} style={compact ? undefined : { maxWidth: 860 }}>
      {!compact && (
        <div className="row g-12" style={{ marginBottom: 14 }}>
          <Tile icon={Sparkles} tone="violet" />
          <div>
            <div className="card-title">Pregúntale a la biblioteca</div>
            <div className="muted" style={{ fontSize: 13 }}>{companion.name} responde solo con lo que dicen los documentos y cita la página.</div>
          </div>
        </div>
      )}
      <form onSubmit={ask} className="composer">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={itemId ? 'Pregunta sobre este documento…' : '¿Cómo se calcula el área de un triángulo?'} />
        <MicButton onText={(text) => setQuestion((q) => joinDictation(q, text))} />
        <button className="btn" type="submit" disabled={busy || question.trim().length < 3}>{busy ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Preguntar</button>
      </form>
      {answer && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lib-answer">
          <RichText text={answer.answer} citations={answer.citations} />
          <Sources citations={answer.citations} />
          <div style={{ marginTop: 10 }}><SpeakButton text={answer.answer} label="Escuchar" /></div>
        </motion.div>
      )}
    </div>
  );
}

function Glossary({ staff }: { staff: boolean }) {
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ['library-catalog'], queryFn: () => api<Catalog>('/api/library/catalog') });
  const [q, setQ] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const params = new URLSearchParams({ ...(q ? { q } : {}), ...(subjectId ? { subjectId } : {}) });
  const terms = useQuery({
    queryKey: ['glossary', params.toString()],
    queryFn: () => api<{ id: string; term: string; definition: string; example: string; subject: string; source: string | null; source_item_id: string | null }[]>(`/api/library/glossary?${params}`),
  });
  const [error, setError] = useState('');

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError('');
    try {
      await api('/api/library/glossary', { method: 'POST', body: JSON.stringify({ subjectId: d.get('subjectId'), term: d.get('term'), definition: d.get('definition'), example: d.get('example') }) });
      form.reset();
      client.invalidateQueries({ queryKey: ['glossary'] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid cols-3" style={{ alignItems: 'start' }}>
      <div className="span-2 stack" style={{ gap: 12, gridColumn: staff ? undefined : '1 / -1' }}>
        <div className="row g-8 wrap">
          <div className="lib-search" style={{ flex: 1, minWidth: 220 }}><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca un concepto…" /></div>
          <select className="lib-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Todas las materias</option>
            {catalog.data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          {terms.data?.map((t) => (
            <div key={t.id} className="card glossary-card">
              <div className="row between g-8">
                <b style={{ fontSize: 16 }}>{t.term}</b>
                <div className="row g-4">
                  <SpeakButton text={`${t.term}. ${t.definition}`} />
                  {staff && <button className="btn sm ghost" onClick={async () => { await api(`/api/library/glossary/${t.id}`, { method: 'DELETE' }); client.invalidateQueries({ queryKey: ['glossary'] }); }}><Trash2 size={14} /></button>}
                </div>
              </div>
              <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{t.definition}</p>
              {t.example && <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Ejemplo: {t.example}</p>}
              <div className="row g-8 wrap" style={{ marginTop: 8 }}>
                <span className="chip violet">{t.subject}</span>
                {t.source_item_id && <Link className="chip" to={`/app/biblioteca/${t.source_item_id}`}><FileText size={12} /> {t.source}</Link>}
              </div>
            </div>
          ))}
        </div>
        {!terms.isLoading && !terms.data?.length && <Empty icon={BookOpen} title="Sin términos" body="Al subir un PDF, la IA propone los conceptos clave del documento." />}
      </div>
      {staff && (
        <Reveal className="card">
          <div className="row g-12" style={{ marginBottom: 14 }}><Tile icon={BookOpen} tone="gold" /><div className="card-title">Nuevo término</div></div>
          <form onSubmit={add}>
            <label className="field">Materia<select name="subjectId">{catalog.data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field">Término<input name="term" required minLength={2} maxLength={80} /></label>
            <label className="field">Definición<textarea name="definition" rows={3} required minLength={5} maxLength={1200} /></label>
            <label className="field">Ejemplo<input name="example" maxLength={600} /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn" type="submit" style={{ width: '100%' }}>Agregar</button>
          </form>
        </Reveal>
      )}
    </div>
  );
}

interface ItemDetail extends Item {
  resource_type: string | null;
  course_id: string | null;
  chunks: number;
  bookmark: { page: number | null; note: string } | null;
  glossary: { id: string; term: string; definition: string; example: string }[];
}

export function LibraryItemPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const item = useQuery({ queryKey: ['library-item', id], queryFn: () => api<ItemDetail>(`/api/library/items/${id}`), refetchInterval: (query) => (query.state.data?.status === 'processing' ? 4000 : false) });
  const [page, setPage] = useState<string>('');
  const [note, setNote] = useState<string | null>(null);
  const data = item.data;
  if (!data) return <div className="card muted">{item.isError ? 'No tienes acceso a este recurso.' : 'Abriendo recurso…'}</div>;
  const yt = data.format === 'youtube' ? youtubeId(data.url) : null;
  const vis = VISIBILITY[data.visibility] ?? VISIBILITY.institution!;
  const bookmarkPage = page || (data.bookmark?.page ? String(data.bookmark.page) : '');
  const bookmarkNote = note ?? data.bookmark?.note ?? '';

  async function saveBookmark(e: FormEvent) {
    e.preventDefault();
    await api(`/api/library/items/${id}/bookmark`, { method: 'POST', body: JSON.stringify({ page: bookmarkPage ? Number(bookmarkPage) : undefined, note: bookmarkNote }) });
    client.invalidateQueries({ queryKey: ['library-item', id] });
    client.invalidateQueries({ queryKey: ['library'] });
  }
  async function remove() {
    if (!confirm('¿Eliminar este recurso de la biblioteca y de Cloudinary?')) return;
    await api(`/api/library/items/${id}`, { method: 'DELETE' });
    client.invalidateQueries({ queryKey: ['library'] });
    navigate('/app/biblioteca');
  }
  async function reindex() {
    await api(`/api/library/items/${id}/reindex`, { method: 'POST' });
    client.invalidateQueries({ queryKey: ['library-item', id] });
  }

  const viewerUrl = data.kind === 'pdf' && data.bookmark?.page ? `${data.url}#page=${data.bookmark.page}` : data.url;
  return (
    <div>
      <Link to="/app/biblioteca" className="btn sm ghost" style={{ marginBottom: 14 }}><ArrowLeft size={15} /> Biblioteca</Link>
      <PageHeader
        eyebrow={data.subject}
        title={data.title}
        subtitle={data.description || undefined}
        actions={<a className="btn ghost" href={data.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir</a>}
      />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2 card" style={{ padding: 0, overflow: 'hidden' }}>
          {data.kind === 'pdf' && <iframe className="lib-viewer" src={viewerUrl} title={data.title} />}
          {data.kind === 'image' && <img src={data.url} alt={data.title} style={{ width: '100%', display: 'block' }} />}
          {data.kind === 'video' && <video src={data.url} controls style={{ width: '100%', display: 'block' }} />}
          {yt && <iframe className="lib-viewer video" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={data.title} allowFullScreen />}
          {(data.kind === 'doc' || (data.kind === 'link' && !yt)) && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Tile icon={data.kind === 'doc' ? BookOpen : Link2} tone="violet" large />
              <p className="muted" style={{ marginTop: 12 }}>Este recurso se abre en una pestaña nueva.</p>
              <a className="btn" href={data.url} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}><ExternalLink size={16} /> Abrir recurso</a>
            </div>
          )}
        </div>
        <div className="stack" style={{ gap: 18 }}>
          <div className="card">
            <div className="row g-8 wrap">
              <span className="chip violet"><vis.icon size={12} /> {vis.label}{data.course ? ` · ${data.course}` : ''}</span>
              {data.pages ? <span className="chip">{data.pages} páginas</span> : null}
              {data.bytes ? <span className="chip">{size(data.bytes)}</span> : null}
              <span className="chip"><Eye size={12} /> {data.views}</span>
              {data.kind === 'pdf' && (
                <span className={`chip ${data.status === 'published' ? 'mint' : data.status === 'failed' ? 'coral' : 'sky'}`}>
                  {data.status === 'processing' ? 'Indexando…' : data.status === 'failed' ? 'No se pudo leer' : `${data.chunks} fragmentos para el tutor`}
                </span>
              )}
            </div>
            <div className="row g-4 wrap" style={{ marginTop: 10 }}>{data.tags.map((t) => <span key={t} className="chip mint">#{t}</span>)}</div>
            {data.uploader && <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Publicado por {data.uploader}</p>}
            {data.canManage && (
              <div className="row g-8" style={{ marginTop: 12 }}>
                {data.kind === 'pdf' && <button className="btn sm ghost" onClick={reindex}><RefreshCw size={14} /> Reindexar</button>}
                <button className="btn sm ghost" onClick={remove}><Trash2 size={14} /> Eliminar</button>
              </div>
            )}
          </div>
          <form className="card" onSubmit={saveBookmark}>
            <div className="row g-8" style={{ marginBottom: 10 }}>{data.bookmark ? <BookmarkCheck size={18} color="var(--gold)" /> : <Bookmark size={18} />}<b>Marcador</b></div>
            {data.kind === 'pdf' && <label className="field">Página<input type="number" min={1} max={data.pages ?? 5000} value={bookmarkPage} onChange={(e) => setPage(e.target.value)} /></label>}
            <label className="field">Nota<input value={bookmarkNote} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Repasar antes del quiz" /></label>
            <div className="row g-8">
              <button className="btn sm" type="submit">{data.bookmark ? 'Actualizar' : 'Guardar'}</button>
              {data.bookmark && <button className="btn sm ghost" type="button" onClick={async () => { await api(`/api/library/items/${id}/bookmark`, { method: 'DELETE' }); setNote(null); setPage(''); client.invalidateQueries({ queryKey: ['library-item', id] }); }}>Quitar</button>}
            </div>
          </form>
          {data.kind === 'pdf' && data.chunks > 0 && (
            <div className="card">
              <div className="row g-8" style={{ marginBottom: 10 }}><Sparkles size={18} color="var(--violet)" /><b>Pregunta sobre este PDF</b></div>
              <AskPanel itemId={id} compact />
            </div>
          )}
          {data.glossary.length > 0 && (
            <div className="card">
              <b>Conceptos clave</b>
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                {data.glossary.map((g) => (
                  <div key={g.id}><b style={{ fontSize: 14 }}>{g.term}:</b> <span style={{ fontSize: 14 }}>{g.definition}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
