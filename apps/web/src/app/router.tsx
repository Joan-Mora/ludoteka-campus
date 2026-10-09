import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth';
import { Shell } from './shell';
import { ChangePasswordPage, ForgotPage, Landing, LoginPage, ResetPage, VerifyPage, VerifyReportPage } from '@/features/public';

function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const classroom = () => import('@/features/classroom');
const staff = () => import('@/features/staff');
const community = () => import('@/features/community');
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
const GamesPage = page(play, 'GamesPage');
const TutorPage = page(() => import('@/features/tutor'), 'TutorPage');
const FacialPage = page(facial, 'FacialPage');
const FacialLoginPage = page(facial, 'FacialLoginPage');
const AdminPage = page(staff, 'AdminPage');
const UsuariosPage = page(() => import('@/features/accounts'), 'UsuariosPage');
const SettingsPage = page(() => import('@/features/settings'), 'SettingsPage');
const BankPage = page(staff, 'BankPage');
const IntegrityPage = page(staff, 'IntegrityPage');
const RectoriaPage = page(staff, 'RectoriaPage');
const ReportsPage = page(staff, 'ReportsPage');
const GuardianPage = page(community, 'GuardianPage');
const NewsPage = page(community, 'NewsPage');
const LibraryPage = page(library, 'LibraryPage');
const LibraryItemPage = page(library, 'LibraryItemPage');
const RoutePage = page(() => import('@/features/route'), 'RoutePage');
const ObservatoryPage = page(() => import('@/features/observatory'), 'ObservatoryPage');
const ArenaPage = page(arena, 'ArenaPage');
const ArenaRoomPage = page(arena, 'ArenaRoomPage');
const ArenaProjectorPage = page(arena, 'ArenaProjectorPage');
const StudyPage = page(() => import('@/features/study'), 'StudyPage');
const GradebookPage = page(() => import('@/features/gradebook'), 'GradebookPage');
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
          <Route path="cursos" element={<CoursesPage />} />
          <Route path="cursos/:id" element={<CoursePage />} />
          <Route path="cursos/:id/aula" element={<CourseDesk />} />
          <Route path="lecciones/:id" element={<LessonPage />} />
          <Route path="logros" element={<AchievementsPage />} />
          <Route path="jugar" element={<GamesPage />} />
          <Route path="tutor" element={<TutorPage />} />
          <Route path="rostro" element={<FacialPage />} />
          <Route path="en-vivo" element={<LivePage />} />
          <Route path="banco" element={<BankPage />} />
          <Route path="integridad/:id" element={<IntegrityPage />} />
          <Route path="reportes/:id" element={<ReportsPage />} />
          <Route path="rectoria" element={<RectoriaPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/usuarios" element={<UsuariosPage />} />
          <Route path="novedades" element={<NewsPage />} />
          <Route path="acudiente" element={<GuardianPage />} />
          <Route path="biblioteca" element={<LibraryPage />} />
          <Route path="biblioteca/:id" element={<LibraryItemPage />} />
          <Route path="ruta" element={<RoutePage />} />
          <Route path="consultas" element={<ObservatoryPage />} />
          <Route path="arena" element={<ArenaPage />} />
          <Route path="arena/:id" element={<ArenaRoomPage />} />
          <Route path="cuaderno" element={<StudyPage />} />
          <Route path="calificaciones" element={<GradebookPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
