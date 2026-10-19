import { useState } from 'react'
import jsPDF from 'jspdf'
import {
  HOD,
  STUDENTS,
  TEACHERS,
  SESSION_LOGS,
  MONTHLY_STATS,
  getAtRiskStudents,
  getDeptAvgAttendance,
  getDeptAvgScore,
} from '../data/mockData'
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

const buildStudentCSV = semesterFilter => {
  const students = semesterFilter === 'all'
    ? STUDENTS
    : STUDENTS.filter(student => student.semester === Number.parseInt(semesterFilter, 10))
  return toCSV(
    ['Name', 'USN', 'Semester', 'Email', 'Attendance%', 'AvgScore', 'Badges', 'Joined'],
    students.map(student => {
      const scores = student.exams.map(exam => Math.round((exam.score / exam.total) * 100))
      const average = scores.length ? `${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)}%` : 'N/A'
      return {
        Name: student.name,
        USN: student.usn,
        Semester: `Sem ${student.semester}`,
        Email: student.email,
        'Attendance%': `${student.attendance.overall}%`,
        AvgScore: average,
        Badges: student.badges.join('; ') || 'None',
        Joined: formatDate(student.joinedDate),
      }
    }),
  )
}

const buildAttendanceCSV = semesterFilter => {
  const students = semesterFilter === 'all'
    ? STUDENTS
    : STUDENTS.filter(student => student.semester === Number.parseInt(semesterFilter, 10))
  const rows = students.flatMap(student => student.attendance.subjects.map(subject => ({
    Name: student.name,
    USN: student.usn,
    Semester: `Sem ${student.semester}`,
    Subject: subject.subject,
    'Classes Held': subject.held,
    Present: subject.present,
    Absent: subject.absent,
    Late: subject.late,
    'Attendance%': `${subject.pct}%`,
    Status: subject.pct >= 75 ? 'Satisfactory' : 'At Risk',
  })))
  return toCSV(['Name', 'USN', 'Semester', 'Subject', 'Classes Held', 'Present', 'Absent', 'Late', 'Attendance%', 'Status'], rows)
}

const buildExamCSV = (semesterFilter, subjectFilter) => {
  const students = semesterFilter === 'all'
    ? STUDENTS
    : STUDENTS.filter(student => student.semester === Number.parseInt(semesterFilter, 10))
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

const buildTeacherCSV = () => toCSV(
  ['Name', 'Employee ID', 'Subject', 'Semester', 'Status', 'Total Classes', 'Avg Duration (mins)', 'Students Taught', 'Notes Pushed', 'Last Active'],
  TEACHERS.map(teacher => ({
    Name: teacher.name,
    'Employee ID': teacher.employeeId,
    Subject: teacher.subject,
    Semester: `Sem ${teacher.semester}`,
    Status: teacher.status === 'approved' ? 'Approved' : 'Pending',
    'Total Classes': teacher.totalClasses,
    'Avg Duration (mins)': teacher.avgDuration || 'N/A',
    'Students Taught': teacher.totalStudentsTaught,
    'Notes Pushed': teacher.totalNotesPushed,
    'Last Active': teacher.lastActive ? formatDate(teacher.lastActive) : 'Never',
  })),
)

const buildSessionCSV = () => toCSV(
  ['Room Code', 'Subject', 'Teacher', 'Semester', 'Date', 'Duration (mins)', 'Students Present', 'Total Students', 'Attendance%', 'Notes Count', 'Exams Count', 'Status'],
  SESSION_LOGS.map(session => ({
    'Room Code': session.roomCode,
    Subject: session.subject,
    Teacher: session.teacher,
    Semester: `Sem ${session.semester}`,
    Date: formatDate(session.date),
    'Duration (mins)': session.duration,
    'Students Present': session.studentsPresent,
    'Total Students': session.totalStudents,
    'Attendance%': `${Math.round((session.studentsPresent / session.totalStudents) * 100)}%`,
    'Notes Count': session.notesCount,
    'Exams Count': session.examsConducted,
    Status: session.status,
  })),
)

const buildAtRiskCSV = () => {
  const students = getAtRiskStudents()
  return toCSV(
    ['Name', 'USN', 'Semester', 'Overall%', 'Worst Subject', 'Worst Subject%', 'Status'],
    students.map(student => {
      const worstSubject = student.attendance.subjects.reduce((worst, subject) => subject.pct < worst.pct ? subject : worst)
      return {
        Name: student.name,
        USN: student.usn,
        Semester: `Sem ${student.semester}`,
        'Overall%': `${student.attendance.overall}%`,
        'Worst Subject': worstSubject?.subject || 'N/A',
        'Worst Subject%': worstSubject ? `${worstSubject.pct}%` : 'N/A',
        Status: student.attendance.overall < 60 ? 'Critical' : 'At Risk',
      }
    }),
  )
}

const buildFullReportPDF = () => {
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
  doc.text(HOD.department, margin, 30)
  doc.text(formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - margin, 22, { align: 'right' })

  doc.setTextColor(25, 30, 45)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Department Overview', margin, 48)
  line(51)
  doc.setFontSize(10)
  const details = [
    ['University', HOD.university],
    ['Department', HOD.department],
    ['HOD', HOD.name],
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
    ['Total Students', STUDENTS.length],
    ['Approved Teachers', TEACHERS.filter(teacher => teacher.status === 'approved').length],
    ['Total Sessions', SESSION_LOGS.length],
    ['Department Attendance', `${getDeptAvgAttendance()}%`],
    ['Department Average Score', `${getDeptAvgScore()}%`],
    ['At-Risk Students', getAtRiskStudents().length],
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
  const atRisk = getAtRiskStudents()
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
      doc.text(`${student.attendance.overall}%`, columns[3], y)
      doc.text(student.attendance.overall < 60 ? 'Critical' : 'At Risk', columns[4], y)
      doc.setTextColor(25, 30, 45)
    })
  }

  const teacherY = Math.max(52, 47 + atRisk.length * 8 + 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Teacher Summary', margin, teacherY)
  line(teacherY + 3)
  const approved = TEACHERS.filter(teacher => teacher.status === 'approved')
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
    doc.text(teacher.subject.slice(0, 18), 72, y)
    doc.text(String(teacher.totalClasses), 126, y)
    doc.text(teacher.avgDuration ? `${teacher.avgDuration}m` : 'N/A', 147, y)
    doc.text(String(teacher.totalStudentsTaught), 174, y)
  })

  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(`NexClass HOD Portal | ${HOD.department} | Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
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
  const [downloading, setDownloading] = useState({})
  const [attSemFilter, setAttSemFilter] = useState('all')
  const [examSemFilter, setExamSemFilter] = useState('all')
  const [examSubFilter, setExamSubFilter] = useState('all')

  const filteredAttendanceStudents = attSemFilter === 'all'
    ? STUDENTS
    : STUDENTS.filter(student => student.semester === Number.parseInt(attSemFilter, 10))
  const previewStudents = filteredAttendanceStudents
  const attendanceRows = filteredAttendanceStudents.reduce((sum, student) => sum + student.attendance.subjects.length, 0)
  const examStudents = examSemFilter === 'all'
    ? STUDENTS
    : STUDENTS.filter(student => student.semester === Number.parseInt(examSemFilter, 10))
  const examRows = examStudents.reduce((sum, student) => sum + student.exams.filter(exam => examSubFilter === 'all' || exam.subject === examSubFilter).length, 0)
  const allSubjects = [...new Set(STUDENTS.flatMap(student => student.exams.map(exam => exam.subject)))].sort()
  const atRiskStudents = getAtRiskStudents()

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

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text)' }}>
      <style>{`@media (max-width: 760px) { .downloads-header { align-items: flex-start !important; flex-direction: column !important; } .downloads-grid { grid-template-columns: 1fr !important; } .downloads-grid > section { grid-column: 1 !important; } }`}</style>
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
          buttons={csvButton('students-csv', `NexClass_Students_${attSemFilter === 'all' ? 'All' : `Sem${attSemFilter}`}_${reportDate()}.csv`, buildStudentCSV(attSemFilter))}
        />

        <DownloadCard
          icon="📋" iconBg="var(--indigo-light)" title="Attendance Report"
          description="Subject-wise attendance breakdown for all students"
          filters={semesterSelect('Attendance semester', attSemFilter, setAttSemFilter)}
          preview={`${attendanceRows} subject attendance records\nFields: Name, USN, Subject, Present, Absent, Attendance%, Status`}
          buttons={csvButton('attendance-csv', `NexClass_Attendance_${reportDate()}.csv`, buildAttendanceCSV(attSemFilter))}
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
          buttons={csvButton('exams-csv', `NexClass_ExamResults_${reportDate()}.csv`, buildExamCSV(examSemFilter, examSubFilter))}
        />

        <DownloadCard
          icon="👨‍🏫" iconBg="var(--green-light)" title="Teacher Activity Report"
          description="Sessions conducted, duration and engagement per teacher"
          preview={`${TEACHERS.length} teachers (${TEACHERS.filter(teacher => teacher.status === 'approved').length} approved, ${TEACHERS.filter(teacher => teacher.status === 'pending').length} pending)\nFields: Name, Subject, Classes, Avg Duration, Students Taught`}
          buttons={csvButton('teachers-csv', `NexClass_TeacherActivity_${reportDate()}.csv`, buildTeacherCSV())}
        />

        <DownloadCard
          icon="⚠️" iconBg="var(--red-light)" title="At-Risk Students"
          description="Students below 75% attendance needing immediate attention"
          preview={atRiskStudents.length === 0
            ? '✅ No at-risk students currently'
            : <><div style={{ color: 'var(--red)', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>{atRiskStudents.length} students at risk</div><div style={{ marginTop: 3, fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--red)' }}>{atRiskStudents.map(student => student.name).join(', ')}</div><div style={{ marginTop: 5 }}>Fields: Name, USN, Attendance%, Worst Subject, Status</div></>}
          buttons={csvButton('atrisk-csv', `NexClass_AtRisk_${reportDate()}.csv`, buildAtRiskCSV(), atRiskStudents.length === 0)}
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
          buttons={pdfButton('fullreport-pdf', `NexClass_DepartmentReport_${reportDate()}.pdf`, buildFullReportPDF())}
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
