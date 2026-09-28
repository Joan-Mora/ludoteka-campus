import { useState } from 'react'
import { Award, Download } from 'lucide-react'
import { certificateUrl, downloadAuthed, ApiError } from '../../shared/api/client'
import { Badge } from './Badge'

export function CertificatesPage() {
  const [attemptId, setAttemptId] = useState('')
  const [score, setScore] = useState(5000)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setError(null)
    try {
      await downloadAuthed(certificateUrl(attemptId.trim()), `certificado-${attemptId.trim()}.pdf`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Descarga fallida')
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="eq-card p-6 sm:p-7">
        <p className="eq-chip"><Award className="h-3.5 w-3.5" aria-hidden /> EQ-C06</p>
        <h2 className="eq-display eq-title-lg mt-3 text-[var(--eq-primary)]">Certificados e insignias</h2>
        <p className="mt-2 text-sm font-bold text-[var(--eq-muted)]">
          PDF con aval rector placeholder + QR/ID · CFA
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            className="eq-input flex-1 font-mono text-sm"
            placeholder="attemptId"
            value={attemptId}
            onChange={(e) => setAttemptId(e.target.value)}
          />
          <button
            type="button"
            disabled={!attemptId.trim()}
            onClick={() => void download()}
            className="eq-btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2.5 disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden /> PDF
          </button>
        </div>
        <label className="mt-4 block text-xs font-black uppercase tracking-wide text-[var(--eq-muted)]">
          Puntaje (preview insignia)
          <input
            type="number"
            className="eq-input mt-1.5"
            value={score}
            onChange={(e) => setScore(Number(e.target.value) || 0)}
          />
        </label>
        {error ? <p className="mt-2 text-sm font-black text-[var(--eq-warn)]">{error}</p> : null}
      </div>
      <Badge score={score} />
    </div>
  )
}