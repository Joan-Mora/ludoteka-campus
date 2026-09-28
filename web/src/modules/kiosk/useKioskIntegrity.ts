import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../shared/api/client'
import type { IntegrityType } from '../../shared/types/api'

export function useKioskIntegrity(attemptId: string | null, enabled: boolean) {
  const [events, setEvents] = useState(0)
  const [suspended, setSuspended] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const posting = useRef(false)

  const report = useCallback(
    async (type: IntegrityType) => {
      if (!attemptId || !enabled || posting.current || suspended) return
      posting.current = true
      try {
        const res = await api.postIntegrity(attemptId, type)
        setEvents((n) => n + 1)
        const status =
          res && typeof res === 'object'
            ? (('status' in res && String(res.status)) ||
                ('attempt' in res &&
                  typeof res.attempt === 'object' &&
                  res.attempt &&
                  'status' in res.attempt &&
                  String((res.attempt as { status?: string }).status)) ||
                '')
            : ''
        if (status === 'suspended') setSuspended(true)
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Error de integridad')
      } finally {
        posting.current = false
      }
    },
    [attemptId, enabled, suspended],
  )

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      setLastError('No se pudo entrar a pantalla completa')
    }
  }, [])

  useEffect(() => {
    if (!enabled || !attemptId) return

    const onVis = () => {
      if (document.hidden) void report('visibility')
    }
    const onBlur = () => {
      void report('blur')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void report('escape')
    }
    const onFs = () => {
      if (!document.fullscreenElement) void report('fullscreen_exit')
    }

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [attemptId, enabled, report])

  return { events, suspended, lastError, enterFullscreen, report }
}