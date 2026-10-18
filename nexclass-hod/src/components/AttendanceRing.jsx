export default function AttendanceRing({ percentage, size = 100 }) {
  const radius = (size / 2) - 10
  const circumference = 2 * Math.PI * radius
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0))
  const offset = circumference - (safePercentage / 100) * circumference
  const color = safePercentage >= 75 ? '#059669' : safePercentage >= 60 ? '#D97706' : '#DC2626'

  return (
    <svg
      role="img"
      aria-label={`${percentage}% attendance`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E4E7ED" strokeWidth="8" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={size / 5}
        fontWeight="800"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        {percentage}%
      </text>
    </svg>
  )
}
