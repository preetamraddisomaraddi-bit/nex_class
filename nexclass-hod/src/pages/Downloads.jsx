import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import { getTeachers, getStudents, getRooms, getStudentProfile } from '../api'
import { useToast } from '../components/AlertToast'

const toCSV = (headers, rows) => {
  const escape = value => {
    const text = String(value ?? '')
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers.map(escape).join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\r\n')
}

const formatDate = (date, options) => new Date(date).toLocaleDateString('en-IN', options)
const reportDate = () => new Date().toISOString().slice(0, 10)

const buildStudentCSV = (semesterFilter, allStudents) => {
  const students = semesterFilter === 'all'
    ? allStudents
    : allStudents.filter(student => Number(student.semester) === Number.parseInt(semesterFilter, 10))
  return toCSV(
    ['Name', 'USN', 'Semester', 'Email', 'Attendance%', 'AvgScore', 'Badges', 'Joined'],
    students.map(student => {
      return {
        Name: student.name,
        USN: student.usn,
        Semester: `Sem ${student.semester}`,
        Email: student.email || '—',
        'Attendance%': student.attendance_pct ? `${student.attendance_pct}%` : '—',
        AvgScore: student.avg_score == null ? '—' : `${Math.round(Number(student.avg_score))}%`,
        Badges: student.badges.join('; ') || 'None',
        Joined: formatDate(student.created_at),
      }
    }),
  )
}

const buildAttendanceCSV = (semesterFilter, allStudents) => {
  const students = semesterFilter === 'all'
    ? allStudents
    : allStudents.filter(student => Number(student.semester) === Number.parseInt(semesterFilter, 10))
  const rows = students.map(student => ({
    Name: student.name,
    USN: student.usn,
    Semester: `Sem ${student.semester}`,
    'Classes Attended': Number(student.classes_attended || 0),
    'Attendance%': student.attendance_pct ? `${student.attendance_pct}%` : '—',
    Status: student.attendance_pct >= 75 ? 'Satisfactory' : student.attendance_pct > 0 ? 'At Risk' : 'No session data',
  }))
  return toCSV(['Name', 'USN', 'Semester', 'Classes Attended', 'Attendance%', 'Status'], rows)
}

const buildExamCSV = (semesterFilter, subjectFilter, allStudents) => {
  const students = semesterFilter === 'all'
    ? allStudents
    : allStudents.filter(student => Number(student.semester) === Number.parseInt(semesterFilter, 10))
  const rows = students.flatMap(student => student.exams
    .filter(exam => subjectFilter === 'all' || exam.subject === subjectFilter)
    .map(exam => {
      const percentage = Math.round((exam.score / exam.total) * 100)
      return {
        Name: student.name,
        USN: student.usn,
        Semester: `Sem ${student.semester}`,
        'Exam Title': exam.title,
        Subject: exam.subject,
        Date: formatDate(exam.date),
        Score: exam.score,
        Total: exam.total,
        Percentage: `${percentage}%`,
        Grade: exam.score >= 90 ? 'O' : exam.score >= 80 ? 'A+' : exam.score >= 70 ? 'A' : exam.score >= 60 ? 'B+' : exam.score >= 50 ? 'B' : 'F',
      }
    }))
  return toCSV(['Name', 'USN', 'Semester', 'Exam Title', 'Subject', 'Date', 'Score', 'Total', 'Percentage', 'Grade'], rows)
}

const buildTeacherCSV = teachers => toCSV(
  ['Name', 'Employee ID', 'Subject', 'Semester', 'Status', 'Total Classes', 'Avg Duration (mins)', 'Students Taught', 'Notes Pushed', 'Last Active'],
  teachers.map(teacher => ({
    Name: teacher.name,
    'Employee ID': teacher.employee_id,
    Subject: teacher.subject || '—',
    Semester: teacher.semester ? `Sem ${teacher.semester}` : '—',
    Status: teacher.status,
    'Total Classes': Number(teacher.total_classes || 0),
    'Avg Duration (mins)': 'N/A',
    'Students Taught': '—',
    'Notes Pushed': '—',
    'Last Active': teacher.last_active ? formatDate(teacher.last_active) : 'Never',
  })),
)

const buildSessionCSV = rooms => toCSV(
  ['Room Code', 'Subject', 'Teacher', 'Semester', 'Date', 'Duration (mins)', 'Students Present', 'Total Students', 'Attendance%', 'Notes Count', 'Exams Count', 'Status'],
  rooms.map(room => ({
    'Room Code': room.code,
    Subject: room.subject,
    Teacher: room.teacher_name || '—',
    Semester: room.semester ? `Sem ${room.semester}` : '—',
    Date: formatDate(room.created_at),
    'Duration (mins)': room.ended_at ? Math.max(0, Math.round((new Date(room.ended_at) - new Date(room.created_at)) / 60000)) : 'Ongoing',
    'Students Present': Number(room.students_present || 0),
    'Total Students': '—',
    'Attendance%': '—',
    'Notes Count': Number(room.notes_count || 0),
    'Exams Count': Number(room.exams_count || 0),
    Status: room.status,
  })),
)

const buildAtRiskCSV = students => {
  return toCSV(
    ['Name', 'USN', 'Semester', 'Overall%', 'Worst Subject', 'Worst Subject%', 'Status'],
    students.map(student => {
      const subjects = student.attendance?.subjects || []
      const worstSubject = subjects.reduce((worst, subject) => subject.pct < worst.pct ? subject : worst, subjects[0])
      return {
        Name: student.name,
        USN: student.usn,
        Semester: `Sem ${student.semester}`,
        'Overall%': `${student.attendance_pct}%`,
        'Worst Subject': worstSubject?.subject || 'N/A',
        'Worst Subject%': worstSubject ? `${worstSubject.pct}%` : 'N/A',
        Status: student.attendance_pct < 60 ? 'Critical' : 'At Risk',
      }
    }),
  )
}

const buildFullReportPDF = ({ students, teachers, rooms, atRisk, deptAttendance, deptScore, hod }) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const line = y => {
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
  }

  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageWidth, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('NexClass HOD Portal', margin, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Department Performance Report', margin, 22)
  doc.text(hod.department || 'Department', margin, 30)
  doc.text(formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - margin, 22, { align: 'right' })

  doc.setTextColor(25, 30, 45)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Department Overview', margin, 48)
  line(51)
  doc.setFontSize(10)
  const details = [
    ['University', hod.university || '—'],
    ['Department', hod.department || '—'],
    ['HOD', hod.name || '—'],
    ['Academic Year', '2024-25'],
    ['Report Generated', new Date().toLocaleString('en-IN')],
  ]
  details.forEach(([label, value], index) => {
    const y = 59 + index * 7
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value), 70, y)
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Key Statistics', margin, 102)
  line(105)
  const stats = [
    ['Total Students', students.length],
    ['Approved Teachers', teachers.filter(teacher => teacher.status === 'approved').length],
    ['Total Sessions', rooms.length],
    ['Department Attendance', `${deptAttendance}%`],
    ['Department Average Score', `${deptScore}%`],
    ['At-Risk Students', atRisk.length],
  ]
  stats.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? margin : pageWidth / 2 + 5
    const y = 115 + Math.floor(index / 2) * 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(25, 30, 45)
    doc.text(String(value), x + 55, y)
  })

  doc.addPage()
  doc.setFillColor(79, 70, 229)
  doc.rect(0, 0, pageWidth, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('NexClass HOD Report - Continued', margin, 8)
  doc.setTextColor(25, 30, 45)
  doc.setFontSize(13)
  doc.text('At-Risk Students', margin, 25)
  line(28)
  const columns = [17, 72, 112, 137, 170]
  doc.setFillColor(240, 240, 245)
  doc.rect(margin, 32, pageWidth - margin * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  ;['Name', 'USN', 'Sem', 'Attendance', 'Status'].forEach((label, index) => doc.text(label, columns[index], 38))
  if (atRisk.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('All students meet the minimum attendance requirement.', margin, 49)
  } else {
    atRisk.forEach((student, index) => {
      const y = 47 + index * 8
      if (y > pageHeight - 45) return
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(student.name, columns[0], y)
      doc.text(student.usn, columns[1], y)
      doc.text(`Sem ${student.semester}`, columns[2], y)
      doc.setTextColor(220, 38, 38)
      doc.text(`${student.attendance_pct}%`, columns[3], y)
      doc.text(student.attendance_pct < 60 ? 'Critical' : 'At Risk', columns[4], y)
      doc.setTextColor(25, 30, 45)
    })
  }

  const teacherY = Math.max(52, 47 + atRisk.length * 8 + 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Teacher Summary', margin, teacherY)
  line(teacherY + 3)
  const approved = teachers.filter(teacher => teacher.status === 'approved')
  const tableY = teacherY + 10
  doc.setFillColor(240, 240, 245)
  doc.rect(margin, tableY - 6, pageWidth - margin * 2, 8, 'F')
  doc.setFontSize(8)
  ;[['Name', 17], ['Subject', 72], ['Classes', 126], ['Avg Dur.', 147], ['Students', 174]].forEach(([label, x]) => doc.text(label, x, tableY))
  approved.forEach((teacher, index) => {
    const y = tableY + 9 + index * 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(teacher.name.replace('Prof. ', ''), 17, y)
    doc.text((teacher.subject || '—').slice(0, 18), 72, y)
    doc.text(String(teacher.total_classes || 0), 126, y)
    doc.text('N/A', 147, y)
    doc.text('—', 174, y)
  })

  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(`NexClass HOD Portal | ${hod.department || 'Department'} | Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
  }

  return doc.output('datauristring').split(',')[1]
}

const baseSelectStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 12,
  color: 'var(--text)',
  maxWidth: '100%',
}

function DownloadCard({ icon, iconBg, title, description, filters, preview, buttons, fullWidth = false }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, lineHeight: 1.4, color: 'var(--muted)' }}>{description}</p>
        </div>
      </header>
      <div style={{ flex: 1, padding: '16px 20px' }}>
        {filters && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>{filters}</div>}
        <div style={{ minHeight: 54, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, lineHeight: 1.55, color: 'var(--muted)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{preview}</div>
      </div>
      <footer style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>{buttons}</footer>
    </section>
  )
}

export default function Downloads() {
  const showToast = useToast()
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [rooms, setRooms] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [downloading, setDownloading] = useState({})
  const [attSemFilter, setAttSemFilter] = useState('all')
  const [examSemFilter, setExamSemFilter] = useState('all')
  const [examSubFilter, setExamSubFilter] = useState('all')

  useEffect(() => {
    let active = true
    Promise.all([getTeachers(), getStudents(), getRooms()])
      .then(async ([teacherRows, studentRows, roomRows]) => {
        const baseStudents = Array.isArray(studentRows) ? studentRows : []
        const roomList = Array.isArray(roomRows) ? roomRows : []
        const profiles = await Promise.all(baseStudents.map(student => getStudentProfile(student.id).catch(() => null)))
        if (!active) return
        const enriched = baseStudents.map((student, index) => {
          const profile = profiles[index] || {}
          const semRooms = roomList.filter(room => Number(room.semester) === Number(student.semester))
          const attendancePct = semRooms.length ? Math.min(100, Math.round(Number(student.classes_attended || 0) / semRooms.length * 100)) : 0
          const records = profile.attendance || []
          const subjectMap = new Map()
          semRooms.forEach(room => {
            if (!subjectMap.has(room.subject)) subjectMap.set(room.subject, { subject: room.subject, held: 0, present: 0, absent: 0, late: 0 })
            subjectMap.get(room.subject).held += 1
          })
          records.forEach(record => {
            const subject = subjectMap.get(record.subject)
            if (subject && record.status === 'present') subject.present += 1
            else if (subject && record.status === 'late') subject.late += 1
          })
          const subjects = [...subjectMap.values()].map(subject => ({ ...subject, absent: Math.max(0, subject.held - subject.present - subject.late), pct: subject.held ? Math.round(subject.present / subject.held * 100) : 0 }))
          const exams = (profile.scores || []).map(score => ({ ...score, title: score.title || 'Exam', date: score.date || score.submitted_at }))
          return { ...student, attendance_pct: attendancePct, attendance: { overall: attendancePct, subjects }, exams, badges: [], codeSubmissions: Number(profile.code_submissions || student.code_submissions || 0) }
        }).sort((a, b) => Number(b.avg_score || 0) - Number(a.avg_score || 0))
        const ranked = enriched.map((student, index) => {
          const badges = []
          if (student.attendance_pct >= 75) badges.push('Attendance Star')
          if (student.codeSubmissions >= 1) badges.push('Coding Champ')
          if (student.codeSubmissions >= 3) badges.push('Fast Learner')
          if (student.exams.some(exam => exam.total && exam.score / exam.total >= 0.8)) badges.push('Exam Ace')
          if (student.exams.some(exam => exam.score === exam.total)) badges.push('Perfect Score')
          if (index === 0 && student.avg_score != null) badges.push('Top Performer')
          if (Number(student.classes_attended || 0) >= 10) badges.push('Consistent')
          return { ...student, badges }
        })
        setTeachers(Array.isArray(teacherRows) ? teacherRows : [])
        setStudents(ranked)
        setRooms(roomList)
      })
      .catch(error => { if (active) setDataError(error.message || 'Failed to load report data.') })
      .finally(() => { if (active) setDataLoading(false) })
    return () => { active = false }
  }, [])

  const filteredAttendanceStudents = attSemFilter === 'all'
    ? students
    : students.filter(student => Number(student.semester) === Number.parseInt(attSemFilter, 10))
  const previewStudents = filteredAttendanceStudents
  const attendanceRows = filteredAttendanceStudents.length
  const examStudents = examSemFilter === 'all'
    ? students
    : students.filter(student => Number(student.semester) === Number.parseInt(examSemFilter, 10))
  const examRows = examStudents.reduce((sum, student) => sum + student.exams.filter(exam => examSubFilter === 'all' || exam.subject === examSubFilter).length, 0)
  const allSubjects = [...new Set(students.flatMap(student => student.exams.map(exam => exam.subject).filter(Boolean)))].sort()
  const atRiskStudents = students.filter(student => student.attendance_pct > 0 && student.attendance_pct < 75)
  const attendanceStudents = students.filter(student => student.attendance_pct > 0)
  const deptAttendance = attendanceStudents.length ? Math.round(attendanceStudents.reduce((sum, student) => sum + student.attendance_pct, 0) / attendanceStudents.length) : 0
  const examScores = students.flatMap(student => student.exams.filter(exam => exam.total).map(exam => exam.score / exam.total * 100))
  const deptScore = examScores.length ? Math.round(examScores.reduce((sum, score) => sum + score, 0) / examScores.length) : 0
  let hod = {}
  try { hod = JSON.parse(window.localStorage.getItem('nexclass_hod_data') || '{}') } catch { /* use report labels */ }

  const buildCurrentReportPDF = () => buildFullReportPDF({ students, teachers, rooms, atRisk: atRiskStudents, deptAttendance, deptScore, hod })

  const downloadFile = async (filename, content, type) => {
    let payload = content
    if (type === 'pdf') {
      const binary = window.atob(content)
      payload = Uint8Array.from(binary, character => character.charCodeAt(0))
    }

    if (window.electronAPI?.saveFile) {
      const result = await window.electronAPI.saveFile(filename, payload, type)
      if (result === true || result?.success) {
        showToast(result?.filePath ? `✅ Saved to ${result.filePath}` : `✅ ${filename} saved`, 'success')
      } else {
        showToast('Download cancelled', 'info')
      }
      return
    }

    const blob = new Blob([payload], { type: type === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(`✅ ${filename} downloaded`, 'success')
  }

  const handleDownload = async (key, filename, content, type) => {
    setDownloading(previous => ({ ...previous, [key]: true }))
    try {
      await new Promise(resolve => window.setTimeout(resolve, 800))
      await downloadFile(filename, content, type)
    } catch (error) {
      console.error('Unable to create report download:', error)
      showToast('Could not save this report. Please try again.', 'error')
    } finally {
      setDownloading(previous => ({ ...previous, [key]: false }))
    }
  }

  const csvButton = (key, filename, content, disabled = false) => (
    <button type="button" key={key} disabled={disabled || downloading[key]} onClick={() => handleDownload(key, filename, content, 'csv')} style={{ ...buttonStyle('csv', downloading[key], disabled), flex: 1 }}>
      {downloading[key] ? '⏳ Saving...' : '↓ CSV'}
    </button>
  )
  const pdfButton = (key, filename, content) => (
    <button type="button" key={key} disabled={downloading[key]} onClick={() => handleDownload(key, filename, content, 'pdf')} style={{ ...buttonStyle('pdf', downloading[key]), flex: 1 }}>
      {downloading[key] ? '⏳ Saving...' : '↓ PDF'}
    </button>
  )
  const semesterSelect = (label, value, onChange) => (
    <select aria-label={label} value={value} onChange={event => onChange(event.target.value)} style={baseSelectStyle}>
      <option value="all">All Semesters</option>
      {[3, 4, 5].map(semester => <option key={semester} value={semester}>Sem {semester}</option>)}
    </select>
  )

  if (dataLoading) return <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--muted)', fontSize: 13 }}>Loading report data...</div>

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text)' }}>
      <style>{`@media (max-width: 760px) { .downloads-header { align-items: flex-start !important; flex-direction: column !important; } .downloads-grid { grid-template-columns: 1fr !important; } .downloads-grid > section { grid-column: 1 !important; } }`}</style>
      {dataError && <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'var(--red-light)', color: 'var(--red)', fontSize: 13 }}>{dataError}</div>}
      <header className="downloads-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 20, fontWeight: 800 }}>Downloads &amp; Reports</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Generate and download department reports</p>
        </div>
        <span style={{ background: 'var(--indigo-light)', color: 'var(--indigo)', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20 }}>📥 6 report types available</span>
      </header>

      <div className="downloads-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
        <DownloadCard
          icon="👨‍🎓" iconBg="var(--blue-light)" title="Student List"
          description="Complete list of enrolled students with attendance and scores"
          filters={semesterSelect('Student list semester', attSemFilter, setAttSemFilter)}
          preview={`${previewStudents.length} students\nFields: Name, USN, Semester, Email, Attendance%, Avg Score, Badges`}
          buttons={csvButton('students-csv', `NexClass_Students_${attSemFilter === 'all' ? 'All' : `Sem${attSemFilter}`}_${reportDate()}.csv`, buildStudentCSV(attSemFilter, students))}
        />

        <DownloadCard
          icon="📋" iconBg="var(--indigo-light)" title="Attendance Report"
          description="Subject-wise attendance breakdown for all students"
          filters={semesterSelect('Attendance semester', attSemFilter, setAttSemFilter)}
          preview={`${attendanceRows} student attendance summaries\nFields: Name, USN, Semester, Classes Attended, Attendance%, Status`}
          buttons={csvButton('attendance-csv', `NexClass_Attendance_${reportDate()}.csv`, buildAttendanceCSV(attSemFilter, students))}
        />

        <DownloadCard
          icon="📝" iconBg="var(--amber-light)" title="Exam Results"
          description="All exam scores with grades and subject-wise breakdown"
          filters={<>
            {semesterSelect('Exam semester', examSemFilter, setExamSemFilter)}
            <select aria-label="Exam subject" value={examSubFilter} onChange={event => setExamSubFilter(event.target.value)} style={{ ...baseSelectStyle, minWidth: 150, flex: 1 }}>
              <option value="all">All Subjects</option>
              {allSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
            </select>
          </>}
          preview={`${examRows} exam records\nFields: Name, USN, Exam, Score, Percentage, Grade`}
          buttons={csvButton('exams-csv', `NexClass_ExamResults_${reportDate()}.csv`, buildExamCSV(examSemFilter, examSubFilter, students))}
        />

        <DownloadCard
          icon="👨‍🏫" iconBg="var(--green-light)" title="Teacher Activity Report"
          description="Sessions conducted, duration and engagement per teacher"
          preview={`${teachers.length} teachers (${teachers.filter(teacher => teacher.status === 'approved').length} approved, ${teachers.filter(teacher => teacher.status === 'pending').length} pending)\nFields: Name, Subject, Classes, Avg Duration, Students Taught`}
          buttons={csvButton('teachers-csv', `NexClass_TeacherActivity_${reportDate()}.csv`, buildTeacherCSV(teachers))}
        />

        <DownloadCard
          icon="⚠️" iconBg="var(--red-light)" title="At-Risk Students"
          description="Students below 75% attendance needing immediate attention"
          preview={atRiskStudents.length === 0
            ? '✅ No at-risk students currently'
            : <><div style={{ color: 'var(--red)', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>{atRiskStudents.length} students at risk</div><div style={{ marginTop: 3, fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--red)' }}>{atRiskStudents.map(student => student.name).join(', ')}</div><div style={{ marginTop: 5 }}>Fields: Name, USN, Attendance%, Worst Subject, Status</div></>}
          buttons={csvButton('atrisk-csv', `NexClass_AtRisk_${reportDate()}.csv`, buildAtRiskCSV(atRiskStudents), atRiskStudents.length === 0)}
        />

        <DownloadCard
          icon="🏛️" iconBg="var(--indigo-light)" title="Full Department Report"
          description="Comprehensive PDF report with department statistics and analytics"
          fullWidth
          preview={<>
            <strong style={{ display: 'block', marginBottom: 8, color: 'var(--text2)', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>📊 Report includes:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px 12px', color: 'var(--indigo)', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
              <span>✓ Department overview &amp; HOD details</span><span>✓ Key statistics summary</span>
              <span>✓ At-risk students list</span><span>✓ Teacher performance summary</span>
              <span>✓ Page numbers and report date</span><span>✓ NexClass branding</span>
            </div>
          </>}
          buttons={pdfButton('fullreport-pdf', `NexClass_DepartmentReport_${reportDate()}.pdf`, buildCurrentReportPDF())}
        />
      </div>
    </div>
  )
}

const buttonStyle = (format, loading, disabled = false) => {
  const pdf = format === 'pdf'
  return {
    padding: 9,
    background: pdf ? 'var(--indigo-light)' : 'var(--green-light)',
    color: pdf ? 'var(--indigo)' : 'var(--green)',
    border: `1px solid ${pdf ? 'var(--indigo-mid)' : 'rgba(5,150,105,0.2)'}`,
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    cursor: loading || disabled ? 'not-allowed' : 'pointer',
    opacity: loading || disabled ? 0.6 : 1,
  }
}
