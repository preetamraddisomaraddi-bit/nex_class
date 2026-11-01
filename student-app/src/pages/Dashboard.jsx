import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoom, markAttendance } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { joinRoom as joinSocketRoom, startHeartbeat } from '../socket.js'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const { student, logout: clearSession } = useAuth()
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function joinRoom(e) {
    e.preventDefault()
    if (roomCode.length !== 6) return setError('Room code must be exactly 6 characters')
    setLoading(true)
    setError('')
    try {
      const code = roomCode.toUpperCase()
      const { data } = await getRoom(code)
      const room = data.room || data
      if (room.status !== 'active') {
        setError('This session has already ended.')
        return
      }
      await markAttendance({ room_id: room.id, status: 'present' })
      joinSocketRoom(student, code)
      startHeartbeat(student, code, 'focused')
      navigate(`/classroom/${code}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Room not found or already ended')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] select-none">

      {/* Header */}
      <header className="bg-[var(--surface)] border-b border-[var(--border)] pl-8 pr-[140px] py-4 flex items-center justify-between drag-region">
        <div className="flex items-center gap-3 no-drag">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/10 text-white">🎓</div>
          <div>
            <h1 className="font-bold text-[var(--text)] leading-none">NexClass</h1>
            <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">Student Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4 no-drag">
          <ThemeToggle compact />
          <button onClick={() => navigate('/profile')} className="text-xs font-bold text-[var(--accent)] hover:text-[var(--accent)] transition-colors bg-[var(--accent-soft)] px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--accent-soft)]">
            👤 View Profile
          </button>
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--text)] leading-none">{student.name}</p>
            <p className="text-[10px] text-[var(--muted)] font-medium mt-1">USN: {student.usn || student.roll_no || '—'}</p>
          </div>
          <button onClick={logout} className="text-[var(--muted)] hover:text-[var(--red)] text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--red-soft)]">
            Sign out
          </button>
        </div>
      </header>

      <main className="p-8 max-w-xl mx-auto mt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[var(--text)]">Welcome back, {student.name?.split(' ')[0]} 👋</h2>
          <p className="text-[var(--muted)] mt-1">Enter your room code below to join your active classroom session.</p>
        </div>

        {/* Join Room Form */}
        <div className="bg-[var(--surface)] rounded-2xl p-8 border border-[var(--border)] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600"></div>
          <form onSubmit={joinRoom} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-[var(--muted)] mb-2 uppercase tracking-wider text-center">6-Digit Room Code</label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.slice(0,6))}
                className="w-full bg-[var(--card2)] border border-[var(--border2)] focus:bg-[var(--surface)] focus:border-indigo-500 rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold tracking-widest text-[var(--accent)] focus:outline-none transition-all uppercase placeholder-[var(--muted)]"
                placeholder="ABCDEF"
                autoFocus
              />
            </div>

            {error && <p className="text-[var(--red)] text-sm text-center bg-[var(--red-soft)] border border-[var(--border)] py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading || !roomCode.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10">
              {loading ? 'Joining...' : 'Join Classroom 🚀'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
