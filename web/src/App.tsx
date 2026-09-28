import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './modules/auth/AuthContext'
import { ForgotPasswordPage } from './modules/auth/ForgotPasswordPage'
import { LoginPage } from './modules/auth/LoginPage'
import { RegisterPage } from './modules/auth/RegisterPage'
import { ResetPasswordPage } from './modules/auth/ResetPasswordPage'
import { CertificatesPage } from './modules/certificates/CertificatesPage'
import { EnrollPage } from './modules/facial/EnrollPage'
import { PracticePage } from './modules/practice/PracticePage'
import { AppShell } from './modules/shell/AppShell'
import { HomePage } from './modules/shell/HomePage'
import { RequireAuth } from './modules/shell/RequireAuth'
import { PlayAttempt } from './modules/student/PlayAttempt'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/app" element={<HomePage />} />
              <Route path="/app/play/:attemptId" element={<PlayAttempt />} />
              <Route path="/app/certificates" element={<CertificatesPage />} />
              <Route path="/app/facial" element={<EnrollPage />} />
              <Route path="/app/practice" element={<PracticePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}