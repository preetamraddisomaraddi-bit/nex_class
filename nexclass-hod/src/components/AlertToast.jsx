import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export const ToastContext = createContext(null)
const types = {
  success: { color: 'var(--green)', icon: '✅' },
  error: { color: 'var(--red)', icon: '❌' },
  info: { color: 'var(--indigo)', icon: 'ℹ️' },
  warning: { color: 'var(--amber)', icon: '⚠️' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const timers = useRef(new Map())
  const dismissToast = useCallback(id => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])
  const showToast = useCallback((message, type = 'info') => {
    const id = ++nextId.current
    const safeType = Object.hasOwn(types, type) ? type : 'info'
    setToasts(current => [...current, { id, message, type: safeType }])
    timers.current.set(id, setTimeout(() => dismissToast(id), 3000))
    return id
  }, [dismissToast])
  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      activeTimers.forEach(clearTimeout)
      activeTimers.clear()
    }
  }, [])
  const value = useMemo(() => ({ showToast }), [showToast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @media (prefers-reduced-motion: reduce) { .nexclass-toast { animation: none !important; } }`}</style>
      <div aria-label="Notifications" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, width: 'min(320px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', fontFamily: 'Inter, sans-serif' }}>
        {toasts.map(toast => (
          <div key={toast.id} className="nexclass-toast" role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'} style={{ width: '100%', maxWidth: 320, background: 'var(--white)', border: '1px solid var(--border)', borderLeft: `4px solid ${types[toast.type].color}`, borderRadius: 'var(--radius)', padding: '12px 16px', boxShadow: 'var(--shadow-md)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, animation: 'slideIn 0.3s ease' }}>
            <span aria-hidden="true">{types[toast.type].icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{toast.message}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context.showToast
}
