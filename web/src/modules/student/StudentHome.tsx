import { useState, type FormEvent } from 'react'
import { Gamepad2, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../shared/api/client'

export function StudentHome() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.joinSession(code.trim().toUpperCase())
      navigate(`/app/play/${res.attemptId}`, { state: { sessionId: res.sessionId } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo unir a la sala')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="eq-card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--eq-coral)] to-[var(--eq-energy)] text-[var(--eq-ink)] shadow-lg shadow-[var(--eq-coral)]/30">
          <Gamepad2 className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="eq-display eq-title-md text-[var(--eq-primary)]">Unirme a la partida</h2>
          <p className="text-sm font-bold text-[var(--eq-muted)]">Código del docente · 4 colores Kahoot</p>
        </div>
      </div>
      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={onJoin}>
        <input
          className="eq-input flex-1 text-center text-xl font-black uppercase tracking-[0.4em]"
          placeholder="CÓDIGO"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button disabled={loading} type="submit" className="eq-btn-primary px-7 py-3.5 disabled:opacity-60">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm font-black text-[var(--eq-warn)]">{error}</p> : null}
      <div className="mt-5 grid grid-cols-4 gap-2">
        {['#E21B3C', '#1368CE', '#D89E00', '#26890C'].map((c) => (
          <div key={c} className="h-10 rounded-xl shadow-inner" style={{ backgroundColor: c }} />
        ))}
      </div>
      <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-black">
        <Sparkles className="h-4 w-4 text-[var(--eq-energy)]" aria-hidden />
        <Link to="/app/certificates">Ver certificados e insignias</Link>
      </p>
    </div>
  )
}