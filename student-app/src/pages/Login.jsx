import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAPI } from '../api.js'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [serverURL, setServerURL] = useState(localStorage.getItem('serverURL') || 'http://localhost:4000')
  const [form, setForm] = useState({ name: '', email: '', password: '', roll_no: '', class_section: '', university_code: '', usn: '', department_id: '', semester_id: '' })
  const [depts, setDepts] = useState([])
  const [sems, setSems] = useState([])
  const [uniName, setUniName] = useState('')
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'university_code') {
      checkUniversityCode(value)
    } else if (name === 'department_id') {
      checkDepartmentSemesters(value)
    }
  }

  async function checkUniversityCode(codeVal) {
    if (!codeVal.trim()) {
      setDepts([])
      setSems([])
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
        setSems([])
        setUniName('')
      }
    } catch (err) {
      setDepts([])
      setSems([])
      setUniName('')
    }
  }

  async function checkDepartmentSemesters(deptId) {
    if (!deptId) {
      setSems([])
      return
    }
    try {
      const api = getAPI()
      const { data } = await api.get(`/semesters/department/${deptId}`)
      setSems(data.semesters || [])
    } catch (err) {
      setSems([])
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      localStorage.setItem('serverURL', serverURL)
      const api = getAPI()
      const endpoint = mode === 'login' ? '/auth/student/login' : '/auth/student/register'
      
      let payload = {}
      if (mode === 'login') {
        if (loginIdentifier.includes('@')) {
          payload.email = loginIdentifier
        } else {
          payload.usn = loginIdentifier
        }
        payload.password = form.password
      } else {
        payload = { ...form }
      }

      const { data } = await api.post(endpoint, payload)
      localStorage.setItem('student', JSON.stringify(data.user))
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Connection failed. Check server URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 select-none text-white">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/20 text-white text-3xl">👨‍🎓</div>
          <h1 className="text-3xl font-bold text-white">NexClass</h1>
          <p className="text-slate-400 mt-1">Student Portal</p>
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

          <form onSubmit={submit} className="space-y-4 text-slate-900">
            {mode === 'login' ? (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email or USN / University Number</label>
                <input value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)} required
                  className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="student@college.edu or USN" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Full Name</label>
                  <input name="name" value={form.name} onChange={update} required
                    className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Rahul Sharma" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Roll Number</label>
                    <input name="roll_no" value={form.roll_no} onChange={update} required
                      className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder="20BCE012" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Class / Section</label>
                    <input name="class_section" value={form.class_section} onChange={update} required
                      className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder="CSE 3A" />
                  </div>
                </div>
              </>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Email Address *</label>
                <input name="email" type="email" value={form.email} onChange={update} required
                  className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="student@college.edu" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Password *</label>
              <input name="password" type="password" value={form.password} onChange={update} required
                className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                placeholder="••••••••" />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">University Code <span className="text-[10px] text-slate-500">(Optional)</span></label>
                  <input name="university_code" value={form.university_code} onChange={update}
                    className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                    placeholder="e.g. VTU-2026" />
                  {uniName && <p className="text-emerald-500 text-xs mt-1 font-semibold">Matched: {uniName}</p>}
                </div>
                {depts.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Department</label>
                    <select name="department_id" value={form.department_id} onChange={update} required
                      className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-350 focus:outline-none focus:border-indigo-500">
                      <option value="">-- Choose Department --</option>
                      {depts.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                )}
                {sems.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">Semester</label>
                    <select name="semester_id" value={form.semester_id} onChange={update} required
                      className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-355 focus:outline-none focus:border-indigo-500">
                      <option value="">-- Choose Semester --</option>
                      {sems.map(s => (
                        <option key={s.id} value={s.id}>Semester {s.number} (AY: {s.academic_year || 'N/A'})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 text-slate-400">USN / University Number <span className="text-[10px] text-slate-500">(Optional)</span></label>
                  <input name="usn" value={form.usn} onChange={update}
                    className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. 1VT24CS001" />
                </div>
              </>
            )}

            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2 border border-red-500/20">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors mt-2 shadow-lg shadow-indigo-600/20">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
