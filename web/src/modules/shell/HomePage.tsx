import { Award, Bot, Home, ScanFace, Target } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { StudentHome } from '../student/StudentHome'
import { TeacherHome } from '../teacher/TeacherHome'
import { XpStreak } from './XpStreak'

export function HomePage() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const isStaff = user.role === 'teacher' || user.role === 'admin'

  return (
    <div className="flex flex-col gap-4">
      <section className="eq-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[220px] flex-1">
            <p className="eq-chip">
              <Target className="h-3.5 w-3.5" aria-hidden />
              Hola, {user.name}
            </p>
            <h1 className="eq-display eq-title-xl mt-3 text-[var(--eq-primary)]">Tablero Fuego</h1>
            <p className="mt-2 text-sm font-bold text-[var(--eq-muted)]">
              Colegio Francisco Arango · rol <strong className="text-[var(--eq-ink)]">{user.role}</strong>
            </p>
          </div>
          <div className="w-full max-w-xs">
            <XpStreak filled={user.role === 'student' ? 4 : 6} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="eq-stat"><strong>Kahoot</strong><span>Partidas</span></div>
          <div className="eq-stat"><strong>XP</strong><span>Progreso</span></div>
          <div className="eq-stat"><strong>EQ</strong><span>Insignias</span></div>
        </div>
        <nav className="mt-5 flex flex-wrap gap-2">
          <Link className="eq-nav-link" to="/app"><Home className="h-4 w-4" aria-hidden /> Inicio</Link>
          <Link className="eq-nav-link" to="/app/certificates"><Award className="h-4 w-4" aria-hidden /> Certificados</Link>
          <Link className="eq-nav-link" to="/app/facial"><ScanFace className="h-4 w-4" aria-hidden /> Facial</Link>
          <Link className="eq-nav-link" to="/app/practice"><Bot className="h-4 w-4" aria-hidden /> Tutor</Link>
        </nav>
      </section>
      {user.role === 'student' ? <StudentHome /> : null}
      {isStaff ? <TeacherHome /> : null}
    </div>
  )
}