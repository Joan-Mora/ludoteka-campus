import { useEffect, useRef, useState } from 'react'
import { embeddingFromVideo } from './embedder'

interface Props {
  onCapture: (payload: { embedding: number[]; modelId: string }) => void
  busy?: boolean
  label?: string
}

export function CameraCapture({ onCapture, busy, label = 'Capturar rostro' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const el = videoRef.current
        if (el) {
          el.srcObject = stream
          await el.play()
          setReady(true)
        }
      } catch {
        setCamError('Cámara denegada o no disponible. Usa contraseña.')
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function capture() {
    const el = videoRef.current
    if (!el) return
    try {
      onCapture(embeddingFromVideo(el))
    } catch (err) {
      setCamError(err instanceof Error ? err.message : 'No se pudo capturar')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-black/80 aspect-[4/3]">
        <video ref={videoRef} className="h-full w-full object-cover scale-x-[-1]" playsInline muted />
      </div>
      {camError ? <p className="text-sm text-red-700" role="alert">{camError}</p> : null}
      <button
        type="button"
        disabled={!ready || busy || !!camError}
        onClick={capture}
        className="rounded-xl bg-[var(--eq-accent)] px-4 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Procesando…' : label}
      </button>
      <p className="text-xs text-[var(--eq-muted)]">
        On-device: solo se envía el vector (embedding), nunca la foto.
      </p>
    </div>
  )
}