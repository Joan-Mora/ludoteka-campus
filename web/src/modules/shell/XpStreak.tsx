interface Props {
  filled?: number
  total?: number
  label?: string
}

export function XpStreak({ filled = 4, total = 7, label = 'Racha semanal' }: Props) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-black text-[var(--eq-primary)]">
        <span>{label}</span>
        <span className="tabular-nums">{filled}/{total}</span>
      </div>
      <div className="eq-xp-track" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`eq-xp-seg ${i < filled ? 'on' : ''}`} />
        ))}
      </div>
    </div>
  )
}