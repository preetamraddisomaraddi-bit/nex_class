import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/AlertToast'
import StatCard from '../components/StatCard'
import { useHOD } from '../context/HODContext'
import {
  HOD,
  STUDENTS,
  SESSION_LOGS,
  MONTHLY_STATS,
  getAtRiskStudents,
  getDeptAvgAttendance,
  getDeptAvgScore,
} from '../data/mockData'

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
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: headingFont,
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text)',
        }}
      >
        {title}
      </h2>
      {trailing}
    </div>
  )
}

function CountPill({ children, tone = 'amber' }) {
  const colors = tone === 'red'
    ? { background: 'var(--red-light)', color: 'var(--red)' }
    : tone === 'green'
      ? { background: 'var(--green-light)', color: 'var(--green)' }
      : { background: 'var(--amber-light)', color: 'var(--amber)' }

  return (
    <span
      style={{
        ...colors,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { teachers, approveTeacher, rejectTeacher } = useHOD()
  const atRiskStudents = useMemo(() => getAtRiskStudents(), [])
  const deptAttendance = getDeptAvgAttendance()
  const deptAvgScore = getDeptAvgScore()

  const pendingTeachers = teachers.filter(teacher => teacher.status === 'pending')
  const approvedTeachers = teachers.filter(teacher => teacher.status === 'approved')

  const totalSessions = SESSION_LOGS.length
  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  function handleApprove(teacherId, name) {
    approveTeacher(teacherId)
    const displayName = name.replace(/^Prof\.\s*/, '')
    showToast(`Prof. ${displayName} has been approved ✅`, 'success')
  }

  function handleReject(teacherId, name) {
    const displayName = name.replace(/^Prof\.\s*/, '')
    const confirmed = window.confirm(`Reject Prof. ${displayName}? This cannot be undone.`)
    if (!confirmed) return
    rejectTeacher(teacherId)
    showToast(`Prof. ${displayName} has been rejected`, 'warning')
  }

  const linkButtonStyle = {
    border: 0,
    padding: 0,
    background: 'transparent',
    color: 'var(--indigo)',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        .dashboard-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        .dashboard-main-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
        .dashboard-chart-scroll { overflow-x: auto; }
        .dashboard-chart-bars { min-width: 560px; }
        .dashboard-teacher-row:last-child, .dashboard-risk-row:last-child, .dashboard-session-row:last-child { border-bottom: 0 !important; }
        .dashboard-action:hover { filter: brightness(0.96); }
        @media (max-width: 1050px) { .dashboard-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) {
          .dashboard-main-grid { grid-template-columns: 1fr; }
          .dashboard-greeting { align-items: flex-start !important; flex-direction: column; }
          .dashboard-date { text-align: left !important; }
        }
        @media (max-width: 420px) { .dashboard-stat-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section
        className="dashboard-greeting"
        style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          boxShadow: 'var(--shadow)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontFamily: headingFont, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Good morning, {HOD.name} 👋
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>
            {HOD.department} · {HOD.university}
          </p>
        </div>
        <div className="dashboard-date" style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: 'var(--muted)' }}>{currentDate}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted2)' }}>2024 — 25</div>
        </div>
      </section>

      <section className="dashboard-stat-grid" aria-label="Department statistics">
        <StatCard
          icon="👨‍🏫"
          iconBg="var(--indigo-light)"
          value={approvedTeachers.length}
          label="Approved Teachers"
          subtitle={pendingTeachers.length ? `${pendingTeachers.length} pending approval` : 'All approved'}
          subtitleColor={pendingTeachers.length ? 'var(--amber)' : 'var(--green)'}
        />
        <StatCard
          icon="👨‍🎓"
          iconBg="var(--blue-light)"
          value={STUDENTS.length}
          label="Total Students"
          subtitle={atRiskStudents.length ? `${atRiskStudents.length} at risk (<75%)` : 'All on track'}
          subtitleColor={atRiskStudents.length ? 'var(--red)' : 'var(--green)'}
        />
        <StatCard
          icon="📋"
          iconBg="var(--green-light)"
          value={totalSessions}
          label="Total Sessions"
          subtitle="This academic period"
        />
        <StatCard
          icon="📊"
          iconBg="var(--amber-light)"
          value={`${deptAttendance}%`}
          label="Dept. Attendance"
          subtitle={deptAttendance >= 75 ? 'Above minimum requirement' : 'Below 75% threshold'}
          subtitleColor={deptAttendance >= 75 ? 'var(--green)' : 'var(--red)'}
        />
      </section>

      <section className="dashboard-main-grid" aria-label="Department activity">
        <div style={panelStyle}>
          <SectionHeader
            title="⏳ Pending Approvals"
            trailing={<CountPill>{pendingTeachers.length}</CountPill>}
          />
          {pendingTeachers.length === 0 ? (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div aria-hidden="true" style={{ fontSize: 24 }}>✅</div>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>No pending approvals</p>
            </div>
          ) : (
            <div style={{ padding: '8px 20px' }}>
              {pendingTeachers.map(teacher => (
                <div
                  className="dashboard-teacher-row"
                  key={teacher.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}
                >
                  <div
                    aria-hidden="true"
                    style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #2563EB)', color: 'white', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    {teacher.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{teacher.name}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{teacher.subject} · Sem {teacher.semester}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      className="dashboard-action"
                      type="button"
                      onClick={() => handleApprove(teacher.id, teacher.name)}
                      style={{ border: 0, borderRadius: 6, padding: '5px 10px', background: 'var(--green)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Approve
                    </button>
                    <button
                      className="dashboard-action"
                      type="button"
                      onClick={() => handleReject(teacher.id, teacher.name)}
                      style={{ border: '1px solid var(--red)', borderRadius: 6, padding: '5px 9px', background: 'transparent', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={panelStyle}>
          <SectionHeader
            title="⚠️ Students At Risk"
            trailing={<CountPill tone={atRiskStudents.length ? 'red' : 'green'}>{atRiskStudents.length}</CountPill>}
          />
          {atRiskStudents.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--green)' }}>
              🎉 All students above 75% attendance
            </div>
          ) : (
            <>
              <div>
                {atRiskStudents.map(student => (
                  <div
                    className="dashboard-risk-row"
                    key={student.id}
                    style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}
                  >
                    <div
                      aria-hidden="true"
                      style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--red-light)', color: 'var(--red)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      {student.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{student.name}</div>
                      <div style={{ marginTop: 2, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--muted)' }}>
                        {student.usn} · Sem {student.semester}
                      </div>
                    </div>
                    <span style={{ background: 'var(--red-light)', color: 'var(--red)', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>
                      {student.attendance.overall}%
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                <button type="button" onClick={() => navigate('/students')} style={linkButtonStyle}>
                  View All Students →
                </button>
              </div>
            </>
          )}
        </div>

        <div style={panelStyle}>
          <SectionHeader
            title="📋 Recent Sessions"
            trailing={(
              <button type="button" onClick={() => navigate('/sessions')} style={linkButtonStyle}>
                View All →
              </button>
            )}
          />
          <div>
            {SESSION_LOGS.slice(0, 5).map(session => {
              const attendanceRatio = session.totalStudents > 0 ? session.studentsPresent / session.totalStudents : 0
              const sessionDate = new Date(`${session.date}T00:00:00`).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              return (
                <div
                  className="dashboard-session-row"
                  key={session.id}
                  style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{session.subject}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{session.teacher}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted2)' }}>{sessionDate} · {session.duration} mins</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: attendanceRatio >= 0.8 ? 'var(--green)' : 'var(--amber)' }}>
                      {session.studentsPresent} / {session.totalStudents}
                    </div>
                    <span style={{ display: 'inline-block', marginTop: 4, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                      Sem {session.semester}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={panelStyle}>
          <SectionHeader
            title="📈 Monthly Overview"
            trailing={(
              <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }} title="Average exam score across student results">
                Exam avg <strong style={{ color: 'var(--green)' }}>{deptAvgScore}%</strong>
              </div>
            )}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '14px 20px 0' }} aria-label="Chart legend">
            {[
              ['#4F46E5', 'Attendance %'],
              ['#059669', 'Avg Score'],
              ['#D97706', 'Sessions'],
            ].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                {label}
              </div>
            ))}
          </div>
          <div className="dashboard-chart-scroll" style={{ padding: '18px 20px 16px' }}>
            <div className="dashboard-chart-bars" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 168, borderBottom: '2px solid var(--border)', paddingBottom: 8 }}>
              {MONTHLY_STATS.map(month => (
                <div key={month.month} style={{ flex: 1, minWidth: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 140, width: '100%' }}>
                    <span title={`${month.attendance}% attendance`} style={{ width: 14, height: `${(month.attendance / 100) * 140}px`, background: '#4F46E5', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} />
                    <span title={`${month.avgScore}% average score`} style={{ width: 14, height: `${(month.avgScore / 100) * 140}px`, background: '#059669', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} />
                    <span title={`${month.sessions} sessions`} style={{ width: 14, height: `${(month.sessions / 60) * 140}px`, background: '#D97706', borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease' }} />
                  </div>
                  <span style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{month.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
