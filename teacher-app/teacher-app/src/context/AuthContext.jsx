import { createContext, useContext, useEffect, useState } from 'react'
import { connectSocket, disconnectSocket } from '../socket.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [teacher, setTeacher] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem('nexclass_server_url') || 'http://localhost:3000'
  )

  useEffect(() => {
    const token = localStorage.getItem('nexclass_teacher_token')
    const savedTeacher = localStorage.getItem('nexclass_teacher_data')
    if (token && savedTeacher) {
      try {
        const teacherData = JSON.parse(savedTeacher)
        setTeacher(teacherData)
        connectSocket(serverUrl, teacherData)
      } catch {
        localStorage.removeItem('nexclass_teacher_token')
        localStorage.removeItem('nexclass_teacher_data')
      }
    }
    setIsLoading(false)
    return () => disconnectSocket()
  }, [])

  const login = (teacherData, token, url) => {
    const nextUrl = (url || serverUrl).replace(/\/$/, '')
    localStorage.setItem('nexclass_teacher_token', token)
    localStorage.setItem('nexclass_teacher_data', JSON.stringify(teacherData))
    localStorage.setItem('nexclass_server_url', nextUrl)
    // Clear legacy session keys so they cannot bypass the new JWT guard.
    localStorage.removeItem('teacher')
    localStorage.removeItem('token')
    setServerUrl(nextUrl)
    setTeacher(teacherData)
    connectSocket(nextUrl, teacherData)
  }

  const logout = () => {
    localStorage.removeItem('nexclass_teacher_token')
    localStorage.removeItem('nexclass_teacher_data')
    localStorage.removeItem('teacher')
    localStorage.removeItem('token')
    disconnectSocket()
    setTeacher(null)
  }

  return (
    <AuthContext.Provider value={{
      teacher,
      isLoading,
      serverUrl,
      setServerUrl,
      login,
      logout,
      isAuthenticated: Boolean(teacher && localStorage.getItem('nexclass_teacher_token'))
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
