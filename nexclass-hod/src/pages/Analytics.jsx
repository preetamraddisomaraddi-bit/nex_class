import { useState, useMemo } from 'react'
import {
  STUDENTS,
  TEACHERS,
  SESSION_LOGS,
  MONTHLY_STATS,
  getAtRiskStudents,
  getDeptAvgAttendance,
  getDeptAvgScore,
  getSemesterAttendance,
  getTopStudents,
} from '../data/mockData'
import CSSBarChart from '../components/CSSBarChart'
import StatCard from '../components/StatCard'

const headingFont = '"Plus Jakarta Sans", sans-serif'
const monoFont = '"JetBrains Mono", monospace'

const getAttColor = percentage => percentage >= 75 ? 'var(--green)' : 'var(--red)'
const getScoreColor = score => score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)'

const avatarColor = name => {
  const colors = [
    'linear-gradient(135deg, #4F46E5, #2563EB)',
    'linear-gradient(135deg, #059669, #0891B2)',
    'linear-gradient(135deg, #D97706, #DC2626)',
    'linear-gradient(135deg, #7C3AED, #DB2777)',
    'linear-gradient(135deg, #0891B2, #059669)',
  ]
  return colors[(name || 'N').charCodeAt(0) % colors.length]
}

function Avatar({ initials, name, size = 34 }) {
  return <div aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: avatarColor(name), color: 'white', fontSize: size <= 30 ? 10 : 12, fontWeight: 700 }}>{initials}</div>
}

function Panel({ title, subtitle, trailing, children, bodyPadding = 20 }) {
  return (
    <section style={{ minWidth: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <header style={{ minHeight: 52, padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}><h2 style={{ margin: 0, fontFamily: headingFont, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>{subtitle && <p style={{ marginTop: 3, fontSize: 11, color: 'var(--muted)' }}>{subtitle}</p>}</div>
        {trailing}
      </header>
      <div style={{ padding: bodyPadding }}>{children}</div>
    </section>
  )
}

function CountPill({ children, tone = 'red' }) {
  const color = tone === 'indigo' ? 'var(--indigo)' : tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber)' : 'var(--red)'
  const background = tone === 'indigo' ? 'var(--indigo-light)' : tone === 'green' ? 'var(--green-light)' : tone === 'amber' ? 'var(--amber-light)' : 'var(--red-light)'
  return <span style={{ padding: '3px 9px', borderRadius: 20, color, background, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

function AtRiskTable({ students }) {
  const tableHead = { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }
  const tableCell = { padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Student', 'Sem', 'Overall', 'Data Structures', 'Worst Subject', 'Status'].map(title => <th key={title} style={tableHead}>{title}</th>)}</tr></thead>
        <tbody>
          {students.map(student => {
            const worst = student.attendance.subjects.reduce((minimum, subject) => subject.pct < minimum.pct ? subject : minimum, student.attendance.subjects[0])
            const dataStructures = student.attendance.subjects.find(subject => subject.subject === 'Data Structures')
            const critical = student.attendance.overall < 60
            return <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={tableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar initials={student.initials} name={student.name} size={30} /><div><div style={{ fontWeight: 600, color: 'var(--text)' }}>{student.name}</div><div style={{ marginTop: 2, fontFamily: monoFont, fontSize: 10, color: 'var(--muted)' }}>{student.usn}</div></div></div></td>
              <td style={tableCell}>Sem {student.semester}</td>
              <td style={tableCell}><span style={{ padding: '3px 8px', borderRadius: 20, background: 'var(--red-light)', color: 'var(--red)', fontWeight: 700 }}>{student.attendance.overall}%</span></td>
              <td style={tableCell}>{dataStructures ? `${dataStructures.pct}%` : '—'}</td>
              <td style={{ ...tableCell, color: 'var(--red)' }}>{worst ? `${worst.subject}: ${worst.pct}%` : '—'}</td>
              <td style={tableCell}><CountPill tone={critical ? 'red' : 'amber'}>{critical ? 'Critical' : 'At Risk'}</CountPill></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )
}

function TopStudentsTable({ students }) {
  const tableHead = { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }
  const tableCell = { padding: '12px 16px', fontSize: 13, color: 'var(--text2)' }
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Rank', 'Student', 'Semester', 'Avg Score', 'Exams Taken', 'Badges'].map(label => <th key={label} style={tableHead}>{label}</th>)}</tr></thead>
        <tbody>
          {students.map((student, index) => {
            const rowBg = index === 0 ? 'var(--amber-light)' : index === 1 ? '#F9FAFB' : index === 2 ? '#FEF7ED' : 'transparent'
            const rankColor = index === 0 ? '#D97706' : index === 1 ? '#6B7280' : index === 2 ? '#92400E' : 'var(--muted)'
            return <tr key={student.id} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...tableCell, fontFamily: monoFont, fontWeight: 800, color: rankColor }}>{medals[index] || `#${index + 1}`}</td>
              <td style={tableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar initials={student.initials} name={student.name} /><div><div style={{ fontWeight: 600, color: 'var(--text)' }}>{student.name}</div><div style={{ marginTop: 2, fontFamily: monoFont, fontSize: 10, color: 'var(--muted)' }}>{student.usn}</div></div></div></td>
              <td style={tableCell}>Sem {student.semester}</td>
              <td style={{ ...tableCell, fontFamily: monoFont, fontWeight: 800, color: getScoreColor(student.avgScore) }}>{student.avgScore}%</td>
              <td style={{ ...tableCell, color: 'var(--muted)' }}>{student.exams.length} exams</td>
              <td style={{ ...tableCell, color: 'var(--indigo)' }}>{student.badges.length} 🏅</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )
}

function TeacherSummaryTable({ teachers }) {
  const tableHead = { padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }
  const tableCell = { padding: '13px 16px', fontSize: 12, color: 'var(--text2)' }
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
    <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}><tr>{['Teacher', 'Sessions', 'Avg Duration', 'Students'].map(label => <th key={label} style={tableHead}>{label}</th>)}</tr></thead>
    <tbody>{teachers.map(teacher => <tr key={teacher.id} style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={tableCell}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar initials={teacher.initials} name={teacher.name} size={30} /><span style={{ fontWeight: 600, color: 'var(--text)' }}>{teacher.name}</span></div></td>
      <td style={{ ...tableCell, fontFamily: monoFont }}>{teacher.totalClasses} classes</td>
      <td style={{ ...tableCell, fontFamily: monoFont }}>{teacher.avgDuration > 0 ? `${teacher.avgDuration} mins` : '—'}</td>
      <td style={{ ...tableCell, color: 'var(--muted)' }}>{teacher.totalStudentsTaught} students</td>
    </tr>)}</tbody>
  </table></div>
}

function InsightRow({ icon, value, label, tone, last = false }) {
  const tones = {
    amber: 'var(--amber-light)',
    indigo: 'var(--indigo-light)',
    green: 'var(--green-light)',
    blue: 'var(--blue-light)',
  }
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: last ? 0 : '1px solid var(--border)' }}>
    <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tones[tone], fontSize: 18, flexShrink: 0 }}>{icon}</span>
    <div><div style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{value}</div><div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>{label}</div></div>
  </div>
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('attendance')
  const semAttendance = getSemesterAttendance()
  const topStudents = getTopStudents(9)
  const atRiskStudents = getAtRiskStudents()
  const deptAttendance = getDeptAvgAttendance()
  const deptScore = getDeptAvgScore()
  const approvedTeachers = TEACHERS.filter(teacher => teacher.status === 'approved')

  const subjectScores = useMemo(() => {
    const subjects = {}
    STUDENTS.forEach(student => {
      student.exams.forEach(exam => {
        if (!subjects[exam.subject]) subjects[exam.subject] = { total: 0, count: 0 }
        subjects[exam.subject].total += (exam.score / exam.total) * 100
        subjects[exam.subject].count += 1
      })
    })
    return Object.entries(subjects).map(([name, data]) => ({ label: name, value: Math.round(data.total / data.count), max: 100, color: '#4F46E5' }))
  }, [])

  const teacherActivity = useMemo(() => TEACHERS
    .filter(teacher => teacher.status === 'approved')
    .map(teacher => ({ label: teacher.name.replace('Prof. ', ''), value: teacher.totalClasses, max: 30, color: '#059669' }))
    .sort((a, b) => b.value - a.value), [])

  const scoreDistribution = useMemo(() => {
    const ranges = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, 'Below 60': 0 }
    STUDENTS.forEach(student => student.exams.forEach(exam => {
      const percentage = (exam.score / exam.total) * 100
      if (percentage >= 90) ranges['90-100'] += 1
      else if (percentage >= 80) ranges['80-89'] += 1
      else if (percentage >= 70) ranges['70-79'] += 1
      else if (percentage >= 60) ranges['60-69'] += 1
      else ranges['Below 60'] += 1
    }))
    const colors = { '90-100': '#059669', '80-89': '#4F46E5', '70-79': '#D97706', '60-69': '#F59E0B', 'Below 60': '#DC2626' }
    return Object.entries(ranges).map(([label, value]) => ({ label, value, max: 8, color: colors[label] }))
  }, [])

  const sessionsPerMonth = MONTHLY_STATS.map(month => ({ label: month.month, value: month.sessions, max: 60, color: '#D97706' }))
  const attendancePerMonth = MONTHLY_STATS.map(month => ({ label: month.month, value: month.attendance, max: 100, color: '#4F46E5' }))
  const mostActive = [...approvedTeachers].sort((a, b) => b.totalClasses - a.totalClasses)[0]
  const avgDuration = SESSION_LOGS.length ? Math.round(SESSION_LOGS.reduce((sum, session) => sum + session.duration, 0) / SESSION_LOGS.length) : 0
  const avgStudents = SESSION_LOGS.length ? Math.round(SESSION_LOGS.reduce((sum, session) => sum + session.studentsPresent, 0) / SESSION_LOGS.length) : 0
  const totalNotes = SESSION_LOGS.reduce((sum, session) => sum + session.notesCount, 0)
  const totalExams = SESSION_LOGS.reduce((sum, session) => sum + session.examsConducted, 0)
  const lastUpdated = new Date().toLocaleDateString('en-IN')

  const tabs = [['attendance', 'Attendance'], ['performance', 'Performance'], ['teachers', 'Teachers'], ['sessions', 'Sessions']]
  const chartColors = ['#059669', '#4F46E5', '#D97706', '#F59E0B', '#DC2626']
  const chartLegend = ['90-100', '80-89', '70-79', '60-69', 'Below 60']

  return (
    <div>
      <style>{`
        .analytics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-bottom: 20px; align-items: start; }
        .analytics-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
        .analytics-tab:hover:not([aria-selected="true"]) { background: var(--bg); color: var(--text); }
        .analytics-chart-scroll { overflow-x: auto; }
        @media (max-width: 1050px) { .analytics-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 760px) { .analytics-header { align-items: flex-start !important; flex-direction: column; } .analytics-grid { grid-template-columns: 1fr; } }
        @media (max-width: 420px) { .analytics-stat-grid { grid-template-columns: 1fr; } }
      `}</style>

      <header className="analytics-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div><h1 style={{ fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Department Analytics</h1><p style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>Computer Science &amp; Engineering · Academic Year 2024-25</p></div>
        <span style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Last updated: {lastUpdated}</span>
      </header>

      <section className="analytics-stat-grid" aria-label="Department analytics summary">
        <StatCard icon="📊" iconBg="var(--indigo-light)" value={`${deptAttendance}%`} label="Dept. Attendance" subtitle={deptAttendance >= 75 ? 'Above minimum' : 'Below threshold'} subtitleColor={deptAttendance >= 75 ? 'var(--green)' : 'var(--red)'} />
        <StatCard icon="🎯" iconBg="var(--green-light)" value={`${deptScore}%`} label="Avg Exam Score" subtitle="Across all students" subtitleColor="var(--muted)" />
        <StatCard icon="📋" iconBg="var(--amber-light)" value={SESSION_LOGS.length} label="Total Sessions" subtitle="This academic period" subtitleColor="var(--muted)" />
        <StatCard icon="⚠️" iconBg="var(--red-light)" value={atRiskStudents.length} label="At Risk Students" subtitle="Below 75% attendance" subtitleColor={atRiskStudents.length > 0 ? 'var(--red)' : 'var(--green)'} />
      </section>

      <div role="tablist" aria-label="Analytics sections" style={{ display: 'flex', gap: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto', padding: 4, marginBottom: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--white)' }}>
        {tabs.map(([key, label]) => <button key={key} className="analytics-tab" type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)} style={{ padding: '8px 20px', border: 0, borderRadius: 7, background: activeTab === key ? 'var(--indigo)' : 'transparent', color: activeTab === key ? 'white' : 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>)}
      </div>

      {activeTab === 'attendance' && <>
        <div className="analytics-grid">
          <Panel title="Semester-wise Attendance">
            <div style={{ fontFamily: headingFont, fontSize: 36, fontWeight: 800, color: getAttColor(deptAttendance) }}>{deptAttendance}%</div>
            <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--muted)' }}>Overall Department Average</div>
            <div className="analytics-chart-scroll"><CSSBarChart type="horizontal" data={semAttendance.map(item => ({ label: item.semester, value: item.pct, max: 100, color: item.pct >= 75 ? '#059669' : item.pct >= 60 ? '#D97706' : '#DC2626' }))} showValues /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 12, marginTop: 16, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}>— Minimum required: 75%</div>
          </Panel>
          <Panel title="Monthly Attendance Trend">
            <div className="analytics-chart-scroll"><CSSBarChart type="vertical" height={140} data={attendancePerMonth} showValues showLabels /></div>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>Trend shows attendance percentage across the last 6 months.</p>
          </Panel>
        </div>
        <Panel title="⚠️ Students Below 75% Attendance" trailing={<CountPill>{atRiskStudents.length}</CountPill>} bodyPadding={0}>
          {atRiskStudents.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--green)', fontSize: 13 }}>🎉 All students meet the minimum attendance requirement!</div> : <AtRiskTable students={atRiskStudents} />}
        </Panel>
      </>}

      {activeTab === 'performance' && <>
        <div className="analytics-grid">
          <Panel title="Subject-wise Average Scores">
            <div style={{ fontFamily: headingFont, fontSize: 36, fontWeight: 800, color: getScoreColor(deptScore) }}>{deptScore}%</div>
            <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--muted)' }}>Department Average</div>
            <div className="analytics-chart-scroll"><CSSBarChart type="horizontal" data={subjectScores} showValues /></div>
          </Panel>
          <Panel title="Score Distribution" subtitle="Across all exams taken">
            <div className="analytics-chart-scroll"><CSSBarChart type="vertical" height={140} data={scoreDistribution} showValues showLabels /></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {chartLegend.map((label, index) => <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}><i aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 2, background: chartColors[index] }} />{label}</span>)}
            </div>
          </Panel>
        </div>
        <Panel title="🏆 Top Students Ranking" trailing={<CountPill tone="indigo">All Semesters</CountPill>} bodyPadding={0}><TopStudentsTable students={topStudents} /></Panel>
      </>}

      {activeTab === 'teachers' && <div className="analytics-grid">
        <Panel title="Sessions per Teacher">
          {mostActive && <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 8, background: 'linear-gradient(135deg, var(--indigo-light), var(--blue-light))' }}>
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: 'var(--indigo)', textTransform: 'uppercase' }}>🏆 Most Active Teacher</div>
            <div style={{ fontFamily: headingFont, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{mostActive.name}</div>
            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>{mostActive.totalClasses} classes · {mostActive.subject} · Sem {mostActive.semester}</div>
          </div>}
          <div className="analytics-chart-scroll"><CSSBarChart type="horizontal" data={teacherActivity} showValues /></div>
        </Panel>
        <Panel title="Teacher Performance Summary" bodyPadding={0}><TeacherSummaryTable teachers={approvedTeachers} /></Panel>
      </div>}

      {activeTab === 'sessions' && <div className="analytics-grid">
        <Panel title="Sessions per Month">
          <div style={{ marginBottom: 4, fontFamily: headingFont, fontSize: 28, fontWeight: 800, color: 'var(--indigo)' }}>{SESSION_LOGS.length} Total Sessions</div>
          <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--muted)' }}>This academic period</div>
          <div className="analytics-chart-scroll"><CSSBarChart type="vertical" height={140} data={sessionsPerMonth} showValues showLabels /></div>
        </Panel>
        <Panel title="Session Insights">
          <InsightRow icon="⏱️" value={`${avgDuration} mins`} label="Average Session Duration" tone="amber" />
          <InsightRow icon="👥" value={`${avgStudents} students`} label="Avg Students per Session" tone="indigo" />
          <InsightRow icon="📤" value={`${totalNotes} notes`} label="Total Notes Pushed" tone="green" />
          <InsightRow icon="📝" value={`${totalExams} exams`} label="Total Exams Conducted" tone="blue" last />
        </Panel>
      </div>}
    </div>
  )
}
