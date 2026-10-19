import { useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import { ToastProvider } from './components/AlertToast'
import { HODProvider } from './context/HODContext'
import Dashboard from './pages/Dashboard'
import Teachers from './pages/Teachers'
import Students from './pages/Students'
import Analytics from './pages/Analytics'
import SessionLogs from './pages/SessionLogs'
import Alerts from './pages/Alerts'
import Downloads from './pages/Downloads'
import Login from './pages/Login'
import LoadingScreen from './components/LoadingScreen'

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

const pageComponents = {
  dashboard: Dashboard,
  teachers: Teachers,
  students: Students,
  analytics: Analytics,
  sessions: SessionLogs,
  alerts: Alerts,
  downloads: Downloads,
}

function ProtectedRoute({ isAuthenticated, children }) {
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AuthGate() {
  const location = useLocation()
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    let active = true
    const updateAuthentication = event => setIsAuthenticated(Boolean(event.detail))
    window.addEventListener('nexclass-auth-change', updateAuthentication)

    const checkAuth = async () => {
      let electronToken = null
      try {
        electronToken = await window.electronAPI?.getToken?.()
      } catch {
        // Browser storage remains available if Electron storage fails.
      }
      const browserToken = window.localStorage.getItem('nexclass_token')
      if (!active) return
      setIsAuthenticated(Boolean(electronToken || browserToken))
      await new Promise(resolve => window.setTimeout(resolve, 800))
      if (active) setAuthChecked(true)
    }

    checkAuth()
    return () => {
      active = false
      window.removeEventListener('nexclass-auth-change', updateAuthentication)
    }
  }, [])

  if (!authChecked) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route element={<ProtectedRoute isAuthenticated={isAuthenticated}><AppShell><Outlet /></AppShell></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {pages.map(([path]) => {
          const Page = pageComponents[path]
          return (
            <Route key={path} path={path} element={
              <div key={location.pathname} className="page-enter">
                <Page />
              </div>
            } />
          )
        })}
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
