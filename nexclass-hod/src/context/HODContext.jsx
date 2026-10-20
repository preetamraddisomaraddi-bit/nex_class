import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiRequest } from '../api'

const HODContext = createContext(null)

const makeInitials = name => String(name || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0].toUpperCase())
  .join('')

const fromServer = teacher => ({
  ...teacher,
  fromServer: true,
  initials: makeInitials(teacher.name),
  employeeId: teacher.employee_id,
  joinedDate: teacher.created_at,
  lastActive: teacher.last_active,
  totalClasses: Number(teacher.total_classes || 0),
  avgDuration: Number(teacher.avg_duration || 0),
  totalStudentsTaught: Number(teacher.total_students_taught || 0),
  totalNotesPushed: Number(teacher.total_notes_pushed || 0),
  sessions: [],
  examsConducted: [],
})

export function HODProvider({ children }) {
  const [teachers, setTeachers] = useState([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)
  const [teacherLoadError, setTeacherLoadError] = useState('')

  const refreshTeachers = useCallback(async () => {
    if (!window.localStorage.getItem('nexclass_token')) {
      setTeachers([])
      return
    }
    setLoadingTeachers(true)
    try {
      const rows = await apiRequest('/teachers')
      setTeachers(Array.isArray(rows) ? rows.map(fromServer) : [])
      setTeacherLoadError('')
    } catch (error) {
      setTeacherLoadError(error.message)
      throw error
    } finally {
      setLoadingTeachers(false)
    }
  }, [])

  useEffect(() => {
    const handleAuthChange = event => {
      if (event.detail) refreshTeachers().catch(() => {})
      else {
        setTeachers([])
        setTeacherLoadError('')
      }
    }
    window.addEventListener('nexclass-auth-change', handleAuthChange)
    if (window.localStorage.getItem('nexclass_token')) refreshTeachers().catch(() => {})
    return () => window.removeEventListener('nexclass-auth-change', handleAuthChange)
  }, [refreshTeachers])

  const approveTeacher = async teacherId => {
    const result = await apiRequest(`/teachers/${teacherId}/approve`, { method: 'PATCH' })
    const updated = fromServer(result.teacher)
    setTeachers(previous => previous.map(teacher => teacher.id === teacherId ? updated : teacher))
    return updated
  }

  const rejectTeacher = async teacherId => {
    await apiRequest(`/teachers/${teacherId}/reject`, { method: 'PATCH' })
    setTeachers(previous => previous.filter(teacher => teacher.id !== teacherId))
  }

  const pendingCount = teachers.filter(teacher => teacher.status === 'pending').length

  return (
    <HODContext.Provider value={{
      teachers, loadingTeachers, teacherLoadError, refreshTeachers,
      approveTeacher, rejectTeacher, pendingCount
    }}>
      {children}
    </HODContext.Provider>
  )
}

export const useHOD = () => {
  const context = useContext(HODContext)
  if (!context) throw new Error('useHOD must be used inside HODProvider')
  return context
}
