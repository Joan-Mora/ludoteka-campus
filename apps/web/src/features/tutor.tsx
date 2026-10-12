import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Hand, Lightbulb, Send, Sparkles, Volume2 } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { joinDictation, useSpeech, voiceSupport } from '@/shared/voice';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { RichText, Sources, type Citation } from '@/shared/rich-text';
import { useCompanion } from '@/shared/companion';
import { PageHeader, Tile } from '@/ui';
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

const suggestions = [
  '¿Cómo sé si un número es divisible entre 3?',
  'Dame una pista para comparar fracciones',
  '¿Qué paso sigue para simplificar 12/18?',
];

export function TutorPage() {
  const [params, setParams] = useSearchParams();
  const companion = useCompanion();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [error, setError] = useState('');
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState(() => params.get('q') ?? '');
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();
  const [readAloud, setReadAloud] = usePref('eq_tutor_voice', false);
  const [handsFree, setHandsFree] = usePref('eq_tutor_handsfree', false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

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
    if (!message.trim()) return;
    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setThinking(true);
    try {
      const reply = await api<{ conversationId: string; content: string; source: string; citations?: Citation[] }>('/api/tutor/chat', {
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
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.content, citations: reply.citations }]);
      if (readAloud || byVoice) speech.speak(reply.content);
      setError('');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'El tutor no respondió');
    } finally {
      setThinking(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft.trim());
  }

  return (
    <div>
      <PageHeader eyebrow="Tutor IA" title={companion.female ? 'Tu tutora de práctica' : 'Tu tutor de práctica'} subtitle="Pistas paso a paso, nunca la respuesta final. Se apaga solo si tienes un examen activo." />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="card span-2" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row g-12" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <Tile icon={Bot} tone="violet" />
            <div style={{ flex: 1 }}>
              <b>{companion.name} · {companion.female ? 'tutora' : 'tutor'} IA</b>
              <div className="row g-4" style={{ fontSize: 12.5, color: 'var(--mint)', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mint)' }} /> En línea
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
          </div>
          <div className="chat" style={{ padding: 20 }}>
            {!messages.length && (
              <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} style={{ display: 'inline-block' }}>
                  <Tile icon={Sparkles} tone="violet" large />
                </motion.div>
                <h3 style={{ marginTop: 14, fontSize: 20 }}>¿En qué paso estás?</h3>
                <p className="muted" style={{ marginTop: 6 }}>Pregunta por un paso, no por el resultado.</p>
                <div className="row g-8 wrap" style={{ justifyContent: 'center', marginTop: 18 }}>
                  {suggestions.map((s) => <button key={s} className="chip violet" style={{ padding: '8px 12px' }} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((message, index) => (
                <motion.div key={index} className={`bubble ${message.role === 'user' ? 'me' : 'bot'}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
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
            <form className="composer" onSubmit={onSubmit}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={handsFree ? 'Toca el micrófono y habla: se envía solo' : 'Escribe o dicta tu duda…'} />
              <MicButton onText={onDictated} />
              <button className="btn" type="submit" disabled={!draft.trim() || thinking}><Send size={16} /> Pedir pista</button>
            </form>
          </div>
        </div>
        <aside className="card">
          <div className="row g-12" style={{ marginBottom: 14 }}><Tile icon={Lightbulb} tone="gold" /><div className="card-title">Cómo sacarle provecho</div></div>
          <div className="stack g-12">
            {[
              'Cuéntale qué intentaste y dónde te trabaste.',
              'Pide un ejemplo parecido, no el resultado.',
              'Explícale tu razonamiento para que lo revise.',
              'Cada pregunta curiosa suma a la insignia Tutor curioso.',
            ].map((tip, i) => (
              <div key={tip} className="row g-12" style={{ alignItems: 'flex-start' }}>
                <span className="chip violet" style={{ minWidth: 28, justifyContent: 'center' }}>{i + 1}</span>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>{tip}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
