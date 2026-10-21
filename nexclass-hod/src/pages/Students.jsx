import { useState, useMemo, useEffect } from 'react'
import { getStudents, getStudentProfile, getRooms } from '../api'
import { useToast } from '../components/AlertToast'
import Modal from '../components/Modal'
import AttendanceRing from '../components/AttendanceRing'
import BadgeGrid, { ALL_BADGES } from '../components/BadgeGrid'

const headingFont = '"Plus Jakarta Sans", sans-serif'
const monoFont = '"JetBrains Mono", monospace'
const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')

const getAvgScore = student => {
  if (!student.exams?.length) return student.avg_score == null ? null : Math.round(Number(student.avg_score))
  const total = student.exams.reduce((sum, exam) => sum + (exam.score / exam.total) * 100, 0)
  return Math.round(total / student.exams.length)
}

const getAttColor = percentage => percentage >= 75 ? 'var(--green)' : percentage >= 60 ? 'var(--amber)' : 'var(--red)'
const getAttBg = percentage => percentage >= 75 ? 'var(--green-light)' : percentage >= 60 ? 'var(--amber-light)' : 'var(--red-light)'
const getScoreColor = score => score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

const getAvatarColor = name => {
  const colors = [
    'linear-gradient(135deg, #4F46E5, #2563EB)',
    'linear-gradient(135deg, #059669, #0891B2)',
    'linear-gradient(135deg, #D97706, #DC2626)',
    'linear-gradient(135deg, #7C3AED, #DB2777)',
    'linear-gradient(135deg, #0891B2, #059669)',
  ]
  return colors[(name || 'S').charCodeAt(0) % colors.length]
}

function StudentAvatar({ student, size = 36, fontSize = 13 }) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: getAvatarColor(student.name), color: 'white', fontSize, fontWeight: 700 }}>
      {student.initials || initials(student.name)}
    </div>
  )
}

function AttendancePill({ percentage }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: getAttBg(percentage), color: getAttColor(percentage), fontSize: 12, fontWeight: 700 }}>{percentage}%</span>
}

function ScorePill({ score }) {
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 20, background: score >= 80 ? 'var(--green-light)' : score >= 60 ? 'var(--amber-light)' : 'var(--red-light)', color: getScoreColor(score), fontSize: 12, fontWeight: 700 }}>{score}%</span>
}

function StudentProfile({ student, activeTab, onTabChange }) {
  if (!student) return null
  const s = student
  const average = getAvgScore(s)
  const classesAttended = s.attendance.subjects.reduce((sum, subject) => sum + subject.present, 0)
  const classesHeld = s.attendance.subjects.reduce((sum, subject) => sum + subject.held, 0)
  const engagementLevel = s.codeSubmissions >= 10 ? 'High' : s.codeSubmissions >= 3 ? 'Medium' : 'Low'
  const engagementColor = engagementLevel === 'High' ? 'var(--green)' : engagementLevel === 'Medium' ? 'var(--amber)' : 'var(--red)'
  const engagementDescription = engagementLevel === 'High'
    ? 'This student is actively engaged in coding activities and participates regularly.'
    : engagementLevel === 'Medium'
      ? 'This student has some coding activity. Encourage more participation.'
      : 'This student needs encouragement to participate in coding activities.'
  const tabs = [
    ['attendance', 'Attendance'],
    ['exams', 'Exam Scores'],
    ['badges', 'Badges'],
    ['activity', 'Activity'],
  ]

  return (
    <>
      <div className="student-profile-header" style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <AttendanceRing percentage={s.attendance.overall} size={90} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <h3 style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{s.name}</h3>
          <div style={{ marginTop: 4, fontFamily: monoFont, fontSize: 13, color: 'var(--indigo)' }}>{s.usn}</div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>Semester {s.semester} · {s.email}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted2)' }}>Joined {s.joinedDate ? new Date(s.joinedDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 12 }}>
            {[
              [`#${s.rank}`, 'Class Rank'],
              [s.exams.length, 'Exams Taken'],
              [s.codeSubmissions, 'Submissions'],
              [s.badges.length, 'Badges'],
            ].map(([value, label]) => <div key={label}><div style={{ fontFamily: headingFont, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{value}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div></div>)}
          </div>
        </div>
        <StudentAvatar student={s} size={64} fontSize={20} />
      </div>

      <div role="tablist" aria-label="Student profile sections" className="student-profile-tabs" style={{ display: 'flex', gap: 4, overflowX: 'auto', width: 'fit-content', maxWidth: '100%', padding: 4, marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--white)' }}>
        {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => onTabChange(key)} style={{ padding: '7px 16px', border: 0, borderRadius: 7, background: activeTab === key ? 'var(--indigo)' : 'transparent', color: activeTab === key ? 'white' : 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>)}
      </div>

      {activeTab === 'attendance' && (
        <section>
          <h3 style={sectionTitle}>Subject-wise Attendance</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 650, borderCollapse: 'collapse' }}>
              <thead><tr>{['Subject', 'Classes Held', 'Present', 'Absent', 'Late', '%'].map(label => <th key={label} style={profileTableHead}>{label}</th>)}</tr></thead>
              <tbody>
                {s.attendance.subjects.map(subject => (
                  <tr key={subject.subject} style={{ background: subject.pct < 75 ? 'var(--red-light)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                    <td style={profileTableCell}>{subject.pct < 75 && <span aria-label="Below attendance requirement" style={{ marginRight: 6 }}>⚠️</span>}{subject.subject}</td>
                    <td style={profileTableCell}>{subject.held}</td>
                    <td style={{ ...profileTableCell, color: 'var(--green)' }}>{subject.present}</td>
                    <td style={{ ...profileTableCell, color: subject.absent > 0 ? 'var(--red)' : 'var(--text2)' }}>{subject.absent}</td>
                    <td style={profileTableCell}>{subject.late}</td>
                    <td style={profileTableCell}><AttendancePill percentage={subject.pct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'exams' && (
        s.exams.length === 0 ? <div style={emptyProfile}>No exams taken yet.</div> : (
          <section>
            {average !== null && <div style={{ padding: '14px 16px', marginBottom: 16, borderRadius: 8, background: 'var(--bg)' }}>
              <div style={{ fontFamily: headingFont, fontSize: 16, fontWeight: 800, color: getScoreColor(average) }}>Overall Average: {average}%</div>
              <div style={{ height: 6, marginTop: 8, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${average}%`, height: '100%', borderRadius: 3, background: getScoreColor(average) }} /></div>
            </div>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
                <thead><tr>{['Exam', 'Subject', 'Date', 'Score', '%'].map(label => <th key={label} style={profileTableHead}>{label}</th>)}</tr></thead>
                <tbody>
                  {s.exams.map((exam, index) => {
                    const pct = exam.total ? Math.round((exam.score / exam.total) * 100) : 0
                    return <tr key={`${exam.title}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={profileTableCell}>{exam.title}</td>
                      <td style={profileTableCell}>{exam.subject}</td>
                      <td style={{ ...profileTableCell, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(`${exam.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={{ ...profileTableCell, fontFamily: monoFont, fontWeight: 700 }}>{exam.score}/{exam.total}</td>
                      <td style={profileTableCell}><ScorePill score={pct} /><div style={{ height: 3, marginTop: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${Math.max(0, Math.min(100, (exam.score / exam.total) * 100))}%`, height: '100%', background: getScoreColor(pct) }} /></div></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      {activeTab === 'badges' && (
        <section>
          <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>{s.badges.length} of {ALL_BADGES.length} badges earned</p>
          <BadgeGrid earnedBadges={s.badges} />
          {s.badges.length === 0 && <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>Encourage this student to participate more in class activities to earn badges.</p>}
        </section>
      )}

      {activeTab === 'activity' && (
        <section>
          <div className="student-activity-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
            <ActivityCard icon="💻" value={s.codeSubmissions} label="Code Submissions" subtitle={s.codeSubmissions >= 3 ? 'Active coder 🔥' : 'Needs more practice'} subtitleColor={s.codeSubmissions >= 3 ? 'var(--green)' : 'var(--amber)'} />
            <ActivityCard icon="📚" value={classesAttended} label="Classes Attended" subtitle={`Out of ${classesHeld} total`} subtitleColor="var(--muted)" />
          </div>
          <div style={{ padding: 16, marginTop: 12, borderRadius: 8, background: 'var(--bg)' }}>
            <h3 style={{ fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Engagement Level</h3>
            <div style={{ marginTop: 8, fontFamily: headingFont, fontSize: 24, fontWeight: 800, color: engagementColor }}>{engagementLevel}</div>
            <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--muted)' }}>{engagementDescription}</p>
          </div>
        </section>
      )}
    </>
  )
}

function ActivityCard({ icon, value, label, subtitle, subtitleColor }) {
  return (
    <article style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)' }}>
      <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--indigo-light)', fontSize: 16 }}>{icon}</span>
      <div style={{ marginTop: 12, fontFamily: headingFont, fontSize: 26, fontWeight: 800, lineHeight: 1, color: 'var(--text)' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: subtitleColor }}>{subtitle}</div>
    </article>
  )
}

const pageTableHead = { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }
const pageTableCell = { padding: '13px 16px', fontSize: 13, color: 'var(--text)' }
const profileTableHead = { ...pageTableHead, padding: '8px 12px', borderBottom: '1px solid var(--border)' }
const profileTableCell = { ...pageTableCell, padding: '10px 12px', color: 'var(--text2)' }
const sectionTitle = { marginBottom: 12, fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }
const emptyProfile = { padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }

export default function Students() {
  const showToast = useToast()
  const [students, setStudents] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [attendanceFilter, setAttendanceFilter] = useState('all')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [activeProfileTab, setActiveProfileTab] = useState('attendance')
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getStudents(), getRooms()])
      .then(([studentRows, roomRows]) => {
        if (!active) return
        const list = Array.isArray(studentRows) ? studentRows : []
        const roomList = Array.isArray(roomRows) ? roomRows : []
        const enriched = list.map(student => {
          const semRooms = roomList.filter(room => Number(room.semester) === Number(student.semester))
          const pct = semRooms.length ? Math.min(100, Math.round(Number(student.classes_attended || 0) / semRooms.length * 100)) : 0
          return { ...student, joinedDate: student.created_at, codeSubmissions: Number(student.code_submissions || 0), attendance_pct: pct, attendance: { overall: pct, subjects: [] }, exams: [], badges: [] }
        }).sort((a, b) => Number(b.avg_score || 0) - Number(a.avg_score || 0))
        const ranked = enriched.map((student, index) => {
          const badges = []
          if (student.attendance_pct >= 75) badges.push('Attendance Star')
          if (student.codeSubmissions >= 1) badges.push('Coding Champ')
          if (student.codeSubmissions >= 3) badges.push('Fast Learner')
          if (Number(student.best_exam_score) >= 80) badges.push('Exam Ace')
          if (Number(student.best_exam_score) === 100) badges.push('Perfect Score')
          if (index === 0 && student.avg_score != null) badges.push('Top Performer')
          if (Number(student.classes_attended || 0) >= 10) badges.push('Consistent')
          return { ...student, rank: index + 1, badges }
        })
        setRooms(roomList)
        setStudents(ranked)
      })
      .catch(loadError => {
        if (active) setError(loadError.message || 'Failed to load students.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const atRiskStudents = useMemo(() => students.filter(student => student.attendance_pct > 0 && student.attendance_pct < 75), [students])

  const filteredStudents = useMemo(() => students.filter(student => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = student.name.toLowerCase().includes(query) || student.usn.toLowerCase().includes(query)
    const matchesSem = semesterFilter === 'all' || student.semester === Number.parseInt(semesterFilter, 10)
    const attendance = student.attendance_pct || 0
    const matchesAtt = attendanceFilter === 'all'
      || (attendanceFilter === 'below75' && attendance < 75)
      || (attendanceFilter === '75to85' && attendance >= 75 && attendance <= 85)
      || (attendanceFilter === 'above85' && attendance > 85)
    return matchesSearch && matchesSem && matchesAtt
  }), [students, searchQuery, semesterFilter, attendanceFilter])

  const closeProfile = () => {
    setShowProfileModal(false)
    setSelectedStudent(null)
  }
  const showProfile = async student => {
    setProfileLoading(true)
    setActiveProfileTab('attendance')
    setShowProfileModal(true)
    try {
      const profile = await getStudentProfile(student.id)
      const records = profile.attendance || []
      const semRooms = rooms.filter(room => Number(room.semester) === Number(student.semester))
      const subjectMap = new Map()
      semRooms.forEach(room => {
        if (!subjectMap.has(room.subject)) subjectMap.set(room.subject, { subject: room.subject, held: 0, present: 0, absent: 0, late: 0 })
        subjectMap.get(room.subject).held += 1
      })
      records.forEach(record => {
        const subject = subjectMap.get(record.subject)
        if (!subject) return
        if (record.status === 'present') subject.present += 1
        else if (record.status === 'late') subject.late += 1
        else if (record.status === 'absent') subject.absent += 1
      })
      const subjects = [...subjectMap.values()].map(subject => ({
        ...subject,
        absent: subject.absent + Math.max(0, subject.held - subject.present - subject.late - subject.absent),
        pct: subject.held ? Math.round(subject.present / subject.held * 100) : 0,
      }))
      const exams = (profile.scores || []).map(score => ({ ...score, title: score.title || 'Exam', date: score.date || score.submitted_at }))
      setSelectedStudent({
        ...student,
        ...profile,
        joinedDate: profile.created_at,
        codeSubmissions: Number(profile.code_submissions || 0),
        exams,
        attendance: { overall: student.attendance_pct, subjects },
        badges: student.badges,
      })
    } catch (loadError) {
      showToast(loadError.message || 'Failed to load student profile.', 'error')
      setShowProfileModal(false)
    } finally {
      setProfileLoading(false)
    }
  }

  const semesterCounts = [3, 4, 5].map(semester => ({ semester, count: students.filter(student => Number(student.semester) === semester).length }))

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--muted)', fontSize: 13 }}>Loading students...</div>

  return (
    <div>
      <style>{`
        .students-row:hover { background: var(--bg); }
        .students-view:hover { background: var(--indigo) !important; color: white !important; }
        .students-tab:hover:not([aria-selected="true"]) { background: var(--bg); color: var(--text); }
        @media (max-width: 900px) { .students-header { align-items: flex-start !important; flex-direction: column; } .students-stats { flex-wrap: wrap; } }
        @media (max-width: 680px) { .student-profile-header { align-items: flex-start !important; flex-wrap: wrap; } .student-profile-tabs { width: 100% !important; } .student-activity-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {error && <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--red-light)', color: 'var(--red)', fontSize: 13 }}>{error}</div>}

      <header className="students-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Department Students</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>{students.length} enrolled · {atRiskStudents.length} at risk</p>
        </div>
        <div className="students-stats" style={{ display: 'flex', gap: 8 }}>
          {semesterCounts.map(({ semester, count }) => <span key={semester} style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{count} in Sem {semester}</span>)}
        </div>
      </header>

      {atRiskStudents.length > 0 && <section role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 16, border: '1px solid #FECACA', borderRadius: 'var(--radius)', background: 'var(--red-light)' }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>⚠️</span>
        <div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--red)' }}>{atRiskStudents.length} students are below 75% attendance and at risk of not meeting the minimum requirement.</div><div style={{ marginTop: 2, fontSize: 12, color: 'var(--red)', opacity: 0.8 }}>{atRiskStudents.map(student => student.name).join(', ')}</div></div>
      </section>}

      <div className="students-filter" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '14px 16px', marginBottom: 16, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <label style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔍</span>
          <input aria-label="Search by name or USN" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search by name or USN..." style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, outlineColor: 'var(--indigo)' }} />
        </label>
        <select aria-label="Filter by semester" value={semesterFilter} onChange={event => setSemesterFilter(event.target.value)} style={{ width: 150, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}>
          <option value="all">All Semesters</option><option value="3">Sem 3</option><option value="4">Sem 4</option><option value="5">Sem 5</option>
        </select>
        <select aria-label="Filter by attendance" value={attendanceFilter} onChange={event => setAttendanceFilter(event.target.value)} style={{ width: 170, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, color: 'var(--text)' }}>
          <option value="all">All Students</option><option value="below75">Below 75% ⚠️</option><option value="75to85">75% – 85%</option><option value="above85">Above 85% ✅</option>
        </select>
        <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--muted)' }}>Showing {filteredStudents.length} of {students.length}</span>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {filteredStudents.length === 0 ? <div style={{ padding: 60, textAlign: 'center' }}><div aria-hidden="true" style={{ fontSize: 40 }}>👨‍🎓</div><h2 style={{ marginTop: 12, fontFamily: headingFont, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No students found</h2><p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>Try adjusting your filters</p></div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Student', 'Sem', 'Attendance', 'Avg Score', 'Rank', 'Badges', 'Action'].map(label => <th key={label} style={pageTableHead}>{label}</th>)}</tr></thead>
              <tbody>
                {filteredStudents.map(student => {
                  const average = getAvgScore(student)
                  const rankColor = student.rank === 1 ? '#D97706' : student.rank === 2 ? '#6B7280' : student.rank === 3 ? '#92400E' : 'var(--muted)'
                  return <tr className="students-row" key={student.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <td style={pageTableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><StudentAvatar student={student} /><div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{student.name}</div><div style={{ marginTop: 2, fontFamily: monoFont, fontSize: 11, color: 'var(--muted)' }}>{student.usn}</div></div></div></td>
                    <td style={{ ...pageTableCell, color: 'var(--muted)' }}>Sem {student.semester}</td>
                    <td style={pageTableCell}>{student.attendance_pct ? <AttendancePill percentage={student.attendance_pct} /> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
                    <td style={{ ...pageTableCell, fontFamily: monoFont, fontWeight: 700, color: average === null ? 'var(--muted2)' : getScoreColor(average) }}>{average === null ? '—' : `${average}%`}</td>
                    <td style={{ ...pageTableCell, fontFamily: monoFont, color: rankColor }}>#{student.rank}</td>
                    <td style={pageTableCell}>{student.badges.length ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>{student.badges.slice(0, 2).map(badge => <span key={badge} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 11 }}>{badge}</span>)}{student.badges.length > 2 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{student.badges.length - 2} more</span>}</div> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
                    <td style={pageTableCell}><button className="students-view" type="button" onClick={() => showProfile(student)} style={{ padding: '6px 12px', border: 0, borderRadius: 6, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>View Profile</button></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showProfileModal} onClose={closeProfile} title="Student Profile" size="lg">
        {profileLoading ? <div style={{ display: 'grid', placeItems: 'center', height: 200, color: 'var(--muted)', fontSize: 13 }}>Loading profile...</div> : <StudentProfile student={selectedStudent} activeTab={activeProfileTab} onTabChange={setActiveProfileTab} />}
      </Modal>
    </div>
  )
}
