import { useEffect } from 'react'

const maxWidths = {
  sm: 400,
  md: 600,
  lg: 800,
  fullscreen: 960,
}

export default function Modal({ isOpen, onClose, title, size = 'md', children }) {
  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidth = maxWidths[size] || maxWidths.md

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .nexclass-modal-close:hover { background: var(--bg) !important; color: var(--text) !important; }
      `}</style>
      <div
        role="presentation"
        onClick={event => {
          if (event.target === event.currentTarget) onClose?.()
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{ background: 'var(--white)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease', overflow: 'hidden' }}
        >
          <header style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
            <button
              className="nexclass-modal-close"
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </header>
          <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>{children}</div>
        </section>
      </div>
    </>
  )
}
