import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registeredCode, setRegisteredCode] = useState('')

  const [form, setForm] = useState({
    // Step 1: University Details
    name: '',
    code: '',
    type: 'Engineering',
    established_year: '',
    address: '',
    phone: '',
    website: '',
    logo_url: '', // base64 string
    
    // Step 2: Admin details
    admin_name: '',
    admin_email: '',
    admin_password: '',
    admin_confirm_password: '',
    admin_staff_id: ''
  })

  // Heuristic abbreviation helper
  const suggestCode = (nameText) => {
    return nameText
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 10)
  }

  const handleNameChange = (e) => {
    const val = e.target.value
    setForm(prev => ({
      ...prev,
      name: val,
      code: suggestCode(val)
    }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, logo_url: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const validateStep1 = () => {
    if (!form.name.trim()) return 'University Name is required.'
    if (!form.code.trim()) return 'University Code abbreviation is required.'
    if (form.code.length > 10) return 'University Code must be 10 characters or less.'
    return null
  }

  const validateStep2 = () => {
    if (!form.admin_name.trim()) return 'Admin Full Name is required.'
    if (!form.admin_email.trim()) return 'Official Admin Email is required.'
    if (form.admin_password.length < 8) return 'Password must be at least 8 characters long.'
    if (form.admin_password !== form.admin_confirm_password) return 'Passwords do not match.'
    return null
  }

  const handleNext = () => {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) return setError(err)
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) return setError(err)
      setStep(3)
    }
  }

  const handlePrev = () => {
    setError('')
    setStep(prev => Math.max(1, prev - 1))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const serverUrl = import.meta.env.VITE_API_URL || window.location.origin

      const { data } = await axios.post(`${serverUrl}/api/universities/register`, {
        name: form.name,
        code: form.code,
        type: form.type,
        established_year: form.established_year ? parseInt(form.established_year) : null,
        address: form.address,
        phone: form.phone,
        website: form.website,
        logo_url: form.logo_url,
        admin_name: form.admin_name,
        admin_email: form.admin_email,
        admin_password: form.admin_password,
        admin_staff_id: form.admin_staff_id
      })

      if (data.success) {
        setRegisteredCode(data.university_code)
        setStep(4)
      } else {
        setError(data.message || 'Registration failed.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to registration servers.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between select-none">
      
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md text-white font-bold">🎓</button>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">NexClass</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">University Registration</p>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-grow py-12 px-6 flex items-center justify-center">
        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-lg w-full relative">
          
          {/* Top colored stripe */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600 rounded-t-2xl"></div>

          {/* Wizard Progress Indicator */}
          {step <= 3 && (
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs text-slate-450 font-bold uppercase tracking-wider mb-2">
                <span>Progress</span>
                <span>Step {step} of 3</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 text-red-500 border border-red-100 rounded-xl p-3 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* STEP 1: University Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">University Profile</h3>
              <p className="text-slate-400 text-xs mt-1">Configure your official institution metadata.</p>
              
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">University Name *</label>
                  <input value={form.name} onChange={handleNameChange} required
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                    placeholder="e.g. Visvesvaraya Technological University" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Short Code (Max 10) *</label>
                    <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0,10) }))} required
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors font-mono font-bold tracking-wider"
                      placeholder="e.g. VTU" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Institution Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors">
                      {['Engineering', 'Medical', 'Arts & Science', 'Polytechnic', 'Management', 'Other'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Established Year</label>
                    <input type="number" value={form.established_year} onChange={e => setForm(f => ({ ...f, established_year: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="e.g. 1998" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Official Website</label>
                    <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="e.g. https://vtu.ac.in" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone Number</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="e.g. +91 8312498100" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Logo Upload</label>
                    <input type="file" accept="image/*" onChange={handleLogoChange}
                      className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Campus Address</label>
                  <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors resize-none"
                    placeholder="e.g. Jnana Sangama, Belagavi, Karnataka, India" />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button onClick={handleNext}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10">
                  Next: Admin Account
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Admin Account */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Admin Account Credentials</h3>
              <p className="text-slate-400 text-xs mt-1">Configure your primary administrative user.</p>
              
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Admin Full Name *</label>
                  <input value={form.admin_name} onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} required
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                    placeholder="e.g. Dr. Karisiddappa" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Official Email *</label>
                    <input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="e.g. admin@vtu.ac.in" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Staff / Employee ID</label>
                    <input value={form.admin_staff_id} onChange={e => setForm(f => ({ ...f, admin_staff_id: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="e.g. VTU-ADM-001" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Password (Min 8) *</label>
                    <input type="password" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Confirm Password *</label>
                    <input type="password" value={form.admin_confirm_password} onChange={e => setForm(f => ({ ...f, admin_confirm_password: e.target.value }))} required
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                      placeholder="••••••••" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button onClick={handlePrev}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl transition-all border border-slate-200 font-semibold text-sm">
                  Back
                </button>
                <button onClick={handleNext}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 text-sm">
                  Next: Review Profile
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review Details */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Review Information</h3>
              <p className="text-slate-400 text-xs mt-1">Verify entered data prior to database submission.</p>
              
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-3">
                <div className="flex items-center gap-3 border-b border-slate-200/60 pb-3">
                  {form.logo_url ? (
                    <img src={form.logo_url} className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200" alt="logo" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white font-extrabold flex items-center justify-center text-sm">{form.code?.slice(0,2)}</div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{form.name}</p>
                    <p className="text-indigo-650 font-mono font-bold tracking-wide mt-0.5">{form.code} &middot; {form.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px] tracking-wide">Established</span>
                    <span className="text-slate-900 font-bold">{form.established_year || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px] tracking-wide">Website</span>
                    <span className="text-slate-900 font-bold truncate block">{form.website || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px] tracking-wide">Admin Staff Name</span>
                    <span className="text-slate-900 font-bold">{form.admin_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px] tracking-wide">Admin Staff Email</span>
                    <span className="text-slate-900 font-bold truncate block">{form.admin_email}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button onClick={handlePrev} disabled={loading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl transition-all border border-slate-200 font-semibold text-sm">
                  Back
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 text-sm">
                  {loading ? 'Registering...' : 'Confirm & Register 🎉'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success Screen */}
          {step === 4 && (
            <div className="text-center space-y-6 py-4">
              <span className="text-5xl block select-none">🎉</span>
              <h3 className="text-2xl font-bold text-slate-900">Registration Successful!</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">Your university has been successfully registered. Share this unique code to sign up teachers and students:</p>
              
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 inline-block font-mono text-3xl font-extrabold text-indigo-750 tracking-widest shadow-inner">
                {registeredCode}
              </div>

              <p className="text-xs text-red-500 font-semibold uppercase tracking-wider">⚠️ Write down this code! You will need it to login.</p>

              <div className="flex flex-col gap-2 pt-6 border-t border-slate-200">
                <a href="/register/admin-app.zip" download
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-indigo-600/10 text-sm flex items-center justify-center gap-1.5">
                  📥 Download Admin Desktop App
                </a>
                <button onClick={() => navigate('/')}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all border border-slate-200 text-sm">
                  Return to Home
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-medium">
        <p>&copy; {new Date().getFullYear()} NexClass SaaS Inc. All rights reserved.</p>
      </footer>
    </div>
  )
}
