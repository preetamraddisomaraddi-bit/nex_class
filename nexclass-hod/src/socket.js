import { io } from 'socket.io-client'

export function connectSocket(serverUrl, token, onAuthenticationFailure) {
  if (!token) return null
  const url = String(serverUrl || 'http://localhost:3000').replace(/\/$/, '')
  const socket = io(url, { auth: { token }, transports: ['websocket'] })
  socket.on('connect_error', error => {
    if (error?.message !== 'Authentication failed') return
    window.localStorage.removeItem('nexclass_token')
    window.localStorage.removeItem('nexclass_hod_data')
    socket.disconnect()
    Promise.resolve(window.electronAPI?.clearToken?.()).catch(() => {}).finally(() => {
      window.dispatchEvent(new CustomEvent('nexclass-auth-change', { detail: false }))
      onAuthenticationFailure?.()
    })
  })
  return socket
}
