const DEFAULT_HOD_SERVER_URL = 'http://localhost:3000'

export const getHODServerURL = async () => {
  const savedUrl = window.localStorage.getItem('nexclass_server_url')
  if (savedUrl) return savedUrl.replace(/\/$/, '')
  const serverInfo = await window.electronAPI?.getServerInfo?.().catch?.(() => null)
  return `${serverInfo?.protocol || 'http'}://localhost:${serverInfo?.port || new URL(DEFAULT_HOD_SERVER_URL).port}`
}

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = window.localStorage.getItem('nexclass_token')
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  let serverUrl = DEFAULT_HOD_SERVER_URL
  try {
    serverUrl = await getHODServerURL()
    response = await fetch(`${serverUrl}/api${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error(`Cannot reach the HOD server at ${serverUrl}. Make sure the HOD app is running.`)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.status = response.status
    error.code = data.code
    throw error
  }
  return data
}

// Small page-level helpers keep the server contract in one place. Responses
// are returned directly (the API uses fetch, not an Axios response wrapper).
export const getTeachers = () => apiRequest('/teachers')
export const getTeacherDetail = id => apiRequest(`/teachers/${id}`)
export const getStudents = () => apiRequest('/students')
export const getStudentProfile = id => apiRequest(`/students/${id}`)
export const getRooms = () => apiRequest('/rooms')
export const getRoomDetail = code => apiRequest(`/rooms/${encodeURIComponent(code)}`)
export const getAttendanceSummary = () => apiRequest('/attendance/summary')
export const sendAlert = data => apiRequest('/alerts', { method: 'POST', body: data })
export const getAudit = (limit = 50, offset = 0) => apiRequest(`/audit?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`)
