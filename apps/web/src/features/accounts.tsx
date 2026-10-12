import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  Mail,
  Power,
  ShieldAlert,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { api, ApiException, download } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Avatar, Empty, PageHeader, Sheet, Stat } from '@/ui';

type Role = 'student' | 'teacher' | 'coordinator' | 'rector' | 'guardian' | 'admin';

interface Account {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isMinor: boolean;
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  groupId: string | null;
  group: string | null;
  linked: string[];
}

interface Group { id: string; name: string; grade_level: number; grade_name: string; year_name: string }

interface PreviewRow {
  line: number;
  fullName?: string;
  email?: string;
  role?: Role;
  group?: string;
  isMinor?: boolean;
  guardianOf?: string[];
  errors: string[];
  warnings: string[];
}

interface Preview { fileName: string; rows: PreviewRow[]; valid: number; invalid: number }

interface CommitResult {
  created: number;
  skipped: number;
  errors: { line: number; email: string | null; errors: string[] }[];
  emailsQueued: number;
  credentials?: { email: string; fullName: string; password: string }[];
}

interface ImportLog { id: string; kind: string; file_name: string; total_rows: number; created_count: number; skipped_count: number; created_at: string; actor_name: string | null }

interface Activity { id: string; action: string; created_at: string; actor_name: string | null }

const ROLE_NAME: Record<Role, string> = { student: 'Estudiante', teacher: 'Docente', coordinator: 'Coordinación', rector: 'Rectoría', guardian: 'Acudiente', admin: 'Administrador' };
const ROLE_TONE: Record<Role, string> = { student: 'violet', teacher: 'sky', coordinator: 'gold', rector: 'gold', guardian: 'mint', admin: 'coral' };

const ACTION_NAME: Record<string, string> = {
  'user.create': 'Cuenta creada',
  'user.update': 'Datos actualizados',
  'user.disable': 'Cuenta desactivada',
  'user.enable': 'Cuenta reactivada',
  'user.resend_access': 'Acceso reenviado',
  'user.force_password': 'Cambio de clave exigido',
  'session.revoke_all': 'Sesiones cerradas',
  'session.reuse_detected': 'Reuso de sesión detectado',
  login: 'Ingreso',
  'login.failed': 'Intento fallido',
  'login.locked': 'Bloqueo temporal',
  'password.change': 'Cambió su contraseña',
  'password.reset': 'Restableció su contraseña',
  'guardian.consent': 'Consentimiento del acudiente',
  'guardian.grant': 'Autorización del acudiente',
  'guardian.revoke': 'Autorización retirada',
  'legal.accept': 'Aceptó términos y política de datos',
  'legal.accept_for_minor': 'Términos aceptados por el acudiente',
  'data.export': 'Descargó sus datos',
  'data.delete_request': 'Pidió eliminar sus datos',
  'data.delete_done': 'Solicitud de eliminación atendida',
  'data.delete_rejected': 'Solicitud de eliminación rechazada',
  'passkey.register': 'Registró una llave de acceso',
  'passkey.remove': 'Quitó una llave de acceso',
};

const groupLabel = (g: Group) => (g.name.toUpperCase().startsWith(String(g.grade_level)) ? g.name.toUpperCase() : `${g.grade_level}${g.name.toUpperCase()}`);
const errorText = (error: unknown) => (error instanceof ApiException || error instanceof Error ? error.message : 'Algo salió mal');
const when = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca';

function StatusChip({ account }: { account: Account }) {
  if (account.status === 'disabled') return <span className="chip">Desactivada</span>;
  if (account.lockedUntil) return <span className="chip coral">Bloqueada</span>;
  if (account.mustChangePassword) return <span className="chip gold">{account.lastLoginAt ? 'Debe cambiar clave' : 'Sin estrenar'}</span>;
  return <span className="chip mint">Activa</span>;
}

export function UsuariosPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [groupId, setGroupId] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const params = new URLSearchParams(Object.entries({ q, role, groupId, status }).filter(([, v]) => v));
  const accounts = useQuery({ queryKey: ['admin-users', params.toString()], queryFn: () => api<Account[]>(`/api/admin/users?${params}`) });
  const all = useQuery({ queryKey: ['admin-users', ''], queryFn: () => api<Account[]>('/api/admin/users') });
  const groups = useQuery({ queryKey: ['groups'], queryFn: () => api<Group[]>('/api/institution/groups') });
  const imports = useQuery({ queryKey: ['admin-imports'], queryFn: () => api<ImportLog[]>('/api/admin/imports') });

  const totals = useMemo(() => {
    const rows = all.data ?? [];
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      pending: rows.filter((r) => r.status === 'active' && r.mustChangePassword).length,
      disabled: rows.filter((r) => r.status === 'disabled').length,
    };
  }, [all.data]);

  const current = selected && (all.data ?? []).find((a) => a.id === selected.id);

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        subtitle="El colegio crea las cuentas. Cada persona recibe una clave temporal y la cambia en su primer ingreso."
        actions={
          <div className="row g-8 wrap">
            <button className="btn ghost" onClick={() => download('/api/admin/users/template.xlsx', 'plantilla-usuarios-ludoteka.xlsx')}><Download size={16} /> Plantilla</button>
            <button className="btn ghost" onClick={() => setImporting(true)}><FileSpreadsheet size={16} /> Importar</button>
            <button className="btn" onClick={() => setCreating(true)}><UserPlus size={16} /> Nueva cuenta</button>
          </div>
        }
      />

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={Users} tone="violet" value={totals.total} label="Cuentas" />
        <Stat icon={UserCheck} tone="mint" value={totals.active} label="Activas" />
        <Stat icon={KeyRound} tone="gold" value={totals.pending} label="Clave temporal" />
        <Stat icon={Power} tone="coral" value={totals.disabled} label="Desactivadas" />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row g-12 wrap user-filters">
          <label className="field" style={{ flex: '2 1 240px', margin: 0, minWidth: 0 }}>Buscar
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo" />
          </label>
          <label className="field" style={{ flex: '1 1 150px', margin: 0 }}>Rol
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ROLE_NAME).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: '1 1 120px', margin: 0 }}>Grupo
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Todos</option>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{groupLabel(g)} · {g.year_name}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: '1 1 130px', margin: 0 }}>Estado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="active">Activas</option>
              <option value="disabled">Desactivadas</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        {accounts.data && !accounts.data.length ? (
          <Empty icon={Users} title="Sin resultados" body="Prueba con otro nombre o quita los filtros." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Persona</th><th className="num">Rol</th><th className="num">Grupo</th><th className="num">Estado</th><th className="num">Último ingreso</th><th className="act" /></tr></thead>
              <tbody>
                {(accounts.data ?? []).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="row g-12" style={{ minWidth: 0 }}>
                        <Avatar name={a.fullName} />
                        <div style={{ minWidth: 0 }}>
                          <b className="ellipsis">{a.fullName}</b>
                          <span className="muted ellipsis" style={{ fontSize: 13 }}>{a.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num"><span className={`chip ${ROLE_TONE[a.role]}`}>{ROLE_NAME[a.role]}</span></td>
                    <td className="num">{a.group ?? <span className="muted">—</span>}</td>
                    <td className="num"><StatusChip account={a} /></td>
                    <td className="num muted">{when(a.lastLoginAt)}</td>
                    <td className="act"><button className="btn sm ghost" onClick={() => setSelected(a)}>Gestionar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DataRequests />

      {!!imports.data?.length && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Importaciones recientes</div>
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Archivo</th><th className="num">Tipo</th><th className="num">Creadas</th><th className="num">Omitidas</th><th className="num">Fecha</th><th>Por</th></tr></thead>
            <tbody>
              {imports.data.map((log) => (
                <tr key={log.id}>
                  <td><b>{log.file_name}</b></td>
                  <td className="num">{log.kind === 'users' ? 'Usuarios' : 'Estructura'}</td>
                  <td className="num">{log.created_count}</td>
                  <td className="num">{log.skipped_count}</td>
                  <td className="num muted">{when(log.created_at)}</td>
                  <td className="muted">{log.actor_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nueva cuenta">
        <CreateAccount groups={groups.data ?? []} onDone={() => setCreating(false)} />
      </Sheet>
      <Sheet open={importing} onClose={() => setImporting(false)} title="Importar usuarios" full>
        {importing && <ImportWizard onClose={() => setImporting(false)} />}
      </Sheet>
      <Sheet open={Boolean(current)} onClose={() => setSelected(null)} title="Gestionar cuenta" full>
        {current && <AccountDetail account={current} />}
      </Sheet>
    </div>
  );
}

interface DataRequest { id: string; kind: 'delete'; status: 'pending' | 'done' | 'rejected'; reason: string | null; created_at: string; resolved_at: string | null; full_name: string; email: string }

/** Habeas data: deletion requests answered within 15 business days (Ley 1581, art. 15). */
function DataRequests() {
  const client = useQueryClient();
  const requests = useQuery({ queryKey: ['admin-data-requests'], queryFn: () => api<DataRequest[]>('/api/admin/data-requests') });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function resolve(id: string, status: 'done' | 'rejected') {
    const prompt = status === 'done'
      ? '¿Ya desactivaste la cuenta o suprimiste los datos que no deben conservarse? Se marcará como atendida.'
      : '¿Rechazar la solicitud? Informa a la persona el motivo legal (por ejemplo, conservación del archivo académico).';
    if (!window.confirm(prompt)) return;
    setBusy(id);
    setError('');
    try {
      client.setQueryData(['admin-data-requests'], await api<DataRequest[]>(`/api/admin/data-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  }

  if (!requests.data?.length) return null;
  const pending = requests.data.filter((r) => r.status === 'pending').length;
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="row between wrap g-8" style={{ marginBottom: 12 }}>
        <div className="card-title">Solicitudes de eliminación de datos</div>
        {pending > 0 && <span className="chip gold">{pending} por atender · plazo 15 días hábiles</span>}
      </div>
      {error && <p className="err" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Persona</th><th>Motivo</th><th className="num">Fecha</th><th className="num">Estado</th><th className="act" /></tr></thead>
          <tbody>
            {requests.data.map((r) => (
              <tr key={r.id}>
                <td><b>{r.full_name}</b><br /><span className="muted" style={{ fontSize: 13 }}>{r.email}</span></td>
                <td style={{ maxWidth: 280 }}>{r.reason ?? <span className="muted">—</span>}</td>
                <td className="num muted">{when(r.created_at)}</td>
                <td className="num"><span className={`chip ${r.status === 'done' ? 'mint' : r.status === 'rejected' ? 'coral' : 'gold'}`}>{r.status === 'done' ? 'Atendida' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente'}</span></td>
                <td className="act">
                  {r.status === 'pending' && (
                    <div className="row g-8">
                      <button className="btn sm" disabled={busy === r.id} onClick={() => resolve(r.id, 'done')}>Atendida</button>
                      <button className="btn sm ghost danger" disabled={busy === r.id} onClick={() => resolve(r.id, 'rejected')}>Rechazar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAccount({ groups, onDone }: { groups: Group[]; onDone: () => void }) {
  const client = useQueryClient();
  const [role, setRole] = useState<Role>('student');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const guardianOf = String(data.get('guardianOf') ?? '').split(/[;,\s]+/).map((e) => e.trim()).filter(Boolean);
      const result = await api<{ id: string; sentTo: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: data.get('fullName'),
          email: data.get('email'),
          role,
          isMinor: data.get('isMinor') === 'on',
          ...(role === 'student' && data.get('groupId') ? { groupId: data.get('groupId') } : {}),
          ...(role === 'guardian' && guardianOf.length ? { guardianOf } : {}),
        }),
      });
      form.reset();
      setRole('student');
      setSentTo(result.sentTo);
      client.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <CheckCircle2 size={44} color="var(--mint)" />
        <h3 style={{ margin: '12px 0 6px' }}>Cuenta creada</h3>
        <p className="muted">Enviamos la clave temporal y el enlace de ingreso a <b>{sentTo}</b>.</p>
        <div className="row g-8" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn ghost" onClick={() => setSentTo('')}>Crear otra</button>
          <button className="btn" onClick={onDone}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="field">Nombre completo<input name="fullName" required minLength={2} autoComplete="off" /></label>
      <label className="field">Correo<input name="email" type="email" required autoComplete="off" /></label>
      <label className="field">Rol
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {Object.entries(ROLE_NAME).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {role === 'student' && (
        <label className="field">Grupo
          <select name="groupId" defaultValue="">
            <option value="">Sin matricular</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)} · {g.year_name}</option>)}
          </select>
        </label>
      )}
      {role === 'guardian' && (
        <label className="field">Acudiente de (correos de sus estudiantes)
          <input name="guardianOf" placeholder="ana.perez@colegio.edu.co; luis.perez@colegio.edu.co" />
        </label>
      )}
      <label className="check-row" key={role}>
        <input name="isMinor" type="checkbox" defaultChecked={role === 'student'} /> Es menor de edad (sus datos se tratan con autorización del acudiente)
      </label>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        Ludoteka genera una clave temporal y la envía con el enlace de ingreso. Al entrar, la persona recibe un código de 6 dígitos y elige su propia contraseña.
      </p>
      {error && <p className="form-error">{error}</p>}
      <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={busy}><UserPlus size={18} /> {busy ? 'Creando…' : 'Crear y enviar acceso'}</button>
    </form>
  );
}

function AccountDetail({ account }: { account: Account }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const self = user?.id === account.id;
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const activity = useQuery({ queryKey: ['admin-activity', account.id], queryFn: () => api<Activity[]>(`/api/admin/users/${account.id}/activity`) });

  async function run(key: string, path: string, init: RequestInit, ok: string | ((data: { sentTo?: string }) => string)) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const data = await api<{ sentTo?: string }>(path, init);
      setNotice(typeof ok === 'string' ? ok : ok(data));
      client.invalidateQueries({ queryKey: ['admin-users'] });
      client.invalidateQueries({ queryKey: ['admin-activity', account.id] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run('save', `/api/admin/users/${account.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ fullName: data.get('fullName'), role: data.get('role'), isMinor: data.get('isMinor') === 'on' }),
    }, 'Cambios guardados.');
  }

  const disabled = account.status === 'disabled';

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="m-profile">
        <Avatar name={account.fullName} large />
        <div style={{ minWidth: 0 }}>
          <b className="ellipsis" style={{ fontSize: 17 }}>{account.fullName}</b>
          <span className="muted ellipsis">{account.email}</span>
          <div className="row g-8 wrap" style={{ marginTop: 6 }}>
            <span className={`chip ${ROLE_TONE[account.role]}`}>{ROLE_NAME[account.role]}</span>
            <StatusChip account={account} />
            {account.group && <span className="chip sky">{account.group}</span>}
            {account.isMinor && <span className="chip">Menor de edad</span>}
          </div>
        </div>
      </div>

      {!!account.linked.length && (
        <p className="muted" style={{ margin: 0 }}>
          {account.role === 'guardian' ? 'Acudiente de: ' : 'Acudientes: '}<b>{account.linked.join(', ')}</b>
        </p>
      )}

      {notice && <p className="ok-text" style={{ margin: 0 }}>{notice}</p>}
      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

      <div className="grid cols-2" style={{ gap: 10 }}>
        <button className="btn ghost" disabled={!!busy || disabled} onClick={() => run('resend', `/api/admin/users/${account.id}/resend-access`, { method: 'POST' }, (d) => `Nueva clave temporal enviada a ${d.sentTo}.`)}>
          <Mail size={16} /> {busy === 'resend' ? 'Enviando…' : 'Reenviar acceso'}
        </button>
        <button className="btn ghost" disabled={!!busy || disabled} onClick={() => run('force', `/api/admin/users/${account.id}/force-password`, { method: 'POST' }, 'Deberá cambiar la clave en su próximo ingreso.')}>
          <KeyRound size={16} /> Exigir cambio de clave
        </button>
        <button className="btn ghost" disabled={!!busy} onClick={() => run('revoke', `/api/admin/users/${account.id}/revoke-sessions`, { method: 'POST' }, 'Cerramos todas sus sesiones y olvidamos sus dispositivos.')}>
          <LogOut size={16} /> Cerrar sesiones
        </button>
        <button
          className={`btn ${disabled ? '' : 'ghost'}`}
          disabled={!!busy || self}
          title={self ? 'No puedes desactivar tu propia cuenta' : undefined}
          onClick={() => run('status', `/api/admin/users/${account.id}`, { method: 'PATCH', body: JSON.stringify({ status: disabled ? 'active' : 'disabled' }) }, disabled ? 'Cuenta reactivada.' : 'Cuenta desactivada y sesiones cerradas.')}
        >
          {disabled ? <UserCheck size={16} /> : <Power size={16} />} {disabled ? 'Reactivar' : 'Desactivar'}
        </button>
      </div>

      <form onSubmit={save} className="card" style={{ padding: 16 }} key={account.id + account.role + account.fullName}>
        <div className="card-title" style={{ marginBottom: 10 }}>Datos</div>
        <label className="field">Nombre completo<input name="fullName" defaultValue={account.fullName} required minLength={2} /></label>
        <label className="field">Rol
          <select name="role" defaultValue={account.role} disabled={self}>
            {Object.entries(ROLE_NAME).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="check-row"><input name="isMinor" type="checkbox" defaultChecked={account.isMinor} /> Es menor de edad</label>
        <button className="btn" type="submit" disabled={!!busy}>Guardar cambios</button>
      </form>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Actividad reciente</div>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>Creada {when(account.createdAt)} · último ingreso {when(account.lastLoginAt).toLowerCase()}</p>
        <div className="stack" style={{ gap: 6 }}>
          {(activity.data ?? []).map((item) => (
            <div key={item.id} className="row g-8" style={{ justifyContent: 'space-between', fontSize: 14, borderBottom: '1px dashed var(--line)', padding: '6px 0' }}>
              <span>{ACTION_NAME[item.action] ?? item.action}{item.actor_name && item.action.startsWith('user.') ? <span className="muted"> · {item.actor_name}</span> : null}</span>
              <span className="muted" style={{ flex: 'none' }}>{when(item.created_at)}</span>
            </div>
          ))}
          {activity.data && !activity.data.length && <p className="muted">Sin actividad registrada.</p>}
        </div>
      </div>
    </div>
  );
}

function credentialsCsv(rows: { email: string; fullName: string; password: string }[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const body = ['nombre;correo;clave_temporal', ...rows.map((r) => [r.fullName, r.email, r.password].map(escape).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'claves-temporales.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ImportWizard({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [sendEmails, setSendEmails] = useState(true);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setError('El archivo supera 3 MB. Divídelo en partes.');
    setBusy(true);
    setError('');
    try {
      setPreview(await api<Preview>(`/api/admin/users/import/preview?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': 'application/octet-stream' },
      }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => !r.errors.length)
      .map(({ fullName, email, role, group, isMinor, guardianOf }) => ({ fullName, email, role, group, isMinor, guardianOf }));
    setBusy(true);
    setError('');
    try {
      const done = await api<CommitResult>('/api/admin/users/import/commit', {
        method: 'POST',
        body: JSON.stringify({ fileName: preview.fileName, rows, sendEmails }),
      });
      setResult(done);
      client.invalidateQueries({ queryKey: ['admin-users'] });
      client.invalidateQueries({ queryKey: ['admin-imports'] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <div className="row g-12">
          <CheckCircle2 size={36} color="var(--mint)" />
          <div>
            <h3 style={{ margin: 0 }}>{result.created} {result.created === 1 ? 'cuenta creada' : 'cuentas creadas'}</h3>
            <span className="muted">{result.skipped ? `${result.skipped} filas omitidas por errores. ` : ''}{result.emailsQueued ? `Enviando ${result.emailsQueued} correos de bienvenida en segundo plano.` : ''}</span>
          </div>
        </div>
        {result.credentials && (
          <div className="card" style={{ padding: 16 }}>
            <p style={{ marginTop: 0 }}><ShieldAlert size={16} /> No se enviaron correos. Descarga las claves temporales ahora: <b>no se vuelven a mostrar</b>. Entrégalas en sobre cerrado y destruye el archivo después.</p>
            <button className="btn" onClick={() => credentialsCsv(result.credentials!)}><Download size={16} /> Descargar claves (CSV)</button>
          </div>
        )}
        {!!result.errors.length && (
          <div className="stack" style={{ gap: 6 }}>
            {result.errors.map((e) => <p key={e.line} className="form-error" style={{ margin: 0 }}>Fila {e.line}{e.email ? ` (${e.email})` : ''}: {e.errors.join('; ')}</p>)}
          </div>
        )}
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <ol className="muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Descarga la plantilla y llena una fila por persona (rol, grupo y a quién acude cada acudiente).</li>
          <li>Sube el archivo en Excel (.xlsx) o CSV. Antes de crear nada verás los errores fila por fila.</li>
          <li>Confirma: cada persona recibe su clave temporal por correo.</li>
        </ol>
        <button className="btn ghost" onClick={() => download('/api/admin/users/template.xlsx', 'plantilla-usuarios-ludoteka.xlsx')}><Download size={16} /> Descargar plantilla</button>
        <label className="upload-drop">
          <Upload size={28} />
          <b>{busy ? 'Revisando el archivo…' : 'Elegir archivo'}</b>
          <span className="muted">.xlsx o .csv · máximo 2000 filas</span>
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  const rows = onlyErrors ? preview.rows.filter((r) => r.errors.length) : preview.rows;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row g-8 wrap">
        <span className="chip mint"><CheckCircle2 size={14} /> {preview.valid} listas</span>
        {!!preview.invalid && <span className="chip coral"><AlertTriangle size={14} /> {preview.invalid} con errores</span>}
        <span className="muted" style={{ fontSize: 13 }}>{preview.fileName}</span>
      </div>
      {!!preview.invalid && (
        <label className="check-row" style={{ margin: 0 }}><input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Ver solo filas con errores</label>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fila</th><th>Persona</th><th>Rol</th><th>Grupo</th><th>Revisión</th></tr></thead>
          <tbody>
            {rows.slice(0, 300).map((r) => (
              <tr key={r.line}>
                <td>{r.line}</td>
                <td><b>{r.fullName ?? '—'}</b><span className="muted ellipsis" style={{ fontSize: 13 }}>{r.email ?? ''}</span></td>
                <td>{r.role ? ROLE_NAME[r.role] : '—'}</td>
                <td>{r.group ?? (r.guardianOf?.length ? `${r.guardianOf.length} est.` : '—')}</td>
                <td style={{ whiteSpace: 'normal' }}>
                  {r.errors.map((e) => <div key={e} className="form-error" style={{ margin: 0 }}>{e}</div>)}
                  {r.warnings.map((w) => <div key={w} className="muted" style={{ fontSize: 13 }}>{w}</div>)}
                  {!r.errors.length && !r.warnings.length && <span className="ok-text">Lista</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 300 && <p className="muted">Mostrando 300 de {rows.length} filas.</p>}
      </div>
      <label className="check-row" style={{ margin: 0 }}>
        <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} />
        Enviar a cada persona su clave temporal por correo. Si lo desmarcas, descargarás un archivo con las claves para entregarlas en papel.
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="row g-8 wrap">
        <button className="btn ghost" onClick={() => setPreview(null)} disabled={busy}>Subir otro archivo</button>
        <button className="btn" onClick={commit} disabled={busy || !preview.valid} style={{ flex: 1 }}>
          {busy ? 'Creando cuentas…' : `Crear ${preview.valid} ${preview.valid === 1 ? 'cuenta' : 'cuentas'}`}
        </button>
      </div>
    </div>
  );
}
