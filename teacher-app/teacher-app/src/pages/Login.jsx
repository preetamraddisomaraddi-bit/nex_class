import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { discoverServer, loginTeacher, registerTeacher } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { login, serverUrl, setServerUrl } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '', employee_id: '', email: '', subject: '', semester: '', password: '', confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const update = event => {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const url = serverUrl.trim().replace(/\/$/, '')
    if (!url) {
      setError('Enter the HOD server URL.')
      return
    }

    setLoading(true)
    localStorage.setItem('nexclass_server_url', url)
    setServerUrl(url)
    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match.')
          return
        }
        await discoverServer(url)
        await registerTeacher({
          name: form.name.trim(),
          employee_id: form.employee_id.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          semester: Number(form.semester),
          password: form.password
        })
        setSuccess('Registration successful! Waiting for HOD approval. You will be notified when approved.')
        setMode('login')
        setForm(current => ({ ...current, password: '', confirmPassword: '' }))
        return
      }

      await discoverServer(url)
      const { data } = await loginTeacher({
        employee_id: form.employee_id.trim(),
        password: form.password
      })
      login(data.teacher, data.token, url)
      navigate('/dashboard')
    } catch (err) {
      const serverError = err.response?.data?.error
      if (err.code === 'INVALID_HOD_SERVER') {
        setError(err.message)
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || !err.response) {
        setError(`Cannot reach HOD server at ${url}. Make sure the HOD app is running and the address is correct.`)
      } else {
        setError(serverError || 'Request failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/25 text-white text-3xl font-bold">🎓</div>
          <h1 className="text-3xl font-bold text-white">NexClass</h1>
          <p className="text-slate-400 mt-1">Teacher Dashboard</p>
        </div>

        <div className="bg-[#1e293b] rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">HOD Server URL</label>
            <input
              value={serverUrl}
              onChange={event => setServerUrl(event.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="http://192.168.x.x:3000"
              type="url"
              required
            />
          </div>

          <div className="flex rounded-lg bg-[#0f172a] p-1 mb-6">
            {['login', 'register'].map(tab => (
              <button type="button" key={tab} onClick={() => { setMode(tab); setError(''); setSuccess('') }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === tab ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                {tab === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <input name="name" value={form.name} onChange={update} required className={fieldClass} placeholder="Dr. Ramesh Kumar" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Employee ID</label>
                <input name="employee_id" value={form.employee_id} onChange={update} required className={fieldClass} placeholder="BIT-T-006" />
              </div>
            </>}

            {mode === 'login' && <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Employee ID</label>
              <input name="employee_id" value={form.employee_id} onChange={update} required className={fieldClass} placeholder="BIT-T-006" autoComplete="username" />
            </div>}

            {mode === 'register' && <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                <input name="email" type="email" value={form.email} onChange={update} required className={fieldClass} placeholder="teacher@college.edu" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                <input name="subject" value={form.subject} onChange={update} required className={fieldClass} placeholder="Computer Science" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Semester</label>
                <input name="semester" type="number" min="1" max="8" value={form.semester} onChange={update} required className={fieldClass} placeholder="3" />
              </div>
            </>}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input name="password" type="password" value={form.password} onChange={update} required minLength={8} className={fieldClass} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            {mode === 'register' && <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Confirm Password</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} required minLength={8} className={fieldClass} placeholder="Re-enter your password" autoComplete="new-password" />
            </div>}

            {error && <p role="alert" className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}
            {success && <p role="status" className="text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-4 py-2">{success}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors mt-2">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
