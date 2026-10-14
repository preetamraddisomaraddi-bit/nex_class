import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import AppShell from './components/AppShell'
import { ToastProvider } from './components/AlertToast'

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

// Packaged Electron loads file:// URLs; hash routing keeps those routes local.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 28 }}><PlaceholderPage name="Login" /></div>} />
          {/* Authentication is intentionally deferred until the Step 4 login page. */}
          <Route element={<AppShell><Outlet /></AppShell>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            {pages.map(([path, name]) => <Route key={path} path={path} element={<PlaceholderPage name={name} />} />)}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </Router>
  )
}
