import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Semesters() {
  const [depts, setDepts] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [sems, setSems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showStudentsModal, setShowStudentsModal] = useState(false)

  const [activeSem, setActiveSem] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [semesterStudents, setSemesterStudents] = useState([])
  const [studsLoading, setStudsLoading] = useState(false)

  // Forms
  const [addForm, setAddForm] = useState({ department_id: '', number: '1', academic_year: '' })
  const [error, setError] = useState('')
  const [btnLoading, setBtnLoading] = useState(false)

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    if (selectedDeptId) {
      loadSemesters(selectedDeptId)
    } else {
      setSems([])
    }
  }, [selectedDeptId])

  async function loadDepartments() {
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const { data } = await api.get(`/departments/university/${uni.id}`)
          setDepts(data.departments || [])
          if (data.departments?.length > 0) {
            setSelectedDeptId(data.departments[0].id)
            setAddForm(prev => ({ ...prev, department_id: data.departments[0].id }))
          }
        }
      }
    } catch (err) {
      console.error('Error loading depts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadSemesters(deptId) {
    try {
      const { data } = await api.get(`/semesters/department/${deptId}`)
      setSems(data.semesters || [])
    } catch (err) {
      console.error('Error loading semesters:', err)
    }
  }

  async function handleAddSemester(e) {
    e.preventDefault()
    setBtnLoading(true)
    setError('')
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (!uni) return

        await api.post('/semesters', {
          university_id: uni.id,
          department_id: addForm.department_id,
          number: parseInt(addForm.number),
          academic_year: addForm.academic_year
        })

        setShowAddModal(false)
        setAddForm(prev => ({ ...prev, number: '1', academic_year: '' }))
        if (selectedDeptId === addForm.department_id) {
          loadSemesters(selectedDeptId)
        } else {
          setSelectedDeptId(addForm.department_id)
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.')
    } finally {
      setBtnLoading(false)
    }
  }

  async function openAssignModal(sem) {
    setActiveSem(sem)
    setSelectedTeacherId('')
    setError('')
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          // Fetch teachers in this university
          const { data } = await api.get(`/universities/${uni.id}/teachers?status=approved`)
          // Filter teachers in same department
          const deptTeachers = (data.teachers || []).filter(t => t.department_name === depts.find(d => d.id === sem.department_id)?.name)
          setTeachers(deptTeachers)
        }
      }
      setShowAssignModal(true)
    } catch (e) {
      console.error('Failed to load teachers:', e)
    }
  }

  async function handleAssignTeacher(e) {
    e.preventDefault()
    if (!selectedTeacherId) return
    setBtnLoading(true)
    setError('')
    try {
      await api.post(`/semesters/${activeSem.id}/assign-teacher`, {
        teacher_id: parseInt(selectedTeacherId)
      })
      setShowAssignModal(false)
      alert('Teacher assigned successfully!')
    } catch (err) {
      setError(err.response?.data?.error || 'Assignment failed.')
    } finally {
      setBtnLoading(false)
    }
  }

  async function openStudentsModal(sem) {
    setActiveSem(sem)
    setSemesterStudents([])
    setStudsLoading(true)
    setShowStudentsModal(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          // Fetch all students in this semester with grades
          const { data } = await api.get(`/semesters/${sem.id}/students`)
          // Fetch overall students to get grade + attendance metrics
          const studentsList = await api.get(`/universities/${uni.id}/students?dept_id=${sem.department_id}&sem_id=${sem.id}`)
          
          // Map scores and attendance percentages
          const mapped = (data.students || []).map(s => {
            const metrics = (studentsList.data.students || []).find(ml => ml.id === s.id)
            return {
              ...s,
              attendance_pct: metrics ? metrics.attendance_pct : 0,
              avg_score: metrics ? metrics.avg_score : 0
            }
          })
          
          setSemesterStudents(mapped)
        }
      }
    } catch (e) {
      console.error('Failed to load semester students:', e)
    } finally {
      setStudsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse select-none">
        <div className="h-10 w-48 bg-slate-200 rounded-lg"></div>
        <div className="h-64 bg-white border border-slate-200 rounded-2xl"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 select-none">
      
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Semesters</h3>
          <p className="text-xs text-slate-500 mt-1">Manage department semesters and map student course years.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Department Filter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Department:</span>
            <select value={selectedDeptId} onChange={e => setSelectedDeptId(e.target.value)}
              className="bg-white border border-slate-250 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none transition-colors">
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.code}</option>
              ))}
            </select>
          </div>
          
          <button onClick={() => setShowAddModal(true)}
            className="bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10">
            + Add Semester
          </button>
        </div>
      </div>

      {/* Semesters Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-250 bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <th className="py-3.5 px-6">Semester Number</th>
              <th className="py-3.5 px-6">Department</th>
              <th className="py-3.5 px-6">Academic Year</th>
              <th className="py-3.5 px-6 text-center">Students Enrolled</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sems.map(sem => (
              <tr key={sem.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-bold text-[#4F46E5] text-sm">Semester {sem.number}</td>
                <td className="py-4 px-6 font-bold text-slate-900">{depts.find(d => d.id === sem.department_id)?.name || 'N/A'}</td>
                <td className="py-4 px-6 font-medium text-slate-500">{sem.academic_year || 'N/A'}</td>
                <td className="py-4 px-6 text-center font-bold text-slate-700">
                  <button onClick={() => openStudentsModal(sem)} className="hover:text-[#4F46E5] hover:underline font-extrabold">
                    {sem.student_count} Students
                  </button>
                </td>
                <td className="py-4 px-6 text-right space-x-3">
                  <button onClick={() => openAssignModal(sem)} className="text-[#4F46E5] hover:text-indigo-850 font-bold hover:underline">
                    Assign Teacher
                  </button>
                </td>
              </tr>
            ))}
            {sems.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400 font-medium">No semesters registered for this department. Add one above!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Semester Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md border border-slate-200 shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-6">Add New Semester</h3>
            <form onSubmit={handleAddSemester} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Select Department *</label>
                <select value={addForm.department_id} onChange={e => setAddForm(f => ({ ...f, department_id: e.target.value }))} required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors">
                  {depts.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Semester Number *</label>
                  <select value={addForm.number} onChange={e => setAddForm(f => ({ ...f, number: e.target.value }))} required
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>Semester {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Academic Year *</label>
                  <input value={addForm.academic_year} onChange={e => setAddForm(f => ({ ...f, academic_year: e.target.value }))} required
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors font-medium"
                    placeholder="e.g. 2024-25" />
                </div>
              </div>

              {error && <p className="text-red-500 text-xs bg-red-50 p-2.5 rounded-lg border border-red-100">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} disabled={btnLoading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl transition-colors font-semibold border border-slate-200 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={btnLoading}
                  className="flex-1 bg-[#4F46E5] hover:bg-indigo-755 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/10 text-xs">
                  {btnLoading ? 'Adding...' : 'Add Semester'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Teacher Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md border border-slate-200 shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2">Assign Course Instructor</h3>
            <p className="text-slate-500 text-xs mb-6">Assign an approved teacher of this department to Semester {activeSem?.number}.</p>
            
            <form onSubmit={handleAssignTeacher} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Approved Teachers List *</label>
                <select value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none transition-colors">
                  <option value="">-- Choose Instructor --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (Emp ID: {t.employee_id || 'N/A'})</option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">No approved teachers available in this department.</p>
                )}
              </div>

              {error && <p className="text-red-500 text-xs bg-red-50 p-2.5 rounded-lg border border-red-100">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} disabled={btnLoading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl transition-colors font-semibold border border-slate-200 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={btnLoading || !selectedTeacherId}
                  className="flex-1 bg-[#4F46E5] hover:bg-indigo-755 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/10 text-xs">
                  {btnLoading ? 'Assigning...' : 'Assign Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Students Modal */}
      {showStudentsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl border border-slate-200 shadow-2xl relative max-h-[90vh] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>
            
            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900">Enrolled Students</h3>
              <p className="text-slate-500 text-xs mt-0.5">List of students in Semester {activeSem?.number} &middot; {depts.find(d => d.id === activeSem?.department_id)?.code}</p>
            </div>

            <div className="flex-grow overflow-y-auto min-h-[300px] border border-slate-200 rounded-xl">
              {studsLoading ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs animate-pulse">Loading Students...</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                      <th className="py-2.5 px-4">USN</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4 text-center">Attendance %</th>
                      <th className="py-2.5 px-4 text-center">Avg Exam Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {semesterStudents.map(student => (
                      <tr key={student.id}>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{student.usn || 'N/A'}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{student.name}</td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className={`${student.attendance_pct >= 75 ? 'text-emerald-600' : student.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {student.attendance_pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-extrabold text-slate-700">{student.avg_score !== null ? `${Math.round(student.avg_score)}%` : 'No Exams'}</td>
                      </tr>
                    ))}
                    {semesterStudents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-400 font-medium">No students enrolled in this semester segment.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowStudentsModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2 rounded-xl transition-all border border-slate-200 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
