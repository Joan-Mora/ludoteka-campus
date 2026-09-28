import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../../shared/api/client'
import { FACIAL_POLICY_VERSION } from '../../shared/types/api'
import type { FacialConsent } from '../../shared/types/api'
import { CameraCapture } from './CameraCapture'
import { ConsentCopy } from './ConsentCopy'

export function EnrollPage() {
  const [consent, setConsent] = useState<FacialConsent | null>(null)
  const [acceptedLocal, setAcceptedLocal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const c = await api.getFacialConsent()
      setConsent(c)
      setAcceptedLocal(c.accepted && !c.needsReconsent)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo leer consentimiento')
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const needsConsent = !consent || consent.needsReconsent

  async function saveConsent() {
    setBusy(true)
    setError(null)
    try {
      const version = consent?.policyCurrent || FACIAL_POLICY_VERSION
      await api.postFacialConsent({ policyVersion: version, accepted: true })
      setMsg('Consentimiento registrado (Ley 1581).')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar consentimiento')
    } finally {
      setBusy(false)
    }
  }

  async function onEnroll(payload: { embedding: number[]; modelId: string }) {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await api.enrollFacial(payload)
      setMsg('Rostro enrolado. Ya puedes entrar con facial.')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONSENT_REQUIRED') {
        setError('Debes aceptar (o re-aceptar) el consentimiento vigente antes de enrolar.')
      } else if (err instanceof ApiError && err.code === 'IMAGE_NOT_ALLOWED') {
        setError('No se envían fotos. Solo el vector on-device.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Enrolamiento fallido')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    setError(null)
    try {
      await api.deleteFacialEnroll()
      setMsg('Embedding eliminado (retención RNF-F03). Puedes seguir con contraseña.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <section className="rounded-2xl bg-[var(--eq-panel)] p-6 shadow-sm">
        <h1 className="eq-display text-lg font-extrabold text-[var(--eq-primary)]">Reconocimiento facial</h1>
        <p className="mt-1 text-sm text-[var(--eq-muted)]">
          EQ-P09 · Ley 1581 · on-device · fallback contraseña · borrado bajo demanda.
        </p>
        <div className="mt-4">
          <ConsentCopy />
        </div>
        {consent?.needsReconsent ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            La política cambió (vigente <code>{consent.policyCurrent}</code>
            {consent.policyVersion ? <>; tenías <code>{consent.policyVersion}</code></> : null}).
            Debes volver a consentir antes de enrolar.
          </p>
        ) : null}
        {consent?.acceptedAt && !consent.needsReconsent ? (
          <p className="mt-2 text-xs text-[var(--eq-muted)]">
            Consentimiento vigente desde {consent.acceptedAt} · v{consent.policyVersion}
          </p>
        ) : null}
        {needsConsent ? (
          <div className="mt-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedLocal}
                onChange={(e) => setAcceptedLocal(e.target.checked)}
              />
              <span>
                He leído y acepto el tratamiento de datos biométricos conforme a la Ley 1581 de 2012
                (política {(consent?.policyCurrent || FACIAL_POLICY_VERSION)}).
              </span>
            </label>
            <button
              type="button"
              disabled={!acceptedLocal || busy}
              onClick={() => void saveConsent()}
              className="mt-3 rounded-xl bg-[var(--eq-primary)] px-4 py-2 text-white disabled:opacity-60"
            >
              Registrar consentimiento
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-[var(--eq-panel)] p-6 shadow-sm">
        <h2 className="font-medium">Enrolar / actualizar</h2>
        <p className="mt-1 text-xs text-[var(--eq-muted)]">
          Retención: borra aquí cuando quieras; también se elimina al baja de cuenta o al plazo del colegio.
        </p>
        <div className="mt-3">
          <CameraCapture
            onCapture={(p) => void onEnroll(p)}
            busy={busy || needsConsent}
            label="Enrolar rostro"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDelete()}
          className="mt-3 text-sm text-red-700 underline disabled:opacity-60"
        >
          Borrar mi embedding ahora
        </button>
        {msg ? <p className="mt-2 text-sm text-green-800">{msg}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
      </section>

      <Link className="text-sm text-[var(--eq-muted)]" to="/app">← Volver</Link>
    </div>
  )
}