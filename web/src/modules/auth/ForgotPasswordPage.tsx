import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../../shared/api/client'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.forgotPassword(email.trim())
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el correo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md eq-card">
      <h1 className="eq-display eq-title-lg text-[var(--eq-primary)]">Recuperar contraseña</h1>
      {done ? (
        <p className="mt-4 text-sm text-[var(--eq-muted)]">Si el correo existe, enviamos instrucciones (respuesta genérica).</p>
      ) : (
        <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
          <label className="text-sm">Correo<input className="mt-1 w-full eq-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button disabled={loading} type="submit" className="rounded-xl bg-[var(--eq-accent)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{loading ? 'Enviando…' : 'Enviar enlace'}</button>
        </form>
      )}
      <p className="mt-4 text-sm"><Link to="/login">Volver</Link></p>
    </div>
  )
}