import axios from 'axios'

export const getBaseURL = () =>
  (localStorage.getItem('nexclass_server_url') || 'http://localhost:3000').replace(/\/$/, '')

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  config.baseURL = getBaseURL()
  const token = localStorage.getItem('nexclass_teacher_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    const isAuthRequest = /\/api\/auth\/teacher\/(login|register)$/.test(error.config?.url || '')
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('nexclass_teacher_token')
      localStorage.removeItem('nexclass_teacher_data')
      localStorage.removeItem('teacher')
      localStorage.removeItem('token')
      window.location.hash = '#/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const registerTeacher = data => api.post('/api/auth/teacher/register', data)
export const loginTeacher = data => api.post('/api/auth/teacher/login', data)

// Rooms
export const createRoom = data => api.post('/api/rooms', data)
export const endRoom = code => api.patch(`/api/rooms/${encodeURIComponent(code)}/end`)
export const getRoomDetail = code => api.get(`/api/rooms/${encodeURIComponent(code)}`)

// Exams and scores
export const createExam = data => api.post('/api/exam/create', {
  ...data,
  questions: data.questions || data.questions_json
})
export const getExam = examId => api.get(`/api/exam/${examId}`)
export const getRoomExams = roomId => api.get(`/api/exam/room/${roomId}`)
export const launchExam = examId => api.patch(`/api/exam/${examId}/launch`)
export const getExamScores = examId => api.get(`/api/exam/${examId}/results`)
export const gradeExamSubmission = (examId, submissionId, data) =>
  api.patch(`/api/exam/${examId}/submissions/${submissionId}/grade`, data)
export const getCodeSubmissions = roomId => api.get(`/api/code/room/${roomId}`)
export const reviewCodeSubmission = (submissionId, data) =>
  api.patch(`/api/code/${submissionId}/review`, data)

// Existing pages use this accessor; it now points at the HOD server API.
export const getAPI = () => api

export const checkServer = url => axios.get(`${url.replace(/\/$/, '')}/health`, { timeout: 5000 })
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
