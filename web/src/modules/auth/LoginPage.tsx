import { useState, type FormEvent } from 'react'
import { Flame, Lock, ScanFace, Trophy, Zap } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../shared/api/client'
import { CameraCapture } from '../facial/CameraCapture'
import { EnergyBar } from '../shell/EnergyBar'
import { useAuth } from './AuthContext'

type Mode = 'password' | 'facial'

export function LoginPage() {
  const { user, login, loginFacial } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/app" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate('/app')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  async function onFacial(payload: { embedding: number[]; modelId: string }) {
    if (!email.trim()) {
      setError('Indica tu correo (MVP 1:1).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await loginFacial(email.trim(), payload.embedding, payload.modelId)
      navigate('/app')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'NO_MATCH') setError('Rostro no coincide. Prueba de nuevo o usa contraseña.')
        else if (err.code === 'NOT_ENROLLED') setError('Sin enroll facial. Entra con contraseña y enrola en Facial.')
        else setError(err.message)
      } else {
        setError('Login facial fallido')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl items-stretch gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="eq-card p-6 sm:p-8">
        <span className="eq-chip">
          <Flame className="h-3.5 w-3.5" aria-hidden />
          Fuego CFA · mates sexto
        </span>
        <h1 className="eq-display eq-title-xl mt-3 text-[var(--eq-primary)]">
          Gana XP. Domina la partida.
        </h1>
        <p className="mt-3 max-w-md text-base font-bold text-[var(--eq-muted)]">
          Evaluaciones tipo Kahoot, racha diaria y kiosco seguro del Colegio Francisco Arango.
        </p>
        <img src="/brand/hero-quest.svg" alt="" className="eq-hero-art mt-5" />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="eq-stat"><strong>20s</strong><span>Timer</span></div>
          <div className="eq-stat"><strong>XP</strong><span>Energía</span></div>
          <div className="eq-stat"><strong>EQ</strong><span>Insignias</span></div>
        </div>
        <div className="mt-5">
          <EnergyBar value={78} label="Energía de la clase" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="eq-chip"><Zap className="h-3.5 w-3.5" aria-hidden /> Racha</span>
          <span className="eq-chip"><Trophy className="h-3.5 w-3.5" aria-hidden /> Podio</span>
          <span className="eq-chip"><Lock className="h-3.5 w-3.5" aria-hidden /> Kiosco</span>
        </div>
      </section>

      <section className="eq-card flex flex-col p-6 sm:p-7">
        <h2 className="eq-display eq-title-lg text-[var(--eq-primary)]">Entrar a la misión</h2>
        <p className="mt-1 text-sm font-bold text-[var(--eq-muted)]">
          Contraseña siempre disponible · facial on-device opcional
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-black ${mode === 'password' ? 'bg-[var(--eq-primary)] text-white shadow-lg shadow-[var(--eq-primary)]/30' : 'bg-[var(--eq-primary)]/10 text-[var(--eq-primary)]'}`}
            onClick={() => { setMode('password'); setError(null) }}
          >
            <Lock className="h-4 w-4" aria-hidden /> Contraseña
          </button>
          <button
            type="button"
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-black ${mode === 'facial' ? 'bg-[var(--eq-primary)] text-white shadow-lg shadow-[var(--eq-primary)]/30' : 'bg-[var(--eq-primary)]/10 text-[var(--eq-primary)]'}`}
            onClick={() => { setMode('facial'); setError(null) }}
          >
            <ScanFace className="h-4 w-4" aria-hidden /> Rostro
          </button>
        </div>

        <label className="mt-5 block text-sm font-black">
          Correo
          <input className="eq-input mt-1.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        {mode === 'password' ? (
          <form className="mt-3 flex flex-1 flex-col gap-3" onSubmit={onSubmit}>
            <label className="text-sm font-black">
              Contraseña
              <input className="eq-input mt-1.5" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error ? <p className="text-sm font-black text-[var(--eq-warn)]" role="alert">{error}</p> : null}
            <button disabled={loading} type="submit" className="eq-btn-primary eq-pulse mt-auto px-4 py-3.5 text-base disabled:opacity-60">
              {loading ? 'Entrando…' : 'Empezar aventura'}
            </button>
          </form>
        ) : (
          <div className="mt-3 flex flex-1 flex-col">
            {error ? <p className="mb-2 text-sm font-black text-[var(--eq-warn)]" role="alert">{error}</p> : null}
            <CameraCapture onCapture={(p) => void onFacial(p)} busy={loading} label="Entrar con rostro" />
            <button type="button" className="mt-3 text-sm font-black text-[var(--eq-muted)] underline" onClick={() => setMode('password')}>
              Usar contraseña
            </button>
          </div>
        )}

        <p className="mt-5 text-sm font-bold text-[var(--eq-muted)]">
          <Link to="/register">Crear cuenta</Link> · <Link to="/forgot-password">Recuperar</Link>
        </p>
      </section>
    </div>
  )
}