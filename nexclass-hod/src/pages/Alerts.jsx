import { useMemo, useState, useEffect } from 'react'
import { getStudents, getRooms, sendAlert as saveAlert } from '../api'
import { useToast } from '../components/AlertToast'
import { useHOD } from '../context/HODContext'

const typeStyles = {
  reminder: { label: 'Reminder', icon: '📌', color: 'var(--blue)', bg: 'var(--blue-light)' },
  warning: { label: 'Warning', icon: '⚠️', color: 'var(--amber)', bg: 'var(--amber-light)' },
  urgent: { label: 'Urgent', icon: '🚨', color: 'var(--red)', bg: 'var(--red-light)' },
}

const baseButton = {
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

const cardStyle = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow)',
  overflow: 'hidden',
}

const templates = [
  'Submit exam results by Friday.',
  "Please share today's session notes.",
  'Attendance report needed for this week.',
]

function TypeBadge({ type }) {
  const style = typeStyles[type] || typeStyles.reminder
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', background: style.bg, color: style.color, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
      {style.label}
    </span>
  )
}

function SectionHeader({ children, right }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{children}</h2>
      {right}
    </div>
  )
}

export default function Alerts() {
  const showToast = useToast()
  const { teachers, notifyTeacherAlert } = useHOD()
  const [students, setStudents] = useState([])
  const [rooms, setRooms] = useState([])
  const [alertHistory, setAlertHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeacher, setSelectedTeacher] = useState('all')
  const [alertType, setAlertType] = useState('reminder')
  const [alertMessage, setAlertMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')

  const approvedTeachers = teachers.filter(t => t.status === 'approved')
  useEffect(() => {
    let active = true
    Promise.all([getStudents(), getRooms()])
      .then(([studentRows, roomRows]) => {
        if (!active) return
        setStudents(Array.isArray(studentRows) ? studentRows : [])
        setRooms(Array.isArray(roomRows) ? roomRows : [])
      })
      .catch(error => { if (active) showToast(error.message || 'Failed to load alert context.', 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [showToast])

  const studentsWithAttendance = useMemo(() => students.map(student => {
    const sessions = rooms.filter(room => Number(room.semester) === Number(student.semester)).length
    const attendance = sessions ? Math.min(100, Math.round(Number(student.classes_attended || 0) / sessions * 100)) : 0
    return { ...student, attendance_pct: attendance }
  }), [students, rooms])
  const atRiskStudents = studentsWithAttendance.filter(student => student.attendance_pct > 0 && student.attendance_pct < 75)
  const pendingTeachers = teachers.filter(teacher => teacher.status === 'pending')

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return alertHistory
    return alertHistory.filter(alert => alert.type === historyFilter)
  }, [alertHistory, historyFilter])

  const autoAlerts = useMemo(() => {
    const alerts = []

    atRiskStudents.forEach(student => {
      alerts.push({
        id: `auto-${student.id}`,
        type: student.attendance_pct < 60 ? 'urgent' : 'warning',
        category: 'attendance',
        message: `${student.name} (${student.usn}) has only ${student.attendance_pct}% attendance in Semester ${student.semester}. Minimum 75% required.`,
        student: student.name,
        action: 'View Student',
      })
    })

    if (pendingTeachers.length > 0) {
      alerts.push({
        id: 'auto-pending',
        type: 'warning',
        category: 'approval',
        message: `${pendingTeachers.length} teacher application${pendingTeachers.length > 1 ? 's' : ''} pending your approval in the department.`,
        action: 'Review Teachers',
      })
    }

    approvedTeachers.forEach(teacher => {
      if (!teacher.lastActive) return
      const daysSince = Math.floor((new Date() - new Date(teacher.lastActive)) / (1000 * 60 * 60 * 24))
      if (daysSince > 7) {
        alerts.push({
          id: `auto-inactive-${teacher.id}`,
          type: 'reminder',
          category: 'inactivity',
          message: `${teacher.name} hasn't conducted a session in ${daysSince} days. Subject: ${teacher.subject}.`,
          action: 'View Teacher',
        })
      }
    })

    return alerts
  }, [studentsWithAttendance, rooms, pendingTeachers, approvedTeachers])

  const urgentCount = autoAlerts.filter(alert => alert.type === 'urgent').length
  const warningCount = autoAlerts.filter(alert => alert.type === 'warning').length
  const hasHistoryFilter = historyFilter !== 'all'
  const messageTooLong = alertMessage.length > 250

  const handleSendAlert = async () => {
    if (alertMessage.trim().length < 5 || isSending) return
    setIsSending(true)
    try {
      const recipientName = selectedTeacher === 'all'
        ? 'All Teachers'
        : approvedTeachers.find(teacher => teacher.id === parseInt(selectedTeacher, 10))?.name || 'Unknown'
      const recipients = selectedTeacher === 'all'
        ? approvedTeachers
        : approvedTeachers.filter(teacher => teacher.id === parseInt(selectedTeacher, 10))
      if (!recipients.length) throw new Error('No approved teachers are available to receive this alert.')

      for (const teacher of recipients) {
        await saveAlert({ teacher_id: teacher.id, message: alertMessage.trim(), type: alertType })
        notifyTeacherAlert(teacher.id, alertMessage.trim(), alertType)
      }
      const newAlert = {
        id: Date.now(),
        to: recipientName,
        teacherId: selectedTeacher === 'all' ? null : parseInt(selectedTeacher, 10),
        message: alertMessage.trim(),
        sentAt: new Date().toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
        type: alertType,
      }

      setAlertHistory(previous => [newAlert, ...previous])
      setAlertMessage('')
      setSelectedTeacher('all')
      setAlertType('reminder')
      showToast(`Alert sent to ${recipientName} 📨`, 'success')
    } catch (error) {
      showToast(error.message || 'Failed to send alert.', 'error')
    } finally {
      setIsSending(false)
    }
  }

  const categoryLabel = category => ({
    attendance: '👨‍🎓 Student Attendance',
    approval: '👨‍🏫 Teacher Approval',
    inactivity: '📅 Teacher Inactivity',
  }[category] || 'System Alert')

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--muted)', fontSize: 13 }}>Loading alert data...</div>

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text)' }}>
      <style>{`@keyframes alertPulse { 0%, 100% { opacity: 1 } 50% { opacity: .7 } } @media (max-width: 1050px) { .alerts-layout { grid-template-columns: 1fr !important; } .alerts-form-card { position: static !important; } } @media (max-width: 620px) { .alerts-header { align-items: flex-start !important; flex-direction: column !important; } .alerts-header-pills { flex-wrap: wrap; } .alerts-history-header { align-items: flex-start !important; flex-direction: column !important; } .alerts-history-filters { flex-wrap: wrap; } }`}</style>

      <header className="alerts-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 20, fontWeight: 800 }}>Alerts &amp; Notifications</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{autoAlerts.length} system alerts · {alertHistory.length} sent</p>
        </div>
        <div className="alerts-header-pills" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {urgentCount > 0 && <span style={{ background: 'var(--red-light)', color: 'var(--red)', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20, animation: 'alertPulse 2s infinite' }}>🚨 {urgentCount} Urgent</span>}
          {warningCount > 0 && <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>⚠️ {warningCount} Warnings</span>}
        </div>
      </header>

      <div className="alerts-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(0, 1.4fr)', gap: 20, alignItems: 'start' }}>
        <section className="alerts-form-card" style={{ ...cardStyle, position: 'sticky', top: 76 }}>
          <SectionHeader>📨 Send Alert</SectionHeader>
          <div style={{ padding: 20 }}>
            <label htmlFor="alert-recipient" style={fieldLabel}>SEND TO</label>
            <select id="alert-recipient" value={selectedTeacher} onChange={event => setSelectedTeacher(event.target.value)} style={fieldStyle}>
              <option value="all">📢 All Teachers ({approvedTeachers.length})</option>
              {approvedTeachers.map(teacher => <option value={teacher.id} key={teacher.id}>{teacher.initials} {teacher.name}</option>)}
            </select>

            <div style={{ ...fieldLabel, marginTop: 0 }}>ALERT TYPE</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['reminder', 'warning', 'urgent'].map(type => {
                const config = typeStyles[type]
                const active = alertType === type
                return (
                  <button key={type} type="button" aria-pressed={active} onClick={() => setAlertType(type)} style={{ ...baseButton, flex: 1, padding: '8px 4px', borderColor: active ? config.color : 'var(--border)', background: active ? config.bg : 'transparent', color: active ? config.color : 'var(--muted)', fontSize: 12, fontWeight: 600, whiteSpace: 'pre-line', transition: 'all .15s' }}>
                    {config.icon}{'\n'}{config.label}
                  </button>
                )
              })}
            </div>

            <label htmlFor="alert-message" style={fieldLabel}>MESSAGE</label>
            <textarea
              id="alert-message"
              value={alertMessage}
              maxLength={300}
              onChange={event => setAlertMessage(event.target.value)}
              placeholder={{ reminder: 'Type a reminder message...', warning: 'Type a warning message...', urgent: 'Type an urgent notice...' }[alertType]}
              style={{ ...fieldStyle, height: 120, resize: 'none', background: 'var(--white)', fontFamily: 'Inter, sans-serif' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
              <span style={{ color: alertMessage.length > 0 && alertMessage.trim().length < 5 ? 'var(--red)' : 'transparent' }}>
                {alertMessage.length > 0 && alertMessage.trim().length < 5 ? '⚠️ Message too short (min 5 chars)' : ' '}
              </span>
              <span style={{ color: messageTooLong ? 'var(--red)' : 'var(--muted)' }}>{alertMessage.length}/300</span>
            </div>

            <button type="button" onClick={handleSendAlert} disabled={alertMessage.trim().length < 5 || isSending} style={{ width: '100%', marginTop: 16, padding: 11, borderRadius: 8, border: 'none', background: alertMessage.trim().length < 5 || isSending ? 'var(--border)' : 'var(--indigo)', color: alertMessage.trim().length < 5 || isSending ? 'var(--muted2)' : '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: alertMessage.trim().length < 5 || isSending ? 'not-allowed' : 'pointer', transition: 'all .15s' }}>
              {isSending ? 'Sending... ⏳' : 'Send Alert →'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 10px', color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <span style={divider} />Quick Templates<span style={divider} />
            </div>
            {templates.map(template => (
              <button key={template} type="button" onClick={() => setAlertMessage(template)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', marginBottom: 6 }} onMouseEnter={event => Object.assign(event.currentTarget.style, { borderColor: 'var(--indigo)', color: 'var(--indigo)', background: 'var(--indigo-light)' })} onMouseLeave={event => Object.assign(event.currentTarget.style, { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--bg)' })}>{template}</button>
            ))}
          </div>
        </section>

        <div>
          <section style={{ ...cardStyle, marginBottom: 20 }}>
            <SectionHeader right={<span style={{ background: urgentCount > 0 ? 'var(--red-light)' : 'var(--amber-light)', color: urgentCount > 0 ? 'var(--red)' : 'var(--amber)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{autoAlerts.length} alerts</span>}>🤖 System Alerts</SectionHeader>
            {autoAlerts.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--green)' }}>✅ No system alerts at this time</div>
            ) : autoAlerts.map((alert, index) => {
              const typeStyle = typeStyles[alert.type]
              return (
                <div key={alert.id} style={{ padding: '14px 20px', borderBottom: index === autoAlerts.length - 1 ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: typeStyle.bg, color: typeStyle.color, fontSize: 16 }}>{typeStyle.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{alert.message}</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{categoryLabel(alert.category)}</div>
                  </div>
                  <div style={{ flexShrink: 0, marginTop: 2 }}><TypeBadge type={alert.type} /></div>
                </div>
              )
            })}
          </section>

          <section style={cardStyle}>
            <div className="alerts-history-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700 }}>📋 Alert History</h2>
              <div className="alerts-history-filters" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {['all', 'reminder', 'warning', 'urgent'].map(filter => {
                  const active = historyFilter === filter
                  const config = typeStyles[filter]
                  const activeColor = filter === 'all' ? 'var(--indigo)' : config.color
                  const activeBg = filter === 'all' ? 'var(--indigo-light)' : config.bg
                  return <button key={filter} type="button" aria-pressed={active} onClick={() => setHistoryFilter(filter)} style={{ ...baseButton, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, borderColor: active ? activeColor : 'var(--border)', background: active ? activeBg : 'transparent', color: active ? activeColor : 'var(--muted)' }}>{filter === 'all' ? 'All' : config.label}</button>
                })}
              </div>
            </div>
            {filteredHistory.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>{hasHistoryFilter ? '📭 No alerts match this filter' : '📭 No alerts sent yet'}</div>
            ) : filteredHistory.map((alert, index) => {
              const config = typeStyles[alert.type] || typeStyles.reminder
              return (
                <div key={alert.id} style={{ padding: '14px 20px', borderBottom: index === filteredHistory.length - 1 ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'stretch', gap: 12 }}>
                  <span aria-hidden="true" style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: config.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>To:</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{alert.to}</span>
                      <TypeBadge type={alert.type} />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{alert.message}</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted2)', fontFamily: '"JetBrains Mono", monospace' }}>📅 {alert.sentAt}</div>
                  </div>
                  <button type="button" aria-label={`Remove alert sent to ${alert.to}`} onClick={() => { setAlertHistory(previous => previous.filter(item => item.id !== alert.id)); showToast('Alert removed', 'info') }} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 14, padding: 4 }} onMouseEnter={event => { event.currentTarget.style.color = 'var(--red)' }} onMouseLeave={event => { event.currentTarget.style.color = 'var(--muted2)' }}>✕</button>
                </div>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}

const fieldLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  marginBottom: 7,
}

const fieldStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg)',
  border: '1.5px solid var(--border2)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text)',
  marginBottom: 16,
  outlineColor: 'var(--indigo)',
}

const divider = { flex: 1, height: 1, background: 'var(--border)' }
