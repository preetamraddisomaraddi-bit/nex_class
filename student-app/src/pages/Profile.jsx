import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyAttendance, getMyProfile, getMyScores } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { jsPDF } from 'jspdf'

export default function Profile() {
  const navigate = useNavigate()
  const { student } = useAuth()
  const profile = student
  
  const [attStats, setAttStats] = useState({ total: 0, present: 0, percentage: 0, records: [] })
  const [profileError, setProfileError] = useState('')
  const [examHistory, setExamHistory] = useState([])
  const [badges, setBadges] = useState([])
  const [notes, setNotes] = useState([])
  const [pushedPDFs, setPushedPDFs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [profileRes, attRes, scoreRes] = await Promise.all([
        getMyProfile(student.id),
        getMyAttendance(student.id),
        getMyScores(student.id)
      ])
      const fullProfile = profileRes.data
      const attendanceRecords = Array.isArray(attRes.data) ? attRes.data : (fullProfile.attendance || [])
      const scores = Array.isArray(scoreRes.data) ? scoreRes.data : (fullProfile.scores || [])
      const present = attendanceRecords.filter(record => record.status === 'present').length
      setAttStats({
        total: attendanceRecords.length,
        present,
        percentage: attendanceRecords.length ? Math.round((present / attendanceRecords.length) * 100) : 0,
        records: attendanceRecords
      })
      setExamHistory(scores.map(score => ({
        ...score,
        percentage: score.total ? Math.round((score.score / score.total) * 100) : 0,
        title: score.title || 'Exam',
        pushed_at: score.submitted_at || score.exam_date
      })))
      setBadges([])
      setNotes([])
      setPushedPDFs([])
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to load profile data from the HOD server.')
      console.error('Failed to load profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Download a single note
  function downloadPDF(note) {
    const doc = new jsPDF()
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(99, 102, 241)
    doc.text('EduSync Saved Note', 20, 20)
    
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Subject: ${note.subject || ''}`, 20, 30)
    doc.text(`Topic: ${note.topic || ''}`, 20, 36)
    doc.text(`Class: ${note.class_name || ''}`, 20, 42)
    doc.text(`Teacher: ${note.teacher_name || ''}`, 20, 48)
    doc.text(`Date: ${new Date(note.pushed_at).toLocaleString()}`, 20, 54)
    
    doc.setLineWidth(0.5)
    doc.setDrawColor(203, 213, 225)
    doc.line(20, 58, 190, 58)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(15, 23, 42)
    doc.text(note.title, 20, 68)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(51, 65, 85)
    const textLines = doc.splitTextToSize(note.content, 170)
    doc.text(textLines, 20, 78)
    
    doc.save(`Saved_Note_${note.title.replace(/\s+/g, '_')}.pdf`)
  }

  // Download all notes aggregated as one PDF
  function downloadAllNotesAsPDF() {
    if (notes.length === 0) return alert('No notes available to export.')
    const doc = new jsPDF()
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(99, 102, 241)
    doc.text('EduSync — Class Notes Compilation', 20, 20)
    
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Student: ${student.name} (USN: ${profile?.usn || student.usn || '—'})`, 20, 30)
    doc.text(`Total Notes Compiled: ${notes.length}`, 20, 36)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 42)
    
    let yPos = 52
    notes.forEach((n, idx) => {
      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setLineWidth(0.5)
      doc.setDrawColor(226, 232, 240)
      doc.line(20, yPos, 190, yPos)
      yPos += 10
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(15, 23, 42)
      doc.text(`${idx + 1}. ${n.title}`, 20, yPos)
      yPos += 6
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`Subject: ${n.subject || 'N/A'} · Date: ${new Date(n.pushed_at).toLocaleString()}`, 20, yPos)
      yPos += 8
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(51, 65, 85)
      const textLines = doc.splitTextToSize(n.content, 170)
      doc.text(textLines, 20, yPos)
      yPos += textLines.length * 6 + 10
    })
    
    doc.save(`All_Notes_Compilation_${student.name.replace(/\s+/g, '_')}.pdf`)
  }

  // Download pushed PDF file via local electron saver
  async function handleDownloadPDF(pdf) {
    try {
      const { data } = await getAPI().get(`/pdfs/${pdf.id}/download`, { responseType: 'arraybuffer' })
      const base64 = btoa(
        new Uint8Array(data).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      )
      if (window.electronAPI) {
        const success = await window.electronAPI.savePDF(pdf.filename, base64)
        if (success) alert(`Saved PDF "${pdf.filename}" successfully!`)
      } else {
        const blob = new Blob([data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = pdf.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('[PDF Download] Error:', err)
      alert('Failed to download PDF file.')
    }
  }

  // Monthly breakdown calculation
  const getMonthlyLogs = () => {
    const months = {}
    const records = attStats.records || []
    records.forEach(r => {
      const date = new Date(r.joined_at || Date.now())
      const key = date.toLocaleString('default', { month: 'long', year: 'numeric' })
      if (!months[key]) {
        months[key] = { name: key, total: 0, present: 0 }
      }
      months[key].total++
      if (r.status === 'present') {
        months[key].present++
      }
    })
    return Object.values(months).map(m => ({
      ...m,
      percentage: m.total ? Math.round((m.present / m.total) * 100) : 0
    }))
  }

  const monthlyLogs = getMonthlyLogs()

  // Exam stats calculations
  const totalPercentage = examHistory.reduce((acc, h) => acc + (h.percentage || 0), 0)
  const avgExamPercentage = examHistory.length ? Math.round(totalPercentage / examHistory.length) : 0
  const bestExam = examHistory.reduce((best, cur) => {
    if (!best || (cur.percentage || 0) > (best.percentage || 0)) return cur
    return best
  }, null)

  const last5Exams = [...examHistory].slice(0, 5).reverse()

  const allBadges = [
    { key: 'attendance_star', name: 'Attendance Star', icon: '🌟', desc: 'Maintain >= 75% class attendance' },
    { key: 'coding_champ', name: 'Coding Champ', icon: '💻', desc: 'Submit programming codes during class' },
    { key: 'fast_learner', name: 'Fast Learner', icon: '🚀', desc: 'Pushed materials and studies completed' },
    { key: 'exam_ace', name: 'Exam Ace', icon: '🎖️', desc: 'Score top grades on exams' },
    { key: 'perfect_score', name: 'Perfect Score', icon: '🏆', desc: 'Achieve 100% on any class quiz' },
    { key: 'consistent', name: 'Consistent', icon: '📈', desc: 'Regular classroom connection heartbeats' },
    { key: 'top_performer', name: 'Top Performer', icon: '👑', desc: 'Maintain top averages across subjects' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading student profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white overflow-y-auto pb-12 select-none">
      
      {/* Top Header */}
      <header className="bg-[#1e293b] border-b border-slate-700/50 px-8 py-4 flex items-center justify-between sticky top-0 z-40 drag-region flex-shrink-0">
        <div className="flex items-center gap-3 no-drag">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-white transition-colors font-bold">← Back</button>
          <div>
            <h1 className="font-bold text-white leading-none">Student Profile</h1>
            <p className="text-xs text-slate-400">Detailed logs, badges & attendance history</p>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="no-drag bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors font-semibold">
          Dashboard
        </button>
      </header>

      {profileError && <p role="alert" className="mx-auto mt-4 max-w-4xl rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{profileError}</p>}

      <main className="p-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Personal Card & Badges */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 text-center relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-500"></div>
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-extrabold text-white mx-auto mb-4 border-2 border-indigo-500/20"
              style={{ background: student.avatar_color || '#6366f1' }}>
              {student.name?.slice(0, 1).toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{student.name}</h2>
            <p className="text-sm text-indigo-400 font-bold mt-1">USN: {profile?.usn || student.usn || '—'}</p>
            
            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-700/40 text-left text-xs">
              <div>
                <span className="text-slate-400 block font-semibold">CLASS</span>
                <span className="text-white font-bold">{profile?.semester ? `Semester ${profile.semester}` : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">EMAIL</span>
                <span className="text-white font-bold truncate block" title={student.email}>{student.email}</span>
              </div>
            </div>
          </div>

          {/* Badges Grid */}
          <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 shadow-xl">
            <h3 className="font-bold text-white mb-4 text-xs uppercase tracking-wider border-b border-slate-700/50 pb-2">Unlocked Achievements</h3>
            <div className="grid grid-cols-2 gap-3">
              {allBadges.map(badge => {
                const earned = badges.some(b => b.badge_key === badge.key)
                return (
                  <div key={badge.key} className={`bg-[#0f172a] rounded-xl p-3 border text-center flex flex-col items-center justify-center transition-all duration-300 relative group
                    ${earned ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-slate-800/80 opacity-25 filter grayscale'}`}
                    title={badge.desc}>
                    <div className="relative">
                      <span className="text-3xl mb-1 block select-none">{badge.icon}</span>
                      {!earned && <span className="absolute -top-1 -right-1 text-xs">🔒</span>}
                    </div>
                    <span className="text-xs font-bold text-white leading-tight mt-1 truncate w-full">{badge.name}</span>
                    <span className="text-[9px] text-slate-500 mt-1 leading-none font-bold uppercase tracking-wider">{earned ? 'Earned' : 'Locked'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* MIDDLE & RIGHT COLUMNS: Stats, Charts & Logs */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Circular Progress & Key stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attendance Progress Ring */}
            <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 flex items-center gap-6 shadow-xl">
              <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="36" className="stroke-slate-800 fill-none" strokeWidth="8" />
                  <circle cx="48" cy="48" r="36" className="stroke-emerald-500 fill-none transition-all duration-1000 ease-out" 
                    strokeWidth="8" 
                    strokeDasharray="226.2" 
                    strokeDashoffset={226.2 - (226.2 * (attStats.percentage || 0)) / 100} 
                    strokeLinecap="round" />
                </svg>
                <span className="absolute text-base font-extrabold text-white">{attStats.percentage}%</span>
              </div>
              <div>
                <h4 className="font-bold text-white text-base leading-none">Class Attendance</h4>
                <p className="text-xs text-slate-400 mt-1">Attended {attStats.present} out of {attStats.total} total sessions.</p>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-3
                  ${attStats.percentage >= 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : attStats.percentage >= 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {attStats.percentage >= 75 ? 'Excellent' : attStats.percentage >= 60 ? 'Satisfactory' : 'Critical Warning'}
                </span>
              </div>
            </div>

            {/* Exams undertakings stats */}
            <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 flex flex-col justify-between shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-base leading-none">Exam Analytics</h4>
                  <p className="text-xs text-slate-400 mt-1">Participated in {examHistory.length} MCQ tests.</p>
                </div>
                <div className="text-2xl bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">🎖️</div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/40 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">AVERAGE GRADE</span>
                  <span className="text-white font-extrabold text-base">{avgExamPercentage}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">BEST SCORE</span>
                  <span className="text-indigo-400 font-extrabold text-base">{bestExam ? `${bestExam.percentage}%` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pure CSS Bar Chart */}
          <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 shadow-xl">
            <h3 className="font-bold text-white mb-4 text-xs uppercase tracking-wider border-b border-slate-700/50 pb-2">Last 5 Exams Performance</h3>
            {last5Exams.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-12">Take exams to generate score trends!</p>
            ) : (
              <div className="flex items-end justify-around h-44 pt-6 px-4 bg-[#0f172a] rounded-xl border border-slate-800">
                {last5Exams.map((h, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 group relative mx-2">
                    <span className="absolute -top-7 bg-indigo-650 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-bold border border-indigo-500/30">
                      {h.percentage}% ({h.score}/{h.total})
                    </span>
                    <div className="w-7 bg-indigo-650 hover:bg-indigo-500 rounded-t transition-all duration-700 ease-out" 
                         style={{ height: `${h.percentage}%` }}>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 truncate w-20 text-center font-medium" title={h.title}>
                      {h.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Breakdown Attendance logs */}
          <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 shadow-xl">
            <h3 className="font-bold text-white mb-4 text-xs uppercase tracking-wider border-b border-slate-700/50 pb-2">Monthly Attendance Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2 pb-3 font-semibold uppercase">Month</th>
                    <th className="py-2 pb-3 font-semibold uppercase text-center">Classes Conducted</th>
                    <th className="py-2 pb-3 font-semibold uppercase text-center">Sessions Attended</th>
                    <th className="py-2 pb-3 font-semibold uppercase text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 text-slate-300">
                  {monthlyLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 font-semibold text-white">{log.name}</td>
                      <td className="py-3 text-center font-mono">{log.total}</td>
                      <td className="py-3 text-center font-mono text-emerald-400">{log.present}</td>
                      <td className="py-3 text-right font-bold">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border
                          ${log.percentage >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : log.percentage >= 60 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {log.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {monthlyLogs.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-4 text-center text-slate-500">No attendance history logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shared PDFs & Notes Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pushed PDFs log */}
            <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 shadow-xl flex flex-col">
              <h3 className="font-bold text-white mb-4 text-xs uppercase tracking-wider border-b border-slate-700/50 pb-2">Shared Study Materials</h3>
              {pushedPDFs.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-8">No shared materials in this room.</p>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-56 pr-1 flex-1">
                  {pushedPDFs.map(pdf => (
                    <div key={pdf.id} className="bg-[#0f172a] rounded-xl p-3 border border-slate-800 flex justify-between items-center hover:border-slate-700 transition-colors">
                      <div className="truncate flex-grow pr-3">
                        <p className="text-xs font-bold text-white truncate" title={pdf.filename}>{pdf.filename}</p>
                        <p className="text-[10px] text-slate-400 truncate">{pdf.subject} · {Math.round(pdf.filesize / 1024)} KB</p>
                      </div>
                      <button onClick={() => handleDownloadPDF(pdf)}
                        className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-0.5 flex-shrink-0">
                        📥 Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes history */}
            <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/40 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-2">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">Classroom Notes</h3>
                {notes.length > 0 && (
                  <button onClick={downloadAllNotesAsPDF}
                    className="text-[10px] text-indigo-450 hover:text-indigo-400 font-bold transition-all">
                    Compile All Notes 📝
                  </button>
                )}
              </div>
              {notes.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-8">No saved notes.</p>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-56 pr-1 flex-1">
                  {notes.map(n => (
                    <div key={n.id} className="bg-[#0f172a] rounded-xl p-3 border border-slate-800 flex justify-between items-center hover:border-slate-700 transition-colors">
                      <div className="truncate flex-grow pr-3">
                        <p className="text-xs font-bold text-white truncate" title={n.title}>{n.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{n.subject} · {new Date(n.pushed_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => downloadPDF(n)}
                        className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded text-[10px] font-bold transition-all flex-shrink-0">
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </main>

    </div>
  )
}
