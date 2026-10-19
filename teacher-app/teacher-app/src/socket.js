import { io } from 'socket.io-client'

let socket = null
let socketUrl = null
let socketToken = null

export const getSocket = () => socket

export const connectSocket = (serverUrl, teacherData) => {
  const url = (serverUrl || localStorage.getItem('nexclass_server_url') || 'http://localhost:3000').replace(/\/$/, '')
  const token = localStorage.getItem('nexclass_teacher_token')
  if (!token) return null

  if (socket && (socketUrl !== url || socketToken !== token)) disconnectSocket()
  if (socket) return socket

  socketUrl = url
  socketToken = token
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
    socket.emit('teacher:connect', {
      teacher_id: teacherData?.id,
      name: teacherData?.name,
      subject: teacherData?.subject,
      semester: teacherData?.semester
    })
  })

  socket.on('connect_error', error => console.error('HOD socket connection error:', error.message))
  socket.on('disconnect', reason => console.info('Disconnected from HOD server:', reason))
  socket.on('account:approved', data => {
    window.dispatchEvent(new CustomEvent('teacher-account-approved', { detail: data }))
  })
  socket.on('hod:alert', data => {
    window.dispatchEvent(new CustomEvent('hod-alert', { detail: data }))
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) socket.disconnect()
  socket = null
  socketUrl = null
  socketToken = null
}

export const emitSessionCreated = data => socket?.emit('session:created', data)
export const emitSessionEnded = data => socket?.emit('session:ended', data)
export const emitNotePushed = data => socket?.emit('note:pushed', data)
export const emitCodeBroadcast = data => socket?.emit('code:broadcast', data)
export const emitExamLaunched = data => socket?.emit('exam:launched', data)
export const emitBoardDraw = data => socket?.emit('board:draw', data)
export const emitBoardClear = data => socket?.emit('board:clear', data)
