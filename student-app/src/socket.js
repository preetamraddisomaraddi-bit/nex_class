import { io } from 'socket.io-client'

let socket = null
let socketUrl = null
let socketToken = null
let activeStudent = null
let activeRoomCode = null
let heartbeatInterval = null
let heartbeatData = null

export const getSocket = () => socket

export const connectSocket = (serverUrl, studentData) => {
  const url = (serverUrl || localStorage.getItem('nexclass_server_url') || 'http://localhost:3000').replace(/\/$/, '')
  const token = localStorage.getItem('nexclass_student_token')
  if (!token) return null

  if (socket && (socketUrl !== url || socketToken !== token)) disconnectSocket()
  if (socket) {
    activeStudent = studentData || activeStudent
    return socket
  }

  socketUrl = url
  socketToken = token
  activeStudent = studentData || activeStudent
  socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000
  })

  socket.on('connect', () => {
    console.info('Connected to HOD server')
    if (activeStudent && activeRoomCode) emitRoomJoin()
  })
  socket.on('connect_error', error => {
    console.error('HOD socket connection error:', error.message)
    if (error?.message === 'Authentication failed') {
      localStorage.removeItem('nexclass_student_token')
      localStorage.removeItem('nexclass_student_data')
      disconnectSocket()
      window.dispatchEvent(new CustomEvent('nexclass-auth-failed'))
    }
  })
  socket.on('disconnect', reason => console.info('Disconnected from HOD server:', reason))
  socket.on('hod:alert', data => window.dispatchEvent(new CustomEvent('hod-alert', { detail: data })))
  window.__socket = socket
  return socket
}

export const disconnectSocket = () => {
  stopHeartbeat()
  if (socket) socket.disconnect()
  socket = null
  socketUrl = null
  socketToken = null
  activeStudent = null
  activeRoomCode = null
  window.__socket = null
}

const emitRoomJoin = () => {
  if (!socket?.connected || !activeStudent || !activeRoomCode) return
  // Match the server's room:join contract so the student receives live
  // exam launches and server-confirmed submission events for this room.
  socket.emit('room:join', {
    room_code: activeRoomCode,
    user: { ...activeStudent, role: 'student' }
  })
}

export const joinRoom = (studentData, roomCode) => {
  const normalizedCode = String(roomCode || '').toUpperCase()
  const isSameRoom = activeRoomCode === normalizedCode && activeStudent?.id === studentData?.id
  activeStudent = studentData
  activeRoomCode = normalizedCode
  if (isSameRoom) return
  if (!isSameRoom) emitRoomJoin()
}

export const leaveRoom = roomCode => {
  const code = String(roomCode || activeRoomCode || '').toUpperCase()
  if (code === activeRoomCode) activeRoomCode = null
  stopHeartbeat()
}

export const startHeartbeat = (studentData, roomCode, status = 'focused') => {
  stopHeartbeat()
  heartbeatData = { student_id: studentData.id, name: studentData.name, room_code: String(roomCode || '').toUpperCase(), status }
  const send = () => socket?.emit('student:heartbeat', { ...heartbeatData, status: document.hasFocus() ? 'focused' : 'unfocused', timestamp: new Date().toISOString() })
  send()
  heartbeatInterval = setInterval(send, 30000)
}

export const stopHeartbeat = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  heartbeatInterval = null
  heartbeatData = null
}

export const emitForceClose = data => socket?.emit('student:force-close', data)
