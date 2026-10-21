import { useState, useMemo, useEffect } from 'react'
import { getRooms, getRoomDetail, getTeachers, getStudents } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/AlertToast'

const headingFont = '"Plus Jakarta Sans", sans-serif'
const monoFont = '"JetBrains Mono", monospace'
const formatDate = dateStr => new Date(dateStr).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const getRateColor = (present, total) => {
  const rate = total > 0 ? present / total : 0
  return rate >= 0.8 ? 'var(--green)' : rate >= 0.6 ? 'var(--amber)' : 'var(--red)'
}

const getScoreColor = score => score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

function StatusBadge({ status }) {
  const completed = status === 'completed'
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: completed ? 'var(--green-light)' : 'var(--blue-light)', color: completed ? 'var(--green)' : 'var(--blue)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{completed ? '✓ Completed' : '● Active'}</span>
}

function Initials({ name }) {
  const initials = (name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return initials || '—'
}

function SessionDetail({ session }) {
  if (!session) return null
  const s = session
  const attendance = s.attendance || []
  const notes = s.notes || []
  const exams = s.exams || []
  const presentCount = attendance.filter(person => person.status === 'present').length
  const absentCount = attendance.filter(person => person.status === 'absent').length
  const infoItems = [
    ['Room Code', s.roomCode, { fontFamily: monoFont, color: 'var(--indigo)' }],
    ['Subject', s.subject],
    ['Teacher', s.teacher.replace('Prof. ', 'Prof.\n')],
    ['Date & Time', formatDate(s.date)],
    ['Semester', `Semester ${s.semester}`],
    ['Duration', s.duration ? `${s.duration} minutes` : s.status === 'active' ? 'Ongoing' : '—'],
    ['Students', `${s.studentsPresent} / ${s.totalStudents}`, { color: getRateColor(s.studentsPresent, s.totalStudents) }],
    ['Status', <StatusBadge key="session-status" status={s.status} />],
  ]

  const attendanceTone = status => status === 'present'
    ? { background: 'var(--green-light)', color: 'var(--green)' }
    : status === 'late'
      ? { background: 'var(--amber-light)', color: 'var(--amber)' }
      : { background: 'var(--red-light)', color: 'var(--red)' }

  return (
    <>
      <section className="session-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, padding: '16px 20px', marginBottom: 20, borderRadius: 10, background: 'var(--bg)' }}>
        {infoItems.map(([label, value, valueStyle]) => <div key={label} style={{ minWidth: 0 }}><div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div><div style={{ whiteSpace: 'pre-line', fontSize: 14, fontWeight: 600, color: 'var(--text)', ...valueStyle }}>{value}</div></div>)}
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h3 style={sectionTitle}>Attendance</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ padding: '3px 8px', borderRadius: 20, background: 'var(--green-light)', color: 'var(--green)', fontSize: 11, fontWeight: 700 }}>{presentCount} Present</span>
            <span style={{ padding: '3px 8px', borderRadius: 20, background: 'var(--red-light)', color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>{absentCount} Absent</span>
          </div>
        </div>
        {attendance.length === 0 ? <p style={mutedText}>Detailed attendance not available for this session.</p> : (
          <div className="session-attendance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {attendance.map((person, index) => {
              const tone = attendanceTone(person.status)
              return <div key={`${person.usn}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                <div aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: tone.background, color: tone.color, fontSize: 10, fontWeight: 700 }}><Initials name={person.name} /></div>
                <div style={{ minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{person.name}</div><div style={{ marginTop: 2, fontFamily: monoFont, fontSize: 11, color: 'var(--muted)' }}>{person.usn}</div></div>
                <span style={{ ...tone, marginLeft: 'auto', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{person.status}</span>
              </div>
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <h3 style={{ ...sectionTitle, marginBottom: 12 }}>Notes Pushed</h3>
        {notes.length === 0 ? <p style={mutedText}>No notes were pushed in this session.</p> : notes.map((note, index) => <div key={`${index}-${note}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <span aria-hidden="true" style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 11, fontWeight: 700 }}>{index + 1}</span>
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>{note}</span>
        </div>)}
      </section>

      <section style={{ marginTop: 20 }}>
        <h3 style={{ ...sectionTitle, marginBottom: 12 }}>Exams Conducted</h3>
        {exams.length === 0 ? <p style={mutedText}>No exams were conducted in this session.</p> : exams.map((exam, index) => <div key={`${exam.title}-${index}`} style={{ padding: '14px 16px', marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 16 }}>📝</span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{exam.title}</div><div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>Avg Score: {exam.avgScore}%</div></div>
            <div style={{ fontFamily: headingFont, fontSize: 24, fontWeight: 800, color: getScoreColor(exam.avgScore) }}>{exam.avgScore}%</div>
          </div>
          <div style={{ height: 4, marginTop: 10, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${Math.max(0, Math.min(100, exam.avgScore || 0))}%`, height: '100%', borderRadius: 2, background: getScoreColor(exam.avgScore) }} /></div>
        </div>)}
      </section>
    </>
  )
}

const sectionTitle = { margin: 0, fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }
const mutedText = { padding: '16px 0', fontSize: 13, color: 'var(--muted)' }

export default function SessionLogs() {
  const showToast = useToast()
  const [rooms, setRooms] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSession, setSelectedSession] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getRooms(), getTeachers(), getStudents()])
      .then(([roomRows, teacherRows, studentRows]) => {
        if (!active) return
        const cohortCount = new Map()
        ;(studentRows || []).forEach(student => cohortCount.set(Number(student.semester), (cohortCount.get(Number(student.semester)) || 0) + 1))
        setRooms((roomRows || []).map(room => {
          const duration = room.ended_at && room.created_at ? Math.max(0, Math.round((new Date(room.ended_at) - new Date(room.created_at)) / 60000)) : null
          return { ...room, roomCode: room.code, teacher: room.teacher_name || '—', teacherId: room.teacher_id, date: room.created_at, duration, studentsPresent: Number(room.students_present || 0), totalStudents: cohortCount.get(Number(room.semester)) || 0, notesCount: Number(room.notes_count || 0), examsConducted: Number(room.exams_count || 0) }
        }))
        setTeachers(Array.isArray(teacherRows) ? teacherRows : [])
        setStudents(Array.isArray(studentRows) ? studentRows : [])
      })
      .catch(error => { if (active) showToast(error.message || 'Failed to load session logs.', 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [showToast])

  const filteredSessions = useMemo(() => rooms.filter(session => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = session.roomCode.toLowerCase().includes(query)
      || session.subject.toLowerCase().includes(query)
      || session.teacher.toLowerCase().includes(query)
    const matchesTeacher = teacherFilter === 'all' || session.teacherId === Number.parseInt(teacherFilter, 10)
    const matchesSem = semesterFilter === 'all' || session.semester === Number.parseInt(semesterFilter, 10)
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter
    return matchesSearch && matchesTeacher && matchesSem && matchesStatus
  }), [rooms, searchQuery, teacherFilter, semesterFilter, statusFilter])

  const clearFilters = () => {
    setSearchQuery('')
    setTeacherFilter('all')
    setSemesterFilter('all')
    setStatusFilter('all')
  }
  const closeModal = () => {
    setShowDetailModal(false)
    setSelectedSession(null)
  }
  const hasActiveFilters = Boolean(searchQuery) || teacherFilter !== 'all' || semesterFilter !== 'all' || statusFilter !== 'all'
  const approvedTeachers = teachers.filter(teacher => teacher.status === 'approved')
  const completedCount = rooms.filter(session => session.status === 'completed').length
  const totalExams = rooms.reduce((sum, session) => sum + session.examsConducted, 0)
  const openSessionDetails = async session => {
    setSelectedSession(session)
    setShowDetailModal(true)
    setDetailLoading(true)
    try {
      const detail = await getRoomDetail(session.code)
      setSelectedSession({
        ...session,
        ...detail,
        roomCode: detail.code,
        teacher: detail.teacher_name || session.teacher,
        date: detail.created_at,
        duration: detail.ended_at && detail.created_at ? Math.max(0, Math.round((new Date(detail.ended_at) - new Date(detail.created_at)) / 60000)) : null,
        studentsPresent: Number(detail.students_present || 0),
        totalStudents: session.totalStudents,
        attendance: detail.attendance || [],
        notes: (detail.notes || []).map(note => note.content),
        exams: (detail.exams || []).map(exam => ({ ...exam, avgScore: exam.avg_score == null ? 0 : Math.round(Number(exam.avg_score)) })),
      })
    } catch (error) {
      showToast(error.message || 'Failed to load session details.', 'error')
      setShowDetailModal(false)
    } finally {
      setDetailLoading(false)
    }
  }
  const tableHead = { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }
  const tableCell = { padding: '13px 16px', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--muted)', fontSize: 13 }}>Loading session logs...</div>

  return (
    <div>
      <style>{`
        .session-log-row:hover { background: var(--bg); }
        .session-log-row:last-child { border-bottom: 0 !important; }
        .session-clear:hover { border-color: var(--red) !important; color: var(--red) !important; }
        .session-empty-clear:hover { text-decoration: underline; }
        @media (max-width: 1000px) { .session-logs-header { align-items: flex-start !important; flex-direction: column; } .session-summary { flex-wrap: wrap; } }
      `}</style>

      <header className="session-logs-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div><h1 style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Session Logs</h1><p style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>{rooms.length} total sessions recorded</p></div>
        <div className="session-summary" style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{rooms.length} Sessions</span>
          <span style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--green-light)', color: 'var(--green)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{completedCount} Completed</span>
          <span style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{totalExams} Exams</span>
        </div>
      </header>

      <div className="session-filter-bar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '14px 16px', marginBottom: 16, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <label style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔍</span>
          <input aria-label="Search sessions" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search by room code, subject or teacher..." style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, outlineColor: 'var(--indigo)' }} />
        </label>
        <select aria-label="Filter by teacher" value={teacherFilter} onChange={event => setTeacherFilter(event.target.value)} style={{ width: 180, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}>
          <option value="all">All Teachers</option>{approvedTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name.replace('Prof. ', 'Prof. ')}</option>)}
        </select>
        <select aria-label="Filter by semester" value={semesterFilter} onChange={event => setSemesterFilter(event.target.value)} style={{ width: 150, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}>
          <option value="all">All Semesters</option><option value="3">Semester 3</option><option value="4">Semester 4</option><option value="5">Semester 5</option>
        </select>
        <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={{ width: 140, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}>
          <option value="all">All Status</option><option value="completed">Completed</option><option value="active">Active</option>
        </select>
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 12, color: 'var(--muted)' }}>Showing {filteredSessions.length} of {rooms.length} sessions</span>
        {hasActiveFilters && <button className="session-clear" type="button" onClick={clearFilters} style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>✕ Clear</button>}
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {filteredSessions.length === 0 ? <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ fontSize: 40 }}>📋</div><h2 style={{ marginTop: 12, fontFamily: headingFont, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No sessions found</h2><p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>Try adjusting your search or filters</p>
          {hasActiveFilters && <button className="session-empty-clear" type="button" onClick={clearFilters} style={{ marginTop: 12, border: 0, background: 'transparent', color: 'var(--indigo)', fontSize: 13, cursor: 'pointer' }}>Clear all filters →</button>}
        </div> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1230, borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Room Code', 'Subject', 'Teacher', 'Sem', 'Date', 'Duration', 'Students', 'Notes', 'Exams', 'Status'].map(label => <th key={label} style={tableHead}>{label}</th>)}</tr></thead>
            <tbody>
              {filteredSessions.map(session => {
                const rate = session.totalStudents > 0 ? session.studentsPresent / session.totalStudents : 0
                const rateColor = getRateColor(session.studentsPresent, session.totalStudents)
                return <tr className="session-log-row" key={session.id} tabIndex={0} onClick={() => openSessionDetails(session)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSessionDetails(session) } }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}>
                  <td style={tableCell}><span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 5, background: 'var(--indigo-light)', color: 'var(--indigo)', fontFamily: monoFont, fontSize: 12, fontWeight: 600 }}>{session.roomCode}</span></td>
                  <td style={{ ...tableCell, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }} title={session.subject}>{session.subject}</td>
                  <td style={{ ...tableCell, fontSize: 12, color: 'var(--text2)' }}>{session.teacher.replace('Prof. ', '')}</td>
                  <td style={{ ...tableCell, color: 'var(--muted)', fontSize: 12 }}>Sem {session.semester}</td>
                  <td style={{ ...tableCell, fontFamily: monoFont, fontSize: 12, color: 'var(--text2)' }}>{formatDate(session.date)}</td>
                  <td style={{ ...tableCell, fontFamily: monoFont, fontSize: 12, color: 'var(--muted)' }}>{session.duration ? `${session.duration} mins` : session.status === 'active' ? 'Ongoing' : '—'}</td>
                  <td style={tableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 600, color: rateColor }}>{session.studentsPresent}/{session.totalStudents}</span><span aria-hidden="true" style={{ display: 'inline-block', width: 40, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', width: `${Math.max(0, Math.min(100, rate * 100))}%`, height: '100%', borderRadius: 2, background: rateColor }} /></span></div></td>
                  <td style={{ ...tableCell, fontSize: 12, color: 'var(--muted)' }}>{session.notesCount > 0 ? `${session.notesCount} 📝` : '—'}</td>
                  <td style={{ ...tableCell, fontSize: 12, color: 'var(--muted)' }}>{session.examsConducted > 0 ? `${session.examsConducted} 📋` : '—'}</td>
                  <td style={tableCell}><StatusBadge status={session.status} /></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>}
      </div>

      <Modal isOpen={showDetailModal} onClose={closeModal} title="Session Details" size="lg">
        {detailLoading ? <div style={{ display: 'grid', placeItems: 'center', height: 200, color: 'var(--muted)', fontSize: 13 }}>Loading session details...</div> : <SessionDetail session={selectedSession} />}
      </Modal>
    </div>
  )
}
