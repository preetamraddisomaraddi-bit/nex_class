const ALL_BADGES = [
  { key: 'Attendance Star', icon: '🌟', description: '≥75% overall attendance' },
  { key: 'Coding Champ', icon: '💻', description: '1+ code submission' },
  { key: 'Fast Learner', icon: '⚡', description: '3+ code submissions' },
  { key: 'Exam Ace', icon: '🏆', description: '≥80% on any exam' },
  { key: 'Perfect Score', icon: '⭐', description: '100% on any exam' },
  { key: 'Top Performer', icon: '🎯', description: 'Ranked #1 in semester' },
  { key: 'Consistent', icon: '🔥', description: '10+ classes attended' },
]

export { ALL_BADGES }

export default function BadgeGrid({ earnedBadges = [] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', margin: -4 }}>
      {ALL_BADGES.map(badge => {
        const isEarned = earnedBadges.includes(badge.key)
        return (
          <span
            key={badge.key}
            title={badge.description}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              margin: 4,
              cursor: 'default',
              background: isEarned ? 'var(--indigo-light)' : 'var(--bg)',
              color: isEarned ? 'var(--indigo)' : 'var(--muted2)',
              border: `1px solid ${isEarned ? 'var(--indigo-mid)' : 'var(--border)'}`,
            }}
          >
            {isEarned ? badge.icon : '🔒'} {badge.key}
          </span>
        )
      })}
    </div>
  )
}
