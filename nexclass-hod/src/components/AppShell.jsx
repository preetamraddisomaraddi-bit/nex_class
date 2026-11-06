import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from './AlertToast'
import { useHOD } from '../context/HODContext'
import { apiRequest } from '../api'
import { useServerStatus } from '../hooks/useServerStatus'
import { useLicense } from '../hooks/useLicense'

const items = [
  { path: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { path: '/teachers', icon: '👨‍🏫', label: 'Teachers' },
  { path: '/students', icon: '👨‍🎓', label: 'Students' },
  { path: '/analytics', icon: '📊', label: 'Analytics' },
  { path: '/sessions', icon: '📋', label: 'Session Logs' },
  { path: '/alerts', icon: '🔔', label: 'Alerts' },
  { path: '/license', icon: '🔑', label: 'License' },
  { path: '/downloads', icon: '📥', label: 'Downloads' },
]
const headingFont = '"Plus Jakarta Sans", sans-serif'
const gradient = 'linear-gradient(135deg, var(--indigo), var(--blue))'

function Avatar({ size, initials = 'H' }) {
  return <div aria-label="HOD profile" style={{ width: size, height: size, borderRadius: '50%', background: gradient, color: 'var(--white)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
}

function NavigationItem({ item, badge = 0 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink to={item.path} end title={item.label} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', paddingLeft: 9, borderLeft: isActive ? '3px solid var(--indigo)' : '3px solid transparent', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--indigo)' : hovered ? 'var(--text)' : 'var(--muted)', background: isActive ? 'var(--indigo-light)' : hovered ? 'var(--bg)' : 'transparent', cursor: 'pointer', marginBottom: 2, textDecoration: 'none' })}>
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
  const server = useServerStatus()
  const { license } = useLicense()
  const [loggingOut, setLoggingOut] = useState(false)
  const [hodProfile, setHodProfile] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('nexclass_hod_data') || '{}') } catch { return {} }
  })
  const [date, setDate] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const updateProfile = event => {
      if (!event.detail) return
      try { setHodProfile(JSON.parse(window.localStorage.getItem('nexclass_hod_data') || '{}')) } catch { setHodProfile({}) }
    }
    window.addEventListener('nexclass-auth-change', updateProfile)
    return () => window.removeEventListener('nexclass-auth-change', updateProfile)
  }, [])
  const title = items.find(item => pathname === item.path || pathname.startsWith(`${item.path}/`))?.label || 'Dashboard'
  const formattedDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  async function logout() {
    if (!window.confirm('Are you sure you want to logout?')) return
    setLoggingOut(true)
    try {
      await window.electronAPI?.clearToken?.()
      window.localStorage.removeItem('nexclass_token')
      window.dispatchEvent(new CustomEvent('nexclass-auth-change', { detail: false }))
      navigate('/login', { replace: true })
    } catch {
      showToast('Unable to log out. Please try again.', 'error')
    } finally {
      setLoggingOut(false)
    }
  }
  async function changePassword() {
    const currentPassword = window.prompt('Enter your current password')
    if (currentPassword === null) return
    const newPassword = window.prompt('Enter a new password (at least 8 characters, with a letter and number)')
    if (newPassword === null) return
    const confirmPassword = window.prompt('Confirm your new password')
    if (confirmPassword === null) return
    if (newPassword !== confirmPassword) return showToast('The new passwords do not match.', 'error')
    try {
      const result = await apiRequest('/auth/hod/change-password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } })
      await window.electronAPI?.storeToken?.(result.token)
      window.localStorage.setItem('nexclass_token', result.token)
      window.dispatchEvent(new CustomEvent('nexclass-auth-change', { detail: true }))
      showToast('Password changed successfully.', 'success')
    } catch (error) {
      showToast(error.message || 'Unable to change password.', 'error')
    }
  }
  async function copyServerAddress() {
    try { await navigator.clipboard.writeText(server.address); showToast('Server address copied', 'success') }
    catch { showToast('Unable to copy the server address.', 'error') }
  }
  const hodName = hodProfile.name || 'Head of Department'
  const hodInitials = String(hodName).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'H'
  const departmentName = hodProfile.department || 'Department'
  const licenseBanner = !license ? null
    : license.state === 'trial' ? { text: `Trial: ${license.daysLeft} days left`, color: 'var(--blue)', background: 'var(--blue-light)' }
      : license.state === 'licensed' && license.daysLeft <= 30 ? { text: `License expires in ${license.daysLeft} days`, color: 'var(--amber)', background: 'var(--amber-light)' }
        : license.state === 'grace' ? { text: `License expired. ${Math.max(0, Math.ceil((new Date(license.graceEndsAt) - date) / 86400000))} days of full access left`, color: 'var(--amber)', background: 'var(--amber-light)' }
          : ['expired', 'unlicensed', 'invalid'].includes(license.state) ? { text: 'License expired. NexClass is read-only. Activate a license to continue.', color: 'var(--red)', background: 'var(--red-light)' } : null
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--text)' }}>
      <aside style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 220, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 60 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 4, background: gradient }} />
            <span style={{ fontFamily: headingFont, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>NexClass<span style={{ color: 'var(--indigo)' }}> HOD</span></span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.3 }}>{departmentName}</div>
          <span style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginTop: 4 }}>{hodProfile.department_code || 'HOD'}</span>
        </div>
        <nav aria-label="Main navigation" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted2)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>Department</div>
          {items.slice(0, 5).map(item => <NavigationItem key={item.path} item={item} badge={item.path === '/teachers' ? pendingCount : 0} />)}
          <div aria-hidden="true" style={{ height: 1, background: 'var(--border)', margin: '8px 10px' }} />
          {items.slice(5).map(item => <NavigationItem key={item.path} item={item} badge={item.path === '/teachers' ? pendingCount : 0} />)}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Avatar size={34} initials={hodInitials} />
            <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
              <div title={hodName} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hodName}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Head of Department</div>
            </div>
            <button type="button" title="Logout" aria-label="Logout" disabled={loggingOut} onClick={logout} style={{ background: 'transparent', border: 'none', cursor: loggingOut ? 'wait' : 'pointer', fontSize: 16, color: 'var(--muted)', padding: 4 }}>→</button>
          </div>
          <button type="button" onClick={changePassword} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, padding: '8px 0 0 44px', color: 'var(--indigo)', fontSize: 11, cursor: 'pointer' }}>Change password</button>
          <div title={server.address} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, minWidth: 0 }}>
            <span aria-label={server.online ? 'Server online' : 'Server offline'} style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: server.online ? 'var(--green)' : 'var(--red)' }} />
            <span style={{ color: 'var(--muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{server.address}</span>
            <button type="button" onClick={copyServerAddress} title="Copy server address" aria-label="Copy server address" style={{ border: 0, background: 'transparent', color: 'var(--indigo)', fontSize: 10, padding: 2, cursor: 'pointer' }}>Copy</button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', textAlign: 'center', marginTop: 8 }}>v1.0.0</div>
        </div>
      </aside>
      <header style={{ position: 'fixed', top: 0, left: 220, right: 0, height: 56, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 50 }}>
        <h1 style={{ fontFamily: headingFont, fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>{hodProfile.department_code || 'HOD'} Dept.</span>
          <span aria-hidden="true" style={{ borderLeft: '1px solid var(--border)', height: 20 }} />
          <time dateTime={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`} style={{ fontSize: 12, color: 'var(--muted)' }}>{formattedDate}</time>
          <Avatar size={32} initials={hodInitials} />
        </div>
      </header>
      <main style={{ position: 'relative', marginLeft: 220, marginTop: 56, height: 'calc(100vh - 56px)', minHeight: 'calc(100vh - 56px)', background: 'var(--bg)', padding: 28, overflowY: 'auto' }}>
        {licenseBanner && <button type="button" onClick={() => navigate('/license')} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 18, padding: '9px 14px', border: '1px solid transparent', borderRadius: 8, background: licenseBanner.background, color: licenseBanner.color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{licenseBanner.text} · View license</button>}
        {children}
      </main>
    </div>
  )
}
