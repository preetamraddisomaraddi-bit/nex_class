import axios from 'axios'

export const getBaseURL = () =>
  (localStorage.getItem('nexclass_server_url') || 'http://localhost:3000').replace(/\/$/, '')

const api = axios.create({
  baseURL: `${getBaseURL()}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  config.baseURL = `${getBaseURL()}/api`
  const token = localStorage.getItem('nexclass_student_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexclass_student_token')
      localStorage.removeItem('nexclass_student_data')
      localStorage.removeItem('student')
      localStorage.removeItem('token')
      if (window.location.hash !== '#/login') window.location.hash = '#/login'
    }
    return Promise.reject(error)
  }
)

export const getAPI = () => api

export const registerStudent = data => api.post('/auth/student/register', data)
export const loginStudent = data => api.post('/auth/student/login', data)
export const getRoom = code => api.get(`/rooms/${encodeURIComponent(code)}`)
export const markAttendance = data => api.post('/attendance', data)
export const submitScore = data => api.post('/scores', data)
export const getMyScores = studentId => api.get(`/scores/student/${studentId}`)
export const getMyAttendance = studentId => api.get(`/attendance/student/${studentId}`)
export const getMyProfile = studentId => api.get(`/students/${studentId}`)
export const getExam = examId => api.get(`/exams/${examId}`)

export const checkServer = url =>
  axios.get(`${url.replace(/\/$/, '')}/health`, { timeout: 5000 })

export const discoverServer = async url => {
  const response = await axios.get(`${url.replace(/\/$/, '')}/discover`, { timeout: 5000 })
  if (response.data?.type !== 'nexclass-hod-server') {
    const error = new Error('The address did not respond as a NexClass HOD server.')
    error.code = 'INVALID_HOD_SERVER'
    throw error
  }
  return response
}

export default api
