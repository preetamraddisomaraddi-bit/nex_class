const DEFAULT_HOD_SERVER_URL = 'http://localhost:3000'

export const getHODServerURL = () =>
  (window.localStorage.getItem('nexclass_server_url') || DEFAULT_HOD_SERVER_URL).replace(/\/$/, '')

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = window.localStorage.getItem('nexclass_token')
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${getHODServerURL()}/api${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('Cannot reach the HOD server at http://localhost:3000. Make sure the HOD app is running.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.status = response.status
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
