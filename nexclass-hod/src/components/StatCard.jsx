export default function StatCard({
  icon,
  label,
  value,
  subtitle,
  subtitleColor = 'var(--muted)',
  iconBg,
}) {
  return (
    <article
      style={{
        minWidth: 0,
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 20,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 30,
          fontWeight: 800,
          color: 'var(--text)',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: subtitleColor, marginTop: 2 }}>
        {subtitle}
      </div>
    </article>
  )
}
