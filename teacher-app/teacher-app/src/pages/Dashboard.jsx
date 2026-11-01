import ThemeToggle from '../components/ThemeToggle.jsx'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAPI } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const { teacher, logout } = useAuth()
  const [rooms, setRooms] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ subject: teacher.subject || '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadRooms() }, [])

  async function loadRooms() {
    try {
      const api = getAPI()
      const { data } = await api.get('/api/rooms')
      setRooms(Array.isArray(data) ? data : data.rooms || [])
    } catch {}
  }

  async function createRoom(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const api = getAPI()
      const { data } = await api.post('/api/rooms', {
        subject: form.subject,
        semester: Number(teacher.semester)
      })
      navigate(`/classroom/${data.code}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room')
    } finally { setLoading(false) }
  }

  function signOut() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">

      {/* Header */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] pl-8 pr-[140px] py-4 flex items-center justify-between drag-region">
        <div className="flex items-center gap-3 no-drag">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/10 text-white">🎓</div>
          <div>
            <h1 className="font-bold text-[var(--text)] leading-none">NexClass</h1>
            <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Teacher Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4 no-drag">
          <ThemeToggle />
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--text)] leading-none">{teacher.name}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{teacher.subject || 'Instructor'}</p>
          </div>
          <button onClick={signOut} className="text-[var(--muted)] hover:text-[var(--red)] text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--red-soft)]">
            Sign out
          </button>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">

        {/* Welcome + Start Class */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)]">Welcome back, {teacher.name?.split(' ')[0]} 👋</h2>
            <p className="text-[var(--muted)] mt-1">Start a new classroom session or review your history logs.</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20">
            <span className="text-lg">+</span> Start New Class
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Classes', value: rooms.length, icon: '📚', bg: 'bg-[var(--accent-soft)] border-[var(--border)] text-[var(--accent)]' },
            { label: 'Active Today', value: rooms.filter(r => r.status === 'active').length, icon: '🟢', bg: 'bg-[var(--green-soft)] border-[var(--border)] text-[var(--green)]' },
            { label: 'Subjects', value: [...new Set(rooms.map(r => r.subject))].length, icon: '🧠', bg: 'bg-[var(--amber-soft)] border-[var(--border)] text-[var(--amber)]' },
          ].map(s => (
            <div key={s.label} className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)] shadow-sm flex items-center justify-between">
              <div>
                <p className="text-3xl font-extrabold text-[var(--text)]">{s.value}</p>
                <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wider mt-1.5">{s.label}</p>
              </div>
              <span className={`text-2xl p-3.5 rounded-xl border ${s.bg}`}>{s.icon}</span>
            </div>
          ))}
        </div>

        {/* Room History */}
        <div>
          <h3 className="text-lg font-bold text-[var(--text)] mb-4 uppercase tracking-wider text-xs">Class History</h3>
          {rooms.length === 0 ? (
            <div className="bg-[var(--card)] rounded-2xl p-12 text-center border border-[var(--border)] border-dashed shadow-sm">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-[var(--muted)] font-medium">No sessions created yet. Launch your first class above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(room => (
                <div key={room.id} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] flex items-center justify-between hover:border-[var(--border)] hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-bold text-sm">
                      {room.subject?.slice(0,2).toUpperCase() || 'CS'}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text)] text-sm leading-snug">{room.subject} — {room.class_name || `Semester ${room.semester}`}</p>
                      <p className="text-[var(--muted)] text-xs mt-1">{room.topic || 'Session'} · {new Date(room.created_at || room.started_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
                      ${room.status === 'active'
                        ? 'bg-[var(--green-soft)] text-[var(--green)] border-[var(--border)]'
                        : 'bg-[var(--card2)] text-[var(--muted)] border-[var(--border)]'}`}>
                      {room.status}
                    </span>
                    <span className="font-mono text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--border)] px-3 py-1 rounded-lg text-sm font-bold">{room.code}</span>
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
        <div className="fixed inset-0 bg-[var(--bg)] backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] rounded-2xl p-8 w-full max-w-md border border-[var(--border)] shadow-2xl relative">
            <h3 className="text-xl font-bold text-[var(--text)] mb-6">Start New Class</h3>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase tracking-wider">Subject</label>
                <input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} required
                  className="w-full bg-[var(--bg)] border border-[var(--border)] focus:bg-[var(--card)] focus:border-[var(--accent)] rounded-lg px-4 py-2.5 text-sm text-[var(--text)] focus:outline-none transition-colors"
                  placeholder="Computer Science" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase tracking-wider">Assigned Semester</label>
                <input value={teacher.semester ? `Semester ${teacher.semester}` : 'No semester assigned'} readOnly
                  className="w-full bg-[var(--card2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--muted)] cursor-not-allowed" />
              </div>
              {error && <p className="text-[var(--red)] text-sm bg-[var(--red-soft)] border border-[var(--border)] rounded-lg py-2 px-3">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-[var(--card2)] hover:bg-[var(--card2)] text-[var(--muted)] py-3 rounded-xl transition-colors font-semibold border border-[var(--border)]">
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

