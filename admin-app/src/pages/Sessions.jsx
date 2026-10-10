import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [depts, setDepts] = useState([])
  const [sems, setSems] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [deptId, setDeptId] = useState('')
  const [semId, setSemId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('all') // 'all', 'active', 'completed'

  // Modal Details
  const [showDetail, setShowDetail] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionAtt, setSessionAtt] = useState([])
  const [sessionNotes, setSessionNotes] = useState([])
  const [sessionExams, setSessionExams] = useState([])
  const [sessionCodes, setSessionCodes] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    loadFilterMetadata()
  }, [])

  useEffect(() => {
    if (deptId) {
      loadSemesters(deptId)
    } else {
      setSems([])
      setSemId('')
    }
  }, [deptId])

  async function loadFilterMetadata() {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const [deptRes, teachRes, sessRes] = await Promise.all([
            api.get(`/departments/university/${uni.id}`),
            api.get(`/universities/${uni.id}/teachers?status=approved`),
            api.get(`/universities/${uni.id}/sessions`)
          ])

          setDepts(deptRes.data.departments || [])
          setTeachers(teachRes.data.teachers || [])
          setSessions(sessRes.data.sessions || [])
        }
      }
    } catch (e) {
      console.error('Failed to load filter metadata:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadSemesters(dId) {
    try {
      const { data } = await api.get(`/semesters/department/${dId}`)
      setSems(data.semesters || [])
      setSemId('')
    } catch (e) {
      console.error('Failed to load semesters:', e)
    }
  }

  async function handleFilter(e) {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const { data } = await api.get(
            `/universities/${uni.id}/sessions?dept_id=${deptId}&sem_id=${semId}&teacher_id=${teacherId}&from=${from}&to=${to}&status=${status}`
          )
          setSessions(data.sessions || [])
        }
      }
    } catch (err) {
      console.error('Filter request failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function openDetails(session) {
    setSelectedSession(session)
    setSessionAtt([])
    setSessionNotes([])
    setSessionExams([])
    setSessionCodes([])
    setDetailLoading(true)
    setShowDetail(true)

    try {
      const [attRes, noteRes, examRes, codeRes] = await Promise.all([
        api.get(`/attendance/room/${session.id}`),
        api.get(`/notes/room/${session.id}`),
        api.get(`/exam/room/${session.id}`),
        api.get(`/code/room/${session.id}`)
      ])

      setSessionAtt(attRes.data.records || [])
      setSessionNotes(noteRes.data.notes || [])
      setSessionExams(examRes.data.exams || [])
      setSessionCodes(codeRes.data.submissions || [])
    } catch (e) {
      console.error('Failed to load session details:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  const getDuration = (start, end) => {
    if (!end) return 'Ongoing'
    const diff = new Date(end) - new Date(start)
    const mins = Math.round(diff / 1000 / 60)
    return `${mins} Mins`
  }

  return (
    <div className="space-y-6 select-none">
      
      {/* Page Header */}
      <div>
        <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Classroom Session Logs</h3>
        <p className="text-xs text-slate-500 mt-1">Audit ongoing and ended classroom sessions across all departments.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <form onSubmit={handleFilter} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-4 items-end">
          <div>
            <label className="block text-[9px] font-bold text-slate-450 mb-1.5 uppercase tracking-wider">Date From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-455 mb-1.5 uppercase tracking-wider">Date To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-455 mb-1.5 uppercase tracking-wider">Department</label>
            <select value={deptId} onChange={e => setDeptId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors font-medium">
              <option value="">All Depts</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-455 mb-1.5 uppercase tracking-wider">Semester</label>
            <select value={semId} onChange={e => setSemId(e.target.value)} disabled={!deptId}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors disabled:opacity-50 font-medium">
              <option value="">All Sems</option>
              {sems.map(s => (
                <option key={s.id} value={s.id}>Sem {s.number}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-455 mb-1.5 uppercase tracking-wider">Instructor</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors font-medium">
              <option value="">All Teachers</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-455 mb-1.5 uppercase tracking-wider">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors font-medium">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
            </select>
          </div>

          <button type="submit"
            className="w-full bg-[#4F46E5] hover:bg-indigo-755 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10">
            Apply Filters
          </button>
        </form>
      </div>

      {/* Sessions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-semibold animate-pulse text-xs">Querying session history...</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-250 bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-6">Code</th>
                <th className="py-3.5 px-6">Subject / Topic</th>
                <th className="py-3.5 px-6">Teacher</th>
                <th className="py-3.5 px-6">Dept / Sem</th>
                <th className="py-3.5 px-6">Date Conducted</th>
                <th className="py-3.5 px-6">Duration</th>
                <th className="py-3.5 px-6 text-center">Students</th>
                <th className="py-3.5 px-6 text-center">Notes</th>
                <th className="py-3.5 px-6 text-center">Exams</th>
                <th className="py-3.5 px-6 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map(session => (
                <tr key={session.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-mono font-bold text-[#4F46E5]">{session.code}</td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-900">{session.subject}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">{session.topic || 'No topic set'}</p>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-700">{session.teacher_name}</td>
                  <td className="py-4 px-6 font-semibold text-slate-500">
                    {session.dept_name || 'N/A'} &middot; <span className="font-bold">Sem {session.semester_number || 'N/A'}</span>
                  </td>
                  <td className="py-4 px-6 text-slate-400 font-medium">{new Date(session.created_at).toLocaleDateString()}</td>
                  <td className="py-4 px-6 text-slate-400 font-bold">{getDuration(session.created_at, session.ended_at)}</td>
                  <td className="py-4 px-6 text-center font-extrabold text-slate-800">{session.student_count}</td>
                  <td className="py-4 px-6 text-center font-semibold text-slate-500">{session.notes_count}</td>
                  <td className="py-4 px-6 text-center font-semibold text-slate-500">{session.exams_count}</td>
                  <td className="py-4 px-6 text-center font-bold">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${
                      session.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button onClick={() => openDetails(session)} className="text-[#4F46E5] hover:text-indigo-850 font-bold hover:underline">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400 font-medium">No sessions conducted matching the filter keys.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Session Details Modal */}
      {showDetail && selectedSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl border border-slate-200 shadow-2xl relative max-h-[90vh] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>

            {/* Session Header details */}
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Room Details: <span className="font-mono text-[#4F46E5]">{selectedSession.code}</span></h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedSession.subject} &middot; Topic: {selectedSession.topic || 'No topic'} &middot; Instructor: {selectedSession.teacher_name}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                selectedSession.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {selectedSession.status}
              </span>
            </div>

            {/* Scrollable details panels */}
            <div className="flex-grow overflow-y-auto space-y-6 pr-2 mb-6">
              {detailLoading ? (
                <div className="text-center py-16 text-slate-400 font-bold animate-pulse text-xs">Querying session attendance sheets & exams...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column: Attendance */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Attendance Roll</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white">
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                            <th className="py-2 px-3">Roll / USN</th>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sessionAtt.map(att => (
                            <tr key={att.student_id}>
                              <td className="py-2 px-3 font-mono text-slate-500">{att.roll_no}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">{att.name}</td>
                              <td className="py-2 px-3 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                  att.status === 'present' 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                    : att.status === 'late' 
                                      ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                      : 'bg-red-50 text-red-650 border-red-100'
                                }`}>
                                  {att.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {sessionAtt.length === 0 && (
                            <tr>
                              <td colSpan={3} className="text-center py-6 text-slate-400 font-medium">No students attended.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Exams and Notes Summary */}
                  <div className="space-y-6">
                    {/* Exams */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exams Administered</h4>
                      <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-3.5">
                        {sessionExams.map(ex => (
                          <div key={ex.id} className="flex justify-between items-center bg-slate-50 border border-slate-200/50 rounded-xl p-3">
                            <div>
                              <p className="font-bold text-slate-900 leading-none">{ex.title}</p>
                              <p className="text-slate-400 text-[10px] mt-1">Duration: {ex.duration_mins} mins</p>
                            </div>
                            <span className="bg-[#4F46E5] text-white font-extrabold font-mono text-[10px] px-2.5 py-1 rounded">
                              EXAM ID: {ex.id}
                            </span>
                          </div>
                        ))}
                        {sessionExams.length === 0 && (
                          <p className="text-slate-400 text-center py-4 font-medium">No exams launched in this room.</p>
                        )}
                      </div>
                    </div>

                    {/* Notes Pushed */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pushed Board Notes</h4>
                      <div className="border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                        {sessionNotes.map(note => (
                          <div key={note.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                            <p className="font-bold text-slate-900">{note.title}</p>
                            <p className="text-slate-550 text-[10px] truncate mt-0.5">{note.content}</p>
                          </div>
                        ))}
                        {sessionNotes.length === 0 && (
                          <p className="text-slate-400 text-center py-4 font-medium">No vector notes shared.</p>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowDetail(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-xl transition-all border border-slate-200 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
