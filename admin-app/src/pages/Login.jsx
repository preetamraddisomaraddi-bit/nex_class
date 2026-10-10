import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Login() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('admin_server_url') || 'http://localhost:3000')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Persist server URL selection
    localStorage.setItem('admin_server_url', serverUrl)

    try {
      const { data } = await axios.post(`${serverUrl}/api/universities/login`, {
        code,
        admin_email: email,
        password
      })

      if (data.success && window.electronAPI) {
        await window.electronAPI.storeToken(data.token)
        await window.electronAPI.storeData('university', data.university)
        navigate('/dashboard')
      } else {
        setError('Verification failed.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not establish connection to the server.')
    } finally {
      setLoading(false)
    }
  }

  function openRegistration() {
    if (window.electronAPI) {
      const regUrl = `${serverUrl}/register`
      window.electronAPI.openExternal(regUrl)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex select-none text-slate-900">
      
      {/* Left panel: Indigo gradient branding */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-tr from-indigo-700 via-indigo-650 to-purple-800 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -mr-40 -mt-40"></div>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg shadow-inner">🎓</div>
          <div>
            <h2 className="font-extrabold text-white leading-none">NexClass Admin</h2>
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mt-0.5">Cloud System Management</p>
          </div>
        </div>

        <div className="max-w-md my-auto">
          <h3 className="text-3xl font-extrabold tracking-tight">University Administration Portal</h3>
          <p className="text-slate-200 text-sm mt-4 leading-relaxed font-medium">
            Manage your university's digital departments, review and approve academic staff, audit real-time class sessions, monitor students, and export institutional audits.
          </p>
          <ul className="mt-8 space-y-3.5 text-xs text-indigo-100 font-semibold">
            <li className="flex items-center gap-2.5">✦ Approve & manage teaching instructors</li>
            <li className="flex items-center gap-2.5">✦ Track student attendance logs & statistics</li>
            <li className="flex items-center gap-2.5">✦ Inspect real-time classroom activities</li>
            <li className="flex items-center gap-2.5">✦ Generate and download compliance CSV/PDF records</li>
          </ul>
        </div>

        <div className="text-xs text-white/40 font-medium">
          &copy; {new Date().getFullYear()} NexClass SaaS Inc. All rights reserved.
        </div>
      </div>

      {/* Right panel: Login form */}
      <div className="w-full md:w-1/2 bg-white flex flex-col justify-center px-12 md:px-20 py-8 relative">
        <div className="max-w-sm w-full mx-auto space-y-8">
          
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Admin Sign In</h3>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1.5">Sign in to manage your university</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Server Connection URL */}
            <div>
              <label className="block text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Host Server Endpoint</label>
              <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} required
                className="w-full bg-slate-50 border border-slate-250 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none transition-colors font-mono"
                placeholder="http://localhost:3000" />
            </div>

            {/* University Code */}
            <div>
              <label className="block text-[9px] font-bold text-slate-450 mb-1 uppercase tracking-wider">University Code *</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase().trim())} required
                className="w-full bg-slate-50 border border-slate-250 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors font-mono font-bold tracking-wider"
                placeholder="e.g. VTU-2026" />
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-[9px] font-bold text-slate-455 mb-1 uppercase tracking-wider">Admin Official Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors"
                placeholder="admin@vtu.ac.in" />
            </div>

            {/* Admin Password */}
            <div>
              <label className="block text-[9px] font-bold text-slate-455 mb-1 uppercase tracking-wider">Secret Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors"
                placeholder="••••••••" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-500 font-semibold leading-relaxed">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10 text-sm">
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          {/* Registration Trigger link */}
          <div className="text-center pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500">
            Not registered yet?{' '}
            <button onClick={openRegistration} className="text-indigo-650 hover:text-indigo-750 underline">
              Register your university
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
