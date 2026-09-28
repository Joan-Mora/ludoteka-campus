interface Props {
  total: number
  current: number
  answered?: number
}

export function ProgressDots({ total, current, answered = 0 }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Progreso ${answered} de ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < answered
        const active = i === current
        return (
          <span
            key={i}
            className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
              done
                ? 'w-5 bg-[var(--eq-accent)]'
                : active
                  ? 'w-5 bg-[var(--eq-energy-2)] eq-pulse'
                  : 'w-2.5 bg-[var(--eq-primary)]/15'
            }`}
          />
        )
      })}
    </div>
  )
}