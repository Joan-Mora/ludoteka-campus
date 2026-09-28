import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Maximize2, PartyPopper, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api, certificateUrl, downloadAuthed } from '../../shared/api/client'
import type { AttemptDetail, QuizQuestion } from '../../shared/types/api'
import { Badge } from '../certificates/Badge'
import { useKioskIntegrity } from '../kiosk/useKioskIntegrity'
import { EnergyBar } from '../shell/EnergyBar'
import { ProgressDots } from '../shell/ProgressDots'

const TIMER_SEC = 20
const OPTION_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C']

export function PlayAttempt() {
  const { attemptId = null } = useParams()
  const { events, suspended, lastError, enterFullscreen } = useKioskIntegrity(attemptId, Boolean(attemptId))

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [seconds, setSeconds] = useState(TIMER_SEC)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ correct: boolean; points: number } | null>(null)
  const startedAt = useRef<number>(Date.now())

  const answeredIds = useMemo(
    () => new Set((attempt?.answers ?? []).map((a) => a.questionId)),
    [attempt],
  )

  const questions = attempt?.questions ?? []
  const current: QuizQuestion | undefined = questions[index]
  const done =
    suspended ||
    attempt?.status === 'suspended' ||
    attempt?.status === 'completed' ||
    (questions.length > 0 && answeredIds.size >= questions.length)

  const reload = useCallback(async () => {
    if (!attemptId) return
    try {
      const data = await api.getAttempt(attemptId)
      setAttempt(data)
      const answered = new Set(data.answers.map((a) => a.questionId))
      const next = data.questions.findIndex((q) => !answered.has(q.id))
      setIndex(next === -1 ? data.questions.length : next)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el intento')
    }
  }, [attemptId])

  useEffect(() => {
    void reload()
    void enterFullscreen()
  }, [reload, enterFullscreen])

  useEffect(() => {
    if (done || !current || feedback) return
    startedAt.current = Date.now()
    setSeconds(TIMER_SEC)
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [current?.id, done, feedback])

  useEffect(() => {
    if (seconds === 0 && current && !feedback && !busy) {
      void answer(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds])

  async function answer(optionId: string | null) {
    if (!attemptId || !current || busy || feedback) return
    setBusy(true)
    try {
      const elapsedMs = Date.now() - startedAt.current
      const res = await api.postAnswer(attemptId, {
        questionId: current.id,
        optionId: optionId ?? undefined,
        elapsedMs,
      })
      setFeedback({ correct: res.correct, points: res.points })
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              score: res.score,
              answers: [
                ...prev.answers.filter((a) => a.questionId !== current.id),
                {
                  questionId: current.id,
                  optionId,
                  correct: res.correct,
                  points: res.points,
                },
              ],
            }
          : prev,
      )
      window.setTimeout(() => {
        setFeedback(null)
        setIndex((i) => i + 1)
        setBusy(false)
      }, 900)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Error al responder')
      setBusy(false)
    }
  }

  if (!attemptId) {
    return <p className="text-sm font-black text-[var(--eq-warn)]">Falta attemptId</p>
  }

  const energy = Math.max(5, Math.round((seconds / TIMER_SEC) * 100))

  if (done && attempt) {
    const isSuspended = suspended || attempt.status === 'suspended'
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <section className="eq-card p-6 text-center sm:p-8">
          <p className="eq-chip mx-auto inline-flex">
            {isSuspended ? (
              <><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Suspendido</>
            ) : (
              <><PartyPopper className="h-3.5 w-3.5" aria-hidden /> Nivel completado</>
            )}
          </p>
          <h2 className="eq-display eq-title-xl mt-3 text-[var(--eq-primary)]">
            {isSuspended ? 'Intento suspendido' : 'Gran partida'}
          </h2>
          <p className="mt-2 text-base font-bold text-[var(--eq-muted)]">Puntaje: {attempt.score}</p>
          <div className="mt-4"><Badge score={attempt.score} /></div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="eq-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5"
              onClick={() => void downloadAuthed(certificateUrl(attemptId), `certificado-${attemptId}.pdf`)}
            >
              <Download className="h-4 w-4" aria-hidden /> Certificado PDF
            </button>
            <Link to="/app/certificates" className="eq-btn-ghost px-4 py-2.5 text-sm">Mis certificados</Link>
            <Link to="/app" className="eq-btn-ghost px-4 py-2.5 text-sm">Inicio</Link>
          </div>
          <p className="mt-3 text-xs font-bold text-[var(--eq-muted)]">Integridad: {events}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="eq-card flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-[200px] flex-1">
          <EnergyBar value={energy} label="Energía del timer" />
          <div className="mt-2.5">
            <ProgressDots total={questions.length || 1} current={index} answered={answeredIds.size} />
          </div>
        </div>
        <div className="text-right">
          <p className="eq-display text-2xl font-black text-[var(--eq-primary)] tabular-nums">{attempt?.score ?? 0}</p>
          <p className="text-xs font-black uppercase tracking-wide text-[var(--eq-muted)]">pts · int {events}</p>
          <button
            type="button"
            onClick={() => void enterFullscreen()}
            className="eq-btn-ghost mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Pantalla completa
          </button>
        </div>
      </div>

      {loadError ? <p className="text-sm font-black text-[var(--eq-warn)]">{loadError}</p> : null}
      {lastError ? <p className="text-sm font-black text-[var(--eq-warn)]">{lastError}</p> : null}

      {!current ? (
        <p className="eq-card p-6 text-sm font-bold text-[var(--eq-muted)]">Cargando preguntas…</p>
      ) : (
        <section className="eq-card p-5 sm:p-7">
          <p className="eq-chip">Pregunta {index + 1} / {questions.length}</p>
          <h2 className="eq-display eq-title-lg mt-4 text-[var(--eq-ink)]">{current.prompt}</h2>
          {feedback ? (
            <p className={`mt-5 inline-flex items-center gap-2 text-xl font-black ${feedback.correct ? 'text-[var(--eq-lime)]' : 'text-[var(--eq-warn)]'}`}>
              {feedback.correct ? (
                <><CheckCircle2 className="h-6 w-6" aria-hidden /> Correcto (+{feedback.points})</>
              ) : (
                <><XCircle className="h-6 w-6" aria-hidden /> Incorrecto</>
              )}
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {current.options.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void answer(opt.id)}
                  className="rounded-[22px] px-4 py-6 text-left text-lg font-black text-white shadow-xl transition hover:-translate-y-1 hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}