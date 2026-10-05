import { type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/shared/auth';
import { Shell } from './shell';
import { ForgotPage, Landing, LoginPage, RegisterPage, ResetPage, VerifyPage } from '@/features/public';
import { CourseDesk, CoursePage, CoursesPage, HomePage, LessonPage } from '@/features/classroom';
import { ExamPage, LivePage } from '@/features/exam';
import { AchievementsPage, GamesPage } from '@/features/play';
import { TutorPage } from '@/features/tutor';
import { FacialLoginPage, FacialPage } from '@/features/facial';
import { AdminPage, BankPage, IntegrityPage, RectoriaPage, ReportsPage } from '@/features/staff';

function Splash() {
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
  return children;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/ingresar" element={<LoginPage />} />
      <Route path="/ingresar/rostro" element={<FacialLoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/recuperar" element={<ForgotPage />} />
      <Route path="/restablecer" element={<ResetPage />} />
      <Route path="/verificar/:code" element={<VerifyPage />} />
      <Route path="/examen/:id" element={<Gate><ExamPage /></Gate>} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
