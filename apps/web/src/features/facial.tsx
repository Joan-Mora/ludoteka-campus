import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Check, Cpu, Eye, KeyRound, Lock, ScanFace, ShieldCheck, Trash2, UserCheck, X } from 'lucide-react';
import { FACE_MODEL_ID, type LivenessAction } from '@eduquest/contracts';
import { api, ApiException } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { captureDescriptors, livenessCopy, loadFaceApi, mean, openCamera, runLiveness } from '@/shared/face';
import { PageHeader, Tile } from '@/ui';
import { AuthLayout } from './public';

type Phase = 'idle' | 'loading' | 'liveness' | 'capture' | 'sending' | 'done' | 'error';

interface Challenge { challengeId: string; action: LivenessAction }

function FaceScanner({ mode, disabled, label, onResult }: {
  mode: 'enroll' | 'login';
  disabled?: boolean;
  label: string;
  onResult: (samples: number[][], challengeId: string) => Promise<string | void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const total = mode === 'enroll' ? 5 : 3;

  async function start() {
    if (!video.current) return;
    let close: (() => void) | null = null;
    try {
      setPhase('loading');
      setProgress(0);
      setMessage('Cargando el modelo de reconocimiento (TensorFlow.js)…');
      const [faceapi, challenge] = await Promise.all([
        loadFaceApi(),
        api<Challenge>('/api/facial/challenge', { method: 'POST' }),
      ]);
      close = await openCamera(video.current);
      setPhase('liveness');
      setMessage(`Prueba de vida: ${livenessCopy[challenge.action]}`);
      await runLiveness(faceapi, video.current, canvas.current, challenge.action, setProgress);
      setPhase('capture');
      setProgress(0);
      setMessage(mode === 'enroll' ? 'Quédate quieto, mirando de frente. Tomando 5 muestras…' : 'Quédate quieto un momento…');
      const samples = await captureDescriptors(faceapi, video.current, canvas.current, total, (taken) => setProgress(taken / total));
      close();
      close = null;
      setPhase('sending');
      setMessage('Comparando en el servidor…');
      const done = await onResult(samples, challenge.challengeId);
      setPhase('done');
      setMessage(done || 'Listo.');
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof ApiException || error instanceof Error ? error.message : 'No se pudo completar');
    } finally {
      close?.();
    }
  }

  const live = phase === 'liveness' || phase === 'capture' || phase === 'loading';
  const ring = phase === 'done' ? 'var(--mint)' : phase === 'error' ? 'var(--coral)' : 'var(--violet)';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
        <motion.div
          style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `3px dashed ${ring}`, opacity: 0.7 }}
          animate={live ? { rotate: 360 } : { rotate: 0 }}
          transition={{ repeat: live ? Infinity : 0, duration: 8, ease: 'linear' }}
        />
        <svg width="256" height="256" style={{ position: 'absolute', inset: -8, transform: 'rotate(-90deg)' }}>
          <circle cx="128" cy="128" r="124" fill="none" stroke={ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 124} strokeDashoffset={2 * Math.PI * 124 * (1 - progress)} style={{ transition: 'stroke-dashoffset .25s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', background: 'var(--grad-night)', display: 'grid', placeItems: 'center' }}>
          <video ref={video} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: live || phase === 'sending' ? 'block' : 'none' }} />
          <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: live ? 'block' : 'none' }} />
          {!live && phase !== 'sending' && (
            <div style={{ color: '#fff' }}>
              {phase === 'done' ? <Check size={76} strokeWidth={3} /> : phase === 'error' ? <X size={76} strokeWidth={3} /> : <ScanFace size={80} strokeWidth={1.6} />}
            </div>
          )}
        </div>
      </div>
      <p style={{ minHeight: 48, marginTop: 20, fontWeight: 700, color: phase === 'error' ? 'var(--coral)' : phase === 'done' ? 'var(--mint)' : 'var(--ink-2)' }}>
        {message || (mode === 'enroll' ? 'Mira de frente a la cámara con buena luz.' : 'Ten la cámara a la altura de los ojos.')}
      </p>
      <button className="btn lg" style={{ marginTop: 8 }} disabled={disabled || (phase !== 'idle' && phase !== 'error' && phase !== 'done')} onClick={start}>
        <Camera size={18} /> {phase === 'error' ? 'Intentar de nuevo' : label}
      </button>
    </div>
  );
}

interface FacialStatus {
  consented: boolean;
  needsReconsent: boolean;
  guardianRequired: boolean;
  enrolled: boolean;
  samples: number;
  quality: number | null;
  enrolledAt: string | null;
  policyVersion: string;
  maxDistance: number;
  lockedUntil: string | null;
  remainingAttempts: number;
}

const reasonCopy: Record<string, string> = {
  ok: 'Correcto',
  unknown_email: 'Correo desconocido',
  no_template: 'Sin rostro registrado',
  no_consent: 'Sin consentimiento',
  guardian_required: 'Falta acudiente',
  locked: 'Bloqueado',
  liveness: 'Prueba de vida fallida',
  challenge: 'Reto inválido',
  distance: 'No coincidió',
  ambiguous: 'Ambiguo',
  quality: 'Muestras inconsistentes',
};

const howItWorks = [
  { icon: Cpu, title: 'Tecnología', body: 'face-api (TensorFlow.js) en el navegador: detector TinyFaceDetector, 68 puntos faciales y red ResNet-34 que produce un descriptor de 128 números.' },
  { icon: Eye, title: 'Captura y prueba de vida', body: 'La cámara se procesa en tu dispositivo. Primero haces un gesto aleatorio (parpadear o girar) y luego se toman 5 muestras. La foto nunca sale del equipo.' },
  { icon: UserCheck, title: 'Comparación', body: 'El servidor promedia las muestras, cifra el descriptor con AES-256-GCM y, al ingresar, mide la distancia euclidiana. Coincide si es menor al umbral.' },
  { icon: Lock, title: 'Errores y seguridad', body: 'Cada intento queda registrado con su motivo. Tras 5 fallos se bloquea 15 minutos. La contraseña siempre funciona y puedes borrar tu rostro cuando quieras.' },
];

export function FacialPage() {
  const { user } = useAuth();
  const status = useQuery({ queryKey: ['facial'], queryFn: () => api<FacialStatus>('/api/facial/consent'), enabled: Boolean(user) });
  const attempts = useQuery({
    queryKey: ['facial-attempts'],
    queryFn: () => api<{ id: string; mode: string; success: boolean; reason: string; distance: number | null; created_at: string }[]>('/api/facial/attempts'),
    enabled: Boolean(user),
  });
  const data = status.data;

  async function accept() {
    await api('/api/facial/consent', { method: 'POST', body: JSON.stringify({ accepted: true }) });
    status.refetch();
  }

  async function enroll(samples: number[][], challengeId: string) {
    const next = await api<FacialStatus>('/api/facial/enroll', { method: 'POST', body: JSON.stringify({ samples, challengeId, modelId: FACE_MODEL_ID }) });
    status.refetch();
    attempts.refetch();
    return `Rostro registrado con ${next.samples} muestras · calidad ${next.quality ?? 0}%.`;
  }

  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Acceso con rostro" subtitle="Reconocimiento facial con IA, prueba de vida y la contraseña siempre como respaldo." />
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <article className="card" style={{ padding: 28 }}>
          <div className="row g-12" style={{ marginBottom: 16 }}>
            <Tile icon={ShieldCheck} tone="mint" />
            <div>
              <div className="card-title">Autorización de datos biométricos</div>
              <div className="muted" style={{ fontSize: 13 }}>Ley 1581 de 2012 · Política {data?.policyVersion}</div>
            </div>
          </div>
          <p style={{ lineHeight: 1.7, color: 'var(--ink-2)' }}>
            Ludoteka Campus, para el Colegio Francisco Arango, trata un descriptor numérico de tu rostro con la única finalidad de
            reconocer tu cuenta al ingresar. La foto se procesa en tu dispositivo y no se envía ni se guarda. El descriptor se guarda
            cifrado y puedes borrarlo en cualquier momento. Si eres menor de edad, tu acudiente debe autorizarlo antes.
          </p>
          <div className="stack g-8" style={{ marginTop: 18 }}>
            {['Sin fotos: solo 128 números cifrados', 'Borrado cuando lo pidas', 'Contraseña siempre disponible'].map((item) => (
              <div key={item} className="row g-8" style={{ fontWeight: 600, fontSize: 14 }}><Check size={16} color="var(--mint)" strokeWidth={3} /> {item}</div>
            ))}
          </div>
          {data?.guardianRequired && <p className="chip coral" style={{ marginTop: 18 }}>Falta la autorización de tu acudiente</p>}
          {data && !data.consented && <button className="btn" style={{ marginTop: 20 }} onClick={accept}>{data.needsReconsent ? 'Aceptar la nueva política' : 'Acepto el tratamiento'}</button>}
          {data?.consented && <span className="chip mint" style={{ marginTop: 20 }}><Check size={14} /> Consentimiento vigente</span>}
        </article>

        <article className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 22, textAlign: 'center' }}>{data?.enrolled ? 'Tu rostro está registrado' : 'Registra tu rostro'}</h3>
          {data?.enrolled && (
            <div className="row g-8" style={{ justifyContent: 'center', margin: '10px 0 18px' }}>
              <span className="chip violet">{data.samples} muestras</span>
              <span className="chip mint">Calidad {data.quality}%</span>
              <span className="chip">Umbral {data.maxDistance}</span>
            </div>
          )}
          <div style={{ marginTop: 18 }}>
            <FaceScanner mode="enroll" label={data?.enrolled ? 'Volver a registrar' : 'Registrar mi rostro'} disabled={!data?.consented || data.guardianRequired} onResult={enroll} />
          </div>
          {data?.enrolled && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn ghost sm" onClick={async () => { await api('/api/facial/enroll', { method: 'DELETE' }); status.refetch(); }}>
                <Trash2 size={15} /> Borrar mi rostro
              </button>
            </div>
          )}
          {!data?.consented && <p className="muted" style={{ fontSize: 13, marginTop: 12, textAlign: 'center' }}>Primero acepta el tratamiento de datos.</p>}
        </article>
      </div>

      <div className="grid cols-4" style={{ marginTop: 18 }}>
        {howItWorks.map((item) => (
          <article key={item.title} className="card">
            <Tile icon={item.icon} tone="soft" />
            <div className="card-title" style={{ marginTop: 12, fontSize: 16 }}>{item.title}</div>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 6 }}>{item.body}</p>
          </article>
        ))}
      </div>

      <article className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <div className="card-title">Historial de accesos faciales</div>
          {data?.lockedUntil ? <span className="chip coral">Bloqueado hasta {new Date(data.lockedUntil).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span> : <span className="chip">{data?.remainingAttempts ?? 5} intentos disponibles</span>}
        </div>
        <table className="table">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Resultado</th><th>Distancia</th></tr></thead>
          <tbody>
            {(attempts.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString('es-CO')}</td>
                <td>{row.mode === 'enroll' ? 'Registro' : row.mode === 'identify' ? 'Identificación' : 'Verificación'}</td>
                <td><span className={`chip ${row.success ? 'mint' : 'coral'}`}>{reasonCopy[row.reason] ?? row.reason}</span></td>
                <td>{row.distance == null ? '—' : row.distance.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!attempts.data?.length && <p className="muted" style={{ padding: 16, textAlign: 'center' }}>Todavía no hay intentos.</p>}
      </article>
    </div>
  );
}

export function FacialLoginPage() {
  const { enter } = useAuth();
  const [email, setEmail] = useState('');

  async function login(samples: number[][], challengeId: string) {
    const data = await api<{ accessToken: string; user: Parameters<typeof enter>[1]; distance: number }>('/api/facial/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), descriptor: mean(samples), challengeId, modelId: FACE_MODEL_ID }),
    });
    enter(data.accessToken, data.user);
    setTimeout(() => { window.location.href = '/app'; }, 1100);
    return `¡Hola, ${data.user.fullName.split(' ')[0]}! Distancia ${data.distance} — identidad confirmada.`;
  }

  return (
    <AuthLayout title="Entrar con rostro" subtitle="Haz el gesto que te pidamos y mira a la cámara. Si no coincide, la contraseña sigue disponible.">
      <label className="field">Correo de la cuenta (opcional)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Déjalo vacío para que te reconozcamos" />
      </label>
      <div style={{ margin: '8px 0 12px' }}>
        <FaceScanner mode="login" label="Entrar con mi rostro" onResult={login} />
      </div>
      <div className="row g-16" style={{ justifyContent: 'center', marginTop: 12 }}>
        <Link to="/ingresar" className="row g-4" style={{ color: 'var(--violet-2)', fontWeight: 800, fontSize: 14 }}><ArrowLeft size={15} /> <KeyRound size={15} /> Usar contraseña</Link>
      </div>
    </AuthLayout>
  );
}
