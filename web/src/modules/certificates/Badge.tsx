interface Props {
  score: number
  label?: string
}

export function Badge({ score, label = 'Insignia EduQuest' }: Props) {
  const tier = score >= 7000 ? 'Oro' : score >= 4000 ? 'Plata' : score >= 1000 ? 'Bronce' : 'Participación'
  const color =
    tier === 'Oro' ? '#FFE566' : tier === 'Plata' ? '#C4CDD8' : tier === 'Bronce' ? '#E8A87C' : '#58CC02'

  return (
    <div className="eq-card flex flex-col items-center gap-2 p-6">
      <div className="eq-float">
        <svg width="128" height="128" viewBox="0 0 96 96" aria-hidden>
          <defs>
            <linearGradient id="eqBadge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor="#FF3D68" />
            </linearGradient>
          </defs>
          <circle cx="48" cy="48" r="44" fill="url(#eqBadge)" opacity="0.25" />
          <circle cx="48" cy="48" r="34" fill="url(#eqBadge)" />
          <text x="48" y="54" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" fontFamily="Outfit, sans-serif">
            EQ
          </text>
        </svg>
      </div>
      <p className="text-sm font-black text-[var(--eq-primary)]">{label}</p>
      <p className="eq-chip">{tier} · {score} pts</p>
      <p className="text-xs font-bold text-[var(--eq-muted)]">Colegio Francisco Arango</p>
    </div>
  )
}