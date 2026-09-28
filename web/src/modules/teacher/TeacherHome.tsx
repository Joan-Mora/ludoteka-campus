import { useState } from 'react'
import { ClipboardList, Download, Play, Plus, Square } from 'lucide-react'
import { ApiError, api, downloadAuthed, sessionReportUrl } from '../../shared/api/client'
import type { QuizSession } from '../../shared/types/api'

export function TeacherHome() {
  const [session, setSession] = useState<QuizSession | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const s = await api.createSession('Mates sexto')
      setSession(s)
      setDetail(await api.getSession(s.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la sesión')
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    if (!session) return
    setBusy(true)
    try {
      await api.startSession(session.id)
      setSession({ ...session, status: 'live' })
      setDetail(await api.getSession(session.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar')
    } finally {
      setBusy(false)
    }
  }

  async function end() {
    if (!session) return
    setBusy(true)
    try {
      await api.endSession(session.id)
      setSession({ ...session, status: 'ended' })
      setDetail(await api.getSession(session.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cerrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="eq-card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--eq-primary)] to-[var(--eq-coral)] text-white shadow-lg">
          <ClipboardList className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="eq-display eq-title-md text-[var(--eq-primary)]">Sala docente</h2>
          <p className="text-sm font-bold text-[var(--eq-muted)]">Lobby · live · reportes</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button disabled={busy} type="button" onClick={() => void create()} className="eq-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-60">
          <Plus className="h-4 w-4" aria-hidden /> Nueva sesión
        </button>
        <button disabled={busy || !session || session.status !== 'lobby'} type="button" onClick={() => void start()} className="eq-btn-ghost inline-flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-60">
          <Play className="h-4 w-4" aria-hidden /> Iniciar
        </button>
        <button disabled={busy || !session || session.status === 'ended'} type="button" onClick={() => void end()} className="eq-btn-ghost inline-flex items-center gap-1.5 px-4 py-2.5 disabled:opacity-60">
          <Square className="h-4 w-4" aria-hidden /> Cerrar
        </button>
        {session ? (
          <button
            type="button"
            className="eq-btn-ghost inline-flex items-center gap-1.5 px-4 py-2.5"
            onClick={() => void downloadAuthed(sessionReportUrl(session.id), `reporte-${session.code}.xlsx`)}
          >
            <Download className="h-4 w-4" aria-hidden /> Reporte
          </button>
        ) : null}
      </div>
      {session ? (
        <div className="mt-5 rounded-[22px] bg-gradient-to-br from-[var(--eq-bg)] to-[var(--eq-bg-2)] p-5 ring-2 ring-[var(--eq-primary)]/15">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--eq-muted)]">Código de sala</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-[0.28em] text-[var(--eq-primary)]">{session.code}</p>
          <p className="eq-chip mt-3">Estado: {session.status}</p>
        </div>
      ) : null}
      {detail ? (
        <pre className="mt-4 overflow-auto rounded-2xl bg-[var(--eq-ink)] p-3 text-xs text-[var(--eq-gold)]">{JSON.stringify(detail, null, 2)}</pre>
      ) : null}
      {error ? <p className="mt-2 text-sm font-black text-[var(--eq-warn)]">{error}</p> : null}
    </div>
  )
}