import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/AlertToast'
import StatCard from '../components/StatCard'
import { useHOD } from '../context/HODContext'
import { apiRequest } from '../api'
import { MONTHLY_STATS } from '../data/mockData'

const headingFont = '"Plus Jakarta Sans", sans-serif'
const panelStyle = {
  minWidth: 0,
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
}

function SectionHeader({ title, trailing }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <h2 style={{ margin: 0, fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      {trailing}
    </div>
  )
}

function CountPill({ children, tone = 'amber' }) {
  const palette = tone === 'red'
    ? { background: 'var(--red-light)', color: 'var(--red)' }
    : tone === 'green'
      ? { background: 'var(--green-light)', color: 'var(--green)' }
      : { background: 'var(--amber-light)', color: 'var(--amber)' }
  return <span style={{ ...palette, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>{children}</span>
}

const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')
const dateLabel = value => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Date unavailable'

export default function Dashboard() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { teachers, approveTeacher, rejectTeacher, realtime, refreshTeachers } = useHOD()
  const [students, setStudents] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const seenEvents = useRef(new Set())

  const loadDashboardData = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true)
    setLoadError('')
    try {
      const [studentRows, roomRows] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/rooms'),
      ])
      setStudents(Array.isArray(studentRows) ? studentRows : [])
      setRooms(Array.isArray(roomRows) ? roomRows : [])
    } catch (error) {
      setLoadError(error.message || 'Unable to load department data.')
    } finally {
      if (initial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData({ initial: true })
  }, [loadDashboardData])

  useEffect(() => {
    const latestEvent = realtime.recentEvents[0]
    if (!latestEvent || seenEvents.current.has(latestEvent.id)) return
    seenEvents.current.add(latestEvent.id)
    if (seenEvents.current.size > 80) seenEvents.current = new Set([...seenEvents.current].slice(-40))
    loadDashboardData()
    if (latestEvent.type === 'alert') showToast(latestEvent.message, 'warning')
    if (latestEvent.type === 'exam' && latestEvent.action === 'launched') showToast(latestEvent.message, 'info')
  }, [realtime.recentEvents, loadDashboardData, showToast])

  const studentsWithAttendance = useMemo(() => {
    const roomsBySemester = rooms.reduce((counts, room) => {
      const semester = Number(room.semester)
      counts[semester] = (counts[semester] || 0) + 1
      return counts
    }, {})
    return students.map(student => {
      const totalSessions = roomsBySemester[Number(student.semester)] || 0
      const attended = Number(student.classes_attended || 0)
      const attendance = totalSessions ? Math.min(100, Math.round(attended / totalSessions * 100)) : 100
      return { ...student, attendance, initials: initials(student.name), totalSessions, attended }
    })
  }, [students, rooms])

  const atRiskStudents = studentsWithAttendance.filter(student => student.attendance < 75)
  const pendingTeachers = teachers.filter(teacher => teacher.status === 'pending')
  const approvedTeachers = teachers.filter(teacher => teacher.status === 'approved')
  const activeSessions = rooms.filter(room => room.status === 'active')
  const deptAttendance = useMemo(() => {
    const eligible = studentsWithAttendance.filter(student => student.totalSessions > 0)
    const expected = eligible.reduce((sum, student) => sum + student.totalSessions, 0)
    const attended = eligible.reduce((sum, student) => sum + Math.min(student.attended, student.totalSessions), 0)
    return expected ? Math.round(attended / expected * 100) : 0
  }, [studentsWithAttendance])
  const deptAvgScore = useMemo(() => {
    const scores = students.map(student => student.avg_score == null ? null : Number(student.avg_score)).filter(Number.isFinite)
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
  }, [students])

  let hod = {}
  try { hod = JSON.parse(window.localStorage.getItem('nexclass_hod_data') || '{}') } catch { /* use fallback */ }
  const hodName = hod.name || hod.full_name || 'Department Head'
  const department = hod.department || 'Computer Science & Engineering'
  const university = hod.university || 'NexClass Department Portal'
  const currentDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  async function handleApprove(teacherId, name) {
    try {
      await approveTeacher(teacherId)
      await refreshTeachers().catch(() => {})
      showToast(`${name} has been approved ✅`, 'success')
    } catch (error) {
      showToast(error.message || 'Unable to approve this teacher.', 'error')
    }
  }

  async function handleReject(teacherId, name) {
    if (!window.confirm(`Reject ${name}? This cannot be undone.`)) return
    try {
      await rejectTeacher(teacherId)
      showToast(`${name} has been rejected`, 'warning')
    } catch (error) {
      showToast(error.message || 'Unable to reject this teacher.', 'error')
    }
  }

  const linkButtonStyle = { border: 0, padding: 0, background: 'transparent', color: 'var(--indigo)', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

  if (loading) return <div role="status" style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading live department data…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        .dashboard-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .dashboard-main-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
        .dashboard-live-grid { grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.6fr); }
        .dashboard-chart-scroll { overflow-x: auto; }
        .dashboard-chart-bars { min-width: 560px; }
        .dashboard-teacher-row:last-child, .dashboard-risk-row:last-child, .dashboard-session-row:last-child { border-bottom: 0 !important; }
        .dashboard-action:hover { filter: brightness(0.96); }
        @media (max-width: 1050px) { .dashboard-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) {
          .dashboard-main-grid { grid-template-columns: 1fr; }
          .dashboard-live-grid { grid-template-columns: 1fr !important; }
          .dashboard-greeting { align-items: flex-start !important; flex-direction: column; }
          .dashboard-date { text-align: left !important; }
        }
        @media (max-width: 420px) { .dashboard-stat-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section className="dashboard-greeting" style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, boxShadow: 'var(--shadow)' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: headingFont, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Welcome, {hodName} 👋</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>{department} · {university}</p>
        </div>
        <div className="dashboard-date" style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: 'var(--muted)' }}>{currentDate}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted2)' }}>Live department overview</div>
        </div>
      </section>

      {loadError && <div role="alert" style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--red-light)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13 }}><span>{loadError}</span><button type="button" onClick={() => loadDashboardData({ initial: true })} style={{ border: 0, borderRadius: 6, background: 'var(--red)', color: 'white', padding: '7px 12px', fontWeight: 600, cursor: 'pointer' }}>Retry</button></div>}

      <section className="dashboard-stat-grid" aria-label="Department statistics">
        <StatCard icon="👨‍🏫" iconBg="var(--indigo-light)" value={approvedTeachers.length} label="Approved Teachers" subtitle={pendingTeachers.length ? `${pendingTeachers.length} pending approval` : 'All approved'} subtitleColor={pendingTeachers.length ? 'var(--amber)' : 'var(--green)'} />
        <StatCard icon="👨‍🎓" iconBg="var(--blue-light)" value={students.length} label="Total Students" subtitle={atRiskStudents.length ? `${atRiskStudents.length} at risk (<75%)` : 'All on track'} subtitleColor={atRiskStudents.length ? 'var(--red)' : 'var(--green)'} />
        <StatCard icon="📋" iconBg="var(--green-light)" value={rooms.length} label="Total Sessions" subtitle={`${activeSessions.length} active now`} />
        <StatCard icon="📊" iconBg="var(--amber-light)" value={`${deptAttendance}%`} label="Dept. Attendance" subtitle={deptAttendance >= 75 ? 'Above minimum requirement' : 'Below 75% threshold'} subtitleColor={deptAttendance >= 75 ? 'var(--green)' : 'var(--red)'} />
      </section>

      <section style={panelStyle} aria-label="Live department activity">
        <SectionHeader title="🔴 Live Department Activity" trailing={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: realtime.connected ? 'var(--green)' : realtime.error ? 'var(--red)' : 'var(--muted)', fontSize: 11, fontWeight: 700 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: realtime.connected ? 'var(--green)' : realtime.error ? 'var(--red)' : 'var(--muted2)' }} />{realtime.connected ? 'Connected' : realtime.error ? 'Offline' : 'Connecting'}</span>} />
        <div className="dashboard-live-grid" style={{ display: 'grid', gap: 20, padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--green-light)' }}><div style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{realtime.onlineTeachers.length}</div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>Teachers online</div></div>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--blue-light)' }}><div style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{realtime.activeRooms.length}</div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>Active sessions</div></div>
            <div style={{ gridColumn: '1 / -1', fontSize: 12, lineHeight: 1.5, color: realtime.error ? 'var(--amber)' : 'var(--muted)' }}>
              {realtime.connected ? realtime.activeRooms.length ? realtime.activeRooms.map(room => <div key={room.id || room.code || room.room_code}>{room.subject} · {room.code || room.room_code} · {(room.students || []).length} students</div>) : 'No live sessions at the moment.' : realtime.error || 'Waiting for the HOD server connection.'}
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent live events</div>
            {realtime.recentEvents.length === 0 ? <div style={{ padding: '8px 0', fontSize: 13, color: 'var(--muted)' }}>Live teacher, student and session activity will appear here.</div> : realtime.recentEvents.slice(0, 5).map(event => <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}><span style={{ color: 'var(--text2)' }}>{event.message}</span><time style={{ color: 'var(--muted2)', whiteSpace: 'nowrap' }} dateTime={event.at}>{new Date(event.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time></div>)}
          </div>
        </div>
      </section>

      <section className="dashboard-main-grid" aria-label="Department activity">
        <div style={panelStyle}>
          <SectionHeader title="⏳ Pending Approvals" trailing={<CountPill>{pendingTeachers.length}</CountPill>} />
          {pendingTeachers.length === 0 ? <div style={{ padding: '28px 20px', textAlign: 'center' }}><div aria-hidden="true" style={{ fontSize: 24 }}>✅</div><p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>No pending approvals</p></div> : <div style={{ padding: '8px 20px' }}>{pendingTeachers.map(teacher => <div className="dashboard-teacher-row" key={teacher.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}><div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #2563EB)', color: 'white', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{teacher.initials || initials(teacher.name)}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{teacher.name}</div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{teacher.subject} · Sem {teacher.semester}</div></div><div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><button className="dashboard-action" type="button" onClick={() => handleApprove(teacher.id, teacher.name)} style={{ border: 0, borderRadius: 6, padding: '5px 10px', background: 'var(--green)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Approve</button><button className="dashboard-action" type="button" onClick={() => handleReject(teacher.id, teacher.name)} style={{ border: '1px solid var(--red)', borderRadius: 6, padding: '5px 9px', background: 'transparent', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Reject</button></div></div>)}</div>}
        </div>

        <div style={panelStyle}>
          <SectionHeader title="⚠️ Students At Risk" trailing={<CountPill tone={atRiskStudents.length ? 'red' : 'green'}>{atRiskStudents.length}</CountPill>} />
          {atRiskStudents.length === 0 ? <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--green)' }}>🎉 No students are currently below the attendance threshold.</div> : <><div>{atRiskStudents.slice(0, 6).map(student => <div className="dashboard-risk-row" key={student.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}><div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--red-light)', color: 'var(--red)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{student.initials}</div><div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{student.name}</div><div style={{ marginTop: 2, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--muted)' }}>{student.usn} · Sem {student.semester}</div></div><span style={{ background: 'var(--red-light)', color: 'var(--red)', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>{student.attendance}%</span></div>)}</div><div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}><button type="button" onClick={() => navigate('/students')} style={linkButtonStyle}>View All Students →</button></div></>}
        </div>

        <div style={panelStyle}>
          <SectionHeader title="📋 Recent Sessions" trailing={<button type="button" onClick={() => navigate('/sessions')} style={linkButtonStyle}>View All →</button>} />
          {rooms.length === 0 ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No sessions have been recorded yet.</div> : rooms.slice(0, 5).map(session => {
            const cohortSize = students.filter(student => Number(student.semester) === Number(session.semester)).length
            const present = Number(session.students_present || 0)
            const rate = cohortSize ? present / cohortSize : 0
            return <div className="dashboard-session-row" key={session.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{session.subject || 'Session'} <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--indigo)' }}>· {session.code}</span></div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{session.teacher_name || 'Teacher unavailable'}</div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted2)' }}>{dateLabel(session.created_at)}</div></div><div style={{ flexShrink: 0, textAlign: 'right' }}><div style={{ fontSize: 12, fontWeight: 600, color: rate >= 0.8 ? 'var(--green)' : rate >= 0.6 ? 'var(--amber)' : 'var(--muted)' }}>{present} / {cohortSize} students</div><span style={{ display: 'inline-block', marginTop: 4, background: session.status === 'active' ? 'var(--blue-light)' : 'var(--indigo-light)', color: session.status === 'active' ? 'var(--blue)' : 'var(--indigo)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{session.status === 'active' ? 'Active' : 'Completed'} · Sem {session.semester}</span></div></div>
          })}
        </div>

        <div style={panelStyle}>
          <SectionHeader title="📈 Monthly Overview" trailing={<div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }} title="Average exam score from server data">Exam avg <strong style={{ color: 'var(--green)' }}>{deptAvgScore}%</strong></div>} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '14px 20px 0' }} aria-label="Chart legend">{[['#4F46E5', 'Attendance %'], ['#059669', 'Avg Score'], ['#D97706', 'Sessions']].map(([color, label]) => <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: color }} />{label}</div>)}</div>
          <div className="dashboard-chart-scroll" style={{ padding: '18px 20px 16px' }}><div className="dashboard-chart-bars" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 168, borderBottom: '2px solid var(--border)', paddingBottom: 8 }}>{MONTHLY_STATS.map(month => <div key={month.month} style={{ flex: 1, minWidth: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}><div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 140, width: '100%' }}><span title={`${month.attendance}% attendance`} style={{ width: 14, height: `${(month.attendance / 100) * 140}px`, background: '#4F46E5', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} /><span title={`${month.avgScore}% average score`} style={{ width: 14, height: `${(month.avgScore / 100) * 140}px`, background: '#059669', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} /><span title={`${month.sessions} sessions`} style={{ width: 14, height: `${(month.sessions / 60) * 140}px`, background: '#D97706', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} /></div><span style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{month.month}</span></div>)}</div></div>
        </div>
      </section>
    </div>
  )
}
