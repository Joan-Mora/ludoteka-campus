import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiException, getToken } from './api';
import { useAuth, type SessionUser } from './auth';

/** What the device calls its built-in authenticator, so the button speaks the user's language. */
export function platformName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Face ID o Touch ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  if (/Android/.test(ua)) return 'huella o rostro';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'llave de acceso';
}

function friendly(error: unknown) {
  if (error instanceof ApiException) return error.message;
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Se canceló o se agotó el tiempo. Inténtalo de nuevo.';
  if (name === 'InvalidStateError') return 'Este dispositivo ya está registrado en tu cuenta.';
  if (name === 'SecurityError') return 'Las llaves de acceso solo funcionan desde la dirección oficial de Ludoteka.';
  return 'No se pudo usar la llave de acceso en este dispositivo.';
}

function usePasskeySupport() {
  const [state, setState] = useState<{ supported: boolean; platform: boolean }>({ supported: false, platform: false });
  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    platformAuthenticatorIsAvailable()
      .then((platform) => setState({ supported: true, platform }))
      .catch(() => setState({ supported: true, platform: false }));
  }, []);
  return state;
}

export function PasskeyLogin({ onDone }: { onDone: (user: SessionUser) => void }) {
  const { enter } = useAuth();
  const { supported, platform } = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!supported) return null;

  async function go() {
    setBusy(true);
    setError('');
    try {
      const { challengeId, options } = await api<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/api/auth/passkey/login/options', { method: 'POST' });
      const response = await startAuthentication({ optionsJSON: options });
      const session = await api<{ accessToken: string; user: SessionUser }>('/api/auth/passkey/login/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, response }),
      });
      enter(session.accessToken, session.user);
      onDone(session.user);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="btn ghost lg" style={{ width: '100%' }} onClick={go} disabled={busy}>
        <Fingerprint size={18} /> {busy ? 'Esperando tu dispositivo…' : `Entrar con ${platform ? platformName() : 'llave de acceso'}`}
      </button>
      {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, textAlign: 'center' }}>
        ¿Aún no la tienes? Entra una vez con tu contraseña y el código: al terminar te ofrecemos activar {platform ? platformName() : 'la llave'} en este equipo. También en Ajustes → Llaves de acceso.
      </p>
    </div>
  );
}

interface Passkey { id: string; label: string; synced: boolean; createdAt: string; lastUsedAt: string | null }

const offerKey = (userId: string) => `eq.passkey.offer.${userId}`;

/** How the current session was verified, read from the access token; only verified sessions may register a passkey. */
function sessionMethod() {
  try {
    const payload = getToken()?.split('.')[1];
    if (!payload) return '';
    return (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { amr?: string }).amr ?? '';
  } catch {
    return '';
  }
}

/** After a verified sign-in, offers on the home screen to save Windows Hello / Face ID so the next login skips the code. */
export function PasskeyOffer() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const client = useQueryClient();
  const { platform } = usePasskeySupport();
  const [hidden, setHidden] = useState(() => !user || localStorage.getItem(offerKey(user.id)) !== null);
  const eligible = !!user && platform && !hidden && pathname === '/app' && ['otp', 'trusted_device'].includes(sessionMethod());
  const passkeys = useQuery({ queryKey: ['passkeys'], queryFn: () => api<Passkey[]>('/api/auth/passkeys'), enabled: eligible });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!user || !eligible || !passkeys.data || (passkeys.data.length && !done)) return null;

  function dismiss() {
    localStorage.setItem(offerKey(user!.id), 'later');
    setHidden(true);
  }

  async function add() {
    setBusy(true);
    setError('');
    try {
      const { challengeId, options } = await api<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/api/auth/passkey/register/options', { method: 'POST' });
      const response = await startRegistration({ optionsJSON: options });
      client.setQueryData(['passkeys'], await api<Passkey[]>('/api/auth/passkey/register/verify', { method: 'POST', body: JSON.stringify({ challengeId, response }) }));
      localStorage.setItem(offerKey(user!.id), 'done');
      setDone(true);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="passkey-offer card" role="dialog" aria-label={`Activar ${platformName()}`}>
      <span className="setting-ico"><Fingerprint size={20} /></span>
      <div className="stack" style={{ gap: 8, minWidth: 0 }}>
        {done ? (
          <>
            <b>{platformName().replace(/^./, (c) => c.toUpperCase())} activado</b>
            <span className="muted" style={{ fontSize: 13 }}>La próxima vez toca «Entrar con {platformName()}» en el inicio de sesión: sin contraseña ni código.</span>
            <button className="btn ghost sm" style={{ width: 'fit-content' }} onClick={() => setHidden(true)}>Entendido</button>
          </>
        ) : (
          <>
            <b>¿Entrar con {platformName()} la próxima vez?</b>
            <span className="muted" style={{ fontSize: 13 }}>Guardamos una llave de acceso en este equipo. Entrarás con tu rostro, huella o PIN, sin contraseña ni código del correo. Puedes quitarla en Ajustes.</span>
            {error && <span className="form-error" style={{ fontSize: 13 }}>{error}</span>}
            <div className="row g-8" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={add} disabled={busy}>{busy ? 'Esperando tu dispositivo…' : `Activar ${platformName()}`}</button>
              <button className="btn ghost sm" onClick={dismiss} disabled={busy}>Ahora no</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const when = (value: string | null) => (value ? new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin usar');

/** Lists, adds, renames and removes the user's passkeys. Adding one needs a session verified by code, device or passkey. */
export function PasskeyManager() {
  const client = useQueryClient();
  const { supported, platform } = usePasskeySupport();
  const passkeys = useQuery({ queryKey: ['passkeys'], queryFn: () => api<Passkey[]>('/api/auth/passkeys') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function add() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { challengeId, options } = await api<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>('/api/auth/passkey/register/options', { method: 'POST' });
      const response = await startRegistration({ optionsJSON: options });
      const list = await api<Passkey[]>('/api/auth/passkey/register/verify', { method: 'POST', body: JSON.stringify({ challengeId, response }) });
      client.setQueryData(['passkeys'], list);
      setNotice('Listo. La próxima vez podrás entrar sin contraseña ni código.');
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function rename(item: Passkey) {
    const label = window.prompt('Nombre de esta llave', item.label)?.trim();
    if (!label || label === item.label) return;
    try {
      client.setQueryData(['passkeys'], await api<Passkey[]>(`/api/auth/passkeys/${item.id}`, { method: 'PATCH', body: JSON.stringify({ label }) }));
    } catch (err) {
      setError(friendly(err));
    }
  }

  async function remove(item: Passkey) {
    if (!window.confirm(`¿Quitar "${item.label}"? Ese dispositivo ya no podrá entrar sin contraseña.`)) return;
    try {
      client.setQueryData(['passkeys'], await api<Passkey[]>(`/api/auth/passkeys/${item.id}`, { method: 'DELETE' }));
    } catch (err) {
      setError(friendly(err));
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {(passkeys.data ?? []).map((item) => (
        <div key={item.id} className="setting-row">
          <span className="setting-ico"><KeyRound size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b className="ellipsis">{item.label}</b>
            <span className="muted" style={{ fontSize: 13 }}>
              {item.synced ? 'Sincronizada en tu cuenta de Apple, Google o Microsoft' : 'Solo en este dispositivo'} · último uso {when(item.lastUsedAt)}
            </span>
          </div>
          <button className="icon-btn" aria-label={`Renombrar ${item.label}`} onClick={() => rename(item)}><Pencil size={16} /></button>
          <button className="icon-btn" aria-label={`Quitar ${item.label}`} onClick={() => remove(item)}><Trash2 size={16} /></button>
        </div>
      ))}
      {passkeys.data && !passkeys.data.length && (
        <p className="muted" style={{ margin: 0 }}>Aún no tienes llaves de acceso. Con una, entras con {platform ? platformName() : 'tu huella, rostro o PIN'} sin escribir la contraseña ni esperar el código.</p>
      )}
      {supported ? (
        <button className="btn ghost" onClick={add} disabled={busy} style={{ width: 'fit-content' }}>
          <Plus size={16} /> {busy ? 'Esperando tu dispositivo…' : `Agregar ${platform ? platformName() : 'llave de acceso'}`}
        </button>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Este navegador no admite llaves de acceso.</p>
      )}
      {notice && <p className="ok-text" style={{ margin: 0 }}>{notice}</p>}
      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
