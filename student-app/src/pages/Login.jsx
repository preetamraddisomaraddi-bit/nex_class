import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { discoverServer, loginStudent, registerStudent } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { login, serverUrl, setServerUrl } = useAuth()
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ name: '', usn: '', email: '', semester: '', password: '', confirmPassword: '' })
  const [signin, setSignin] = useState({ usn: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const updateForm = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const updateSignin = event => setSignin(current => ({ ...current, [event.target.name]: event.target.value }))

  async function handleRegister(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!form.usn.trim()) return setError('USN is required.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const url = serverUrl.trim().replace(/\/$/, '')
      await discoverServer(url)
      await registerStudent({
        name: form.name.trim(),
        usn: form.usn.trim().toUpperCase(),
        email: form.email.trim(),
        semester: Number(form.semester),
        password: form.password
      })
      setSuccess('Registration successful! You can now sign in.')
      setMode('signin')
      setSignin(current => ({ ...current, usn: form.usn.trim().toUpperCase() }))
      setForm(current => ({ ...current, password: '', confirmPassword: '' }))
    } catch (err) {
      setError(err.code === 'ERR_NETWORK' || !err.response
        ? `Cannot reach HOD server at ${serverUrl}. Make sure the HOD app is running.`
        : err.response?.data?.error || err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!signin.usn.trim() || !signin.password) return setError('USN and password are required.')
    setLoading(true)
    try {
      const url = serverUrl.trim().replace(/\/$/, '')
      await discoverServer(url)
      const { data } = await loginStudent({ usn: signin.usn.trim().toUpperCase(), password: signin.password })
      login(data.student, data.token, url)
      navigate('/dashboard')
    } catch (err) {
      setError(err.code === 'ERR_NETWORK' || !err.response
        ? `Cannot reach HOD server at ${serverUrl}. Make sure the HOD app is running.`
        : err.response?.data?.error || err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="h-screen overflow-y-auto bg-[#0f172a] select-none text-white">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center p-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/20 text-white text-3xl">👨‍🎓</div>
          <h1 className="text-3xl font-bold text-white">NexClass</h1>
          <p className="text-slate-400 mt-1">Student Portal</p>
        </div>
        <div className="bg-[#1e293b] rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">HOD Server URL</label>
            <input value={serverUrl} onChange={event => setServerUrl(event.target.value)} type="url" required
              className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="http://localhost:3000" />
            <p className="text-[10px] text-slate-500 mt-1">Use the HOD server address shown in the HOD app.</p>
          </div>
          <div className="flex rounded-lg bg-[#0f172a] p-1 mb-6">
            {[['signin', 'Sign In'], ['register', 'Register']].map(([key, label]) => (
              <button type="button" key={key} onClick={() => { setMode(key); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === key ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">USN</label>
                <input name="usn" value={signin.usn} onChange={updateSignin} required autoComplete="username"
                  className={fieldClass} placeholder="e.g. 1BI23MCA001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <input name="password" type="password" value={signin.password} onChange={updateSignin} required autoComplete="current-password"
                  className={fieldClass} placeholder="••••••••" />
              </div>
              {success && <p role="status" className="text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-4 py-2">{success}</p>}
              {error && <p role="alert" className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors mt-2 shadow-lg shadow-indigo-600/20">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <input name="name" value={form.name} onChange={updateForm} required className={fieldClass} placeholder="Student name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">USN</label>
                <input name="usn" value={form.usn} onChange={updateForm} required className={fieldClass} placeholder="e.g. 1BI23MCA001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email (optional)</label>
                <input name="email" type="email" value={form.email} onChange={updateForm} className={fieldClass} placeholder="student@college.edu" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Semester</label>
                <input name="semester" type="number" min="1" max="8" value={form.semester} onChange={updateForm} required className={fieldClass} placeholder="3" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <input name="password" type="password" value={form.password} onChange={updateForm} required minLength={8} autoComplete="new-password"
                  className={fieldClass} placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Confirm Password</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateForm} required minLength={8} autoComplete="new-password"
                  className={fieldClass} placeholder="Re-enter password" />
              </div>
              {success && <p role="status" className="text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-4 py-2">{success}</p>}
              {error && <p role="alert" className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors mt-2 shadow-lg shadow-indigo-600/20">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
