import { useEffect, useState } from 'react'

interface Props {
  value: number
  max?: number
  label?: string
  tone?: 'default' | 'onDark'
}

/** XP/energía continua — sin jump-reset. */
export function EnergyBar({ value, max = 100, label = 'Energía', tone = 'default' }: Props) {
  const target = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const [pct, setPct] = useState(target)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPct(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  const labelCls =
    tone === 'onDark'
      ? 'text-white'
      : 'text-[var(--eq-primary)]'

  return (
    <div className="w-full">
      <div className={`mb-1.5 flex items-center justify-between text-xs font-black ${labelCls}`}>
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="eq-energy-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="eq-energy-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}