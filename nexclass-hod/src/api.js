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
