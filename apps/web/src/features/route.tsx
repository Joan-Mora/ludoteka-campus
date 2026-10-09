import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Compass, Lightbulb, Loader2, ShieldCheck, SkipForward, Sparkles, Target, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { MicButton, SpeakButton } from '@/shared/voice-ui';
import { spokenAnswer } from '@/shared/voice';
import { useCompanion } from '@/shared/companion';
import { Empty, PageHeader, Reveal, Ring } from '@/ui';

interface Topic { id: string; code: string; name: string; level: number; streak: number; correct_count: number; attempt_count: number; pending: number }
interface Pending { id: string; topic_id: string; topic: string; level: number; prompt: string; hint: string; source: string }
interface Recent { id: string; topic: string; level: number; prompt: string; status: string; given: string | null; answer: string; explanation: string; verification: string }
interface Overview { topics: Topic[]; pending: Pending[]; recent: Recent[]; suggestion: { topicId: string; name: string; level: number } | null; average: number }
interface Result { correct: boolean; answer: string; explanation: string; verification: string; mastery: { level: number; change: -1 | 0 | 1 } }

const VERIFICATION: Record<string, string> = {
  verified: 'La IA propuso el reto y el servidor confirmó la respuesta.',
  corrected: 'La IA propuso el reto y el servidor corrigió su respuesta.',
  template: 'Reto de plantilla calculado por el servidor.',
};

function LevelBar({ level }: { level: number }) {
  return (
    <div className="level-bar" aria-label={`Nivel ${level} de 10`}>
      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < level ? `on t${Math.min(3, Math.ceil(level / 3.4))}` : ''} />)}
    </div>
  );
}

export function RoutePage() {
  const client = useQueryClient();
  const companion = useCompanion();
  const overview = useQuery({ queryKey: ['route'], queryFn: () => api<Overview>('/api/route') });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(topicId?: string) {
    setBusy(topicId ?? 'auto');
    setError(null);
    try {
      await api('/api/route/generate', { method: 'POST', body: JSON.stringify(topicId ? { topicId, count: 3 } : { count: 3 }) });
      await client.invalidateQueries({ queryKey: ['route'] });
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudieron crear los retos');
    } finally {
      setBusy(null);
    }
  }

  const data = overview.data;
  return (
    <div>
      <PageHeader eyebrow="Mi ruta" title="Tu ruta de retos" subtitle={`${companion.name} arma retos según tu nivel en cada tema. La IA los redacta y el servidor verifica cada respuesta antes de guardarla.`} />
      <div className="grid cols-3" style={{ alignItems: 'start' }}>
        <div className="span-2 stack" style={{ gap: 16 }}>
          {data?.suggestion && (
            <Reveal>
              <div className="card route-hero">
                <Ring value={data.average * 10} size={92} stroke={10} color="#fff" track="rgba(255,255,255,.25)">
                  <div style={{ textAlign: 'center', color: '#fff' }}><b style={{ fontSize: 22 }}>{data.average}</b><div style={{ fontSize: 11, opacity: 0.85 }}>de 10</div></div>
                </Ring>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>{companion.name} sugiere</div>
                  <h3 style={{ margin: '4px 0 6px', fontSize: 22 }}>{data.suggestion.name}</h3>
                  <p style={{ margin: 0, opacity: 0.9 }}>Es tu tema con menos nivel (nivel {data.suggestion.level}). Dos aciertos seguidos te suben de nivel.</p>
                </div>
                <button className="btn lg" style={{ background: '#fff', color: 'var(--violet)' }} disabled={Boolean(busy)} onClick={() => generate(data.suggestion!.topicId)}>
                  {busy === data.suggestion.topicId ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />} Dame 3 retos
                </button>
              </div>
            </Reveal>
          )}
          {error && <p className="form-error">{error}</p>}
          <AnimatePresence>
            {data?.pending.map((item) => <Challenge key={item.id} item={item} onDone={() => client.invalidateQueries({ queryKey: ['route'] })} />)}
          </AnimatePresence>
          {data && !data.pending.length && (
            <Empty icon={Compass} title="Sin retos pendientes" body={`Pide retos de un tema o deja que ${companion.name} elija el que más necesitas.`} />
          )}
          {!!data?.recent.length && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Últimos retos</h3>
              <div className="stack" style={{ gap: 8 }}>
                {data.recent.map((r) => (
                  <div key={r.id} className="row g-12" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    {r.status === 'correct' ? <CheckCircle2 size={18} color="var(--mint)" /> : r.status === 'wrong' ? <XCircle size={18} color="var(--coral)" /> : <SkipForward size={18} color="var(--muted)" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.prompt}</div>
                      <div className="muted" style={{ fontSize: 12.5 }}>{r.topic} · nivel {r.level} · {r.given ? `respondiste ${r.given}, ` : ''}respuesta {r.answer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>Temas</h3>
            <button className="btn sm ghost" disabled={Boolean(busy)} onClick={() => generate()}>{busy === 'auto' ? <Loader2 size={14} className="spin" /> : <Target size={14} />} Sorpréndeme</button>
          </div>
          {data?.topics.map((topic, i) => (
            <Reveal key={topic.id} delay={i * 0.03}>
              <div className="card topic-card">
                <div className="row between g-8">
                  <b style={{ fontSize: 14 }}>{topic.name}</b>
                  <span className="chip violet">N{topic.level}</span>
                </div>
                <LevelBar level={topic.level} />
                <div className="row between" style={{ marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 12 }}>{topic.attempt_count ? `${topic.correct_count}/${topic.attempt_count} aciertos` : 'Sin intentos'}{topic.pending ? ` · ${topic.pending} pendientes` : ''}</span>
                  <button className="btn sm ghost" disabled={Boolean(busy)} onClick={() => generate(topic.id)}>{busy === topic.id ? <Loader2 size={14} className="spin" /> : 'Practicar'}</button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

function Challenge({ item, onDone }: { item: Pending; onDone: () => void }) {
  const client = useQueryClient();
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [skipped, setSkipped] = useState<{ answer: string; explanation: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!answer.trim()) return;
    setSending(true);
    setError(null);
    try {
      const outcome = await api<Result>(`/api/route/items/${item.id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) });
      setResult(outcome);
      if (outcome.correct) client.invalidateQueries({ queryKey: ['me-game'] });
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

  async function skip() {
    setSkipped(await api(`/api/route/items/${item.id}/skip`, { method: 'POST' }));
  }

  const done = result || skipped;
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className={`card challenge ${result ? (result.correct ? 'ok' : 'bad') : ''}`}>
      <div className="row g-8 wrap" style={{ marginBottom: 10 }}>
        <span className="chip violet">{item.topic}</span>
        <span className="chip">Nivel {item.level}</span>
        <span className={`chip ${item.source === 'ia' ? 'sky' : ''}`}>{item.source === 'ia' ? <><Sparkles size={12} /> Redactado por IA</> : 'Plantilla'}</span>
        <span style={{ marginLeft: 'auto' }}><SpeakButton text={item.prompt} label="Leer" /></span>
      </div>
      <p className="challenge-prompt">{item.prompt}</p>
      {!done && (
        <>
          {hint && <p className="hint"><Lightbulb size={15} /> {item.hint}</p>}
          <form className="composer" onSubmit={submit}>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Tu respuesta: 3/4, 2,5, 1.200…" inputMode="text" autoComplete="off" />
            <MicButton onText={(text) => setAnswer(spokenAnswer(text) || text)} />
            <button className="btn" type="submit" disabled={sending || !answer.trim()}>{sending ? <Loader2 size={16} className="spin" /> : 'Responder'}</button>
          </form>
          {error && <p className="form-error">{error}</p>}
          <div className="row g-8" style={{ marginTop: 10 }}>
            {!hint && <button className="btn sm ghost" onClick={() => setHint(true)}><Lightbulb size={14} /> Pista</button>}
            <button className="btn sm ghost" onClick={skip}><SkipForward size={14} /> Saltar</button>
          </div>
        </>
      )}
      {result && (
        <div className="challenge-result">
          <div className="row g-8" style={{ fontWeight: 800, fontSize: 16 }}>
            {result.correct ? <><CheckCircle2 color="var(--mint)" /> ¡Correcto!</> : <><XCircle color="var(--coral)" /> La respuesta era {result.answer}</>}
            {result.mastery.change === 1 && <span className="chip mint"><TrendingUp size={12} /> Subiste a nivel {result.mastery.level}</span>}
            {result.mastery.change === -1 && <span className="chip coral"><TrendingDown size={12} /> Bajaste a nivel {result.mastery.level}</span>}
          </div>
          <p style={{ margin: '8px 0' }}>{result.explanation}</p>
          <p className="muted row g-4" style={{ fontSize: 12.5, margin: 0 }}><ShieldCheck size={14} /> {VERIFICATION[result.verification]}</p>
        </div>
      )}
      {skipped && (
        <div className="challenge-result">
          <b>Respuesta: {skipped.answer}</b>
          <p style={{ margin: '6px 0 0' }}>{skipped.explanation}</p>
        </div>
      )}
      {done && <button className="btn sm" style={{ marginTop: 12 }} onClick={onDone}>Siguiente</button>}
    </motion.div>
  );
}
