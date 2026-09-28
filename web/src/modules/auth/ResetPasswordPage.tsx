import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, api } from '../../shared/api/client'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md eq-card">
      <h1 className="eq-display eq-title-lg text-[var(--eq-primary)]">Nueva contraseña</h1>
      {done ? (
        <p className="mt-4 text-sm">Listo. <Link to="/login">Ingresar</Link></p>
      ) : (
        <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
          <label className="text-sm">Contraseña nueva<input className="mt-1 w-full eq-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button disabled={loading || !token} type="submit" className="rounded-xl bg-[var(--eq-accent)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{loading ? 'Guardando…' : 'Guardar'}</button>
        </form>
      )}
    </div>
  )
}