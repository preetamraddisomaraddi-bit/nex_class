import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Departments() {
  const [depts, setDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [editingId, setEditingId] = useState(null)
  
  const [form, setForm] = useState({ name: '', code: '', hod_name: '' })
  const [error, setError] = useState('')
  const [btnLoading, setBtnLoading] = useState(false)

  useEffect(() => {
    loadDepartments()
  }, [])

  async function loadDepartments() {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (uni) {
          const { data } = await api.get(`/departments/university/${uni.id}`)
          setDepts(data.departments || [])
        }
      }
    } catch (err) {
      console.error('Failed to load departments:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBtnLoading(true)
    setError('')
    try {
      if (window.electronAPI) {
        const uni = await window.electronAPI.getData('university')
        if (!uni) return

        if (modalMode === 'add') {
          await api.post('/departments', {
            university_id: uni.id,
            name: form.name,
            code: form.code,
            hod_name: form.hod_name
          })
        } else {
          await api.put(`/departments/${editingId}`, {
            name: form.name,
            code: form.code,
            hod_name: form.hod_name
          })
        }

        setShowModal(false)
        setForm({ name: '', code: '', hod_name: '' })
        loadDepartments()
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.')
    } finally {
      setBtnLoading(false)
    }
  }

  function openEdit(dept) {
    setModalMode('edit')
    setEditingId(dept.id)
    setForm({ name: dept.name, code: dept.code, hod_name: dept.hod_name || '' })
    setError('')
    setShowModal(true)
  }

  function openAdd() {
    setModalMode('add')
    setForm({ name: '', code: '', hod_name: '' })
    setError('')
    setShowModal(true)
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this department? This cannot be undone.')) return
    try {
      const { data } = await api.delete(`/departments/${id}`)
      if (data.success) {
        loadDepartments()
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete department.')
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
      
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">Departments</h3>
          <p className="text-xs text-slate-500 mt-1">Configure academic divisions and heads of departments.</p>
        </div>
        <button onClick={openAdd}
          className="bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10">
          + Add Department
        </button>
      </div>

      {/* Table grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-250 bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <th className="py-3.5 px-6">Code</th>
              <th className="py-3.5 px-6">Department Name</th>
              <th className="py-3.5 px-6">H.O.D. Name</th>
              <th className="py-3.5 px-6 text-center">Teachers</th>
              <th className="py-3.5 px-6 text-center">Students</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {depts.map(dept => (
              <tr key={dept.id} className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-mono font-bold text-[#4F46E5]">{dept.code}</td>
                <td className="py-4 px-6 font-bold text-slate-900">{dept.name}</td>
                <td className="py-4 px-6 font-medium text-slate-800">{dept.hod_name || 'Not assigned'}</td>
                <td className="py-4 px-6 text-center font-semibold text-slate-500">{dept.teacher_count}</td>
                <td className="py-4 px-6 text-center font-semibold text-slate-500">{dept.student_count}</td>
                <td className="py-4 px-6 text-right space-x-2">
                  <button onClick={() => openEdit(dept)} className="text-indigo-650 hover:text-indigo-850 font-bold hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(dept.id)} className="text-red-600 hover:text-red-850 font-bold hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {depts.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">No departments registered. Add one above!</td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Footer info counts */}
        <div className="bg-slate-50/50 border-t border-slate-100 py-3.5 px-6 flex justify-between items-center text-slate-400 font-medium">
          <span>Total Departments: <strong className="text-slate-800">{depts.length}</strong></span>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md border border-slate-200 shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#4F46E5] rounded-t-2xl"></div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-6">
              {modalMode === 'add' ? 'Add New Department' : 'Edit Department Details'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Department Code *</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 8) }))} required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors font-mono font-bold tracking-wider"
                  placeholder="e.g. CSE" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Department Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors font-medium"
                  placeholder="e.g. Computer Science & Engineering" />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Head of Department (H.O.D.)</label>
                <input value={form.hod_name} onChange={e => setForm(f => ({ ...f, hod_name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none transition-colors"
                  placeholder="e.g. Dr. Ramesh Kumar" />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-500 font-semibold">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} disabled={btnLoading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl transition-colors font-semibold border border-slate-200 text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={btnLoading}
                  className="flex-1 bg-[#4F46E5] hover:bg-indigo-755 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-600/10 text-xs">
                  {btnLoading ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
