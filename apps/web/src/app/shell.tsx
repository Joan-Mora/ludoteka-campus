import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  Building2,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Moon,
  Radio,
  ScanFace,
  Search,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { Avatar, Bar } from '@/ui';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

const roleLabel: Record<string, string> = {
  student: 'Estudiante',
  teacher: 'Docente',
  admin: 'Administración',
  directivo: 'Rectoría',
  guardian: 'Acudiente',
};

function Section({ label, items }: { label: string; items: NavItem[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="nav-label">{label}</div>
      <nav className="nav">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-ico"><item.icon size={16} strokeWidth={2.4} /></span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notes = useQuery({
    queryKey: ['notes'],
    queryFn: () => api<{ id: string; title: string; body: string; read_at: string | null }[]>('/api/notifications'),
  });
  const [open, setOpen] = useState(false);
  const game = useQuery({
    queryKey: ['me-game'],
    queryFn: () => api<{ xp: number; level: { level: number; title: string; min_xp: number }; nextLevel: { min_xp: number } | null }>('/api/gamification/me'),
    enabled: user?.role === 'student',
  });
  const unread = notes.data?.filter((n) => !n.read_at).length ?? 0;
  const isStudent = user?.role === 'student';
  const isStaff = user && ['teacher', 'admin'].includes(user.role);
  const isBoard = user && ['admin', 'directivo'].includes(user.role);

  const learn: NavItem[] = [
    { to: '/app', label: 'Inicio', icon: LayoutDashboard, end: true },
    { to: '/app/cursos', label: 'Mis cursos', icon: BookOpen },
    { to: '/app/en-vivo', label: 'Sala en vivo', icon: Radio },
  ];
  const play: NavItem[] = [
    { to: '/app/logros', label: 'Logros', icon: Trophy },
    { to: '/app/jugar', label: 'Arcade', icon: Gamepad2 },
    { to: '/app/tutor', label: 'Tutor IA', icon: Sparkles },
  ];
  const account: NavItem[] = [{ to: '/app/rostro', label: 'Acceso facial', icon: ScanFace }];
  const staff: NavItem[] = [
    ...(isStaff ? [{ to: '/app/banco', label: 'Banco de preguntas', icon: GraduationCap }] : []),
    ...(isBoard ? [{ to: '/app/rectoria', label: 'Rectoría', icon: Building2 }] : []),
    ...(user?.role === 'admin' ? [{ to: '/app/admin', label: 'Institución', icon: Building2 }] : []),
  ];

  const xp = game.data?.xp ?? 0;
  const floor = game.data?.level.min_xp ?? 0;
  const next = game.data?.nextLevel?.min_xp ?? xp + 1;
  const pct = Math.round(((xp - floor) / Math.max(1, next - floor)) * 100);

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? '' : 'dark';
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <div>
            <div className="brand-name">Ludoteka</div>
            <div className="brand-sub">Colegio Francisco Arango</div>
          </div>
        </div>
        <Section label="Aprender" items={learn} />
        {isStudent && <Section label="Jugar" items={play} />}
        <Section label="Gestión" items={staff} />
        <Section label="Cuenta" items={account} />
        <div className="side-card">
          <div className="row g-12">
            <Avatar name={user?.fullName} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#fff', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.fullName}</div>
              <div style={{ fontSize: 12, color: '#a79fe0', fontWeight: 600 }}>{roleLabel[user?.role ?? 'student']}</div>
            </div>
            <button className="icon-btn" style={{ background: 'rgba(255,255,255,.08)', borderColor: 'transparent', color: '#fff' }} onClick={async () => { await logout(); navigate('/'); }} title="Salir">
              <LogOut size={17} />
            </button>
          </div>
          {isStudent && game.data && (
            <div style={{ marginTop: 14 }}>
              <div className="row between" style={{ fontSize: 12, fontWeight: 700, color: '#c9c3f3', marginBottom: 6 }}>
                <span>Nivel {game.data.level.level} · {game.data.level.title}</span>
                <span>{pct}%</span>
              </div>
              <Bar value={pct} tone="gold" thin />
            </div>
          )}
        </div>
      </aside>
      <section className="main">
        <header className="topbar">
          <div className="search"><Search size={17} /> Buscar lecciones, tareas o evaluaciones</div>
          <div className="row g-8">
            {isStudent && (
              <div className="xp-pill">
                <span className="tile gold" style={{ width: 28, height: 28, borderRadius: 9 }}><Zap size={15} strokeWidth={2.6} /></span>
                {xp} XP
              </div>
            )}
            <button className="icon-btn" onClick={toggleTheme} title="Tema"><Moon size={18} /></button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" title="Notificaciones" onClick={() => setOpen(!open)}>
                <Bell size={18} />
                {unread > 0 && <span className="dot">{unread}</span>}
              </button>
              {open && (
                <div className="card" style={{ position: 'absolute', right: 0, top: 52, width: 340, padding: 0, boxShadow: 'var(--shadow-lg)', zIndex: 20 }}>
                  <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                    <b>Notificaciones</b>
                    <span className="chip violet">{unread} nuevas</span>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {(notes.data ?? []).map((note) => (
                      <button
                        key={note.id}
                        onClick={async () => { await api(`/api/notifications/${note.id}/read`, { method: 'POST' }); notes.refetch(); }}
                        className="row g-12"
                        style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 0, borderBottom: '1px solid var(--line)', background: note.read_at ? 'transparent' : 'rgba(124,92,255,.06)', alignItems: 'flex-start' }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 99, marginTop: 7, flex: 'none', background: note.read_at ? 'var(--line)' : 'var(--coral)' }} />
                        <span>
                          <b style={{ fontSize: 14 }}>{note.title}</b>
                          <span className="muted" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{note.body}</span>
                        </span>
                      </button>
                    ))}
                    {!notes.data?.length && <p className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 14 }}>Todo al día.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
