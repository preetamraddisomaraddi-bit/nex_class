import { useTheme } from '../context/ThemeContext.jsx'

const options = [
  { value: 'white', label: '☀️ White' },
  { value: 'light', label: '🌤️ Light' },
  { value: 'dark', label: '🌙 Dark' },
]

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Choose color theme"
      className={`theme-toggle no-drag inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 ${compact ? 'gap-0' : 'gap-1'}`}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={`whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
            theme === option.value
              ? 'bg-indigo-600 text-white'
              : 'bg-transparent text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--text)]'
          } ${compact ? 'px-1.5' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
