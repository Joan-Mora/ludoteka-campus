import { FormEvent, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Check,
  Flame,
  Gamepad2,
  Lock,
  Map,
  Radio,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Ring, Tile } from '@/ui';

function Brand({ light = true }: { light?: boolean }) {
  return (
    <Link to="/" className="row g-12">
      <img src="/favicon.svg" alt="" style={{ width: 40, height: 40, borderRadius: 12 }} />
      <div>
        <div className="brand-name" style={{ color: light ? '#fff' : 'var(--ink)' }}>Ludoteka Campus</div>
        <div className="brand-sub" style={{ color: light ? '#a79fe0' : 'var(--muted)' }}>Colegio Francisco Arango</div>
      </div>
    </Link>
  );
}

function HeroPreview() {
  const nodes = [
    { state: 'done', x: 40 },
    { state: 'done', x: 110 },
    { state: 'next', x: 70 },
    { state: 'todo', x: 10 },
  ];
  return (
    <div style={{ position: 'relative', height: 520 }}>
      <motion.div
        className="glass"
        style={{ position: 'absolute', inset: '30px 20px 20px 60px', padding: 26 }}
        initial={{ opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="row between">
          <div>
            <div style={{ fontSize: 12, color: '#a79fe0', fontWeight: 700 }}>MATEMÁTICAS 6°</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>Aventura lógica</div>
          </div>
          <span className="chip" style={{ background: 'rgba(255,200,61,.18)', color: '#ffd66b', border: 0 }}><Flame size={14} /> 5 días</span>
        </div>
        <div style={{ position: 'relative', height: 300, marginTop: 20 }}>
          {nodes.map((node, i) => (
            <motion.div
              key={i}
              className={`node ${node.state}`}
              style={{ position: 'absolute', left: 60 + node.x, top: i * 72, width: 60, height: 56 }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4 + i * 0.12, type: 'spring', stiffness: 260, damping: 16 }}
            >
              {node.state === 'done' ? <Check size={26} strokeWidth={3.2} /> : node.state === 'next' ? <Star size={24} fill="#fff" /> : <Lock size={20} />}
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div className="float-card" style={{ right: -10, top: 10, width: 230 }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
        <div className="row g-12">
          <Ring value={72} size={62} stroke={8} track="#eee9ff"><b style={{ fontSize: 15 }}>N3</b></Ring>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Nivel Estratega</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>1.240 XP</div>
          </div>
        </div>
      </motion.div>

      <motion.div className="float-card" style={{ left: -10, bottom: 70, width: 250 }} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
        <div className="row g-12">
          <Tile icon={Trophy} tone="gold" />
          <div>
            <div style={{ fontWeight: 800 }}>¡Insignia desbloqueada!</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Examen perfecto · +50 XP</div>
          </div>
        </div>
      </motion.div>

      <motion.div className="float-card" style={{ right: 10, bottom: 0, width: 260 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
        <div className="row g-12">
          <Tile icon={ShieldCheck} tone="mint" />
          <div>
            <div style={{ fontWeight: 800 }}>Examen en kiosco</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Integridad en tiempo real</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const features = [
  { icon: Map, tone: 'violet' as const, title: 'Mapa de aventura', body: 'Unidades y lecciones como estaciones de un recorrido. Cada avance queda en tu camino.' },
  { icon: Trophy, tone: 'gold' as const, title: 'XP, niveles y ligas', body: 'Experiencia, rachas, insignias y misiones semanales que premian la constancia.' },
  { icon: Sparkles, tone: 'coral' as const, title: 'Tutor con IA', body: 'Pistas socráticas durante la práctica. Se apaga solo cuando hay un examen activo.' },
  { icon: Radio, tone: 'sky' as const, title: 'Clases en vivo', body: 'Preguntas en tiempo real para todo el grupo con marcador instantáneo.' },
  { icon: ShieldCheck, tone: 'mint' as const, title: 'Examen en kiosco', body: 'Pantalla completa, alertas al docente y suspensión automática por reincidencia.' },
  { icon: BadgeCheck, tone: 'violet' as const, title: 'Certificados verificables', body: 'Constancias PDF con código único que cualquiera puede validar en línea.' },
];

export function Landing() {
  return (
    <div>
      <section className="landing">
        <div className="container">
          <nav className="public-nav">
            <Brand />
            <div className="row g-8">
              <Link to="/ingresar" className="btn glass">Ingresar</Link>
              <Link to="/registro" className="btn white">Crear cuenta</Link>
            </div>
          </nav>
          <div className="grid cols-2" style={{ alignItems: 'center', gap: 40, padding: '56px 0 96px' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.08)', color: '#e9e6ff', border: '1px solid rgba(255,255,255,.15)' }}>
                <Zap size={14} color="#ffd66b" /> Aula virtual gamificada · 2026
              </span>
              <h1 className="display" style={{ fontSize: 'clamp(46px, 6.2vw, 84px)', margin: '22px 0 20px' }}>
                Aprender se siente como <span className="text-grad">una aventura.</span>
              </h1>
              <p style={{ fontSize: 19, lineHeight: 1.6, color: '#cfc9ff', maxWidth: 540 }}>
                Ludoteka Campus es el campus virtual del Colegio Francisco Arango: un mundo explorable donde cada edificio
                es una forma de aprender, con biblioteca, arena por equipos, tutor IA y acceso facial.
              </p>
              <div className="row g-12 wrap" style={{ marginTop: 32 }}>
                <Link to="/ingresar" className="btn lg">Entrar al aula <ArrowRight size={18} /></Link>
                <Link to="/registro" className="btn lg glass">Soy estudiante nuevo</Link>
              </div>
              <div className="row g-24 wrap" style={{ marginTop: 44 }}>
                {[
                  ['12', 'lecciones de Mate 6°'],
                  ['5', 'niveles por desbloquear'],
                  ['4+', 'reportes PDF y Excel'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div className="display" style={{ fontSize: 36 }}>{value}</div>
                    <div style={{ color: '#a79fe0', fontSize: 14, fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
            <HeroPreview />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 52px' }}>
            <div className="eyebrow">Todo lo que tu clase necesita</div>
            <h2 className="display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', marginTop: 12 }}>Un aula completa, no un quiz suelto.</h2>
          </div>
          <div className="grid cols-3">
            {features.map((feature, i) => (
              <motion.article
                key={feature.title}
                className="card hover feature"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
              >
                <Tile icon={feature.icon} tone={feature.tone} large />
                <h3 style={{ fontSize: 21, margin: '18px 0 8px' }}>{feature.title}</h3>
                <p className="muted" style={{ lineHeight: 1.6 }}>{feature.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="hero" style={{ padding: '56px 48px' }}>
            <div className="grid cols-2" style={{ alignItems: 'center', gap: 40, position: 'relative' }}>
              <div>
                <div className="eyebrow" style={{ color: '#ffd66b' }}>Cómo funciona</div>
                <h2 className="display" style={{ fontSize: 'clamp(30px, 3.6vw, 46px)', marginTop: 12 }}>Del primer clic al certificado.</h2>
                <p style={{ marginTop: 14, fontSize: 17, lineHeight: 1.6 }}>Cada rol tiene su espacio: estudiantes que avanzan, docentes que orquestan y rectoría que decide con datos.</p>
              </div>
              <div className="stack g-12">
                {[
                  { icon: BookOpen, title: 'Aprende', body: 'Lecciones cortas y tareas con retroalimentación.' },
                  { icon: Gamepad2, title: 'Practica', body: 'Minijuegos, tutor IA y quices en vivo.' },
                  { icon: ShieldCheck, title: 'Demuestra', body: 'Examen en kiosco con integridad en tiempo real.' },
                  { icon: BarChart3, title: 'Decide', body: 'Paneles y reportes para docentes y rectoría.' },
                ].map((step, i) => (
                  <div key={step.title} className="glass row g-16" style={{ padding: 16 }}>
                    <div className="display" style={{ fontSize: 28, width: 40, color: '#ffd66b' }}>0{i + 1}</div>
                    <step.icon size={22} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{step.title}</div>
                      <div style={{ color: '#cfc9ff', fontSize: 14 }}>{step.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid cols-3">
          {[
            { icon: ScanFace, title: 'Privacidad por diseño', body: 'Acceso facial opcional, en el dispositivo y con consentimiento según Ley 1581.' },
            { icon: Lock, title: 'Seguridad real', body: 'Sesiones cortas, contraseñas con argon2id y roles estrictos por perfil.' },
            { icon: BarChart3, title: 'Datos para decidir', body: 'Boletines, resultados e integridad exportables en PDF y Excel.' },
          ].map((item) => (
            <div key={item.title} className="row g-16" style={{ alignItems: 'flex-start' }}>
              <Tile icon={item.icon} tone="soft" large />
              <div>
                <h3 style={{ fontSize: 19 }}>{item.title}</h3>
                <p className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 0' }}>
        <div className="container row between wrap g-12">
          <Brand light={false} />
          <span className="muted" style={{ fontSize: 14 }}>© 2026 Colegio Francisco Arango · Ludoteka Campus</span>
        </div>
      </footer>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="auth">
      <section className="auth-art">
        <div className="orb" style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,255,.55), transparent 70%)', top: -120, right: -120 }} />
        <div className="orb" style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,93,115,.4), transparent 70%)', bottom: -140, left: -100 }} />
        <Brand />
        <div style={{ position: 'relative' }}>
          <h2 className="display" style={{ fontSize: 'clamp(36px, 3.8vw, 56px)' }}>Cada lección suma. <span className="text-grad">Cada logro cuenta.</span></h2>
          <div className="stack g-12" style={{ marginTop: 32, maxWidth: 420 }}>
            {[
              { icon: Zap, tone: 'gold' as const, text: 'Gana XP y sube de nivel' },
              { icon: Flame, tone: 'coral' as const, text: 'Mantén tu racha diaria' },
              { icon: Trophy, tone: 'violet' as const, text: 'Compite en la liga del grupo' },
            ].map((item) => (
              <div key={item.text} className="glass row g-12" style={{ padding: 12 }}>
                <Tile icon={item.icon} tone={item.tone} />
                <b>{item.text}</b>
              </div>
            ))}
          </div>
        </div>
        <p style={{ color: '#a79fe0', fontSize: 13, position: 'relative' }}>Aula virtual oficial · Colegio Francisco Arango</p>
      </section>
      <section className="auth-form">
        <motion.div className="auth-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800 }}>{title}</h1>
          <p className="muted" style={{ margin: '8px 0 28px', fontSize: 15.5 }}>{subtitle}</p>
          {children}
        </motion.div>
      </section>
    </main>
  );
}

const labAccounts = [
  ['Estudiante', 'estudiante@eduquest.local'],
  ['Docente', 'docente@eduquest.local'],
  ['Rectoría', 'rectoria@eduquest.local'],
  ['Admin', 'admin@eduquest.local'],
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await login(String(data.get('email')), String(data.get('password')));
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo entrar');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Ingresa para continuar tu aventura de aprendizaje.">
      <form onSubmit={onSubmit}>
        <label className="field">Correo institucional<input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@colegio.edu.co" required /></label>
        <label className="field">Contraseña<input name="password" type="password" placeholder="••••••••" required /></label>
        <div className="row between" style={{ marginBottom: 18 }}>
          <Link to="/recuperar" style={{ color: 'var(--violet-2)', fontWeight: 700, fontSize: 14 }}>¿Olvidaste tu contraseña?</Link>
          <Link to="/ingresar/rostro" className="row g-4" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 14 }}><ScanFace size={15} /> Acceso facial</Link>
        </div>
        {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={busy}>{busy ? 'Entrando…' : 'Entrar al aula'} <ArrowRight size={18} /></button>
      </form>
      <p className="muted" style={{ marginTop: 20, textAlign: 'center', fontSize: 14.5 }}>
        ¿Eres nuevo? <Link to="/registro" style={{ color: 'var(--violet-2)', fontWeight: 800 }}>Crea tu cuenta</Link>
      </p>
      {import.meta.env.DEV && (
        <div className="card" style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Cuentas de laboratorio</div>
          <div className="row g-8 wrap">
            {labAccounts.map(([label, value]) => (
              <button key={value} type="button" className="chip violet" onClick={() => setEmail(value)}>{label}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>La clave está en SEED_PASSWORD.</p>
        </div>
      )}
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await register(String(data.get('fullName')), String(data.get('email')), String(data.get('password')));
      navigate('/app');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo crear la cuenta');
    }
  }
  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Cuenta de estudiante. Tu docente te asignará al grupo.">
      <form onSubmit={onSubmit}>
        <label className="field">Nombre completo<input name="fullName" placeholder="Ana María Pérez" required /></label>
        <label className="field">Correo<input name="email" type="email" placeholder="tu@correo.com" required /></label>
        <label className="field">Contraseña<input name="password" type="password" placeholder="Mínimo 8 caracteres" required /></label>
        {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
        <button className="btn lg" type="submit" style={{ width: '100%' }}>Comenzar mi aventura <ArrowRight size={18} /></button>
      </form>
      <p className="muted" style={{ marginTop: 20, textAlign: 'center', fontSize: 14.5 }}>
        ¿Ya tienes cuenta? <Link to="/ingresar" style={{ color: 'var(--violet-2)', fontWeight: 800 }}>Ingresa</Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPage() {
  const [sent, setSent] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email: String(data.get('email')) }) });
    setSent(true);
  }
  return (
    <AuthLayout title="Recupera tu acceso" subtitle="Te enviaremos un enlace válido por una hora.">
      {sent ? (
        <div className="card row g-12" style={{ background: 'var(--surface-2)' }}>
          <Tile icon={Check} tone="mint" />
          <p>Si el correo existe, enviamos un enlace. En el laboratorio sin Resend, el enlace queda en la consola de la API.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <label className="field">Correo<input name="email" type="email" required /></label>
          <button className="btn lg" type="submit" style={{ width: '100%' }}>Enviar enlace</button>
        </form>
      )}
      <p style={{ marginTop: 20, textAlign: 'center' }}><Link to="/ingresar" style={{ color: 'var(--violet-2)', fontWeight: 800 }}>Volver a ingresar</Link></p>
    </AuthLayout>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token: params.get('token'), password: String(data.get('password')) }) });
      navigate('/ingresar');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo cambiar');
    }
  }
  return (
    <AuthLayout title="Nueva contraseña" subtitle="Elige una contraseña segura para tu cuenta.">
      <form onSubmit={onSubmit}>
        <label className="field">Contraseña<input name="password" type="password" required /></label>
        {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
        <button className="btn lg" type="submit" style={{ width: '100%' }}>Guardar contraseña</button>
      </form>
    </AuthLayout>
  );
}

export function VerifyPage() {
  const { code = '' } = useParams();
  const query = useQuery({
    queryKey: ['cert', code],
    queryFn: () => api<{ student: string; title: string; course: string; issuedAt: string; code: string }>(`/api/public/certificates/${code}`),
  });
  return (
    <main className="landing" style={{ minHeight: '100vh' }}>
      <div className="container">
        <nav className="public-nav"><Brand /></nav>
        <div style={{ maxWidth: 640, margin: '40px auto' }}>
          {query.isError && (
            <div className="card" style={{ textAlign: 'center' }}>
              <Tile icon={Lock} tone="coral" large />
              <h2 style={{ marginTop: 14 }}>Código no encontrado</h2>
              <p className="muted" style={{ marginTop: 6 }}>Ese código no está registrado en el colegio.</p>
            </div>
          )}
          {query.data && (
            <motion.article className="card" style={{ padding: 40, textAlign: 'center', border: '2px solid transparent', backgroundImage: 'linear-gradient(var(--surface), var(--surface)), var(--grad-brand)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="badge-medal" style={{ background: 'var(--grad-mint)' }}><BadgeCheck size={40} /></div>
              <span className="chip mint">Certificado auténtico</span>
              <p className="eyebrow" style={{ marginTop: 20 }}>Colegio Francisco Arango certifica que</p>
              <h1 className="display" style={{ fontSize: 42, margin: '10px 0' }}>{query.data.student}</h1>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{query.data.title}</p>
              <p className="muted" style={{ marginTop: 4 }}>{query.data.course} · {new Date(query.data.issuedAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
              <div className="chip" style={{ marginTop: 18, fontFamily: 'monospace' }}>{query.data.code}</div>
              <div style={{ marginTop: 24 }}>
                <a className="btn" href={`/api/public/certificates/${query.data.code}/pdf`}>Descargar PDF</a>
              </div>
            </motion.article>
          )}
        </div>
      </div>
    </main>
  );
}

export function VerifyReportPage() {
  const { code = '' } = useParams();
  const query = useQuery({
    queryKey: ['report-verify', code],
    queryFn: () => api<{ code: string; kind: string; format: string; title: string; rows: number; generatedAt: string; generatedBy: string }>(`/api/public/reports/${encodeURIComponent(code)}`),
    retry: false,
  });
  return (
    <main className="landing" style={{ minHeight: '100vh' }}>
      <div className="container">
        <nav className="public-nav"><Brand /></nav>
        <div style={{ maxWidth: 640, margin: '40px auto' }}>
          {query.isError && (
            <div className="card" style={{ textAlign: 'center' }}>
              <Tile icon={Lock} tone="coral" large />
              <h2 style={{ marginTop: 14 }}>Reporte no registrado</h2>
              <p className="muted" style={{ marginTop: 6 }}>El número {code} no corresponde a ningún documento emitido por Ludoteka Campus.</p>
            </div>
          )}
          {query.data && (
            <motion.article className="card" style={{ padding: 36 }} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div className="row g-12">
                <Tile icon={BadgeCheck} tone="mint" large />
                <div>
                  <span className="chip mint">Documento auténtico</span>
                  <h2 style={{ marginTop: 6 }}>{query.data.title}</h2>
                </div>
              </div>
              <table className="table" style={{ marginTop: 20 }}>
                <tbody>
                  <tr><th>N.º consecutivo</th><td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{query.data.code}</td></tr>
                  <tr><th>Tipo</th><td>{query.data.kind}</td></tr>
                  <tr><th>Formato</th><td>{query.data.format.toUpperCase()}</td></tr>
                  <tr><th>Registros incluidos</th><td>{query.data.rows}</td></tr>
                  <tr><th>Fecha de generación</th><td>{new Date(query.data.generatedAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
                  <tr><th>Generado por</th><td>{query.data.generatedBy}</td></tr>
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>La verificación confirma que el documento fue emitido por el sistema; el contenido sensible no se publica.</p>
            </motion.article>
          )}
        </div>
      </div>
    </main>
  );
}
