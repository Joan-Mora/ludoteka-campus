import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../shared/api/client'
import { ConsentCopy } from '../facial/ConsentCopy'
import { useAuth } from './AuthContext'

export function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ackFacial, setAckFacial] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/app" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ackFacial) {
      setError('Confirma que leíste la información de datos biométricos (opcional).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await register({ name: name.trim(), email: email.trim(), password })
      navigate('/app/facial')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md eq-card">
      <h1 className="eq-display eq-title-lg text-[var(--eq-primary)]">Registro estudiante</h1>
      <p className="mt-1 text-sm text-[var(--eq-muted)]">
        La contraseña es obligatoria. El facial es opcional y se configura después del registro.
      </p>
      <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="text-sm">Nombre<input className="mt-1 w-full eq-input" required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="text-sm">Correo<input className="mt-1 w-full eq-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="text-sm">Contraseña<input className="mt-1 w-full eq-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>

        <ConsentCopy compact />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={ackFacial} onChange={(e) => setAckFacial(e.target.checked)} />
          <span>
            He leído la información sobre datos biométricos (Ley 1581). Entiendo que el facial es opcional
            y que tras crear la cuenta podré consentir y enrolar en Facial, o usar solo contraseña.
          </span>
        </label>

        {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
        <button disabled={loading} type="submit" className="rounded-xl bg-[var(--eq-accent)] px-4 py-2.5 font-medium text-white disabled:opacity-60">{loading ? 'Creando…' : 'Crear cuenta'}</button>
      </form>
      <p className="mt-4 text-sm"><Link to="/login">Ya tengo cuenta</Link></p>
    </div>
  )
}