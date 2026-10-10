import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAPI } from '../api.js'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [serverURL, setServerURL] = useState(localStorage.getItem('serverURL') || 'http://localhost:4000')
  const [form, setForm] = useState({ name: '', email: '', password: '', subject: '', university_code: '', employee_id: '', department_id: '' })
  const [depts, setDepts] = useState([])
  const [uniName, setUniName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'university_code') {
      checkUniversityCode(value)
    }
  }

  async function checkUniversityCode(codeVal) {
    if (!codeVal.trim()) {
      setDepts([])
      setUniName('')
      return
    }
    try {
      localStorage.setItem('serverURL', serverURL)
      const api = getAPI()
      const { data } = await api.get(`/universities/code/${codeVal}`)
      if (data.university) {
        setUniName(data.university.name)
        const deptRes = await api.get(`/departments/university/${data.university.id}`)
        setDepts(deptRes.data.departments || [])
      } else {
        setDepts([])
        setUniName('')
      }
    } catch (err) {
      setDepts([])
      setUniName('')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      localStorage.setItem('serverURL', serverURL)
      const api = getAPI()
      const endpoint = mode === 'login' ? '/auth/teacher/login' : '/auth/teacher/register'
      
      const payload = { ...form }
      if (mode === 'login') {
        delete payload.name
        delete payload.subject
        delete payload.university_code
        delete payload.employee_id
        delete payload.department_id
      }
      
      const { data } = await api.post(endpoint, payload)
      localStorage.setItem('teacher', JSON.stringify(data.user))
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Connection failed. Check server URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/25 text-white text-3xl font-bold">🎓</div>
          <h1 className="text-3xl font-bold text-white">NexClass</h1>
          <p className="text-slate-400 mt-1">Teacher Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-[#1e293b] rounded-2xl p-8 border border-slate-700/50 shadow-2xl">

          {/* Server URL */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Server URL</label>
            <input
              value={serverURL}
              onChange={e => setServerURL(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="http://localhost:4000"
            />
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg bg-[#0f172a] p-1 mb-6">
            {['login', 'register'].map(m => (
              <button type="button" key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all capitalize
                  ${mode === m ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                <input name="name" value={form.name} onChange={update} required
                  className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Dr. Ramesh Kumar" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input name="email" type="email" value={form.email} onChange={update} required
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="teacher@college.edu" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input name="password" type="password" value={form.password} onChange={update} required
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••" />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                  <input name="subject" value={form.subject} onChange={update}
                    className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Computer Science" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">University Code <span className="text-[10px] text-slate-500">(Optional)</span></label>
                  <input name="university_code" value={form.university_code} onChange={update}
                    className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                    placeholder="e.g. VTU-2026" />
                  {uniName && <p className="text-emerald-500 text-xs mt-1 font-semibold">Matched: {uniName}</p>}
                </div>
                {depts.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Department</label>
                    <select name="department_id" value={form.department_id} onChange={update} required
                      className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500">
                      <option value="">-- Choose Department --</option>
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Employee / Staff ID <span className="text-[10px] text-slate-500">(Optional)</span></label>
                  <input name="employee_id" value={form.employee_id} onChange={update}
                    className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. VTU-TCH-101" />
                </div>
              </>
            )}

            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}

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
