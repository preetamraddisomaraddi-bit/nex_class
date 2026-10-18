export default function CSSBarChart({
  data = [],
  type = 'horizontal',
  height = 160,
  showValues = true,
  showLabels = true,
}) {
  if (type === 'horizontal') {
    return (
      <div style={{ width: '100%' }}>
        {data.map((item, index) => {
          const max = item.max || 100
          const width = Math.max(0, Math.min(100, (item.value / max) * 100))
          return (
            <div key={`${item.label}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, minWidth: 0 }}>
              <span title={item.label} style={{ minWidth: 120, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
              <div role="img" aria-label={`${item.label}: ${item.value}`} style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${width}%`, background: item.color, borderRadius: 5, transition: 'width 0.6s ease' }} />
              </div>
              {showValues && <span style={{ minWidth: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: item.color, fontFamily: '"JetBrains Mono", monospace' }}>{item.value}</span>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, borderBottom: '2px solid var(--border)', paddingBottom: 0, minWidth: Math.max(280, data.length * 48) }}>
      {data.map((item, index) => {
        const max = item.max || 100
        const barHeight = Math.max(4, Math.min(height, (item.value / max) * height))
        return (
          <div key={`${item.label}-${index}`} style={{ flex: 1, minWidth: 32, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
            {showValues && <span style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: item.color, fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap' }}>{item.value}</span>}
            <div
              title={`${item.label}: ${item.value}`}
              role="img"
              aria-label={`${item.label}: ${item.value}`}
              style={{ width: '100%', height: barHeight, minHeight: 4, background: item.color, borderRadius: '4px 4px 0 0', transition: 'height 0.6s ease' }}
            />
            {showLabels && <span style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{item.label}</span>}
          </div>
        )
      })}
    </div>
  )
}
