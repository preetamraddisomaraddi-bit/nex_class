import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAPI } from '../api.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const teacher = JSON.parse(localStorage.getItem('teacher') || '{}')
  const [rooms, setRooms] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ subject: teacher.subject || '', class_name: '', topic: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadRooms() }, [])

  async function loadRooms() {
    try {
      const api = getAPI()
      const { data } = await api.get(`/rooms/teacher/${teacher.id}`)
      setRooms(data.rooms || [])
    } catch {}
  }

  async function createRoom(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const api = getAPI()
      const { data } = await api.post('/rooms/create', { teacher_id: teacher.id, ...form })
      navigate(`/classroom/${data.room.code}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room')
    } finally { setLoading(false) }
  }

  function logout() {
    localStorage.removeItem('teacher')
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 pl-8 pr-[140px] py-4 flex items-center justify-between drag-region">
        <div className="flex items-center gap-3 no-drag">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/10 text-white">🎓</div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">NexClass</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Teacher Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4 no-drag">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900 leading-none">{teacher.name}</p>
            <p className="text-xs text-slate-500 mt-1">{teacher.subject || 'Instructor'}</p>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-600 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
            Sign out
          </button>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">

        {/* Welcome + Start Class */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome back, {teacher.name?.split(' ')[0]} 👋</h2>
            <p className="text-slate-500 mt-1">Start a new classroom session or review your history logs.</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20">
            <span className="text-lg">+</span> Start New Class
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Classes', value: rooms.length, icon: '📚', bg: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
            { label: 'Active Today', value: rooms.filter(r => r.status === 'active').length, icon: '🟢', bg: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
            { label: 'Subjects', value: [...new Set(rooms.map(r => r.subject))].length, icon: '🧠', bg: 'bg-amber-50 border-amber-100 text-amber-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-3xl font-extrabold text-slate-900">{s.value}</p>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1.5">{s.label}</p>
              </div>
              <span className={`text-2xl p-3.5 rounded-xl border ${s.bg}`}>{s.icon}</span>
            </div>
          ))}
        </div>

        {/* Room History */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider text-xs">Class History</h3>
          {rooms.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 border-dashed shadow-sm">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-slate-500 font-medium">No sessions created yet. Launch your first class above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(room => (
                <div key={room.id} className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between hover:border-slate-350 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 font-bold text-sm">
                      {room.subject?.slice(0,2).toUpperCase() || 'CS'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-snug">{room.subject} — {room.class_name}</p>
                      <p className="text-slate-500 text-xs mt-1">{room.topic || 'No topic set'} · {new Date(room.started_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
                      ${room.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {room.status}
                    </span>
                    <span className="font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg text-sm font-bold">{room.code}</span>
                    {room.status === 'active' && (
                      <button onClick={() => navigate(`/classroom/${room.code}`)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors shadow-md shadow-indigo-600/10">
                        Rejoin
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md border border-slate-200 shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Start New Class</h3>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Subject</label>
                <input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors"
                  placeholder="Computer Science" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Class / Section</label>
                <input value={form.class_name} onChange={e => setForm(f => ({...f, class_name: e.target.value}))} required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors"
                  placeholder="CSE 3A" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Today's Topic</label>
                <input value={form.topic} onChange={e => setForm(f => ({...f, topic: e.target.value}))}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors"
                  placeholder="Introduction to Arrays" />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg py-2 px-3">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl transition-colors font-semibold border border-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/10">
                  {loading ? 'Creating...' : 'Start Class 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
