import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { apiRequest, getHODServerURL } from '../api'

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
  const [realtime, setRealtime] = useState({
    connected: false,
    error: '',
    onlineTeachers: [],
    activeRooms: [],
    recentEvents: [],
  })

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

  useEffect(() => {
    let socket
    let mounted = true

    const resetRealtime = () => setRealtime({
      connected: false,
      error: '',
      onlineTeachers: [],
      activeRooms: [],
      recentEvents: [],
    })

    const appendEvent = (type, message, details = {}) => {
      setRealtime(previous => ({
        ...previous,
        recentEvents: [{ id: `${Date.now()}-${Math.random()}`, type, message, at: new Date().toISOString(), ...details }, ...previous.recentEvents].slice(0, 8),
      }))
    }

    const connect = () => {
      socket?.disconnect()
      socket = null
      const token = window.localStorage.getItem('nexclass_token')
      if (!token) {
        resetRealtime()
        return
      }

      socket = io(getHODServerURL(), {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
        timeout: 10000,
      })

      socket.on('connect', () => {
        if (mounted) setRealtime(previous => ({ ...previous, connected: true, error: '' }))
      })
      socket.on('disconnect', () => {
        if (mounted) setRealtime(previous => ({ ...previous, connected: false }))
      })
      socket.on('connect_error', error => {
        if (mounted) setRealtime(previous => ({ ...previous, connected: false, error: error.message || 'Live connection unavailable' }))
      })
      socket.on('hod:online-teachers', rows => {
        if (mounted) setRealtime(previous => ({ ...previous, onlineTeachers: Array.isArray(rows) ? rows : [] }))
      })
      socket.on('hod:active-rooms', rows => {
        if (mounted) setRealtime(previous => ({ ...previous, activeRooms: Array.isArray(rows) ? rows : [] }))
      })
      socket.on('teacher:online', teacher => {
        if (!mounted) return
        setRealtime(previous => ({ ...previous, onlineTeachers: [...previous.onlineTeachers.filter(item => item.id !== teacher.id), teacher] }))
        appendEvent('teacher', `${teacher.name} came online`)
      })
      socket.on('teacher:offline', teacher => {
        if (!mounted) return
        setRealtime(previous => ({ ...previous, onlineTeachers: previous.onlineTeachers.filter(item => item.id !== teacher.teacher_id) }))
        appendEvent('teacher', `${teacher.name || 'A teacher'} went offline`)
      })
      socket.on('session:started', session => {
        if (!mounted) return
        setRealtime(previous => ({ ...previous, activeRooms: [...previous.activeRooms.filter(room => room.room_code !== session.room_code), { ...session, students: [] }] }))
        appendEvent('session', `${session.subject} session started · ${session.room_code}`)
      })
      socket.on('session:ended', session => {
        if (!mounted) return
        setRealtime(previous => ({ ...previous, activeRooms: previous.activeRooms.filter(room => room.room_code !== session.room_code) }))
        appendEvent('session', `Session ${session.room_code} ended`)
      })
      socket.on('student:joined', student => {
        if (!mounted) return
        setRealtime(previous => ({
          ...previous,
          activeRooms: previous.activeRooms.map(room => room.room_code === student.room_code
            ? { ...room, students: [...new Set([...(room.students || []), student.student_id])] }
            : room),
        }))
        appendEvent('student', `${student.name} joined ${student.room_code}`, { usn: student.usn })
      })
      socket.on('student:offline', student => appendEvent('student', `${student.name || 'A student'} disconnected from ${student.room_code || 'a session'}`))
      socket.on('note:pushed', note => appendEvent('note', `A teacher shared notes in ${note.room_code}`))
      socket.on('exam:launched', exam => appendEvent('exam', `${exam.title || 'An exam'} started in ${exam.room_code}`))
      socket.on('exam:submitted', submission => appendEvent('exam', `A student submitted an exam in ${submission.room_code}`))
      socket.on('code:submitted', submission => appendEvent('code', `A student submitted code in ${submission.room_code}`))
      socket.on('student:status', status => appendEvent('student', `${status.name || 'Student'} is ${status.status || 'active'} in ${status.room_code || 'a session'}`))
    }

    const handleAuthChange = event => {
      if (event.detail) connect()
      else {
        socket?.disconnect()
        socket = null
        resetRealtime()
      }
    }

    window.addEventListener('nexclass-auth-change', handleAuthChange)
    if (window.localStorage.getItem('nexclass_token')) connect()
    return () => {
      mounted = false
      window.removeEventListener('nexclass-auth-change', handleAuthChange)
      socket?.disconnect()
    }
  }, [])

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
      approveTeacher, rejectTeacher, pendingCount, realtime
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
