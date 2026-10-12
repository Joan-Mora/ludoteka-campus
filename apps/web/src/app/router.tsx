import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/shared/auth';
import { Tile } from '@/ui';
import { Shell } from './shell';
import { roleLabel, ROUTE_ROLES } from './nav';
import { ChangePasswordPage, ForgotPage, Landing, LoginPage, ResetPage, VerifyPage, VerifyReportPage } from '@/features/public';

function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const classroom = () => import('@/features/classroom');
const staff = () => import('@/features/staff');
const community = () => import('@/features/community');
const governance = () => import('@/features/governance');
const library = () => import('@/features/library');
const arena = () => import('@/features/arena');
const exam = () => import('@/features/exam');
const play = () => import('@/features/play');
const facial = () => import('@/features/facial');

const HomePage = page(classroom, 'HomePage');
const CoursesPage = page(classroom, 'CoursesPage');
const CoursePage = page(classroom, 'CoursePage');
const CourseDesk = page(classroom, 'CourseDesk');
const LessonPage = page(classroom, 'LessonPage');
const ExamPage = page(exam, 'ExamPage');
const LivePage = page(exam, 'LivePage');
const AchievementsPage = page(play, 'AchievementsPage');
const GamesPage = page(() => import('@/features/games/arcade'), 'GamesPage');
const TutorPage = page(() => import('@/features/tutor'), 'TutorPage');
const FacialPage = page(facial, 'FacialPage');
const FacialLoginPage = page(facial, 'FacialLoginPage');
const AdminPage = page(staff, 'AdminPage');
const UsuariosPage = page(() => import('@/features/accounts'), 'UsuariosPage');
const SettingsPage = page(() => import('@/features/settings'), 'SettingsPage');
const BankPage = page(staff, 'BankPage');
const IntegrityPage = page(staff, 'IntegrityPage');
const ReportsPage = page(staff, 'ReportsPage');
const CoordinationPage = page(governance, 'CoordinationPage');
const RectoriaPage = page(governance, 'RectoriaPage');
const MessagesPage = page(governance, 'MessagesPage');
const GuardianPage = page(community, 'GuardianPage');
const NewsPage = page(community, 'NewsPage');
const LibraryPage = page(library, 'LibraryPage');
const LibraryItemPage = page(library, 'LibraryItemPage');
const RoutePage = page(() => import('@/features/route'), 'RoutePage');
const LearningPage = page(() => import('@/features/learning'), 'LearningPage');
const ObservatoryPage = page(() => import('@/features/observatory'), 'ObservatoryPage');
const ArenaPage = page(arena, 'ArenaPage');
const ArenaRoomPage = page(arena, 'ArenaRoomPage');
const ArenaProjectorPage = page(arena, 'ArenaProjectorPage');
const StudyPage = page(() => import('@/features/study'), 'StudyPage');
const GradebookPage = page(() => import('@/features/gradebook'), 'GradebookPage');
const NotificationsPage = page(() => import('@/features/notifications'), 'NotificationsPage');
const legal = () => import('@/features/legal');
const LegalPage = page(legal, 'LegalPage');
const AcceptPage = page(legal, 'AcceptPage');

export function Splash() {
  return (
    <div className="kiosk" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/favicon.svg" alt="" style={{ width: 72, height: 72, borderRadius: 22, animation: 'bob 1.4s ease-in-out infinite' }} />
        <p style={{ marginTop: 16, fontWeight: 700, color: '#cfc9ff' }}>Abriendo Ludoteka Campus…</p>
      </div>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/ingresar" replace />;
  if (user.mustChangePassword) return <Navigate to="/cambiar-clave" replace />;
  if (user.legalPending) return <Navigate to="/aceptar" replace />;
  return children;
}

export function NotForRole() {
  const { user } = useAuth();
  return (
    <div className="card not-for-role" role="alert">
      <Tile icon={ShieldOff} tone="coral" large />
      <h1>Esta sección no es para tu rol</h1>
      <p className="muted">
        Entraste como <b>{user ? roleLabel[user.role] : 'invitado'}</b>. Cada rol del colegio tiene su propio espacio en el campus; desde el inicio
        encuentras todo lo que te corresponde.
      </p>
      <Link className="btn" to="/app">Volver al inicio</Link>
    </div>
  );
}

function RoleRoute({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useAuth();
  const allowed = ROUTE_ROLES[path];
  if (user && allowed && !allowed.includes(user.role)) return <NotForRole />;
  return children;
}

const app: [string, ComponentType][] = [
  ['cursos', CoursesPage],
  ['cursos/:id', CoursePage],
  ['cursos/:id/aula', CourseDesk],
  ['lecciones/:id', LessonPage],
  ['logros', AchievementsPage],
  ['notificaciones', NotificationsPage],
  ['jugar', GamesPage],
  ['tutor', TutorPage],
  ['rostro', FacialPage],
  ['en-vivo', LivePage],
  ['banco', BankPage],
  ['integridad/:id', IntegrityPage],
  ['reportes/:id', ReportsPage],
  ['coordinacion', CoordinationPage],
  ['coordinacion/asistencia', CoordinationPage],
  ['coordinacion/citaciones', CoordinationPage],
  ['rectoria', RectoriaPage],
  ['rectoria/firmas', RectoriaPage],
  ['rectoria/comunicados', RectoriaPage],
  ['rectoria/reportes', RectoriaPage],
  ['mensajes', MessagesPage],
  ['admin', AdminPage],
  ['admin/usuarios', UsuariosPage],
  ['novedades', NewsPage],
  ['acudiente', GuardianPage],
  ['biblioteca', LibraryPage],
  ['biblioteca/:id', LibraryItemPage],
  ['ruta', RoutePage],
  ['aprender', LearningPage],
  ['consultas', ObservatoryPage],
  ['arena', ArenaPage],
  ['arena/:id', ArenaRoomPage],
  ['cuaderno', StudyPage],
  ['calificaciones', GradebookPage],
  ['ajustes', SettingsPage],
];

export function AppRouter() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/ingresar" element={<LoginPage />} />
        <Route path="/ingresar/rostro" element={<FacialLoginPage />} />
        <Route path="/cambiar-clave" element={<ChangePasswordPage />} />
        <Route path="/recuperar" element={<ForgotPage />} />
        <Route path="/restablecer" element={<ResetPage />} />
        <Route path="/aceptar" element={<AcceptPage />} />
        <Route path="/legal/:kind" element={<LegalPage />} />
        <Route path="/verificar/:code" element={<VerifyPage />} />
        <Route path="/verificar-reporte/:code" element={<VerifyReportPage />} />
        <Route path="/examen/:id" element={<Gate><ExamPage /></Gate>} />
        <Route path="/arena/:id/proyector" element={<Gate><ArenaProjectorPage /></Gate>} />
        <Route path="/app" element={<Gate><Shell /></Gate>}>
          <Route index element={<HomePage />} />
          {app.map(([path, Page]) => (
            <Route key={path} path={path} element={<RoleRoute path={path}><Page /></RoleRoute>} />
          ))}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
