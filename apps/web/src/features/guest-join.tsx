import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, ApiException } from '@/shared/api';
import { useAuth, type SessionUser } from '@/shared/auth';

interface Door {
  code: string;
  title: string;
  gradeName: string;
  groupCode: string;
  people: { id: string; fullName: string }[];
}

export function GuestJoinPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { enter } = useAuth();
  const door = useQuery({ queryKey: ['guest-door', code], queryFn: () => api<Door>(`/api/invitado/${code}`), retry: false });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function join(body: { userId?: string; name?: string }, key: string) {
    setBusy(key);
    setError('');
    try {
      const session = await api<{ accessToken: string; user: SessionUser }>(`/api/invitado/${code}/entrar`, { method: 'POST', body: JSON.stringify(body) });
      enter(session.accessToken, session.user);
      navigate('/app/clase');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'No se pudo entrar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="kiosk" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: 'min(480px, 100%)' }}>
        <p className="eyebrow">Ludoteka Campus</p>
        {door.isLoading && <p className="muted row g-6"><Loader2 size={16} className="spin" /> Abriendo la clase…</p>}
        {door.isError && <p className="form-error">{door.error instanceof ApiException ? door.error.message : 'Ese código no abre una clase'}</p>}
        {door.data && (
          <>
            <h1 style={{ fontSize: 28, margin: '8px 0' }}>{door.data.gradeName} · grupo {door.data.groupCode}</h1>
            <p className="muted">{door.data.title}. Elige tu nombre. Si no estás en la lista, escríbelo abajo.</p>
            <div className="stack g-8" style={{ marginTop: 16 }}>
              {door.data.people.map((person) => (
                <button key={person.id} className="btn ghost" style={{ justifyContent: 'flex-start' }} disabled={Boolean(busy)} onClick={() => join({ userId: person.id }, person.id)}>
                  {busy === person.id ? <Loader2 size={16} className="spin" /> : null} {person.fullName}
                </button>
              ))}
            </div>
            <form style={{ marginTop: 18 }} onSubmit={(e) => { e.preventDefault(); void join({ name }, 'typed'); }}>
              <label className="field">No estoy en la lista
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre y apellido" maxLength={80} />
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="btn" type="submit" disabled={name.trim().length < 3 || Boolean(busy)}>{busy === 'typed' ? <Loader2 size={16} className="spin" /> : null} Entrar con este nombre</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
