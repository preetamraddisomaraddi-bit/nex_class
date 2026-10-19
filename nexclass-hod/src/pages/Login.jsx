import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const features = [
  'Approve & manage department teachers',
  'Monitor student attendance & performance',
  'View all session logs & analytics',
  'Send alerts to teaching staff',
  'Download department reports',
]

const headingFont = '"Plus Jakarta Sans", sans-serif'

export default function Login() {
  const navigate = useNavigate()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  function triggerShake() {
    setShakeKey(key => key + 1)
    setShake(true)
    window.setTimeout(() => setShake(false), 500)
  }

  async function handleLogin(event) {
    event?.preventDefault()
    if (loading) return

    if (!employeeId.trim() || !password.trim()) {
      setError('Please fill in all fields')
      triggerShake()
      return
    }

    setLoading(true)
    setError('')
    await new Promise(resolve => window.setTimeout(resolve, 800))

    if (employeeId.trim() === 'BIT-HOD-001' && password === 'hod123') {
      try {
        const token = 'nexclass-hod-token'
        await window.electronAPI?.storeToken?.(token)
        window.localStorage.setItem('nexclass_token', token)
        window.dispatchEvent(new CustomEvent('nexclass-auth-change', { detail: true }))
        navigate('/dashboard', { replace: true })
      } catch {
        setError('Unable to sign in right now. Please try again.')
        triggerShake()
        setLoading(false)
      }
      return
    }

    setError('Invalid Employee ID or Password')
    setPassword('')
    triggerShake()
    setLoading(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') handleLogin(event)
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--white)',
    border: '1.5px solid var(--border2)',
    borderRadius: 8,
    padding: '11px 14px',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 7,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif', color: 'var(--text)' }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        .login-shaking { animation: loginShake 0.4s ease !important; }
        .login-input:focus {
          border-color: var(--indigo) !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
        }
        .login-submit:hover:not(:disabled) { opacity: 0.92; }
        .login-submit:active:not(:disabled) { transform: scale(0.98); }
        .login-submit:disabled { opacity: 0.7; cursor: wait; }
        @media (max-width: 760px) {
          .login-brand-panel { display: none !important; }
          .login-form-panel { width: 100% !important; padding: 36px 20px !important; }
          .login-card { padding: 0 !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-animated { animation: none !important; }
        }
      `}</style>

      <section className="login-brand-panel" style={{ width: '42%', minHeight: '100vh', flexShrink: 0, background: 'linear-gradient(145deg, #4F46E5 0%, #2563EB 100%)', color: 'var(--white)', padding: '52px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎓</span>
            <span style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 800, color: 'var(--white)', letterSpacing: '-0.5px' }}>NexClass<span style={{ color: 'rgba(255,255,255,0.6)' }}> HOD</span></span>
          </div>

          <h1 style={{ fontFamily: headingFont, fontSize: 28, fontWeight: 800, lineHeight: 1.2, color: 'var(--white)', marginTop: 52 }}>Monitor your department with confidence.</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginTop: 16 }}>Real-time insights on teachers, students, attendance and performance — all in one place.</p>

          <ul style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 40, padding: 0, listStyle: 'none' }}>
            {features.map(feature => (
              <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>✦</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>NexClass HOD Portal v1.0.0</div>
      </section>

      <main className="login-form-panel" style={{ width: '58%', minHeight: '100vh', background: 'var(--bg)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
        <div className="login-card login-animated" style={{ width: '100%', maxWidth: 400, padding: '0 48px', animation: 'fadeInUp 0.4s ease forwards' }}>
          <div style={{ fontFamily: headingFont, fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>Welcome back 👋</div>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, marginBottom: 36 }}>Sign in to your HOD account</p>

          <form key={shakeKey} className={shake ? 'login-shaking' : undefined} onSubmit={handleLogin} onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label htmlFor="employee-id" style={labelStyle}>Employee ID</label>
              <input id="employee-id" className="login-input" name="employeeId" type="text" autoComplete="username" placeholder="Enter your employee ID" value={employeeId} onChange={event => { setEmployeeId(event.target.value); setError('') }} style={inputStyle} />
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input id="password" className="login-input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={event => { setPassword(event.target.value); setError('') }} style={{ ...inputStyle, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted)', padding: 4 }}>{showPassword ? '🙈' : '👁'}</button>
              </div>
            </div>

            {error && <div role="alert" className="login-animated" style={{ background: 'var(--red-light)', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.3s ease' }}><span aria-hidden="true">❌</span>{error}</div>}

            <button type="submit" className="login-submit" disabled={loading} style={{ width: '100%', background: 'var(--indigo)', color: 'var(--white)', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: loading ? 'wait' : 'pointer', marginTop: 4, transition: 'opacity 0.15s, transform 0.1s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 9 }}>
              {loading && <span aria-hidden="true" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.45)', borderTopColor: 'var(--white)', borderRadius: '50%', animation: 'loginSpin 0.75s linear infinite' }} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--muted2)', whiteSpace: 'nowrap' }}>Department of MCA</span>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted2)', textAlign: 'center', marginTop: 20 }}>Bangalore Institute of Technology</p>
        </div>
      </main>
    </div>
  )
}
