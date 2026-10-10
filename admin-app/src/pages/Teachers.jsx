import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Teachers() {
  const [activeTab, setActiveTab] = useState('approved') // 'approved' or 'pending'
  const [approvedList, setApprovedList] = useState([])
  const [pendingList, setPendingList] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showDetail, setShowDetail] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [teacherSessions, setTeacherSessions] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    loadTeachers()
  }, [])

  async function loadTeachers() {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const [appRes, pendRes] = await Promise.all([
            api.get(`/universities/${uni.id}/teachers?status=approved`),
            api.get(`/universities/${uni.id}/teachers?status=pending`)
          ])
          setApprovedList(appRes.data.teachers || [])
          setPendingList(pendRes.data.teachers || [])
        }
      }
    } catch (err) {
      console.error('Failed to load teachers lists:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id) {
    if (!confirm('Approve registration for this instructor?')) return
    try {
      await api.post(`/auth/teacher/approve/${id}`)
      loadTeachers()
    } catch (err) {
      alert('Failed to approve teacher.')
    }
  }

  async function handleReject(id) {
    if (!confirm('Reject and delete this registration?')) return
    try {
      await api.post(`/auth/teacher/reject/${id}`)
      loadTeachers()
    } catch (err) {
      alert('Failed to reject registration.')
    }
  }

  async function handleRemove(id) {
    if (!confirm('Are you sure you want to remove this instructor? All their sessions will remain logged but they will not be able to login.')) return
    try {
      await api.delete(`/teachers/${id}`)
      loadTeachers()
    } catch (err) {
      alert('Failed to delete teacher.')
    }
  }

  async function openDetails(teacher) {
    setSelectedTeacher(teacher)
    setTeacherSessions([])
    setDetailLoading(true)
    setShowDetail(true)
    try {
      // Load sessions conducted by this teacher
      const { data } = await api.get(`/rooms/teacher/${teacher.id}`)
      setTeacherSessions(data.rooms?.slice(0, 5) || [])
    } catch (e) {
      console.error('Failed to load teacher detail logs:', e)
    } finally {
      setDetailLoading(false)
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

  const list = activeTab === 'approved' ? approvedList : pendingList

  return (
    <div className="space-y-6 select-none">
      
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Teachers</h3>
          <p className="text-xs text-slate-500 mt-1">Audit academic instructors and approve account registration requests.</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
        <button onClick={() => setActiveTab('approved')}
          className={`pb-3 px-4 border-b-2 transition-all ${
            activeTab === 'approved' 
              ? 'border-[#4F46E5] text-[#4F46E5]' 
              : 'border-transparent text-slate-400 hover:text-slate-900'
          }`}>
          Approved ({approvedList.length})
        </button>
        <button onClick={() => setActiveTab('pending')}
          className={`pb-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'pending' 
              ? 'border-[#4F46E5] text-[#4F46E5]' 
              : 'border-transparent text-slate-400 hover:text-slate-900'
          }`}>
          Pending Approval
          {pendingList.length > 0 && (
            <span className="bg-[#DC2626] text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full">
              {pendingList.length}
            </span>
          )}
        </button>
      </div>

      {/* Teachers list table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-250 bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <th className="py-3.5 px-6">Name</th>
              <th className="py-3.5 px-6">Employee ID</th>
              <th className="py-3.5 px-6">Department</th>
              <th className="py-3.5 px-6">Email Address</th>
              {activeTab === 'approved' ? (
                <>
                  <th className="py-3.5 px-6">Last Live Class</th>
                  <th className="py-3.5 px-6 text-center">Total Sessions</th>
                </>
              ) : (
                <th className="py-3.5 px-6">Registered On</th>
              )}
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(teacher => (
              <tr key={teacher.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-bold text-slate-900">{teacher.name}</td>
                <td className="py-4 px-6 font-mono font-bold text-slate-600">{teacher.employee_id || 'N/A'}</td>
                <td className="py-4 px-6 font-semibold text-slate-500">{teacher.department_name || 'Standalone'}</td>
                <td className="py-4 px-6 text-slate-500 font-medium">{teacher.email}</td>
                
                {activeTab === 'approved' ? (
                  <>
                    <td className="py-4 px-6 text-slate-400 font-medium">
                      {teacher.last_session_date ? new Date(teacher.last_session_date).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-4 px-6 text-center font-extrabold text-slate-700">{teacher.total_sessions}</td>
                    <td className="py-4 px-6 text-right space-x-3">
                      <button onClick={() => openDetails(teacher)} className="text-[#4F46E5] hover:text-indigo-850 font-bold hover:underline">
                        View Details
                      </button>
                      <button onClick={() => handleRemove(teacher.id)} className="text-[#DC2626] hover:text-red-850 font-bold hover:underline">
                        Remove
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-4 px-6 text-slate-400 font-medium">{new Date(teacher.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-6 text-right space-x-3">
                      <button onClick={() => handleApprove(teacher.id)} className="text-emerald-650 hover:text-emerald-850 font-bold hover:underline">
                        Approve
                      </button>
                      <button onClick={() => handleReject(teacher.id)} className="text-[#DC2626] hover:text-red-850 font-bold hover:underline">
                        Reject
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={activeTab === 'approved' ? 7 : 6} className="text-center py-12 text-slate-400 font-medium">
                  No instructors found in this segment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Teacher details modal */}
      {showDetail && selectedTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl border border-slate-200 shadow-2xl relative max-h-[90vh] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>

            <div className="mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-150 flex items-center justify-center text-lg font-bold text-indigo-700">
                {selectedTeacher.name?.slice(0,2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedTeacher.name}</h3>
                <p className="text-xs text-slate-400">Employee ID: <strong className="font-mono text-slate-600">{selectedTeacher.employee_id || 'N/A'}</strong></p>
              </div>
            </div>

            <div className="space-y-4 flex-grow overflow-y-auto mb-6">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3">
                  <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wide mb-1">Academic Department</span>
                  <span className="text-slate-800 font-bold">{selectedTeacher.department_name || 'Standalone'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3">
                  <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wide mb-1">Classroom Subject</span>
                  <span className="text-slate-800 font-bold">{selectedTeacher.subject || 'Not Set'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Classes Held (Max 5)</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {detailLoading ? (
                    <div className="text-center py-6 text-slate-400 font-semibold animate-pulse">Fetching class history...</div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[9px] font-bold tracking-wider">
                          <th className="py-2 px-3">Room</th>
                          <th className="py-2 px-3">Subject / Topic</th>
                          <th className="py-2 px-3 text-right">Class Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {teacherSessions.map(sess => (
                          <tr key={sess.id}>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{sess.code}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {sess.subject} &middot; <span className="text-slate-400 font-normal">{sess.topic || 'No topic'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 font-bold">{sess.class_name}</td>
                          </tr>
                        ))}
                        {teacherSessions.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center py-6 text-slate-450 font-medium">No live sessions conducted yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowDetail(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2 rounded-xl transition-all border border-slate-200 text-xs">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
