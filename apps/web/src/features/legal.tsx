import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, FileText, Scale, ShieldCheck, UserRound, Users } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Tile, ThemeButton } from '@/ui';
import { AuthLayout, LegalLinks } from './public';

type Kind = 'terminos' | 'privacidad' | 'cookies';

interface PublicDocument {
  kind: Kind;
  version: string;
  title: string;
  publishedAt: string;
}

export interface LegalStatus {
  documents: { id: string; kind: Kind; version: string; title: string; acceptedAt: string | null; acceptedBy: string | null }[];
  pending: boolean;
  ownPending: boolean;
  needsGuardian: boolean;
  wards: { id: string; fullName: string }[];
}

const SCHOOL = 'Colegio Francisco Arango';
const PROCESSORS = [
  ['Render (Estados Unidos)', 'alojamiento de la aplicación'],
  ['Cockroach Labs (Estados Unidos)', 'base de datos'],
  ['Cloudinary (Estados Unidos)', 'archivos de la biblioteca y del aula'],
  ['Resend (Estados Unidos)', 'envío de correos de acceso y avisos'],
  ['Google (Gemini API)', 'compañero de IA: recibe la pregunta del estudiante sin nombre, correo ni otros datos que lo identifiquen'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Terminos() {
  return (
    <>
      <Section title="1. Qué es Ludoteka Campus">
        <p>Ludoteka Campus es el aula virtual del {SCHOOL}. Está destinada exclusivamente a su comunidad educativa: estudiantes, docentes, directivos, acudientes y personal administrativo.</p>
      </Section>
      <Section title="2. Cuentas">
        <p>Las cuentas las crea el colegio; no hay registro público. Cada persona es responsable de su cuenta: no debe compartir su contraseña, sus códigos de verificación ni sus llaves de acceso (passkeys), y debe avisar a secretaría si sospecha que alguien más la usa.</p>
        <p>El colegio puede suspender una cuenta cuando la persona deja de pertenecer a la comunidad educativa o cuando se incumplen estos términos o el Manual de Convivencia.</p>
      </Section>
      <Section title="3. Uso aceptable">
        <ul>
          <li>Usar el campus con fines educativos y con respeto hacia los demás.</li>
          <li>No suplantar a otras personas ni intentar acceder a cuentas, datos o funciones que no le corresponden.</li>
          <li>No publicar contenido ofensivo, discriminatorio, violento o que vulnere derechos de terceros.</li>
          <li>Presentar las evaluaciones con honestidad. El modo examen registra eventos de integridad (cambios de pestaña, pérdida de foco) que el docente puede revisar.</li>
        </ul>
      </Section>
      <Section title="4. Inteligencia artificial">
        <p>El compañero de IA (Luka o Luna) da pistas y explicaciones; puede equivocarse y no reemplaza al docente. Se desactiva durante los exámenes. No se le envían nombres, correos ni otros datos que identifiquen a estudiantes menores de edad.</p>
      </Section>
      <Section title="5. Contenidos">
        <p>Los materiales del colegio y de los docentes se ofrecen para uso educativo dentro de la comunidad. Quien publica un contenido declara tener derecho a compartirlo.</p>
      </Section>
      <Section title="6. Disponibilidad y cambios">
        <p>El colegio procura que el servicio esté disponible, pero puede haber interrupciones por mantenimiento o por causas ajenas. Estos términos pueden cambiar; cuando cambien publicaremos una nueva versión y pediremos aceptarla de nuevo al ingresar.</p>
      </Section>
      <Section title="7. Menores de edad">
        <p>Para estudiantes menores de edad, el acudiente acepta estos términos y la política de tratamiento de datos en su nombre desde su propia cuenta. Si el estudiante no tiene acudiente vinculado, debe aceptarlos junto con él.</p>
      </Section>
    </>
  );
}

function Privacidad() {
  return (
    <>
      <Section title="1. Responsable del tratamiento">
        <p>El {SCHOOL} es responsable del tratamiento de los datos personales recogidos en Ludoteka Campus, en los términos de la Ley 1581 de 2012 y el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).</p>
        <p>Canales de atención: Ajustes › Privacidad dentro del campus, la secretaría del colegio y el correo de protección de datos que el colegio designe <span className="legal-todo">[por completar]</span>.</p>
      </Section>
      <Section title="2. Datos que tratamos">
        <ul>
          <li><b>Identificación y contacto:</b> nombre, correo institucional, rol, grupo y vínculo acudiente–estudiante.</li>
          <li><b>Académicos:</b> avances, calificaciones, entregas, resultados de evaluaciones, eventos de integridad del modo examen, XP, insignias y certificados.</li>
          <li><b>Uso y seguridad:</b> fecha de ingreso, dispositivo y navegador, dirección IP y registro de auditoría de acciones sensibles.</li>
          <li><b>Contenido propio:</b> apuntes, tarjetas de repaso, mensajes al compañero de IA y publicaciones en foros.</li>
          <li><b>Biométricos (dato sensible, opcional):</b> la plantilla facial del acceso con rostro. La foto no sale del dispositivo; solo se guarda una plantilla numérica cifrada.</li>
        </ul>
        <p>Las llaves de acceso (Face ID, Touch ID, huella o Windows Hello) quedan en el dispositivo: el colegio solo guarda una llave pública que no permite reconstruir la huella ni el rostro.</p>
      </Section>
      <Section title="3. Finalidades">
        <ul>
          <li>Prestar el servicio educativo: cursos, lecciones, evaluaciones, boletines y certificados.</li>
          <li>Informar a los acudientes sobre el proceso de sus estudiantes.</li>
          <li>Proteger las cuentas: verificación por correo, detección de accesos indebidos y auditoría.</li>
          <li>Personalizar el aprendizaje (ruta de retos y repaso espaciado) y generar estadísticas institucionales.</li>
        </ul>
        <p>No vendemos datos ni los usamos con fines publicitarios.</p>
      </Section>
      <Section title="4. Niñas, niños y adolescentes">
        <p>El tratamiento de datos de menores respeta su interés superior y sus derechos fundamentales (artículo 7 de la Ley 1581 y artículo 12 del Decreto 1377). La autorización la otorga el acudiente, y se tiene en cuenta la opinión del menor según su madurez.</p>
      </Section>
      <Section title="5. Datos sensibles">
        <p>Nadie está obligado a entregar datos sensibles. El acceso facial es voluntario, requiere autorización expresa (del acudiente en el caso de menores) y puede eliminarse en cualquier momento desde Ajustes › Seguridad, sin afectar el uso del campus.</p>
      </Section>
      <Section title="6. Encargados y transferencia internacional">
        <p>Para operar el campus usamos proveedores que tratan datos por cuenta del colegio, con medidas de seguridad y confidencialidad:</p>
        <ul>
          {PROCESSORS.map(([name, use]) => <li key={name}><b>{name}:</b> {use}.</li>)}
        </ul>
        <p>Algunos de estos proveedores almacenan la información fuera de Colombia. Al aceptar esta política autorizas esa transmisión internacional para las finalidades descritas.</p>
      </Section>
      <Section title="7. Tus derechos">
        <p>Como titular (o acudiente del titular menor de edad) puedes conocer, actualizar y rectificar tus datos; pedir prueba de la autorización; ser informado del uso que se les da; revocar la autorización o pedir la supresión cuando no exista un deber legal o contractual de conservarlos, y presentar quejas ante la Superintendencia de Industria y Comercio.</p>
        <p>Desde Ajustes › Privacidad puedes descargar una copia de tus datos y solicitar su eliminación.</p>
      </Section>
      <Section title="8. Consultas y reclamos">
        <p>Las consultas se responden en máximo diez (10) días hábiles, prorrogables por cinco (5) más. Los reclamos se atienden en máximo quince (15) días hábiles, prorrogables por ocho (8) más, informando el motivo de la demora (artículos 14 y 15 de la Ley 1581).</p>
      </Section>
      <Section title="9. Seguridad y conservación">
        <p>Las contraseñas se guardan con argon2id, las sesiones son cortas, el acceso nuevo exige un código por correo y las plantillas faciales se cifran. Conservamos los datos mientras la persona pertenezca a la comunidad educativa y durante el tiempo que exijan las normas de archivo escolar.</p>
      </Section>
      <Section title="10. Vigencia">
        <p>Esta política rige desde su publicación. Si cambia, publicaremos una nueva versión y pediremos aceptarla de nuevo.</p>
      </Section>
    </>
  );
}

function Cookies() {
  const rows = [
    ['eq_refresh', 'Cookie', 'Mantener la sesión abierta. HttpOnly, segura y limitada a /api/auth.', '7 días'],
    ['lk_device', 'Cookie', 'Recordar un dispositivo de confianza para no pedir el código cada vez. Solo si lo eliges.', '30 días'],
    ['Token de acceso', 'sessionStorage', 'Autorizar cada petición mientras la pestaña esté abierta.', '20 minutos'],
    ['lk_theme', 'localStorage', 'Recordar el tema claro, oscuro o del sistema.', 'Hasta que lo borres'],
    ['lk_voice', 'localStorage', 'Recordar la voz elegida para el compañero de IA en este dispositivo.', 'Hasta que lo borres'],
  ];
  return (
    <>
      <Section title="Solo lo necesario">
        <p>Ludoteka Campus no usa cookies publicitarias ni de analítica de terceros. Solo guardamos lo indispensable para que inicies sesión de forma segura y para recordar tus preferencias.</p>
      </Section>
      <Section title="Qué guardamos">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Para qué</th><th>Duración</th></tr></thead>
            <tbody>
              {rows.map(([name, type, use, time]) => (
                <tr key={name}><td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{name}</td><td>{type}</td><td>{use}</td><td>{time}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Recursos externos">
        <p>Las fuentes tipográficas se cargan desde Google Fonts y los archivos de la biblioteca desde Cloudinary; estos servicios reciben la dirección IP del navegador al entregar el archivo.</p>
      </Section>
      <Section title="Cómo borrarlas">
        <p>Al cerrar sesión se elimina la sesión. Desde Ajustes › Seguridad puedes olvidar los dispositivos de confianza, y desde tu navegador puedes borrar todo lo guardado por este sitio.</p>
      </Section>
    </>
  );
}

const BODIES: Record<Kind, { title: string; icon: typeof Scale; Body: () => ReactNode }> = {
  terminos: { title: 'Términos y condiciones de uso', icon: Scale, Body: Terminos },
  privacidad: { title: 'Política de tratamiento de datos personales', icon: ShieldCheck, Body: Privacidad },
  cookies: { title: 'Aviso de cookies y almacenamiento local', icon: FileText, Body: Cookies },
};

function useDocuments() {
  return useQuery({ queryKey: ['legal-documents'], queryFn: () => api<PublicDocument[]>('/api/legal/documents'), staleTime: 60 * 60_000 });
}

export function TemplateBanner() {
  return (
    <div className="notice-warn" role="note" style={{ margin: '20px 0 4px' }}>
      <span><b>Plantilla pendiente de revisión jurídica.</b> Este texto es un modelo que el abogado del colegio debe revisar y completar antes de su publicación definitiva.</span>
    </div>
  );
}

export function LegalPage() {
  const { kind = '' } = useParams();
  const documents = useDocuments();
  if (!(kind in BODIES)) return <Navigate to="/legal/terminos" replace />;
  const { title, icon, Body } = BODIES[kind as Kind];
  const doc = documents.data?.find((d) => d.kind === kind);
  return (
    <main className="legal-page">
      <header className="legal-top">
        <Link to="/" className="row g-8 legal-back"><ArrowLeft size={18} /> Ludoteka Campus</Link>
        <ThemeButton className="icon-btn" />
      </header>
      <article className="legal-doc">
        <div className="row g-12" style={{ alignItems: 'flex-start' }}>
          <Tile icon={icon} tone="soft" large />
          <div>
            <div className="eyebrow">{SCHOOL}</div>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', marginTop: 4 }}>{title}</h1>
            {doc && <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Versión {doc.version} · publicada el {new Date(doc.publishedAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>}
          </div>
        </div>
        <TemplateBanner />
        <Body />
        <LegalLinks className="legal-foot" />
      </article>
    </main>
  );
}

export function AcceptPage() {
  const { user, ready, update, logout } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const status = useQuery({ queryKey: ['legal-status'], queryFn: () => api<LegalStatus>('/api/legal/status'), enabled: Boolean(user) });
  const [read, setRead] = useState(false);
  const [guardianPresent, setGuardianPresent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const settled = status.data && !status.data.pending;

  useEffect(() => {
    if (settled && user?.legalPending) update({ legalPending: false });
  }, [settled, user?.legalPending]);

  if (!ready) return null;
  if (!user) return <Navigate to="/ingresar" replace />;
  if (user.mustChangePassword) return <Navigate to="/cambiar-clave" replace />;
  if (settled) return user.legalPending ? null : <Navigate to="/app" replace />;

  const data = status.data;
  const minorWithoutGuardian = Boolean(user.isMinor && data?.ownPending && !data.needsGuardian);
  const canAccept = read && (!minorWithoutGuardian || guardianPresent);

  async function accept() {
    setBusy(true);
    setError('');
    try {
      const wards = data?.wards.map((w) => w.id) ?? [];
      const next = await api<LegalStatus>('/api/legal/accept', { method: 'POST', body: JSON.stringify({ wards, guardianPresent: minorWithoutGuardian ? guardianPresent : undefined }) });
      client.setQueryData(['legal-status'], next);
      update({ legalPending: next.pending });
      if (!next.pending) navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo registrar la aceptación');
    } finally {
      setBusy(false);
    }
  }

  const exit = (
    <p style={{ marginTop: 18, textAlign: 'center' }}>
      <button type="button" className="link-btn" onClick={async () => { await logout(); navigate('/ingresar'); }}>Salir</button>
    </p>
  );

  if (data?.needsGuardian) {
    return (
      <AuthLayout title="Falta la autorización de tu acudiente" subtitle="Como eres menor de edad, tu acudiente debe aceptar los términos y la política de datos en tu nombre.">
        <div className="card row g-12" style={{ background: 'var(--surface-2)', alignItems: 'flex-start' }}>
          <Tile icon={Users} tone="gold" />
          <p style={{ lineHeight: 1.55 }}>Pídele que entre a Ludoteka Campus con su cuenta: al ingresar verá la solicitud y podrá aceptarla. Después vuelve a entrar.</p>
        </div>
        <button className="btn lg ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => status.refetch()} disabled={status.isFetching}>Ya aceptó, revisar de nuevo</button>
        {exit}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Antes de entrar" subtitle="Lee y acepta los documentos del campus. Si publicamos una versión nueva, te la pediremos otra vez.">
      <div className="stack g-8">
        {(data?.documents ?? []).map((d) => (
          <Link key={d.id} to={`/legal/${d.kind}`} target="_blank" rel="noopener" className="setting-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="setting-ico"><FileText size={18} /></span>
            <span style={{ flex: 1 }}><b>{d.title}</b><br /><span className="muted" style={{ fontSize: 13 }}>Versión {d.version}{d.acceptedAt ? ' · aceptada' : ''}</span></span>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
      {data?.wards.length ? (
        <div className="card" style={{ marginTop: 16, background: 'var(--surface-2)' }}>
          <div className="row g-8" style={{ marginBottom: 8 }}><UserRound size={18} /><b>También aceptas en nombre de:</b></div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
            {data.wards.map((w) => <li key={w.id}>{w.fullName}, menor de edad a tu cargo</li>)}
          </ul>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Mientras no aceptes por ellos, no podrán usar el campus.</p>
        </div>
      ) : null}
      <label className="check-row" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
        <span>Leí y acepto los términos y condiciones, la política de tratamiento de datos personales y el aviso de cookies.</span>
      </label>
      {minorWithoutGuardian && (
        <label className="check-row">
          <input type="checkbox" checked={guardianPresent} onChange={(e) => setGuardianPresent(e.target.checked)} />
          <span>Mi acudiente leyó estos documentos conmigo y autoriza el tratamiento de mis datos.</span>
        </label>
      )}
      {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn lg" style={{ width: '100%' }} disabled={!canAccept || busy || !data} onClick={accept}>{busy ? 'Guardando…' : 'Aceptar y entrar'} <ArrowRight size={18} /></button>
      {exit}
    </AuthLayout>
  );
}
