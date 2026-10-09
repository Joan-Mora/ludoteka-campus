import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  Laptop,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Play,
  ScanFace,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiException, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { COMPANIONS, useCompanion, type CompanionId } from '@/shared/companion';
import { PasskeyManager } from '@/shared/passkey';
import { useTheme, type ThemeChoice } from '@/shared/theme';
import { saveVoiceURI, savedVoiceURI, sayWith, spanishVoices, useVoices, voiceFor, voiceGender, voiceSupport, type VoiceGender } from '@/shared/voice';
import { Avatar, PageHeader } from '@/ui';
import { roleLabel } from '@/app/nav';
import { Luka } from './campus';

type Section = 'perfil' | 'seguridad' | 'companero' | 'apariencia' | 'privacidad';

const SECTIONS: [Section, string, LucideIcon][] = [
  ['perfil', 'Perfil', UserRound],
  ['seguridad', 'Seguridad', Shield],
  ['companero', 'Compañero IA', Sparkles],
  ['apariencia', 'Apariencia', Palette],
  ['privacidad', 'Privacidad', FileText],
];

const errorText = (error: unknown) => (error instanceof ApiException || error instanceof Error ? error.message : 'Algo salió mal');
const when = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function Block({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card settings-block">
      <header className="row g-12" style={{ marginBottom: 14 }}>
        <span className="setting-ico"><Icon size={18} /></span>
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 13.5 }}>{subtitle}</div>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const section = (SECTIONS.find(([key]) => key === params.get('seccion'))?.[0] ?? 'perfil') as Section;
  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Ajustes" subtitle="Tu perfil, cómo entras, tu compañero de IA y tus datos." />
      <div className="row g-8 seg" style={{ marginBottom: 18 }} role="tablist" aria-label="Secciones de ajustes">
        {SECTIONS.map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={section === key}
            className={`btn sm ${section === key ? '' : 'ghost'}`}
            style={section === key ? undefined : { border: 0 }}
            onClick={() => setParams({ seccion: key }, { replace: true })}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="settings-grid">
        {section === 'perfil' && <ProfileSection />}
        {section === 'seguridad' && <SecuritySection />}
        {section === 'companero' && <CompanionSection />}
        {section === 'apariencia' && <AppearanceSection />}
        {section === 'privacidad' && <PrivacySection />}
      </div>
    </div>
  );
}

/* ---------- Perfil ---------- */

function ProfileSection() {
  const { user, changePassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!user) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get('next'));
    if (next !== String(data.get('confirm'))) return setError('Las contraseñas nuevas no coinciden');
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await changePassword(String(data.get('current')), next);
      form.reset();
      setNotice('Contraseña actualizada. Cerramos tus otras sesiones por seguridad.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Block icon={UserRound} title="Perfil" subtitle="Tu nombre, correo y rol los administra el colegio.">
        <div className="m-profile">
          <Avatar name={user.fullName} large />
          <div style={{ minWidth: 0 }}>
            <b className="ellipsis" style={{ fontSize: 17 }}>{user.fullName}</b>
            <span className="muted ellipsis">{user.email}</span>
            <div className="row g-8 wrap" style={{ marginTop: 6 }}>
              <span className="chip violet">{roleLabel[user.role]}</span>
              {user.isMinor && <span className="chip">Menor de edad</span>}
            </div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>Si algún dato está mal, pídele a la secretaría que lo corrija.</p>
      </Block>
      <Block icon={ShieldCheck} title="Cambiar contraseña" subtitle="Mínimo 8 caracteres, con al menos una letra y un número.">
        <form onSubmit={submit}>
          <label className="field">Contraseña actual<input name="current" type="password" autoComplete="current-password" required /></label>
          <label className="field">Nueva contraseña<input name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label className="field">Repite la nueva contraseña<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
          {error && <p className="form-error">{error}</p>}
          {notice && <p className="ok-text">{notice}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </form>
      </Block>
    </>
  );
}

/* ---------- Seguridad ---------- */

interface SessionRow { id: string; device: string; method: string; ip: string | null; startedAt: string; lastActiveAt: string; current: boolean }
interface DeviceRow { id: string; label: string; createdAt: string; lastUsedAt: string | null; expiresAt: string }
interface FacialStatus { consented: boolean; guardianRequired: boolean; enrolled: boolean; enrolledAt: string | null }

function SecuritySection() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { logoutEverywhere } = useAuth();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<SessionRow[]>('/api/auth/sessions') });
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api<DeviceRow[]>('/api/auth/devices') });
  const facial = useQuery({ queryKey: ['facial'], queryFn: () => api<FacialStatus>('/api/facial/consent') });
  const [error, setError] = useState('');

  async function closeSession(id: string) {
    try {
      await api(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      client.invalidateQueries({ queryKey: ['sessions'] });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function forget(id: string) {
    try {
      client.setQueryData(['devices'], await api<DeviceRow[]>(`/api/auth/devices/${id}`, { method: 'DELETE' }));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function everywhere() {
    if (!window.confirm('Se cerrará tu sesión en todos los dispositivos, incluido este, y se olvidarán los dispositivos de confianza. ¿Continuar?')) return;
    await logoutEverywhere();
    navigate('/ingresar', { replace: true });
  }

  return (
    <>
      <Block icon={ShieldCheck} title="Llaves de acceso" subtitle="Entra con Face ID, Touch ID, huella o Windows Hello, sin contraseña ni código.">
        <PasskeyManager />
      </Block>

      <Block icon={ScanFace} title="Acceso facial" subtitle="Ingreso con la cámara del colegio o de tu equipo. El patrón se guarda cifrado.">
        <p style={{ marginTop: 0 }}>
          {facial.data?.enrolled
            ? <span className="chip mint"><Check size={14} /> Activo desde {when(facial.data.enrolledAt)}</span>
            : facial.data?.guardianRequired
              ? <span className="chip gold">Necesita la autorización de tu acudiente</span>
              : <span className="chip">Sin configurar</span>}
        </p>
        <Link className="btn ghost" to="/app/rostro">{facial.data?.enrolled ? 'Revisar acceso facial' : 'Configurar acceso facial'}</Link>
      </Block>

      <Block icon={Laptop} title="Dispositivos de confianza" subtitle="En estos equipos no te pedimos el código del correo durante 30 días.">
        <div className="stack" style={{ gap: 10 }}>
          {(devices.data ?? []).map((d) => (
            <div key={d.id} className="setting-row">
              <span className="setting-ico"><Laptop size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="ellipsis">{d.label}</b>
                <span className="muted" style={{ fontSize: 13 }}>Último uso {when(d.lastUsedAt ?? d.createdAt)} · vence {when(d.expiresAt)}</span>
              </div>
              <button className="btn sm ghost" onClick={() => forget(d.id)}>Olvidar</button>
            </div>
          ))}
          {devices.data && !devices.data.length && <p className="muted" style={{ margin: 0 }}>Ningún dispositivo recordado.</p>}
        </div>
      </Block>

      <Block icon={Monitor} title="Sesiones abiertas" subtitle="Cada inicio de sesión activo en tus dispositivos.">
        <div className="stack" style={{ gap: 10 }}>
          {(sessions.data ?? []).map((s) => (
            <div key={s.id} className="setting-row">
              <span className="setting-ico"><Monitor size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="ellipsis">{s.device} {s.current && <span className="chip mint" style={{ marginLeft: 6 }}>Este dispositivo</span>}</b>
                <span className="muted" style={{ fontSize: 13 }}>{s.method} · desde {when(s.startedAt)} · activa {when(s.lastActiveAt)}</span>
              </div>
              {!s.current && <button className="btn sm ghost" onClick={() => closeSession(s.id)}>Cerrar</button>}
            </div>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn ghost danger" style={{ marginTop: 14 }} onClick={everywhere}><LogOut size={16} /> Cerrar sesión en todos los dispositivos</button>
      </Block>
    </>
  );
}

/* ---------- Compañero IA ---------- */

const SAMPLE: Record<CompanionId, string> = {
  luka: 'Hola, soy Luka. Estoy listo para ayudarte a practicar.',
  luna: 'Hola, soy Luna. Estoy lista para ayudarte a practicar.',
};

function CompanionSection() {
  const { update } = useAuth();
  const companion = useCompanion();
  const voices = useVoices();
  const [voiceURI, setVoiceURI] = useState(savedVoiceURI());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const gender: VoiceGender = companion.female ? 'female' : 'male';
  const spanish = useMemo(() => spanishVoices(voices), [voices]);
  const groups = useMemo(() => ({
    male: spanish.filter((v) => voiceGender(v) === 'male'),
    female: spanish.filter((v) => voiceGender(v) === 'female'),
    other: spanish.filter((v) => voiceGender(v) === null),
  }), [spanish]);
  const auto = voiceFor(gender, voices);

  async function choose(id: CompanionId) {
    if (id === companion.id) return;
    setSaving(true);
    setError('');
    try {
      await api('/api/me/preferences', { method: 'PUT', body: JSON.stringify({ companion: id }) });
      update({ companion: id });
      saveVoiceURI(null);
      setVoiceURI(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  function pickVoice(uri: string | null) {
    saveVoiceURI(uri);
    setVoiceURI(uri);
  }

  const voiceList = (list: SpeechSynthesisVoice[], label: string) =>
    list.length > 0 && (
      <div>
        <div className="eyebrow" style={{ margin: '10px 0 6px' }}>{label}</div>
        <div className="stack" style={{ gap: 6 }}>
          {list.map((v) => (
            <label key={v.voiceURI} className={`setting-row voice-row ${voiceURI === v.voiceURI ? 'on' : ''}`}>
              <input type="radio" name="voice" checked={voiceURI === v.voiceURI} onChange={() => pickVoice(v.voiceURI)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="ellipsis">{v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*\(.*\)$/, '')}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>{v.lang}{v.localService ? ' · en el equipo' : ' · en línea'}</span>
              </div>
              <button type="button" className="btn sm ghost" onClick={(e) => { e.preventDefault(); sayWith(v, 1.05, SAMPLE[companion.id]); }}><Play size={14} /> Probar</button>
            </label>
          ))}
        </div>
      </div>
    );

  return (
    <>
      <Block icon={Sparkles} title="Elige tu compañero" subtitle="Te acompaña en el tutor, el cuaderno, la biblioteca y Mi ruta.">
        <div className="companion-pick">
          {(Object.values(COMPANIONS)).map((c) => (
            <button key={c.id} className={`companion-card ${companion.id === c.id ? 'on' : ''}`} onClick={() => choose(c.id)} disabled={saving} aria-pressed={companion.id === c.id}>
              <Luka variant={c.id} size={76} mood={companion.id === c.id ? 'talking' : 'idle'} />
              <b>{c.name}</b>
              <span className="muted">Tu {c.noun} IA</span>
              {companion.id === c.id && <span className="chip mint"><Check size={13} /> Elegido</span>}
            </button>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
      </Block>

      <Block icon={Play} title={`Voz de ${companion.name}`} subtitle="La voz se guarda en este dispositivo: cada equipo trae voces distintas.">
        {!voiceSupport.speech ? (
          <p className="muted" style={{ margin: 0 }}>Este navegador no puede leer en voz alta.</p>
        ) : (
          <>
            {!auto.matches && !voiceURI && (
              <div className="notice-warn">
                <AlertTriangle size={18} />
                <span>
                  Este dispositivo no tiene voces {companion.female ? 'femeninas' : 'masculinas'} en español, así que ajustamos el tono de otra voz.
                  {' '}Puedes agregar una: en iPhone o Mac, Ajustes › Accesibilidad › Contenido leído › Voces › Español ({companion.female ? 'Mónica o Paulina' : 'Jorge o Juan'}); en Windows, Configuración › Hora e idioma › Voz › Agregar voces.
                </span>
              </div>
            )}
            <label className={`setting-row voice-row ${!voiceURI ? 'on' : ''}`}>
              <input type="radio" name="voice" checked={!voiceURI} onChange={() => pickVoice(null)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>Automática</b>
                <span className="muted" style={{ fontSize: 12.5 }}>{auto.voice ? `Ahora: ${auto.voice.name}` : 'Sin voces en español'}</span>
              </div>
              <button type="button" className="btn sm ghost" onClick={(e) => { e.preventDefault(); sayWith(auto.voice, auto.pitch, SAMPLE[companion.id]); }}><Play size={14} /> Probar</button>
            </label>
            {voiceList(companion.female ? groups.female : groups.male, companion.female ? 'Voces femeninas' : 'Voces masculinas')}
            {voiceList(companion.female ? groups.male : groups.female, companion.female ? 'Voces masculinas' : 'Voces femeninas')}
            {voiceList(groups.other, 'Otras voces en español')}
            {!spanish.length && <p className="muted">No encontramos voces en español en este dispositivo.</p>}
          </>
        )}
      </Block>
    </>
  );
}

/* ---------- Apariencia ---------- */

function AppearanceSection() {
  const { choice, setTheme } = useTheme();
  const options: [ThemeChoice, string, LucideIcon][] = [
    ['light', 'Claro', Sun],
    ['dark', 'Oscuro', Moon],
    ['system', 'Como el dispositivo', Monitor],
  ];
  function pick(next: ThemeChoice) {
    setTheme(next);
    api('/api/me/preferences', { method: 'PUT', body: JSON.stringify({ theme: next }) }).catch(() => undefined);
  }
  return (
    <Block icon={Palette} title="Tema" subtitle="El modo oscuro cansa menos la vista de noche.">
      <div className="theme-pick">
        {options.map(([key, label, Icon]) => (
          <button key={key} className={`theme-card ${choice === key ? 'on' : ''}`} onClick={() => pick(key)} aria-pressed={choice === key}>
            <span className={`theme-swatch ${key}`}><Icon size={20} /></span>
            <b>{label}</b>
          </button>
        ))}
      </div>
    </Block>
  );
}

/* ---------- Privacidad ---------- */

interface LegalStatus {
  documents: { id: string; kind: string; version: string; title: string; acceptedAt: string | null; acceptedBy: string | null }[];
}
interface DataRequest { id: string; kind: 'export' | 'delete'; status: 'pending' | 'done' | 'rejected'; reason: string | null; created_at: string; resolved_at: string | null }

const REQUEST_STATUS: Record<DataRequest['status'], string> = { pending: 'En revisión', done: 'Atendida', rejected: 'Rechazada' };

function PrivacySection() {
  const client = useQueryClient();
  const legal = useQuery({ queryKey: ['legal-status'], queryFn: () => api<LegalStatus>('/api/legal/status') });
  const requests = useQuery({ queryKey: ['data-requests'], queryFn: () => api<DataRequest[]>('/api/me/data-requests') });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function exportData() {
    setBusy('export');
    setError('');
    try {
      await download('/api/me/export', `mis-datos-ludoteka-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  }

  async function requestDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get('reason') ?? '').trim();
    if (!window.confirm('El colegio revisará la solicitud. Algunos datos académicos deben conservarse por ley. ¿Enviar la solicitud de eliminación?')) return;
    setBusy('delete');
    setError('');
    try {
      await api('/api/me/data-requests', { method: 'POST', body: JSON.stringify({ kind: 'delete', reason: reason || undefined }) });
      form.reset();
      setNotice('Solicitud enviada. El colegio tiene hasta 15 días hábiles para responder.');
      client.invalidateQueries({ queryKey: ['data-requests'] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <Block icon={FileText} title="Documentos que aceptaste" subtitle="Ley 1581 de 2012 y Decreto 1377 de 2013.">
        <div className="stack" style={{ gap: 8 }}>
          {(legal.data?.documents ?? []).map((doc) => (
            <div key={doc.id} className="setting-row">
              <span className="setting-ico"><FileText size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/legal/${doc.kind}`}><b className="ellipsis">{doc.title}</b></Link>
                <span className="muted" style={{ fontSize: 13 }}>Versión {doc.version} · {doc.acceptedAt ? `aceptada el ${when(doc.acceptedAt)}${doc.acceptedBy ? ` por ${doc.acceptedBy}` : ''}` : 'pendiente'}</span>
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block icon={Download} title="Tus datos" subtitle="Derecho a conocer, actualizar y rectificar (habeas data).">
        <p className="muted" style={{ marginTop: 0 }}>Descarga una copia de tu perfil, avance, notas, apuntes y actividad en formato JSON.</p>
        <button className="btn ghost" onClick={exportData} disabled={!!busy}><Download size={16} /> {busy === 'export' ? 'Preparando…' : 'Descargar mis datos'}</button>
      </Block>

      <Block icon={Trash2} title="Solicitar eliminación" subtitle="El colegio la revisa: algunos registros académicos deben conservarse por ley.">
        <form onSubmit={requestDeletion}>
          <label className="field">Motivo (opcional)<textarea name="reason" rows={3} maxLength={500} /></label>
          <button className="btn ghost danger" type="submit" disabled={!!busy || requests.data?.some((r) => r.kind === 'delete' && r.status === 'pending')}>
            <Trash2 size={16} /> Solicitar eliminación de mis datos
          </button>
        </form>
        {notice && <p className="ok-text">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        {!!requests.data?.length && (
          <div className="stack" style={{ gap: 6, marginTop: 14 }}>
            {requests.data.map((r) => (
              <div key={r.id} className="row g-8" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                <span>{r.kind === 'delete' ? 'Eliminación' : 'Copia de datos'} · {when(r.created_at)}</span>
                <span className={`chip ${r.status === 'done' ? 'mint' : r.status === 'rejected' ? 'coral' : 'gold'}`}>{REQUEST_STATUS[r.status]}</span>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Para quejas o reclamos también puedes escribir a la secretaría del colegio o acudir a la Superintendencia de Industria y Comercio.</p>
      </Block>
    </>
  );
}
