import { useState, type FormEvent } from 'react'
import { Bot, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../../shared/api/client'
import type { PracticeMessage } from '../../shared/types/api'

export function PracticePage() {
  const [history, setHistory] = useState<PracticeMessage[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) return
    setBusy(true)
    setError(null)
    const nextHist = [...history, { role: 'user' as const, content: text }]
    setHistory(nextHist)
    setMessage('')
    try {
      const res = await api.practiceChat({ message: text, history })
      setHistory([...nextHist, { role: 'assistant', content: res.reply }])
    } catch (err) {
      if (err instanceof ApiError && err.code === 'KIOSK_ACTIVE') {
        setError('Tutor bloqueado durante un examen kiosco. Termina el intento primero.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Error del tutor')
      }
      setHistory(history)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <section className="eq-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--eq-lime)] to-[var(--eq-sky)] text-white shadow-md">
            <Bot className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="eq-display eq-title-md text-[var(--eq-primary)]">Tutor IA (práctica)</h1>
            <p className="text-sm font-bold text-[var(--eq-muted)]">EQ-P10 · bloqueado en kiosco</p>
          </div>
        </div>
      </section>

      <div className="eq-card flex min-h-[300px] flex-col gap-2.5 p-4">
        {history.length === 0 ? (
          <p className="text-sm font-bold text-[var(--eq-muted)]">Pregunta lo que quieras practicar.</p>
        ) : (
          history.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm font-bold ${
                m.role === 'user'
                  ? 'ml-auto bg-gradient-to-br from-[var(--eq-coral)] to-[var(--eq-energy)] text-white'
                  : 'bg-[var(--eq-bg)] text-[var(--eq-ink)] ring-1 ring-[var(--eq-primary)]/10'
              }`}
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="eq-input flex-1"
          placeholder="Escribe tu duda…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !message.trim()}
          className="eq-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden /> Enviar
        </button>
      </form>
      {error ? <p className="text-sm font-black text-[var(--eq-warn)]" role="alert">{error}</p> : null}
      <Link className="text-sm font-black text-[var(--eq-muted)]" to="/app">Volver</Link>
    </div>
  )
}