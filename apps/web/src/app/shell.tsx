import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, CheckCheck, Gamepad2, LogOut, Menu, Search, Zap } from 'lucide-react';
import { api } from '@/shared/api';
import { NoteRow, useNoteActions, useNotifications, type NoteFeed } from '@/shared/notifications';
import { useAuth } from '@/shared/auth';
import { useCompanion } from '@/shared/companion';
import { Avatar, Bar, Sheet, ThemeButton } from '@/ui';
import { VoiceNav } from '@/shared/voice-ui';
import { configureSpeech } from '@/shared/voice';
import { hasDeviceTheme, setTheme, useTheme, type ThemeChoice } from '@/shared/theme';
import { buildingForPath, campusFor } from '@/shared/buildings';
import { enterBuilding } from '@/shared/enter';
import { MiniCampus } from '@/ui/campus-mini';
import { useLayout } from './layout';
import { Guide } from './guide';
import { PasskeyOffer } from '@/shared/passkey';
import { mobileTabs, navSections, roleLabel, type NavItem, type NavSection } from './nav';

function PageLoading() {
  return <div className="page-loading" role="status" aria-label="Cargando"><span /><span /><span /></div>;
}

interface GameMe { xp: number; level: { level: number; title: string; min_xp: number }; nextLevel: { min_xp: number } | null }

function useShellData() {
  const { user } = useAuth();
  const notes = useNotifications({ limit: 8 });
  const game = useQuery({ queryKey: ['me-game'], queryFn: () => api<GameMe>('/api/gamification/me'), enabled: user?.role === 'student' });
  const xp = game.data?.xp ?? 0;
  const floor = game.data?.level.min_xp ?? 0;
  const next = game.data?.nextLevel?.min_xp ?? xp + 1;
  return {
    notes,
    game,
    xp,
    pct: Math.round(((xp - floor) / Math.max(1, next - floor)) * 100),
    unread: notes.data?.unread ?? 0,
  };
}

/** Latest notes in the bell: each opens where it came from; the full history lives in /app/notificaciones. */
function NotificationList({ feed, onClose }: { feed: NoteFeed | undefined; onClose: () => void }) {
  const navigate = useNavigate();
  const actions = useNoteActions();
  return (
    <div className="note-list">
      {(feed?.items ?? []).map((note) => (
        <NoteRow key={note.id} note={note} onOpen={(n) => { onClose(); void actions.open(n); }} />
      ))}
      {!feed?.items.length && <p className="muted" style={{ padding: 20, textAlign: 'center', fontSize: 14 }}>Todo al día.</p>}
      <div className="note-foot">
        {Boolean(feed?.unread) && <button className="btn sm ghost" onClick={() => void actions.readAll()}><CheckCheck size={15} /> Marcar todo como leído</button>}
        <button className="btn sm" onClick={() => { onClose(); navigate('/app/notificaciones'); }}>Ver todas</button>
      </div>
    </div>
  );
}

type Campus = ReturnType<typeof useCampus>;

/** The role's buildings, the one we are in, and a way to walk into another one. */
function useCampus() {
  const { user } = useAuth();
  const companion = useCompanion();
  const { dark } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const layout = useMemo(() => campusFor(user?.role, companion.name), [user?.role, companion.name]);
  const buildings = layout.buildings;
  const here = useMemo(() => buildingForPath(pathname, buildings), [pathname, buildings]);
  return {
    layout,
    buildings,
    here,
    dark,
    of: (to: string) => buildingForPath(to, buildings),
    enter: (to: string, source?: Element | null) => enterBuilding(navigate, to, source),
  };
}

const plainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function Section({ section, campus }: { section: NavSection; campus: Campus }) {
  return (
    <div>
      <div className="nav-label">{section.label}</div>
      <nav className="nav">
        {section.items.map((item) => {
          const building = campus.of(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
              style={building ? ({ '--b': building.color } as CSSProperties) : undefined}
              data-building={building?.key}
              onClick={(event) => {
                if (!building || !plainClick(event)) return;
                event.preventDefault();
                campus.enter(item.to, document.querySelector(`[data-mini="${building.key}"] .mini-art`));
              }}
            >
              <span className="nav-ico"><item.icon size={16} strokeWidth={2.4} /></span>
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * While the user scrolls, decorative animations (clouds, walkers, pins) pause so the main thread is free and
 * two-finger touchpad scrolling stays smooth on slower laptops.
 */
function useScrollQuiet() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: number | undefined;
    const busy = () => {
      if (!root.classList.contains('scrolling')) {
        root.classList.add('scrolling');
        document.querySelectorAll('svg.iso-svg').forEach((svg) => (svg as SVGSVGElement).pauseAnimations());
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        root.classList.remove('scrolling');
        document.querySelectorAll('.iso-wrap:not(.paused) svg.iso-svg').forEach((svg) => (svg as SVGSVGElement).unpauseAnimations());
      }, 200);
    };
    const options = { passive: true, capture: true } as const;
    document.addEventListener('scroll', busy, options);
    document.addEventListener('wheel', busy, options);
    document.addEventListener('touchmove', busy, options);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove('scrolling');
      document.removeEventListener('scroll', busy, options);
      document.removeEventListener('wheel', busy, options);
      document.removeEventListener('touchmove', busy, options);
    };
  }, []);
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
  const bellRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const campus = useCampus();
  const isStudent = user?.role === 'student';
  useNoPinchZoom();
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!bellRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

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
        <MiniCampus layout={campus.layout} current={campus.here?.key ?? null} dark={campus.dark} onEnter={(b, source) => campus.enter(b.to, source)} />
        {sections.map((section) => <Section key={section.label} section={section} campus={campus} />)}
        <div className="side-card">
          <div className="row g-12">
            <Avatar name={user?.fullName} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="side-name">{user?.fullName}</div>
              <div className="side-role">{user?.guestLabel || (user ? roleLabel[user.role] : '')}</div>
            </div>
            <button className="icon-btn" onClick={async () => { await logout(); navigate('/'); }} title="Salir">
              <LogOut size={17} />
            </button>
          </div>
          {isStudent && !user?.isGuest && game.data && (
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
            <div style={{ position: 'relative' }} ref={bellRef}>
              <button className="icon-btn" title="Notificaciones" aria-expanded={open} aria-label={`Notificaciones${unread ? `: ${unread} nuevas` : ''}`} onClick={() => setOpen(!open)}>
                <Bell size={18} />
                {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
              </button>
              {open && (
                <div className="card bell-pop">
                  <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                    <b>Notificaciones</b>
                    <span className="chip violet">{unread === 1 ? '1 nueva' : `${unread} nuevas`}</span>
                  </div>
                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    <NotificationList feed={notes.data} onClose={() => setOpen(false)} />
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
  const campus = useCampus();
  const content = useRef<HTMLElement>(null);
  useTableCards(content);

  const tabs = useMemo(() => {
    if (user?.isGuest) return [{ to: '/app/clase', label: 'Clase', icon: Gamepad2, end: true }];
    return user ? mobileTabs(user.role, companion.name) : [];
  }, [user, companion.name]);
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
        <VoiceNav compact />
        <button className="m-icon" onClick={() => setBell(true)} aria-label={`Notificaciones${unread ? `: ${unread} nuevas` : ''}`}>
          <Bell size={21} />
          {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
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
            <div className="muted" style={{ fontSize: 13 }}>{user?.guestLabel || (user ? roleLabel[user.role] : '')}{user?.isGuest ? '' : ` · ${user?.email ?? ''}`}</div>
            {isStudent && !user?.isGuest && game.data && (
              <div style={{ marginTop: 8 }}>
                <div className="row between muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <span>Nivel {game.data.level.level} · {game.data.level.title}</span><span>{pct}%</span>
                </div>
                <Bar value={pct} tone="gold" thin />
              </div>
            )}
          </div>
        </div>
        <MiniCampus layout={campus.layout} current={campus.here?.key ?? null} dark={campus.dark} onEnter={(b, source) => campus.enter(b.to, source)} />
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
          <button className="btn ghost" onClick={async () => { await logout(); navigate('/'); }}><LogOut size={17} /> Salir</button>
        </div>
      </Sheet>

      <Sheet open={bell} onClose={() => setBell(false)} title={`Notificaciones${unread ? ` · ${unread} nuevas` : ''}`}>
        <NotificationList feed={notes.data} onClose={() => setBell(false)} />
      </Sheet>
    </div>
  );
}

export function Shell() {
  const { user } = useAuth();
  const companion = useCompanion();
  const layout = useLayout();
  const sections = useMemo(() => {
    if (!user) return [];
    if (user.isGuest) return [{ label: 'Hoy', items: [{ to: '/app/clase', label: 'La clase', icon: Gamepad2, end: true }] }];
    return navSections(user.role, companion.name);
  }, [user, companion.name]);
  useEffect(() => configureSpeech(companion.female ? 'female' : 'male'), [companion.female]);
  useScrollQuiet();
  const preferences = useQuery({ queryKey: ['preferences'], queryFn: () => api<{ theme: ThemeChoice }>('/api/me/preferences'), staleTime: Infinity, enabled: Boolean(user) });
  useEffect(() => {
    const theme = preferences.data?.theme;
    if (theme && theme !== 'system' && !hasDeviceTheme()) setTheme(theme);
  }, [preferences.data?.theme]);
  return (
    <>
      {layout === 'mobile' ? <MobileShell sections={sections} /> : <DesktopShell sections={sections} />}
      <Guide />
      {user && <PasskeyOffer key={user.id} />}
    </>
  );
}
