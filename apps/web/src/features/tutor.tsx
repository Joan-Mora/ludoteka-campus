import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Hand, History, Lightbulb, Loader2, MessageSquare, Plus, Send, Sparkles, Trash2, Volume2 } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { joinDictation, useSpeech, voiceSupport } from '@/shared/voice';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { RichText, Sources, type Citation } from '@/shared/rich-text';
import { useCompanion } from '@/shared/companion';
import { AutoTextarea, PageHeader, Tile } from '@/ui';
import { LEARNING_METHODS } from '@eduquest/contracts';

const METHODS: readonly string[] = LEARNING_METHODS;

function usePref(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved === null ? initial : saved === '1';
  });
  useEffect(() => { localStorage.setItem(key, value ? '1' : '0'); }, [key, value]);
  return [value, setValue] as const;
}

interface Bubble { role: 'user' | 'assistant'; content: string; citations?: Citation[] }
interface ConversationRow { id: string; title: string; updatedAt: string; messages: number }

const suggestions = [
  '¿Cómo sé si un número es divisible entre 3?',
  'Dame una pista para comparar fracciones',
  '¿Qué paso sigue para simplificar 12/18?',
];

const tips = [
  'Cuéntale qué intentaste y dónde te trabaste.',
  'Pide un ejemplo parecido, no el resultado.',
  'Explícale tu razonamiento para que lo revise.',
  'Cada pregunta curiosa suma a la insignia Tutor curioso.',
];

function whenShort(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

export function TutorPage() {
  const [params, setParams] = useSearchParams();
  const companion = useCompanion();
  const client = useQueryClient();
  const history = useQuery({ queryKey: ['tutor-conversations'], queryFn: () => api<ConversationRow[]>('/api/tutor/conversations') });
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [title, setTitle] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [panel, setPanel] = useState<'history' | 'tips'>('history');
  const [error, setError] = useState('');
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState(() => params.get('q') ?? '');
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();
  const [readAloud, setReadAloud] = usePref('eq_tutor_voice', false);
  const [handsFree, setHandsFree] = usePref('eq_tutor_handsfree', false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, thinking]);

  function remember(id: string | null) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('c', id);
      else next.delete('c');
      return next;
    }, { replace: true });
  }

  async function open(id: string) {
    if (id === conversationId || thinking) return;
    speech.stop();
    setOpening(id);
    try {
      const data = await api<{ id: string; title: string | null; messages: Bubble[] }>(`/api/tutor/conversations/${id}`);
      setConversationId(data.id);
      setTitle(data.title);
      setMessages(data.messages);
      setError('');
      remember(data.id);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo abrir la conversación');
      remember(null);
    } finally {
      setOpening(null);
    }
  }

  function startNew() {
    if (thinking) return;
    speech.stop();
    setConversationId(undefined);
    setTitle(null);
    setMessages([]);
    setDraft('');
    setError('');
    remember(null);
  }

  async function remove(id: string) {
    await api(`/api/tutor/conversations/${id}`, { method: 'DELETE' }).catch(() => undefined);
    setRemoving(null);
    if (id === conversationId) startNew();
    void client.invalidateQueries({ queryKey: ['tutor-conversations'] });
  }

  const restored = useRef(false);
  useEffect(() => {
    const id = params.get('c');
    if (restored.current || !id) return;
    restored.current = true;
    void open(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spokenAsk = useRef(false);
  useEffect(() => {
    const asked = params.get('q');
    if (params.get('enviar') !== '1' || !asked || spokenAsk.current) return;
    spokenAsk.current = true;
    const next = new URLSearchParams(params);
    next.delete('q');
    next.delete('enviar');
    setParams(next, { replace: true });
    void send(asked, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function onDictated(text: string) {
    if (handsFree) void send(text);
    else setDraft((current) => joinDictation(current, text));
  }

  async function send(message: string, byVoice = false) {
    if (!message.trim() || thinking) return;
    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setThinking(true);
    try {
      const reply = await api<{ conversationId: string; title: string | null; content: string; source: string; citations?: Citation[] }>('/api/tutor/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversationId,
          lessonId: params.get('lesson') || undefined,
          courseId: params.get('course') || undefined,
          method: METHODS.includes(params.get('method') ?? '') ? params.get('method') : undefined,
        }),
      });
      setConversationId(reply.conversationId);
      setTitle(reply.title);
      remember(reply.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.content, citations: reply.citations }]);
      if (readAloud || byVoice) speech.speak(reply.content);
      setError('');
      void client.invalidateQueries({ queryKey: ['tutor-conversations'] });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'El tutor no respondió');
    } finally {
      setThinking(false);
    }
  }

  const rows = history.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Tutor IA"
        title={companion.female ? 'Tu tutora de práctica' : 'Tu tutor de práctica'}
        subtitle="Pistas paso a paso, nunca la respuesta final. Se apaga solo si tienes un examen activo."
        actions={<button className="btn" onClick={startNew} disabled={thinking}><Plus size={16} /> Nueva conversación</button>}
      />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="card span-2" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row g-12 wrap" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <Tile icon={Bot} tone="violet" />
            <div style={{ flex: 1, minWidth: 160 }}>
              <b className="ellipsis" style={{ display: 'block' }}>{title ?? (messages.length ? 'Conversación sin título aún' : 'Conversación nueva')}</b>
              <div className="row g-4" style={{ fontSize: 12.5, color: 'var(--mint)', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mint)' }} /> {companion.name} en línea
              </div>
            </div>
            {params.get('lesson') && <span className="chip violet">Contexto de la lección</span>}
            {params.get('method') === 'conversacion' && <span className="chip soft">Modo conversación</span>}
            {speech.supported && (
              <button className={`chip ${readAloud ? 'violet' : ''}`} onClick={() => { if (readAloud) speech.stop(); setReadAloud(!readAloud); }} title={`Leer las respuestas de ${companion.name} en voz alta`}>
                <Volume2 size={13} /> Voz {readAloud ? 'activada' : 'apagada'}
              </button>
            )}
            {voiceSupport.dictation && (
              <button className={`chip ${handsFree ? 'mint' : ''}`} onClick={() => setHandsFree(!handsFree)} title="Lo que dictes se envía solo, sin escribir">
                <Hand size={13} /> Manos libres
              </button>
            )}
            <button className="icon-btn sm" onClick={startNew} disabled={thinking} title="Nueva conversación" aria-label="Nueva conversación"><Plus size={16} /></button>
          </div>
          <div className="chat" style={{ padding: 20 }}>
            {opening && <p className="muted row g-6"><Loader2 size={14} className="spin" /> Abriendo la conversación…</p>}
            {!messages.length && !opening && (
              <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} style={{ display: 'inline-block' }}>
                  <Tile icon={Sparkles} tone="violet" large />
                </motion.div>
                <h3 style={{ marginTop: 14, fontSize: 20 }}>¿En qué paso estás?</h3>
                <p className="muted" style={{ marginTop: 6 }}>Pregunta por un paso, no por el resultado. {companion.name} le pondrá un título a la conversación para que la encuentres en el historial.</p>
                <div className="row g-8 wrap" style={{ justifyContent: 'center', marginTop: 18 }}>
                  {suggestions.map((s) => <button key={s} className="chip violet" style={{ padding: '8px 12px' }} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((message, index) => (
                <motion.div key={`${conversationId ?? 'new'}-${index}`} className={`bubble ${message.role === 'user' ? 'me' : 'bot'}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                  {message.role === 'assistant' ? <RichText text={message.content} citations={message.citations} /> : message.content}
                  {message.role === 'assistant' && message.citations?.length ? <Sources citations={message.citations} /> : null}
                  {message.role === 'assistant' && <div className="bubble-tools"><SpeakButton text={message.content} /></div>}
                </motion.div>
              ))}
            </AnimatePresence>
            {thinking && (
              <div className="bubble bot row g-4">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--violet)' }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div style={{ padding: 16, borderTop: '1px solid var(--line)' }}>
            {error && <p className="err" style={{ marginBottom: 10 }}>{error}</p>}
            <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(draft.trim()); }}>
              <AutoTextarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onSend={() => void send(draft.trim())}
                maxLength={2000}
                placeholder={handsFree ? 'Toca el micrófono y habla: se envía solo' : 'Escribe o dicta tu duda… (Shift+Enter para otra línea)'}
                aria-label="Tu mensaje"
              />
              <MicButton onText={onDictated} />
              <button className="btn" type="submit" disabled={!draft.trim() || thinking}><Send size={16} /> Pedir pista</button>
            </form>
          </div>
        </div>
        <aside className="card tutor-side">
          <div className="seg-tabs mini" role="tablist" aria-label="Panel lateral">
            <button role="tab" aria-selected={panel === 'history'} className={panel === 'history' ? 'on' : ''} onClick={() => setPanel('history')}><History size={14} /> Historial <span className="seg-count">{rows.length}</span></button>
            <button role="tab" aria-selected={panel === 'tips'} className={panel === 'tips' ? 'on' : ''} onClick={() => setPanel('tips')}><Lightbulb size={14} /> Consejos</button>
          </div>
          {panel === 'history' ? (
            <div className="tutor-history">
              <button className="tutor-conv new" onClick={startNew} disabled={thinking}>
                <Plus size={16} /> <span>Nueva conversación</span>
              </button>
              {history.isLoading && <p className="muted row g-6"><Loader2 size={14} className="spin" /> Cargando…</p>}
              {rows.map((row) => (
                <div key={row.id} className={`tutor-conv ${row.id === conversationId ? 'on' : ''}`}>
                  <button className="tutor-conv-open" onClick={() => open(row.id)} aria-current={row.id === conversationId}>
                    {opening === row.id ? <Loader2 size={15} className="spin" /> : <MessageSquare size={15} />}
                    <span className="tutor-conv-text">
                      <b>{row.title}</b>
                      <small>{whenShort(row.updatedAt)} · {Math.ceil(row.messages / 2)} {row.messages > 2 ? 'preguntas' : 'pregunta'}</small>
                    </span>
                  </button>
                  {removing === row.id ? (
                    <span className="row g-4">
                      <button className="btn sm ghost danger" onClick={() => remove(row.id)}>Borrar</button>
                      <button className="btn sm ghost" onClick={() => setRemoving(null)}>No</button>
                    </span>
                  ) : (
                    <button className="icon-btn sm" onClick={() => setRemoving(row.id)} aria-label={`Borrar «${row.title}»`} title="Borrar del historial"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              {!history.isLoading && !rows.length && <p className="muted" style={{ fontSize: 14 }}>Aquí aparecerán tus conversaciones con {companion.name}, cada una con su título.</p>}
            </div>
          ) : (
            <div className="stack g-12">
              {tips.map((tip, i) => (
                <div key={tip} className="row g-12" style={{ alignItems: 'flex-start' }}>
                  <span className="chip violet" style={{ minWidth: 28, justifyContent: 'center' }}>{i + 1}</span>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>{tip}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
