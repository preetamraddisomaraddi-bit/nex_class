import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { connectSocket, disconnectSocket } from '../socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serverUrl, setServerUrlState] = useState(
    localStorage.getItem('nexclass_server_url') || 'http://localhost:3000'
  )

  const setServerUrl = value => {
    const normalized = String(value || '').trim().replace(/\/$/, '')
    setServerUrlState(normalized)
    localStorage.setItem('nexclass_server_url', normalized)
  }

  useEffect(() => {
    const token = localStorage.getItem('nexclass_student_token')
    const saved = localStorage.getItem('nexclass_student_data')
    if (token && saved) {
      try {
        const user = JSON.parse(saved)
        setStudent(user)
        connectSocket(serverUrl, user)
      } catch {
        localStorage.removeItem('nexclass_student_token')
        localStorage.removeItem('nexclass_student_data')
      }
    }
    setIsLoading(false)
    return () => disconnectSocket()
  }, [])

  const login = (user, token, url) => {
    const normalizedUrl = String(url || serverUrl).trim().replace(/\/$/, '')
    localStorage.setItem('nexclass_student_token', token)
    localStorage.setItem('nexclass_student_data', JSON.stringify(user))
    localStorage.setItem('nexclass_server_url', normalizedUrl)
    localStorage.removeItem('student')
    localStorage.removeItem('token')
    setServerUrlState(normalizedUrl)
    setStudent(user)
    connectSocket(normalizedUrl, user)
  }

  const logout = () => {
    localStorage.removeItem('nexclass_student_token')
    localStorage.removeItem('nexclass_student_data')
    localStorage.removeItem('student')
    localStorage.removeItem('token')
    disconnectSocket()
    setStudent(null)
  }

  const value = useMemo(() => ({
    student,
    isLoading,
    serverUrl,
    setServerUrl,
    login,
    logout,
    isAuthenticated: Boolean(student && localStorage.getItem('nexclass_student_token'))
  }), [student, isLoading, serverUrl])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
