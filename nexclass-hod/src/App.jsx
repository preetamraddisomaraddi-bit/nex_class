import { useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import { ToastProvider } from './components/AlertToast'
import { HODProvider } from './context/HODContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'

const pages = [
  ['dashboard', 'Dashboard'],
  ['teachers', 'Teachers'],
  ['students', 'Students'],
  ['analytics', 'Analytics'],
  ['sessions', 'Session Logs'],
  ['alerts', 'Alerts'],
  ['downloads', 'Downloads'],
]

const PlaceholderPage = ({ name }) => (
  <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 40, textAlign: 'center', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
    <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: 12 }}>🚧</div>
    <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{name}</h2>
    <p style={{ color: 'var(--muted)', fontSize: 14 }}>This page is coming soon.</p>
  </div>
)

function AuthGate() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    async function checkToken() {
      let token = null
      try {
        token = await window.electronAPI?.getToken?.()
      } catch {
        token = null
      }
      if (!active) return

      if (token && pathname === '/login') navigate('/dashboard', { replace: true })
      else if (!token && pathname !== '/login') navigate('/login', { replace: true })
      setChecking(false)
    }
    checkToken()
    return () => { active = false }
    // Check persisted authentication once, when the router mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking) {
    return <div aria-label="Checking sign-in" style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppShell><Outlet /></AppShell>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {pages.map(([path, name]) => (
          <Route
            key={path}
            path={path}
            element={path === 'dashboard' ? <Dashboard /> : <PlaceholderPage name={name} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

// Packaged Electron loads file:// URLs; hash routing keeps those routes local.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <HODProvider>
      <Router>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </Router>
    </HODProvider>
  )
}
