import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { jsPDF } from 'jspdf'

export default function Downloads() {
  const [depts, setDepts] = useState([])
  const [sems, setSems] = useState([])
  const [uniDetails, setUniDetails] = useState(null)
  const [loading, setLoading] = useState(true)

  // Card 1: Student List Filters
  const [c1Dept, setC1Dept] = useState('')
  const [c1Sem, setC1Sem] = useState('')

  // Card 2: Attendance Filters
  const [c2From, setC2From] = useState('')
  const [c2To, setC2To] = useState('')
  const [c2Dept, setC2Dept] = useState('')

  // Card 3: Exam Filters
  const [c3Dept, setC3Dept] = useState('')
  const [c3Sem, setC3Sem] = useState('')

  // Card 4: Session Filters
  const [c4From, setC4From] = useState('')
  const [c4To, setC4To] = useState('')

  // Spinners
  const [spinners, setSpinners] = useState({ c1: false, c2: false, c3: false, c4: false, c5: false })

  useEffect(() => {
    loadMetadata()
  }, [])

  async function loadMetadata() {
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        setUniDetails(uni)
        if (uni) {
          const { data } = await api.get(`/departments/university/${uni.id}`)
          setDepts(data.departments || [])
          
          if (data.departments?.length > 0) {
            // Load semesters for the first department just to have it
            const semRes = await api.get(`/semesters/department/${data.departments[0].id}`)
            setSems(semRes.data.semesters || [])
          }
        }
      }
    } catch (e) {
      console.error('Failed to load downloads metadata:', e)
    } finally {
      setLoading(false)
    }
  }

  const triggerCSVDownload = async (cardKey, url, defaultFilename) => {
    setSpinners(prev => ({ ...prev, [cardKey]: true }))
    try {
      const response = await api.get(url)
      if (window.electronAPI) {
        const res = await window.electronAPI.saveFile(defaultFilename, response.data, 'csv')
        if (res.success) alert(`CSV saved to: ${res.path}`)
      }
    } catch (err) {
      alert('CSV Export failed.')
    } finally {
      setSpinners(prev => ({ ...prev, [cardKey]: false }))
    }
  }

  // Generates Full University Report PDF
  const downloadFullReport = async () => {
    setSpinners(prev => ({ ...prev, c5: true }))
    try {
      if (window.electronAPI && uniDetails) {
        const doc = new jsPDF()

        // Page 1: Coversheet
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(26)
        doc.setTextColor(79, 70, 229)
        doc.text('NEXCLASS COMPLIANCE AUDIT', 20, 50)
        
        doc.setFontSize(16)
        doc.setTextColor(51, 65, 85)
        doc.text(uniDetails.name.toUpperCase(), 20, 62)
        
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text(`Official Code: ${uniDetails.code}`, 20, 74)
        doc.text(`Generated On: ${new Date().toLocaleString()}`, 20, 80)
        doc.text('Administrative compliance metrics audit details packet.', 20, 86)
        
        doc.line(20, 92, 190, 92)

        // Fetch metrics to populate
        const [statsRes, deptRes] = await Promise.all([
          api.get(`/universities/${uniDetails.id}/stats`),
          api.get(`/departments/university/${uniDetails.id}`)
        ])

        const s = statsRes.data
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('1. Institutional Statistics', 20, 110)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text(`- Enrolled Students count: ${s.total_students}`, 25, 120)
        doc.text(`- Registered Departments: ${s.total_departments}`, 25, 126)
        doc.text(`- Approved Teachers: ${s.total_teachers}`, 25, 132)
        doc.text(`- Classroom Sessions Today: ${s.sessions_today}`, 25, 138)
        doc.text(`- Overall Attendance Percentage: ${s.overall_attendance_pct}%`, 25, 144)
        doc.text(`- Academic Score Average: ${s.university_avg_score}%`, 25, 150)

        // Page 2: Department Roster
        doc.addPage()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('2. Department Audits', 20, 20)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        let y = 32
        deptRes.data.departments?.forEach(d => {
          doc.text(`- Code: ${d.code} | Name: ${d.name} | Teachers: ${d.teacher_count} | Students: ${d.student_count}`, 20, y)
          y += 8
        })

        const pdfBase64 = doc.output('datauristring')
        const saveRes = await window.electronAPI.saveFile('university_full_audit.pdf', pdfBase64, 'pdf')
        if (saveRes.success) alert(`Full audit PDF saved to: ${saveRes.path}`)
      }
    } catch (err) {
      console.error(err)
      alert('PDF generation failed.')
    } finally {
      setSpinners(prev => ({ ...prev, c5: false }))
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400 font-semibold animate-pulse text-xs">Loading utilities...</div>

  }

  return (
    <div className="space-y-6 select-none">
      
      {/* Page Header */}
      <div>
        <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Compliance File Exports</h3>
        <p className="text-xs text-slate-500 mt-1">Export raw student, exam, and attendance metrics into CSV or PDF formats.</p>
      </div>

      {/* Grid Cards of downloads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Student List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-2xl block">👨‍🎓</span>
            <h4 className="font-extrabold text-slate-950 text-sm uppercase tracking-wider">Students Registry List</h4>
            <p className="text-slate-500 text-xs leading-relaxed">Download student details, roll numbers, semesters, and contact emails filtered by department.</p>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <select value={c1Dept} onChange={e => setC1Dept(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors">
                <option value="">All Depts</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
              <select value={c1Sem} onChange={e => setC1Sem(e.target.value)} disabled={!c1Dept}
                className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors disabled:opacity-50">
                <option value="">All Sems</option>
                {sems.map(s => <option key={s.id} value={s.id}>Sem {s.number}</option>)}
              </select>
            </div>
          </div>
          
          <button 
            onClick={() => triggerCSVDownload('c1', `/universities/${uniDetails.id}/export/students?dept_id=${c1Dept}&sem_id=${c1Sem}`, 'students_register.csv')}
            disabled={spinners.c1}
            className="w-full bg-[#4F46E5] hover:bg-indigo-755 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md mt-6 uppercase tracking-wider">
            {spinners.c1 ? 'Exporting CSV...' : 'Download Student CSV'}
          </button>
        </div>

        {/* Card 2: Attendance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-2xl block">📅</span>
            <h4 className="font-extrabold text-slate-950 text-sm uppercase tracking-wider">Classroom Attendance Logs</h4>
            <p className="text-slate-500 text-xs leading-relaxed">Download attendance sign-in timestamps and status parameters (present, late, absent) for audit reports.</p>
            
            <div className="grid grid-cols-3 gap-2 pt-2">
              <input type="date" value={c2From} onChange={e => setC2From(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:bg-white rounded-lg px-2 py-1 text-xs focus:outline-none" />
              <input type="date" value={c2To} onChange={e => setC2To(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:bg-white rounded-lg px-2 py-1 text-xs focus:outline-none" />
              <select value={c2Dept} onChange={e => setC2Dept(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2 py-1 text-xs focus:outline-none">
                <option value="">All Depts</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={() => triggerCSVDownload('c2', `/universities/${uniDetails.id}/export/attendance?from=${c2From}&to=${c2To}&dept_id=${c2Dept}`, 'attendance_records.csv')}
            disabled={spinners.c2}
            className="w-full bg-[#4F46E5] hover:bg-indigo-755 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md mt-6 uppercase tracking-wider">
            {spinners.c2 ? 'Exporting CSV...' : 'Download Attendance CSV'}
          </button>
        </div>

        {/* Card 3: Exam Results */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-2xl block">🏆</span>
            <h4 className="font-extrabold text-slate-950 text-sm uppercase tracking-wider">Academic Exam Results</h4>
            <p className="text-slate-500 text-xs leading-relaxed">Download grade scores, answer keys compliance rates, and scores metrics from active tests.</p>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <select value={c3Dept} onChange={e => setC3Dept(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors">
                <option value="">All Depts</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
              <select value={c3Sem} onChange={e => setC3Sem(e.target.value)} disabled={!c3Dept}
                className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none transition-colors disabled:opacity-50">
                <option value="">All Sems</option>
                {sems.map(s => <option key={s.id} value={s.id}>Sem {s.number}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={() => triggerCSVDownload('c3', `/universities/${uniDetails.id}/export/exams?dept_id=${c3Dept}&sem_id=${c3Sem}`, 'exam_grades.csv')}
            disabled={spinners.c3}
            className="w-full bg-[#4F46E5] hover:bg-indigo-755 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md mt-6 uppercase tracking-wider">
            {spinners.c3 ? 'Exporting CSV...' : 'Download Grades CSV'}
          </button>
        </div>

        {/* Card 4: Full University Audit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-2xl block">📄</span>
            <h4 className="font-extrabold text-slate-950 text-sm uppercase tracking-wider">Full Institution Audit Packet</h4>
            <p className="text-slate-500 text-xs leading-relaxed">Generate a comprehensive audit document containing statistics, department listings, student attendance averages, and top scores.</p>
          </div>

          <button 
            onClick={downloadFullReport}
            disabled={spinners.c5}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md mt-6 uppercase tracking-wider">
            {spinners.c5 ? 'Compiling PDF...' : 'Download Full PDF Audit'}
          </button>
        </div>

      </div>

    </div>
  )
}
