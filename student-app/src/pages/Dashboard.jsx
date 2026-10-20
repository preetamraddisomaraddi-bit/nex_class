import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoom, markAttendance } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { joinRoom as joinSocketRoom, startHeartbeat } from '../socket.js'

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
    <div className="min-h-screen bg-slate-50 text-slate-900 select-none">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 pl-8 pr-[140px] py-4 flex items-center justify-between drag-region">
        <div className="flex items-center gap-3 no-drag">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/10 text-white">🎓</div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">NexClass</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Student Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4 no-drag">
          <button onClick={() => navigate('/profile')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100/30">
            👤 View Profile
          </button>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900 leading-none">{student.name}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">USN: {student.usn || student.roll_no || '—'}</p>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-650 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
            Sign out
          </button>
        </div>
      </header>

      <main className="p-8 max-w-xl mx-auto mt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, {student.name?.split(' ')[0]} 👋</h2>
          <p className="text-slate-500 mt-1">Enter your room code below to join your active classroom session.</p>
        </div>

        {/* Join Room Form */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600"></div>
          <form onSubmit={joinRoom} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider text-center">6-Digit Room Code</label>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.slice(0,6))}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold tracking-widest text-indigo-650 focus:outline-none transition-all uppercase placeholder-slate-350"
                placeholder="ABCDEF"
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center bg-red-50 border border-red-100 py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading || !roomCode.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-755 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10">
              {loading ? 'Joining...' : 'Join Classroom 🚀'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
