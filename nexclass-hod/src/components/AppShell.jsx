import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from './AlertToast'
import { useHOD } from '../context/HODContext'

const items = [
  { path: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { path: '/teachers', icon: '👨‍🏫', label: 'Teachers' },
  { path: '/students', icon: '👨‍🎓', label: 'Students' },
  { path: '/analytics', icon: '📊', label: 'Analytics' },
  { path: '/sessions', icon: '📋', label: 'Session Logs' },
  { path: '/alerts', icon: '🔔', label: 'Alerts' },
  { path: '/downloads', icon: '📥', label: 'Downloads' },
]
const headingFont = '"Plus Jakarta Sans", sans-serif'
const gradient = 'linear-gradient(135deg, var(--indigo), var(--blue))'

function Avatar({ size }) {
  return <div aria-label="Dr. Rajesh Kumar" style={{ width: size, height: size, borderRadius: '50%', background: gradient, color: 'var(--white)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>RK</div>
}

function NavigationItem({ item, badge = 0 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink to={item.path} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', paddingLeft: isActive ? 9 : 12, borderLeft: isActive ? '3px solid var(--indigo)' : 'none', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--indigo)' : hovered ? 'var(--text)' : 'var(--muted)', background: isActive ? 'var(--indigo-light)' : hovered ? 'var(--bg)' : 'transparent', cursor: 'pointer', marginBottom: 2, textDecoration: 'none' })}>
      <span aria-hidden="true" style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge > 0 && <span aria-label={`${badge} pending teachers`} style={{ background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{badge}</span>}
    </NavLink>
  )
}

export default function AppShell({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showToast = useToast()
  const { pendingCount } = useHOD()
  const [loggingOut, setLoggingOut] = useState(false)
  const [date, setDate] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  const title = items.find(item => pathname === item.path || pathname.startsWith(`${item.path}/`))?.label || 'Dashboard'
  const formattedDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  async function logout() {
    setLoggingOut(true)
    try {
      if (window.electronAPI) await window.electronAPI.clearToken()
      navigate('/login', { replace: true })
    } catch {
      showToast('Unable to log out. Please try again.', 'error')
    } finally {
      setLoggingOut(false)
    }
  }
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text)' }}>
      <aside style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 220, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 60 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 4, background: gradient }} />
            <span style={{ fontFamily: headingFont, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>NexClass<span style={{ color: 'var(--indigo)' }}> HOD</span></span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.3 }}>Computer Science &amp; Engineering</div>
          <span style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginTop: 4 }}>CSE</span>
        </div>
        <nav aria-label="Main navigation" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>Department</div>
          {items.map(item => <NavigationItem key={item.path} item={item} badge={item.path === '/teachers' ? pendingCount : 0} />)}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
          <Avatar size={34} />
          <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <div title="Dr. Rajesh Kumar" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dr. Rajesh Kumar</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Head of Department</div>
          </div>
          <button type="button" title="Logout" aria-label="Logout" disabled={loggingOut} onClick={logout} style={{ background: 'transparent', border: 'none', cursor: loggingOut ? 'wait' : 'pointer', fontSize: 16, color: 'var(--muted)', padding: 4 }}>→</button>
        </div>
      </aside>
      <header style={{ position: 'fixed', top: 0, left: 220, right: 0, height: 56, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 50 }}>
        <h1 style={{ fontFamily: headingFont, fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>CSE Dept.</span>
          <span aria-hidden="true" style={{ borderLeft: '1px solid var(--border)', height: 20 }} />
          <time dateTime={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`} style={{ fontSize: 12, color: 'var(--muted)' }}>{formattedDate}</time>
          <Avatar size={32} />
        </div>
      </header>
      <main style={{ position: 'relative', marginLeft: 220, marginTop: 56, height: 'calc(100vh - 56px)', minHeight: 'calc(100vh - 56px)', background: 'var(--bg)', padding: 28, overflowY: 'auto' }}>{children}</main>
    </div>
  )
}
