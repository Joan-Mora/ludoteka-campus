import { Flame, LogOut, Sparkles } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EnergyBar } from './EnergyBar'
import { EqLogo } from './EqLogo'

export function AppShell() {
  const { user, logout } = useAuth()
  const menuEnergy = user ? (user.role === 'student' ? 72 : 88) : 45

  return (
    <div className="relative min-h-svh text-[var(--eq-ink)]">
      <div className="eq-mesh" aria-hidden />
      <header className="eq-header sticky top-0 z-20 border-b border-white/25 text-white shadow-[0_12px_40px_rgba(75,31,255,0.35)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2.5 px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <Link to={user ? '/app' : '/login'} className="group flex items-center gap-3 text-white no-underline">
              <EqLogo size={48} className="eq-float drop-shadow-lg" />
              <span>
                <span className="eq-display block text-xl font-extrabold tracking-tight">EduQuest</span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">
                  CFA · mates sexto · Fuego
                </span>
              </span>
            </Link>
            {user ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-black sm:inline-flex">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-black hover:bg-white/25"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Salir
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                Fuego CFA
              </span>
            )}
          </div>
          <div className="rounded-2xl bg-black/15 px-3 py-2.5 ring-1 ring-white/20">
            <EnergyBar value={menuEnergy} label="XP del día" tone="onDark" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}