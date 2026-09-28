interface Props {
  size?: number
  className?: string
}

export function EqLogo({ size = 40, className = '' }: Props) {
  return (
    <img
      src="/brand/eq-mark.svg"
      width={size}
      height={size}
      alt="EduQuest"
      className={className}
      draggable={false}
    />
  )
}