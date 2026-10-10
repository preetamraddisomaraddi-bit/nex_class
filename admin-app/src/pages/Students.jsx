import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Students() {
  const [students, setStudents] = useState([])
  const [depts, setDepts] = useState([])
  const [sems, setSems] = useState([])
  
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [selectedSemId, setSelectedSemId] = useState('')
  const [attendanceFilter, setAttendanceFilter] = useState('all') // 'all', 'below75', 'above75'

  // Modal Profile Details
  const [showProfile, setShowProfile] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  
  const [profileAtt, setProfileAtt] = useState({ total: 0, present: 0, percentage: 0, records: [] })
  const [profileExams, setProfileExams] = useState([])
  const [profileBadges, setProfileBadges] = useState([])
  const [profileCodes, setProfileCodes] = useState([])
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    loadFilterData()
  }, [])

  useEffect(() => {
    if (selectedDeptId) {
      loadSemesters(selectedDeptId)
    } else {
      setSems([])
      setSelectedSemId('')
    }
  }, [selectedDeptId])

  async function loadFilterData() {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const { data } = await api.get(`/departments/university/${uni.id}`)
          setDepts(data.departments || [])
          
          // Initial load of students
          const studs = await api.get(`/universities/${uni.id}/students`)
          setStudents(studs.data.students || [])
        }
      }
    } catch (e) {
      console.error('Failed to load filter metadata:', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadSemesters(deptId) {
    try {
      const { data } = await api.get(`/semesters/department/${deptId}`)
      setSems(data.semesters || [])
      setSelectedSemId('')
    } catch (e) {
      console.error('Failed to load semesters:', e)
    }
  }

  async function handleSearch(e) {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const { data } = await api.get(
            `/universities/${uni.id}/students?dept_id=${selectedDeptId}&sem_id=${selectedSemId}&attendance=${attendanceFilter}&search=${search}`
          )
          setStudents(data.students || [])
        }
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function openProfile(student) {
    setSelectedStudent(student)
    setProfileAtt({ total: 0, present: 0, percentage: 0, records: [] })
    setProfileExams([])
    setProfileBadges([])
    setProfileCodes([])
    setProfileLoading(true)
    setShowProfile(true)

    try {
      const [attRes, examRes, badgeRes, codeRes] = await Promise.all([
        api.get(`/attendance/student/${student.id}`),
        api.get(`/exam/student/${student.id}`),
        api.get(`/badges/student/${student.id}`),
        api.get(`/code/student/${student.id}`)
      ])

      setProfileAtt(attRes.data)
      setProfileExams(examRes.data.history || [])
      setProfileBadges(badgeRes.data.badges || [])
      setProfileCodes(codeRes.data.submissions || [])
    } catch (e) {
      console.error('Failed to fetch full student profile details:', e)
    } finally {
      setProfileLoading(false)
    }
  }

  // Helper to compile subject-wise attendance
  const getSubjectAttendance = () => {
    const subjectMap = {}
    const records = profileAtt.records || []
    records.forEach(r => {
      const key = r.subject || 'General'
      if (!subjectMap[key]) {
        subjectMap[key] = { subject: key, teacher: r.teacher_name || 'N/A', total: 0, present: 0, absent: 0, late: 0 }
      }
      subjectMap[key].total++
      if (r.status === 'present') subjectMap[key].present++
      else if (r.status === 'late') subjectMap[key].late++
      else if (r.status === 'absent') subjectMap[key].absent++
    })
    return Object.values(subjectMap)
  }

  const allBadges = [
    { type: 'attendance_star', title: 'Attendance Star', icon: '⭐', desc: 'Present in at least 3 classes' },
    { type: 'coding_champ', title: 'Coding Champ', icon: '💻', desc: 'Submitted program code once' },
    { type: 'fast_learner', title: 'Fast Learner', icon: '🚀', desc: 'Submitted program code 3 times' },
    { type: 'exam_ace', title: 'Exam Ace', icon: '🥇', desc: 'Score >= 80% on any exam' },
    { type: 'perfect_score', title: 'Perfect Score', icon: '🏆', desc: 'Score = 100% on any exam' }
  ]

  return (
    <div className="space-y-6 select-none">
      
      {/* Page Header */}
      <div>
        <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Students Roster</h3>
        <p className="text-xs text-slate-500 mt-1">Audit student profiles, check grades, and track academic metrics.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Search Identity</label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors"
              placeholder="Search Name or USN..." />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Department</label>
            <select value={selectedDeptId} onChange={e => setSelectedDeptId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors font-medium">
              <option value="">All Departments</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Semester</label>
            <select value={selectedSemId} onChange={e => setSelectedSemId(e.target.value)} disabled={!selectedDeptId}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors disabled:opacity-50 font-medium">
              <option value="">All Semesters</option>
              {sems.map(s => (
                <option key={s.id} value={s.id}>Semester {s.number}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Attendance threshold</label>
            <select value={attendanceFilter} onChange={e => setAttendanceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none transition-colors font-medium">
              <option value="all">Show All</option>
              <option value="below75">Below 75% Attendance 🔴</option>
              <option value="above75">Above 75% Attendance 🟢</option>
            </select>
          </div>

          <button type="submit"
            className="w-full bg-[#4F46E5] hover:bg-indigo-755 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-md shadow-indigo-600/10">
            Search Students
          </button>
        </form>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-semibold animate-pulse text-xs">Querying student roster...</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-250 bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3.5 px-6">USN</th>
                <th className="py-3.5 px-6">Student Name</th>
                <th className="py-3.5 px-6">Department</th>
                <th className="py-3.5 px-6">Semester</th>
                <th className="py-3.5 px-6 text-center">Attendance Rate</th>
                <th className="py-3.5 px-6 text-center">Exam Average</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-mono font-bold text-slate-800">{student.usn || 'Standalone'}</td>
                  <td className="py-4 px-6 font-bold text-slate-900">{student.name}</td>
                  <td className="py-4 px-6 font-semibold text-slate-500">{student.department_name || 'N/A'}</td>
                  <td className="py-4 px-6 font-bold text-slate-500">Sem {student.semester_number || 'N/A'}</td>
                  <td className="py-4 px-6 text-center font-extrabold">
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${
                      student.attendance_pct >= 75 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : student.attendance_pct >= 60 
                          ? 'bg-amber-50 text-amber-600 border-amber-200' 
                          : 'bg-red-50 text-red-650 border-red-200'
                    }`}>
                      {student.attendance_pct !== null ? `${Math.round(student.attendance_pct)}%` : '0%'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center font-bold text-slate-700">
                    {student.avg_score !== null ? `${Math.round(student.avg_score)}%` : 'No Exams'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button onClick={() => openProfile(student)} className="text-[#4F46E5] hover:text-indigo-850 font-bold hover:underline">
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">No students matched the active filter queries.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Student Profile Overlay Modal */}
      {showProfile && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl border border-slate-200 shadow-2xl relative max-h-[90vh] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>

            <div className="mb-6 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#4F46E5] text-white font-extrabold flex items-center justify-center text-lg">
                  {selectedStudent.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-400">USN: <strong className="font-mono text-slate-600">{selectedStudent.usn || 'N/A'}</strong></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 font-semibold">{selectedStudent.email}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Enrolled: {new Date(selectedStudent.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto space-y-6 pr-2 mb-6">
              {profileLoading ? (
                <div className="text-center py-16 text-slate-400 font-bold animate-pulse text-xs">Compiling student academic logs...</div>
              ) : (
                <>
                  {/* Grid 1: Basic metrics and Code counts */}
                  <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-slate-500">
                    <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider block mb-1">Attendance Rate</span>
                      <span className={`text-2xl font-extrabold ${profileAtt.percentage >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>{profileAtt.percentage}%</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider block mb-1">Average Grade</span>
                      <span className="text-2xl font-extrabold text-slate-900">
                        {profileExams.length > 0 
                          ? `${Math.round(profileExams.reduce((acc, curr) => acc + curr.percentage, 0) / profileExams.length)}%` 
                          : 'No score'}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider block mb-1">Code Submissions</span>
                      <span className="text-2xl font-extrabold text-indigo-700">{profileCodes.length} Submits</span>
                    </div>
                  </div>

                  {/* Section 2: Attendance per subject */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendance Per Subject</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                            <th className="py-2 px-4">Subject</th>
                            <th className="py-2 px-4">Teacher</th>
                            <th className="py-2 px-4 text-center">Present</th>
                            <th className="py-2 px-4 text-center">Absent</th>
                            <th className="py-2 px-4 text-center">Late</th>
                            <th className="py-2 px-4 text-right">Attendance %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {getSubjectAttendance().map(sub => {
                            const rate = Math.round((sub.present / sub.total) * 100)
                            return (
                              <tr key={sub.subject}>
                                <td className="py-3 px-4 font-bold text-slate-800">{sub.subject}</td>
                                <td className="py-3 px-4 font-medium text-slate-500">{sub.teacher}</td>
                                <td className="py-3 px-4 text-center text-emerald-600 font-bold">{sub.present}</td>
                                <td className="py-3 px-4 text-center text-red-500 font-bold">{sub.absent}</td>
                                <td className="py-3 px-4 text-center text-amber-500 font-bold">{sub.late}</td>
                                <td className={`py-3 px-4 text-right font-extrabold ${rate >= 75 ? 'text-emerald-600' : 'text-red-550'}`}>{rate}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: Exam Scores */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exam Submissions</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                            <th className="py-2 px-4">Exam Name</th>
                            <th className="py-2 px-4">Subject</th>
                            <th className="py-2 px-4">Date Submitted</th>
                            <th className="py-2 px-4 text-center">Raw Score</th>
                            <th className="py-2 px-4 text-right">Grade %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profileExams.map(ex => (
                            <tr key={ex.id}>
                              <td className="py-3 px-4 font-bold text-slate-800">{ex.title}</td>
                              <td className="py-3 px-4 font-medium text-slate-500">{ex.subject}</td>
                              <td className="py-3 px-4 text-slate-400">{new Date(ex.submitted_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-center font-bold text-slate-700">{ex.score} / {ex.total}</td>
                              <td className="py-3 px-4 text-right font-extrabold text-emerald-600">{ex.percentage}%</td>
                            </tr>
                          ))}
                          {profileExams.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">No exams submitted.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 4: Badges Grid */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Earned Achievements</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      {allBadges.map(badge => {
                        const earned = profileBadges.some(b => b.badge_type === badge.type)
                        return (
                          <div key={badge.type} className={`border rounded-2xl p-4 text-center flex flex-col items-center justify-between transition-all duration-300 ${
                            earned 
                              ? 'bg-indigo-50 border-indigo-200 text-slate-850 shadow-sm' 
                              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                          }`}>
                            <span className="text-2xl mb-1">{badge.icon}</span>
                            <span className="text-xs font-bold leading-none">{badge.title}</span>
                            <span className="text-[9px] text-slate-400 font-medium leading-tight mt-1.5">{badge.desc}</span>
                            {!earned && <span className="text-[9px] font-extrabold uppercase mt-2 text-slate-450 tracking-wider">🔒 Locked</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowProfile(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-xl transition-all border border-slate-200 text-xs">
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
