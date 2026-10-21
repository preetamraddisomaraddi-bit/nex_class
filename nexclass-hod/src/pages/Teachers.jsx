import { useMemo, useState } from 'react'
import { useHOD } from '../context/HODContext'
import { useToast } from '../components/AlertToast'
import { getTeacherDetail, sendAlert as saveAlert } from '../api'
import Modal from '../components/Modal'

const headingFont = '"Plus Jakarta Sans", sans-serif'
const monoFont = '"JetBrains Mono", monospace'

const getAvatarColor = name => {
  const colors = [
    'linear-gradient(135deg, #4F46E5, #2563EB)',
    'linear-gradient(135deg, #059669, #0891B2)',
    'linear-gradient(135deg, #D97706, #DC2626)',
    'linear-gradient(135deg, #7C3AED, #DB2777)',
    'linear-gradient(135deg, #0891B2, #059669)',
  ]
  const index = (name || 'T').charCodeAt(0) % colors.length
  return colors[index]
}

function getRelativeTime(dateStr) {
  if (!dateStr) return 'Never'
  const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff <= 7) return `${diff} days ago`
  if (diff <= 30) return `${Math.floor(diff / 7)} weeks ago`
  return `${Math.floor(diff / 30)} months ago`
}

function dateLabel(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function Avatar({ teacher, size = 36, fontSize = 13 }) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: getAvatarColor(teacher.name), color: 'white', fontWeight: 700, fontSize, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {teacher.initials}
    </div>
  )
}

function EmptyState({ icon, title, description }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div aria-hidden="true" style={{ fontSize: 40 }}>{icon}</div>
      <h3 style={{ marginTop: 12, fontFamily: headingFont, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
      <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>{description}</p>
    </div>
  )
}

function TeacherDetail({ teacher }) {
  if (!teacher) return null

  const sessionHistory = (teacher.sessions || []).slice(0, 5)
  const exams = teacher.examsConducted || []
  const studentsTaught = teacher.totalStudentsTaught || '—'

  const scoreColor = score => score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <Avatar teacher={teacher} size={64} fontSize={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{teacher.name}</h3>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>Teacher · Sem {teacher.semester}</div>
          <div style={{ marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>{teacher.email}</div>
          <div style={{ marginTop: 4, fontFamily: monoFont, fontSize: 12, color: 'var(--indigo)' }}>{teacher.employeeId}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
            {[
              [teacher.totalClasses || 0, 'Classes'],
              [teacher.avgDuration || 0, 'Avg Mins'],
              [studentsTaught, 'Students'],
              [teacher.totalNotesPushed || 0, 'Notes'],
            ].map(([value, label]) => (
              <div key={label}>
                <div style={{ fontFamily: headingFont, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section>
        <h3 style={{ marginBottom: 12, fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Recent Sessions</h3>
        {sessionHistory.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No sessions conducted yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Date', 'Room Code', 'Duration', 'Students', 'Notes', 'Exams'].map(label => <th key={label} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {sessionHistory.map(session => {
                  const ratio = session.totalStudents ? session.studentsPresent / session.totalStudents : 0
                  return (
                    <tr key={session.id}>
                      <td style={detailCell}>{dateLabel(session.date)}</td>
                      <td style={{ ...detailCell, fontFamily: monoFont, fontSize: 12, color: 'var(--indigo)' }}>{session.roomCode}</td>
                      <td style={detailCell}>{session.duration ? `${session.duration} mins` : '—'}</td>
                      <td style={{ ...detailCell, color: ratio >= 0.8 ? 'var(--green)' : 'var(--amber)' }}>{session.studentsPresent}/{session.totalStudents}</td>
                      <td style={detailCell}>{session.notesCount} notes</td>
                      <td style={detailCell}>{session.examsConducted > 0 ? `${session.examsConducted} exam` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 12, fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Exams Conducted</h3>
        {exams.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No exams conducted yet.</p>
        ) : exams.map(exam => (
          <div key={exam.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14, marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{exam.title}</div>
              <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>{dateLabel(exam.date)}</div>
              <div style={{ height: 4, marginTop: 8, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, Math.min(100, exam.avgScore || 0))}%`, height: '100%', background: scoreColor(exam.avgScore || 0), borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: headingFont, fontSize: 18, fontWeight: 800, color: scoreColor(exam.avgScore) }}>{exam.avgScore}%</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Avg Score</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: headingFont, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{exam.totalStudents}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Students</div></div>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}

const detailCell = { padding: '10px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }

export default function Teachers() {
  const { teachers, approveTeacher, rejectTeacher, notifyTeacherAlert, loadingTeachers, teacherLoadError, refreshTeachers } = useHOD()
  const showToast = useToast()
  const [activeTab, setActiveTab] = useState('approved')
  const [searchQuery, setSearchQuery] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertTarget, setAlertTarget] = useState(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertType, setAlertType] = useState('reminder')
  const [sendingAlert, setSendingAlert] = useState(false)

  const approvedTeachers = teachers.filter(teacher => teacher.status === 'approved')
  const pendingTeachers = teachers.filter(teacher => teacher.status === 'pending')
  const filteredApproved = useMemo(() => approvedTeachers.filter(teacher => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = teacher.name.toLowerCase().includes(query) || (teacher.subject || '').toLowerCase().includes(query)
    const matchesSem = semesterFilter === 'all' || teacher.semester === Number.parseInt(semesterFilter, 10)
    return matchesSearch && matchesSem
  }), [approvedTeachers, searchQuery, semesterFilter])

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedTeacher(null)
  }
  const closeAlertModal = () => {
    setShowAlertModal(false)
    setAlertTarget(null)
    setAlertMessage('')
    setAlertType('reminder')
  }
  const reviewTeacher = async (teacher, action) => {
    const isApprove = action === 'approve'
    const confirmation = isApprove
      ? `Approve ${teacher.name} as a teacher?`
      : `Reject ${teacher.name}? This cannot be undone.`
    if (!window.confirm(confirmation)) return
    try {
      if (isApprove) {
        await approveTeacher(teacher.id)
        showToast(`${teacher.name} approved successfully ✅`, 'success')
        setActiveTab('approved')
      } else {
        await rejectTeacher(teacher.id)
        showToast(`${teacher.name} has been rejected`, 'warning')
      }
    } catch (error) {
      showToast(error.message || 'Unable to update this teacher.', 'error')
    }
  }
  const sendAlert = async () => {
    if (!alertTarget || alertMessage.trim().length < 5 || sendingAlert) return
    setSendingAlert(true)
    try {
      await saveAlert({ teacher_id: alertTarget.id, message: alertMessage.trim(), type: alertType })
      notifyTeacherAlert(alertTarget.id, alertMessage.trim(), alertType)
      showToast(`Alert sent to ${alertTarget.name} 📨`, 'success')
      closeAlertModal()
    } catch (error) {
      showToast(error.message || 'Failed to send alert.', 'error')
    } finally {
      setSendingAlert(false)
    }
  }

  const viewTeacherDetails = async teacher => {
    try {
      const detail = await getTeacherDetail(teacher.id)
      const sessions = (detail.sessions || []).map(session => {
        const duration = session.ended_at && session.created_at
          ? Math.max(0, Math.round((new Date(session.ended_at) - new Date(session.created_at)) / 60000))
          : 0
        return {
          id: session.id,
          roomCode: session.code,
          date: session.created_at,
          duration,
          studentsPresent: Number(session.students_present || 0),
          totalStudents: Number(session.students_present || 0),
          notesCount: Number(session.notes_count || 0),
          examsConducted: Number(session.exams_count || 0),
        }
      })
      const durations = sessions.filter(session => session.duration > 0).map(session => session.duration)
      setSelectedTeacher({
        ...teacher,
        email: detail.email || teacher.email,
        employeeId: detail.employee_id || teacher.employeeId,
        totalClasses: sessions.length,
        avgDuration: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
        totalStudentsTaught: '—',
        totalNotesPushed: sessions.reduce((sum, session) => sum + session.notesCount, 0),
        sessions,
        examsConducted: (detail.exams || []).map(exam => ({
          id: exam.id,
          title: exam.title,
          date: exam.launched_at,
          avgScore: exam.avg_score == null ? 0 : Math.round(Number(exam.avg_score)),
          totalStudents: Number(exam.total_students || 0),
        })),
      })
      setShowDetailModal(true)
    } catch (error) {
      showToast(error.message || 'Failed to load teacher details.', 'error')
    }
  }

  const cardStyle = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }
  const buttonBase = { border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

  if (loadingTeachers) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12, color: 'var(--muted)' }}><div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTop: '3px solid var(--indigo)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><span style={{ fontSize: 13 }}>Loading teachers...</span></div>

  return (
    <div>
      <style>{`
        .teachers-row:hover { background: var(--bg); }
        .teachers-view:hover { background: var(--indigo) !important; color: white !important; }
        .teachers-alert:hover { border-color: var(--amber) !important; color: var(--amber) !important; }
        .teachers-tab:hover:not([aria-selected="true"]) { background: var(--bg); color: var(--text); }
        .teachers-action:hover { opacity: 0.9; }
        @media (max-width: 760px) { .teachers-header { align-items: flex-start !important; flex-direction: column; } .teachers-filter { align-items: stretch !important; flex-direction: column; } .teachers-filter select { width: 100% !important; } }
      `}</style>

      {teacherLoadError && <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--red-light)', color: 'var(--red)', fontSize: 13 }}>{teacherLoadError} <button type="button" onClick={() => refreshTeachers().catch(() => {})} style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Retry</button></div>}

      <header className="teachers-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Department Teachers</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>Computer Science &amp; Engineering · {approvedTeachers.length} approved · {pendingTeachers.length} pending</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ minWidth: 100, padding: '10px 16px', borderRadius: 8, background: 'var(--indigo-light)' }}><div style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--indigo)' }}>{approvedTeachers.length}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Approved</div></div>
          <div style={{ minWidth: 100, padding: '10px 16px', borderRadius: 8, background: 'var(--amber-light)' }}><div style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--amber)' }}>{pendingTeachers.length}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Pending</div></div>
        </div>
      </header>

      <div role="tablist" aria-label="Teacher status" style={{ display: 'flex', gap: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, marginBottom: 20 }}>
        <button className="teachers-tab" type="button" role="tab" aria-selected={activeTab === 'approved'} onClick={() => setActiveTab('approved')} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, background: activeTab === 'approved' ? 'var(--indigo)' : 'transparent', color: activeTab === 'approved' ? 'white' : 'var(--muted)' }}>Approved Teachers ({approvedTeachers.length})</button>
        <button className="teachers-tab" type="button" role="tab" aria-selected={activeTab === 'pending'} onClick={() => setActiveTab('pending')} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, background: activeTab === 'pending' ? 'var(--indigo)' : 'transparent', color: activeTab === 'pending' ? 'white' : 'var(--muted)' }}>
          Pending Approval{pendingTeachers.length > 0 && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 20, background: activeTab === 'pending' ? 'rgba(255,255,255,0.2)' : 'var(--amber-light)', color: activeTab === 'pending' ? 'white' : 'var(--amber)', fontSize: 11 }}>{pendingTeachers.length}</span>}
        </button>
      </div>

      {activeTab === 'approved' ? (
        <>
          <div className="teachers-filter" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 16, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <label style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔍</span>
              <input aria-label="Search teachers by name or subject" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search by name or subject..." style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px 9px 36px', fontSize: 13, outlineColor: 'var(--indigo)' }} />
            </label>
            <select aria-label="Filter by semester" value={semesterFilter} onChange={event => setSemesterFilter(event.target.value)} style={{ width: 160, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)' }}>
              <option value="all">All Semesters</option><option value="3">Semester 3</option><option value="4">Semester 4</option><option value="5">Semester 5</option><option value="6">Semester 6</option>
            </select>
            <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--muted)' }}>{filteredApproved.length} teachers</span>
          </div>

          <div style={cardStyle}>
            {filteredApproved.length === 0 ? <EmptyState icon="👨‍🏫" title="No teachers found" description="Try adjusting your search or filters" /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 930, borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Teacher', 'Subject', 'Sem', 'Classes', 'Avg Duration', 'Last Active', 'Actions'].map(label => <th key={label} style={tableHead}>{label}</th>)}</tr></thead>
                  <tbody>
                    {filteredApproved.map(teacher => {
                      const age = teacher.lastActive ? Math.floor((new Date() - new Date(teacher.lastActive)) / 86400000) : Infinity
                      const activityColor = age <= 3 ? 'var(--green)' : age <= 7 ? 'var(--amber)' : 'var(--muted)'
                      return (
                        <tr className="teachers-row" key={teacher.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                          <td style={tableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar teacher={teacher} /><div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{teacher.name}</div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{teacher.email}</div></div></div></td>
                          <td style={tableCell}><span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12, fontWeight: 500 }}>{teacher.subject}</span></td>
                          <td style={{ ...tableCell, color: 'var(--text2)' }}>Sem {teacher.semester}</td>
                          <td style={{ ...tableCell, fontFamily: monoFont, whiteSpace: 'nowrap' }}>{teacher.totalClasses} classes</td>
                          <td style={{ ...tableCell, fontFamily: monoFont }}>{teacher.avgDuration > 0 ? `${teacher.avgDuration} mins` : '—'}</td>
                          <td style={{ ...tableCell, color: activityColor, whiteSpace: 'nowrap' }}>{getRelativeTime(teacher.lastActive)}</td>
                          <td style={tableCell}><div style={{ display: 'flex', gap: 6 }}>
                            <button className="teachers-view" type="button" onClick={() => viewTeacherDetails(teacher)} style={{ ...buttonBase, background: 'var(--indigo-light)', color: 'var(--indigo)' }}>View Details</button>
                            <button className="teachers-alert" type="button" onClick={() => { setAlertTarget(teacher); setShowAlertModal(true) }} style={{ ...buttonBase, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>Send Alert</button>
                          </div></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={cardStyle}>
          {pendingTeachers.length === 0 ? <EmptyState icon="✅" title="No pending approvals" description="All teacher applications have been reviewed." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 790, borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Teacher', 'Employee ID', 'Subject', 'Sem', 'Applied On', 'Actions'].map(label => <th key={label} style={tableHead}>{label}</th>)}</tr></thead>
                <tbody>
                  {pendingTeachers.map(teacher => (
                    <tr className="teachers-row" key={teacher.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                      <td style={tableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar teacher={teacher} /><div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{teacher.name}</div><div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>{teacher.email}</div></div></div></td>
                      <td style={{ ...tableCell, fontFamily: monoFont, color: 'var(--text2)' }}>{teacher.employeeId}</td>
                      <td style={tableCell}><span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12 }}>{teacher.subject}</span></td>
                      <td style={{ ...tableCell, color: 'var(--text2)' }}>Sem {teacher.semester}</td>
                      <td style={{ ...tableCell, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{teacher.joinedDate ? new Date(teacher.joinedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td style={tableCell}><div style={{ display: 'flex', gap: 8 }}>
                        <button className="teachers-action" type="button" onClick={() => reviewTeacher(teacher, 'approve')} style={{ ...buttonBase, padding: '6px 14px', background: 'var(--green)', color: 'white' }}>✅ Approve</button>
                        <button className="teachers-action" type="button" onClick={() => reviewTeacher(teacher, 'reject')} style={{ ...buttonBase, padding: '6px 14px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)' }}>❌ Reject</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showDetailModal} onClose={closeDetailModal} title="Teacher Profile" size="lg">
        <TeacherDetail teacher={selectedTeacher} />
      </Modal>

      <Modal isOpen={showAlertModal} onClose={closeAlertModal} title="Send Alert" size="sm">
        {alertTarget && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, marginBottom: 20, borderRadius: 8, background: 'var(--bg)' }}>
              <Avatar teacher={alertTarget} size={32} />
              <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{alertTarget.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{alertTarget.subject} · Semester {alertTarget.semester}</div></div>
            </div>
            <label htmlFor="alert-type" style={formLabel}>ALERT TYPE</label>
            <select id="alert-type" value={alertType} onChange={event => setAlertType(event.target.value)} style={{ ...formControl, marginBottom: 16 }}>
              <option value="reminder">📌 Reminder</option><option value="warning">⚠️ Warning</option><option value="urgent">🚨 Urgent</option>
            </select>
            <label htmlFor="alert-message" style={formLabel}>MESSAGE</label>
            <textarea id="alert-message" maxLength={200} value={alertMessage} onChange={event => setAlertMessage(event.target.value)} placeholder={`Type your message to ${alertTarget.name}...`} style={{ ...formControl, height: 100, padding: '10px 12px', resize: 'none', fontFamily: 'Inter, sans-serif' }} />
            <div style={{ marginTop: 4, textAlign: 'right', fontSize: 11, color: 'var(--muted)' }}>{alertMessage.length}/200 characters</div>
            <button type="button" onClick={sendAlert} disabled={alertMessage.trim().length < 5 || sendingAlert} style={{ width: '100%', marginTop: 20, padding: 11, background: 'var(--indigo)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: alertMessage.trim().length < 5 || sendingAlert ? 'not-allowed' : 'pointer', opacity: alertMessage.trim().length < 5 || sendingAlert ? 0.5 : 1 }}>{sendingAlert ? 'Sending…' : 'Send Alert'}</button>
          </>
        )}
      </Modal>

    </div>
  )
}

const tableHead = { padding: '11px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' }
const tableCell = { padding: '13px 16px', fontSize: 13, color: 'var(--text)' }
const formLabel = { display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.05em' }
const formControl = { display: 'block', width: '100%', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--white)', outlineColor: 'var(--indigo)' }
