import { useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
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
  'dashboard',
  'teachers',
  'students',
  'analytics',
  'sessions',
  'alerts',
  'downloads',
]

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
      let browserToken = null
      try {
        browserToken = window.localStorage.getItem('nexclass_token')
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }
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
        {pages.map(path => {
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
