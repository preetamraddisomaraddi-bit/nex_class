import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [alerts, setAlerts] = useState({ pending_teachers: [], low_attendance_students: [] })
  const [depts, setDepts] = useState([])
  const [topStudents, setTopStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const [statsRes, sessionRes, alertRes, reportRes, perfRes] = await Promise.all([
            api.get(`/universities/${uni.id}/stats`),
            api.get(`/universities/${uni.id}/recent-sessions`),
            api.get(`/universities/${uni.id}/alerts`),
            api.get(`/universities/${uni.id}/reports/attendance`),
            api.get(`/universities/${uni.id}/reports/performance`)
          ])

          setStats(statsRes.data)
          setSessions(sessionRes.data.sessions || [])
          setAlerts(alertRes.data)
          setDepts(reportRes.data.dept_attendance || [])
          setTopStudents(perfRes.data.top_students?.slice(0, 3) || [])
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse select-none">
        <div className="grid grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-64 bg-white border border-slate-200 rounded-2xl"></div>
          <div className="h-64 bg-white border border-slate-200 rounded-2xl"></div>
        </div>
        <div className="h-48 bg-white border border-slate-200 rounded-2xl"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 select-none">
      
      {/* Alerts Banner Section */}
      {(alerts.pending_teachers.length > 0 || alerts.low_attendance_students.length > 0) && (
        <div className="bg-[#FEF3C7] border border-[#F3F4F6] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              ⚠️ Attention Required
            </span>
            <p className="text-xs text-amber-700 font-semibold mt-1">
              There are <strong className="text-amber-900">{alerts.pending_teachers.length} teachers</strong> pending approval, and <strong className="text-amber-900">{alerts.low_attendance_students.length} students</strong> with low attendance (&lt;75%).
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {alerts.pending_teachers.length > 0 && (
              <button onClick={() => navigate('/teachers')} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg uppercase tracking-wider shadow-sm transition-all">
                Review Teachers
              </button>
            )}
            {alerts.low_attendance_students.length > 0 && (
              <button onClick={() => navigate('/students')} className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 font-bold text-[10px] px-3.5 py-2 rounded-lg uppercase tracking-wider border border-amber-550/20 transition-all">
                View Students
              </button>
            )}
          </div>
        </div>
      )}

      {/* Row 1: Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Departments', value: stats?.total_departments, icon: '🏢', bg: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
          { label: 'Approved Teachers', value: stats?.total_teachers, icon: '👨‍🏫', bg: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
          { label: 'Enrolled Students', value: stats?.total_students, icon: '👨‍🎓', bg: 'bg-blue-50 border-blue-100 text-blue-700' },
          { label: 'Active Rooms Today', value: stats?.sessions_today, icon: '📋', bg: 'bg-purple-50 border-purple-100 text-purple-750' }
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-3xl font-extrabold text-slate-900 leading-none">{card.value}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2.5">{card.label}</p>
            </div>
            <span className={`text-2xl p-3.5 rounded-xl border ${card.bg}`}>{card.icon}</span>
          </div>
        ))}
      </div>

      {/* Row 2: Analytics Cards (Attendance vs Performance) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Attendance Overview Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Attendance Breakdown</h4>
              <span className="text-3xl font-extrabold text-indigo-600 leading-none">{stats?.overall_attendance_pct}%</span>
            </div>
            
            {/* Dept list snippet */}
            <div className="space-y-4">
              {depts.slice(0, 3).map(dept => (
                <div key={dept.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{dept.name}</span>
                    <span className="text-slate-550">{dept.attendance_pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        dept.attendance_pct >= 75 ? 'bg-emerald-500' : dept.attendance_pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${dept.attendance_pct}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {depts.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No department attendance logs recorded.</p>
              )}
            </div>
          </div>
          
          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <button onClick={() => navigate('/reports')} className="text-xs font-bold text-indigo-650 hover:text-indigo-750">
              View Attendance Report &rarr;
            </button>
          </div>
        </div>

        {/* Academic Performance Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Academic Performance</h4>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-emerald-600 leading-none">{stats?.university_avg_score}%</span>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Average Grade</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Top Performing Students</p>
              {topStudents.map((st, index) => (
                <div key={st.id} className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-none">{st.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1 font-mono">{st.usn}</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-600">{Math.round(st.avg_score)}%</span>
                </div>
              ))}
              {topStudents.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No exam submissions recorded.</p>
              )}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <button onClick={() => navigate('/students')} className="text-xs font-bold text-indigo-650 hover:text-indigo-750">
              View All Students &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Rooms/Sessions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider mb-6">Recent Live Classrooms</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-250 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="pb-3.5">Code</th>
                <th className="pb-3.5">Subject / Topic</th>
                <th className="pb-3.5">Instructor</th>
                <th className="pb-3.5">Department</th>
                <th className="pb-3.5">Semester</th>
                <th className="pb-3.5">Started At</th>
                <th className="pb-3.5 text-right">Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map(session => (
                <tr key={session.code} className="hover:bg-slate-50/50">
                  <td className="py-4 font-mono font-bold text-indigo-600">{session.code}</td>
                  <td className="py-4">
                    <p className="font-bold text-slate-900">{session.subject}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">{session.class_name || 'No Topic Set'}</p>
                  </td>
                  <td className="py-4 font-medium text-slate-800">{session.teacher_name}</td>
                  <td className="py-4 text-slate-500 font-semibold">{session.dept_name || 'N/A'}</td>
                  <td className="py-4 text-slate-550 font-bold">Sem {session.semester_number || 'N/A'}</td>
                  <td className="py-4 text-slate-400 font-medium">{new Date(session.created_at).toLocaleString()}</td>
                  <td className="py-4 text-right font-bold text-slate-800">{session.student_count}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">No classroom history logs compiled yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
