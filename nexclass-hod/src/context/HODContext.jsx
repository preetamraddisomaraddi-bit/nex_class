import { createContext, useContext, useState } from 'react'
import { TEACHERS } from '../data/mockData'

const HODContext = createContext(null)

export function HODProvider({ children }) {
  const [teachers, setTeachers] = useState(() => TEACHERS.map(teacher => ({ ...teacher })))

  const approveTeacher = teacherId => {
    setTeachers(previous => previous.map(teacher => (
      teacher.id === teacherId
        ? { ...teacher, status: 'approved' }
        : teacher
    )))
  }

  const rejectTeacher = teacherId => {
    setTeachers(previous => previous.filter(teacher => teacher.id !== teacherId))
  }

  const pendingCount = teachers.filter(teacher => teacher.status === 'pending').length

  return (
    <HODContext.Provider value={{ teachers, approveTeacher, rejectTeacher, pendingCount }}>
      {children}
    </HODContext.Provider>
  )
}

export const useHOD = () => useContext(HODContext)
