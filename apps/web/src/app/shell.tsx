import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, LogOut, Menu, Search, Zap } from 'lucide-react';
import { api } from '@/shared/api';
import { useAuth } from '@/shared/auth';
import { useCompanion } from '@/shared/companion';
import { Avatar, Bar, Sheet, ThemeButton } from '@/ui';
import { VoiceNav } from '@/shared/voice-ui';
import { configureSpeech } from '@/shared/voice';
import { hasDeviceTheme, setTheme, type ThemeChoice } from '@/shared/theme';
import { useLayout } from './layout';
import { mobileTabs, navSections, roleLabel, type NavItem, type NavSection } from './nav';

function PageLoading() {
  return <div className="page-loading" role="status" aria-label="Cargando"><span /><span /><span /></div>;
}

interface Note { id: string; title: string; body: string; read_at: string | null }
interface GameMe { xp: number; level: { level: number; title: string; min_xp: number }; nextLevel: { min_xp: number } | null }

function useShellData() {
  const { user } = useAuth();
  const notes = useQuery({ queryKey: ['notes'], queryFn: () => api<Note[]>('/api/notifications') });
  const game = useQuery({ queryKey: ['me-game'], queryFn: () => api<GameMe>('/api/gamification/me'), enabled: user?.role === 'student' });
  const xp = game.data?.xp ?? 0;
  const floor = game.data?.level.min_xp ?? 0;
  const next = game.data?.nextLevel?.min_xp ?? xp + 1;
  return {
    notes,
    game,
    xp,
    pct: Math.round(((xp - floor) / Math.max(1, next - floor)) * 100),
    unread: notes.data?.filter((n) => !n.read_at).length ?? 0,
  };
}

function NotificationList({ notes, onRead }: { notes: Note[] | undefined; onRead: () => void }) {
  return (
    <div className="note-list">
      {(notes ?? []).map((note) => (
        <button
          key={note.id}
          onClick={async () => { await api(`/api/notifications/${note.id}/read`, { method: 'POST' }); onRead(); }}
          className={`note-item${note.read_at ? '' : ' unread'}`}
        >
          <span className="note-dot" />
          <span>
            <b>{note.title}</b>
            <span className="muted">{note.body}</span>
          </span>
        </button>
      ))}
      {!notes?.length && <p className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 14 }}>Todo al día.</p>}
    </div>
  );
}

function Section({ section }: { section: NavSection }) {
  return (
    <div>
      <div className="nav-label">{section.label}</div>
      <nav className="nav">
        {section.items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-ico"><item.icon size={16} strokeWidth={2.4} /></span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Touchpad pinch arrives as ctrl+wheel (Chromium, Firefox) or gesture events (Safari); keyboard zoom stays available. */
function useNoPinchZoom() {
  useEffect(() => {
    const wheel = (event: WheelEvent) => { if (event.ctrlKey) event.preventDefault(); };
    const gesture = (event: Event) => event.preventDefault();
    window.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('gesturestart', gesture);
    document.addEventListener('gesturechange', gesture);
    return () => {
      window.removeEventListener('wheel', wheel);
      document.removeEventListener('gesturestart', gesture);
      document.removeEventListener('gesturechange', gesture);
    };
  }, []);
}

function DesktopShell({ sections }: { sections: NavSection[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notes, game, xp, pct, unread } = useShellData();
  const [open, setOpen] = useState(false);
  const isStudent = user?.role === 'student';
  useNoPinchZoom();

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
        {sections.map((section) => <Section key={section.label} section={section} />)}
        <div className="side-card">
          <div className="row g-12">
            <Avatar name={user?.fullName} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="side-name">{user?.fullName}</div>
              <div className="side-role">{user ? roleLabel[user.role] : ''}</div>
            </div>
            <button className="icon-btn" onClick={async () => { await logout(); navigate('/'); }} title="Salir">
              <LogOut size={17} />
            </button>
          </div>
          {isStudent && game.data && (
            <div style={{ marginTop: 14 }}>
              <div className="row between side-level">
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
            <VoiceNav />
            <ThemeButton />
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
                    <NotificationList notes={notes.data} onRead={() => notes.refetch()} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
        </div>
      </section>
    </div>
  );
}

/** Labels each table cell with its column header so tables can stack as cards on phones. */
function useTableCards(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const label = () => {
      el.querySelectorAll<HTMLTableElement>('table.table:not(.keep-table)').forEach((table) => {
        const heads = Array.from(table.querySelectorAll('thead th')).map((th) => {
          const parts = Array.from(th.childNodes).map((node) => node.textContent?.trim() ?? '').filter(Boolean);
          return parts.join(' · ');
        });
        if (!heads.length) return;
        table.classList.add('as-cards');
        table.querySelectorAll('tbody tr').forEach((tr) => {
          Array.from(tr.children).forEach((cell, i) => {
            const text = heads[i] ?? '';
            if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
          });
        });
      });
    };
    label();
    const observer = new MutationObserver(label);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root]);
}

const FULLSCREEN = [/^\/app\/arena\/[^/]+$/];

function MobileShell({ sections }: { sections: NavSection[] }) {
  const { user, logout } = useAuth();
  const companion = useCompanion();
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, game, xp, pct, unread } = useShellData();
  const [more, setMore] = useState(false);
  const [bell, setBell] = useState(false);
  const content = useRef<HTMLElement>(null);
  useTableCards(content);

  const tabs = useMemo(() => (user ? mobileTabs(user.role, companion.name) : []), [user, companion.name]);
  const all = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const current = useMemo(() => {
    const path = location.pathname;
    return [...all].sort((a, b) => b.to.length - a.to.length).find((item) => (item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`)));
  }, [all, location.pathname]);
  const fullscreen = FULLSCREEN.some((re) => re.test(location.pathname));
  const onTab = tabs.some((tab) => (tab.end ? location.pathname === tab.to : location.pathname.startsWith(tab.to)));
  const isStudent = user?.role === 'student';

  useEffect(() => {
    setMore(false);
    setBell(false);
    content.current?.scrollTo?.({ top: 0 });
  }, [location.pathname]);

  const tabLink = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.end ?? item.to === '/app'} className={({ isActive }) => `m-tab${isActive ? ' active' : ''}`}>
      <item.icon size={22} strokeWidth={2.2} />
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <div className={`m-shell${fullscreen ? ' fullscreen' : ''}`}>
      <header className="m-top">
        {fullscreen || (!onTab && location.pathname !== '/app') ? (
          <button className="m-icon" onClick={() => navigate(-1)} aria-label="Volver"><ArrowLeft size={22} /></button>
        ) : (
          <img className="m-brand" src="/favicon.svg" alt="" />
        )}
        <div className="m-title">{current?.label ?? 'Ludoteka'}</div>
        {isStudent && <span className="m-xp"><Zap size={14} strokeWidth={2.6} /> {xp}</span>}
        <button className="m-icon" onClick={() => setBell(true)} aria-label={`Notificaciones${unread ? `: ${unread} nuevas` : ''}`}>
          <Bell size={21} />
          {unread > 0 && <span className="dot">{unread}</span>}
        </button>
        <button className="m-avatar" onClick={() => setMore(true)} aria-label="Menú de la cuenta">
          <Avatar name={user?.fullName} />
        </button>
      </header>

      <main className="m-content" ref={content}>
        <Suspense fallback={<PageLoading />}><Outlet /></Suspense>
      </main>

      {!fullscreen && (
        <nav className="m-tabs" aria-label="Navegación principal">
          {tabs.map(tabLink)}
          <button className={`m-tab${more ? ' active' : ''}`} onClick={() => setMore(true)}>
            <Menu size={22} strokeWidth={2.2} />
            <span>Más</span>
          </button>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} title="Todo Ludoteka">
        <div className="m-profile">
          <Avatar name={user?.fullName} large />
          <div style={{ minWidth: 0, flex: 1 }}>
            <b className="ellipsis">{user?.fullName}</b>
            <div className="muted" style={{ fontSize: 13 }}>{user ? roleLabel[user.role] : ''} · {user?.email}</div>
            {isStudent && game.data && (
              <div style={{ marginTop: 8 }}>
                <div className="row between muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <span>Nivel {game.data.level.level} · {game.data.level.title}</span><span>{pct}%</span>
                </div>
                <Bar value={pct} tone="gold" thin />
              </div>
            )}
          </div>
        </div>
        {sections.map((section) => (
          <div key={section.label} className="m-section">
            <div className="eyebrow">{section.label}</div>
            <div className="m-grid">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `m-tile${isActive ? ' active' : ''}`}>
                  <span className="m-tile-ico"><item.icon size={20} strokeWidth={2.3} /></span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
        <div className="m-actions">
          <ThemeButton className="btn ghost" label />
          <VoiceNav />
          <button className="btn ghost" onClick={async () => { await logout(); navigate('/'); }}><LogOut size={17} /> Salir</button>
        </div>
      </Sheet>

      <Sheet open={bell} onClose={() => setBell(false)} title={`Notificaciones${unread ? ` · ${unread} nuevas` : ''}`}>
        <NotificationList notes={notes.data} onRead={() => notes.refetch()} />
      </Sheet>
    </div>
  );
}

export function Shell() {
  const { user } = useAuth();
  const companion = useCompanion();
  const layout = useLayout();
  const sections = useMemo(() => (user ? navSections(user.role, companion.name) : []), [user, companion.name]);
  useEffect(() => configureSpeech(companion.female ? 'female' : 'male'), [companion.female]);
  const preferences = useQuery({ queryKey: ['preferences'], queryFn: () => api<{ theme: ThemeChoice }>('/api/me/preferences'), staleTime: Infinity, enabled: Boolean(user) });
  useEffect(() => {
    const theme = preferences.data?.theme;
    if (theme && theme !== 'system' && !hasDeviceTheme()) setTheme(theme);
  }, [preferences.data?.theme]);
  return layout === 'mobile' ? <MobileShell sections={sections} /> : <DesktopShell sections={sections} />;
}
