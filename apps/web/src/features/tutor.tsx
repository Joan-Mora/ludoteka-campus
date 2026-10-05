import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Lightbulb, Send, Sparkles } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { PageHeader, Tile } from '@/ui';

interface Bubble { role: 'user' | 'assistant'; content: string }

const suggestions = [
  '¿Cómo sé si un número es divisible entre 3?',
  'Dame una pista para comparar fracciones',
  '¿Qué paso sigue para simplificar 12/18?',
];

export function TutorPage() {
  const [params] = useSearchParams();
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [error, setError] = useState('');
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  async function send(message: string) {
    if (!message.trim()) return;
    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setThinking(true);
    try {
      const reply = await api<{ conversationId: string; content: string; source: string }>('/api/tutor/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversationId,
          lessonId: params.get('lesson') || undefined,
          courseId: params.get('course') || undefined,
        }),
      });
      setConversationId(reply.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.content }]);
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
      <PageHeader eyebrow="Tutor IA" title="Tu tutor de práctica" subtitle="Pistas paso a paso, nunca la respuesta final. Se apaga solo si tienes un examen activo." />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="card span-2" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="row g-12" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <Tile icon={Bot} tone="violet" />
            <div style={{ flex: 1 }}>
              <b>Luka · tutor IA</b>
              <div className="row g-4" style={{ fontSize: 12.5, color: 'var(--mint)', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--mint)' }} /> En línea
              </div>
            </div>
            {params.get('lesson') && <span className="chip violet">Contexto de la lección</span>}
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
                  {message.content}
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
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escribe tu duda…" />
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
