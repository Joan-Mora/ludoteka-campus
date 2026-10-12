import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  Compass,
  Fingerprint,
  Flame,
  Gamepad2,
  KeyRound,
  Library,
  Lock,
  Mail,
  Menu,
  Megaphone,
  NotebookPen,
  ScanFace,
  School,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { useAuth, type OtpChallenge, type SessionUser } from '@/shared/auth';
import { Sheet, ThemeButton, Tile } from '@/ui';
import { PasskeyLogin } from '@/shared/passkey';
import { useTheme } from '@/shared/theme';
import { buildingsFor, IsoCampus, Luka, phaseOf } from './campus';

function Brand({ light = true }: { light?: boolean }) {
  return (
    <Link to="/" className={`row g-12 brand-link${light ? '' : ' on-page'}`}>
      <img src="/favicon.svg" alt="" style={{ width: 40, height: 40, borderRadius: 12 }} />
      <div>
        <div className="brand-name">Ludoteka Campus</div>
        <div className="brand-sub">Colegio Francisco Arango</div>
      </div>
    </Link>
  );
}

function HeroCampus() {
  const phase = phaseOf(Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date())) % 24);
  const buildings = buildingsFor('student');
  const { dark } = useTheme();
  const shown = !dark ? 'day' : phase === 'day' || phase === 'dawn' ? 'dusk' : phase;
  return (
    <div className="hero-campus">
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
        <IsoCampus buildings={buildings} phase={shown} interactive={false} />
      </motion.div>
      <motion.div className="hero-luka" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
        <Luka mood="talking" size={92} />
        <div className="luka-bubble" style={{ marginBottom: 34 }}>
          <div className="luka-name"><Sparkles size={13} /> Luka</div>
          <p>¡Hola! Soy tu compañero IA. Te acompaño por el campus, te explico paso a paso y te escucho por voz.</p>
        </div>
      </motion.div>
      <motion.div className="float-card hero-float" style={{ right: 0, top: 10 }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}>
        <div className="row g-12">
          <Tile icon={ScanFace} tone="mint" />
          <div>
            <div style={{ fontWeight: 800 }}>Ingreso con tu rostro</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Con prueba de vida y cifrado</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const features = [
  { icon: School, color: '#ff8a5c', title: 'Aula', body: 'Cursos, lecciones, tareas y evaluaciones con integridad en tiempo real.' },
  { icon: Library, color: '#4f86f7', title: 'Biblioteca', body: 'Guías y lecturas en la nube con etiquetas, marcadores y glosario. Luka responde citando el documento.' },
  { icon: BrainCircuit, color: '#8b6cff', title: 'Laboratorio IA', body: 'Tutor socrático que da pistas, no respuestas, y se apaga solo durante los exámenes.' },
  { icon: Swords, color: '#ff5d73', title: 'Arena', body: 'Competencias por equipos con código QR, capitán rotativo y podio en el proyector.' },
  { icon: NotebookPen, color: '#19c39c', title: 'Cuaderno', body: 'Apuntes con resumen automático y tarjetas de repaso espaciado para no olvidar.' },
  { icon: Compass, color: '#3ab8ff', title: 'Mi ruta', body: 'Retos que se ajustan a tu dominio de cada tema, verificados por el servidor.' },
  { icon: Megaphone, color: '#ff5d73', title: 'Cartelera', body: 'Novedades por audiencia, foros del curso y confirmación de lectura para acudientes.' },
  { icon: Trophy, color: '#ffc83d', title: 'Sala de trofeos', body: 'XP, rachas, insignias y certificados con código QR verificable.' },
];

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Documentos legales">
      <Link to="/legal/terminos">Términos</Link>
      <Link to="/legal/privacidad">Tratamiento de datos</Link>
      <Link to="/legal/cookies">Cookies</Link>
    </nav>
  );
}

function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="public-nav">
      <Brand />
      <div className="row g-8 public-nav-desk">
        <a href="#acceso" className="btn glass">Cómo obtener mi cuenta</a>
        <ThemeButton className="icon-btn on-dark" />
        <Link to="/ingresar" className="btn white">Ingresar</Link>
      </div>
      <button className="icon-btn on-dark public-nav-burger" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={20} /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ludoteka Campus">
        <div className="stack g-10">
          <Link to="/ingresar" className="btn lg">Ingresar <ArrowRight size={18} /></Link>
          <a href="#acceso" className="btn ghost lg" onClick={() => setOpen(false)}>Cómo obtener mi cuenta</a>
          <ThemeButton className="btn ghost lg" label />
          <LegalLinks className="sheet-legal" />
        </div>
      </Sheet>
    </nav>
  );
}

export function Landing() {
  return (
    <div>
      <section className="landing">
        <div className="container">
          <PublicNav />
          <div className="grid cols-2" style={{ alignItems: 'center', gap: 40, padding: '56px 0 96px' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="chip landing-chip">
                <Zap size={14} /> Aula virtual gamificada · 2026
              </span>
              <h1 className="display" style={{ fontSize: 'clamp(46px, 6.2vw, 84px)', margin: '22px 0 20px' }}>
                Aprender se siente como <span className="text-grad">una aventura.</span>
              </h1>
              <p className="landing-lead" style={{ fontSize: 19, lineHeight: 1.6, maxWidth: 540 }}>
                Ludoteka Campus es el campus virtual del Colegio Francisco Arango: un mundo explorable donde cada edificio
                es una forma de aprender, con biblioteca, arena por equipos, tutor IA y acceso facial.
              </p>
              <div className="row g-12 wrap" style={{ marginTop: 32 }}>
                <Link to="/ingresar" className="btn lg">Entrar al aula <ArrowRight size={18} /></Link>
                <a href="#acceso" className="btn lg glass">Cómo obtener mi cuenta</a>
              </div>
              <div className="row g-24 wrap" style={{ marginTop: 44 }}>
                {[
                  ['8', 'edificios para aprender'],
                  ['6', 'roles: estudiante, docente, coordinación, rectoría, acudiente y administración'],
                  ['QR', 'en cada reporte y certificado'],
                ].map(([value, label]) => (
                  <div key={label} style={{ maxWidth: value === '6' ? 240 : 170 }}>
                    <div className="display" style={{ fontSize: 36 }}>{value}</div>
                    <div className="landing-stat">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
            <HeroCampus />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 52px' }}>
            <div className="eyebrow">Un edificio para cada forma de aprender</div>
            <h2 className="display" style={{ fontSize: 'clamp(34px, 4vw, 52px)', marginTop: 12 }}>Recorre el campus, no un menú.</h2>
            <p className="muted" style={{ marginTop: 12, fontSize: 17, lineHeight: 1.6 }}>Cada edificio muestra en vivo lo que te espera: lecciones pendientes, salas abiertas, avisos sin leer y tarjetas para repasar.</p>
          </div>
          <div className="grid cols-4">
            {features.map((feature, i) => (
              <motion.article
                key={feature.title}
                className="card hover feature building-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="building-ico" style={{ background: feature.color }}><feature.icon size={24} strokeWidth={2.4} /></span>
                <h3 style={{ fontSize: 20, margin: '16px 0 8px' }}>{feature.title}</h3>
                <p className="muted" style={{ lineHeight: 1.6, fontSize: 14.5 }}>{feature.body}</p>
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
                <p style={{ marginTop: 14, fontSize: 17, lineHeight: 1.6 }}>Cada rol tiene su espacio: estudiantes que avanzan, docentes que orquestan, acudientes que acompañan y rectoría que decide con datos.</p>
              </div>
              <div className="stack g-12">
                {[
                  { icon: BookOpen, title: 'Aprende', body: 'Lecciones, biblioteca y tutor IA que responde por voz.' },
                  { icon: Gamepad2, title: 'Practica', body: 'Mi ruta adaptativa, tarjetas de repaso y Arena por equipos.' },
                  { icon: ShieldCheck, title: 'Demuestra', body: 'Examen en kiosco con integridad en tiempo real.' },
                  { icon: BarChart3, title: 'Decide', body: 'Reportes PDF y Excel numerados y consultas en lenguaje natural.' },
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

      <section className="section" id="acceso" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 36px' }}>
            <div className="eyebrow">Cuentas institucionales</div>
            <h2 className="display" style={{ fontSize: 'clamp(30px, 3.6vw, 46px)', marginTop: 12 }}>Tu cuenta la entrega el colegio.</h2>
            <p className="muted" style={{ marginTop: 12, fontSize: 16.5, lineHeight: 1.6 }}>No hay registro público: así sabemos quién entra al campus y protegemos a los estudiantes menores de edad.</p>
          </div>
          <div className="grid cols-4">
            {[
              { icon: School, title: 'El colegio te crea', body: 'Secretaría o administración registran tu cuenta con tu correo, rol y grupo.' },
              { icon: Mail, title: 'Recibes un correo', body: 'Llega una clave temporal a tu correo. Acudientes y estudiantes reciben cada uno la suya.' },
              { icon: KeyRound, title: 'Primer ingreso seguro', body: 'Escribes un código de 6 dígitos que te enviamos y eliges tu propia contraseña.' },
              { icon: Fingerprint, title: 'Entra más rápido', body: 'Si quieres, activa Face ID, huella, Windows Hello o tu rostro desde Ajustes.' },
            ].map((step, i) => (
              <div key={step.title} className="card access-step">
                <span className="access-num">{i + 1}</span>
                <Tile icon={step.icon} tone="soft" large />
                <h3 style={{ fontSize: 18, margin: '14px 0 6px' }}>{step.title}</h3>
                <p className="muted" style={{ lineHeight: 1.55, fontSize: 14.5 }}>{step.body}</p>
              </div>
            ))}
          </div>
          <p className="muted" style={{ textAlign: 'center', marginTop: 20, fontSize: 14.5 }}>¿No te ha llegado el correo? Pide en secretaría que reenvíen tu acceso.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid cols-3">
          {[
            { icon: ScanFace, title: 'Privacidad por diseño', body: 'Acceso facial opcional con consentimiento (Ley 1581): la foto nunca sale del dispositivo y la plantilla se guarda cifrada.' },
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
          <LegalLinks />
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
        <ThemeButton className="icon-btn auth-theme" />
        <motion.div className="auth-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800 }}>{title}</h1>
          <p className="muted" style={{ margin: '8px 0 28px', fontSize: 15.5 }}>{subtitle}</p>
          {children}
          <LegalLinks className="auth-legal" />
        </motion.div>
      </section>
    </main>
  );
}

const labAccounts = [
  ['Estudiante', 'estudiante@eduquest.local'],
  ['Docente', 'docente@eduquest.local'],
  ['Coordinación', 'coordinacion@eduquest.local'],
  ['Acudiente', 'acudiente@eduquest.local'],
  ['Admin', 'admin@eduquest.local'],
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const go = (user: SessionUser) => navigate(user.mustChangePassword ? '/cambiar-clave' : '/app', { replace: true });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await login(String(data.get('email')), String(data.get('password')));
      if ('otp' in result) setChallenge(result.otp);
      else go(result.user);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo entrar');
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return <OtpStep challenge={challenge} onChallenge={setChallenge} onBack={() => setChallenge(null)} onDone={go} />;
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Ingresa con el correo y la contraseña que te entregó el colegio.">
      <form onSubmit={onSubmit}>
        <label className="field">Correo institucional<input name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@colegio.edu.co" required /></label>
        <label className="field">Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required /></label>
        <div className="row between wrap g-8" style={{ marginBottom: 18 }}>
          <Link to="/recuperar" style={{ color: 'var(--violet-2)', fontWeight: 700, fontSize: 14 }}>¿Olvidaste tu contraseña?</Link>
          <Link to="/ingresar/rostro" className="row g-4" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 14 }}><ScanFace size={15} /> Acceso facial</Link>
        </div>
        {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={busy}>{busy ? 'Verificando…' : 'Continuar'} <ArrowRight size={18} /></button>
      </form>
      <PasskeyLogin onDone={go} />
      <p className="muted" style={{ marginTop: 20, textAlign: 'center', fontSize: 14 }}>
        ¿No tienes cuenta? El colegio la crea por ti. <a href="/#acceso" style={{ color: 'var(--violet-2)', fontWeight: 800 }}>Cómo obtenerla</a>
      </p>
      {import.meta.env.DEV && (
        <div className="card" style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Cuentas de laboratorio</div>
          <div className="row g-8 wrap">
            {labAccounts.map(([label, value]) => (
              <button key={value} type="button" className="chip violet" onClick={() => setEmail(value)}>{label}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>La clave está en SEED_PASSWORD. El código llega al buzón de LAB_OTP_INBOX.</p>
        </div>
      )}
    </AuthLayout>
  );
}

function OtpStep({ challenge, onChallenge, onBack, onDone }: { challenge: OtpChallenge; onChallenge: (next: OtpChallenge) => void; onBack: () => void; onDone: (user: SessionUser) => void }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function submit(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      onDone(await verifyOtp(challenge.challengeId, value, trust));
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo verificar');
      if (err instanceof ApiException && (err.code === 'OTP_EXPIRED' || err.code === 'OTP_LOCKED')) window.setTimeout(onBack, 2500);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    try {
      onChallenge(await resendOtp(challenge.challengeId));
      setNotice('Te enviamos un código nuevo.');
      setWait(30);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo reenviar');
    }
  }

  return (
    <AuthLayout title="Revisa tu correo" subtitle={`Escribe el código de 6 dígitos que enviamos a ${challenge.maskedEmail}. Vence en 10 minutos.`}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="field">
          Código de verificación
          <input
            className="otp-input"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(next);
              if (next.length === 6) void submit(next);
            }}
            placeholder="••••••"
            aria-describedby="otp-help"
          />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
          <span>Recordar este dispositivo por 30 días. No lo marques en computadores compartidos.</span>
        </label>
        {challenge.devCode && (
          <button type="button" className="chip violet" style={{ marginBottom: 12 }} onClick={() => { setCode(challenge.devCode!); void submit(challenge.devCode); }}>
            Código de desarrollo: {challenge.devCode}
          </button>
        )}
        {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
        {notice && !error && <p className="ok-text" style={{ marginBottom: 12 }}>{notice}</p>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Entrar al aula'} <ArrowRight size={18} /></button>
      </form>
      <div id="otp-help" className="row between wrap g-8" style={{ marginTop: 16, fontSize: 14 }}>
        <button type="button" className="link-btn" onClick={onBack}>Usar otra cuenta</button>
        <button type="button" className="link-btn" disabled={wait > 0} onClick={resend}>{wait > 0 ? `Reenviar código en ${wait} s` : 'Reenviar código'}</button>
      </div>
    </AuthLayout>
  );
}

export function ChangePasswordPage() {
  const { user, ready, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  if (!user) return <Navigate to="/ingresar" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = String(data.get('newPassword'));
    if (next !== String(data.get('confirm'))) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await changePassword(String(data.get('currentPassword')), next);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={user.mustChangePassword ? 'Crea tu contraseña' : 'Cambia tu contraseña'}
      subtitle={user.mustChangePassword ? 'Tu cuenta tiene una clave temporal. Elige una propia para continuar: mínimo 8 caracteres, con letras y números.' : 'Mínimo 8 caracteres, con letras y números.'}
    >
      <form onSubmit={onSubmit}>
        <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <label className="field">{user.mustChangePassword ? 'Clave temporal (la del correo)' : 'Contraseña actual'}<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label className="field">Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label className="field">Repite la nueva contraseña<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
        {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={busy}>{busy ? 'Guardando…' : 'Guardar y entrar'} <ArrowRight size={18} /></button>
      </form>
      <p style={{ marginTop: 18, textAlign: 'center' }}>
        <button type="button" className="link-btn" onClick={async () => { await logout(); navigate('/ingresar'); }}>Salir</button>
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
    <main className="landing" style={{ minHeight: 'var(--vh-full)' }}>
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
    <main className="landing" style={{ minHeight: 'var(--vh-full)' }}>
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
              <div className="table-scroll" style={{ marginTop: 20 }}><table className="table">
                <tbody>
                  <tr><th>N.º consecutivo</th><td style={{ fontFamily: 'monospace', fontWeight: 800 }}>{query.data.code}</td></tr>
                  <tr><th>Tipo</th><td>{query.data.kind}</td></tr>
                  <tr><th>Formato</th><td>{query.data.format.toUpperCase()}</td></tr>
                  <tr><th>Registros incluidos</th><td>{query.data.rows}</td></tr>
                  <tr><th>Fecha de generación</th><td>{new Date(query.data.generatedAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
                  <tr><th>Generado por</th><td>{query.data.generatedBy}</td></tr>
                </tbody>
              </table></div>
              <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>La verificación confirma que el documento fue emitido por el sistema; el contenido sensible no se publica.</p>
            </motion.article>
          )}
        </div>
      </div>
    </main>
  );
}
