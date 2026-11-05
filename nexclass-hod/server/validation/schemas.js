const { z } = require('zod')

const trimmed = (min, max, label) => z.string().trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`)
const identity = label => z.string().trim().min(3, `${label} must be at least 3 characters`).max(30, `${label} must be at most 30 characters`).regex(/^[A-Za-z0-9_-]+$/, `${label} may contain only letters, numbers, hyphens and underscores`)
const email = z.string().trim().email('Enter a valid email address').max(254, 'Email must be at most 254 characters')
const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters').refine(value => /[A-Za-z]/.test(value) && /\d/.test(value), 'Password must contain a letter and a number')
const semester = z.coerce.number().int('Semester must be an integer').min(1).max(8)
const positiveId = z.coerce.number().int('Must be a positive integer').positive('Must be a positive integer')
const stringLogin = z.string().max(100, 'Must be at most 100 characters')

const teacherRegister = z.object({
  name: trimmed(2, 80, 'Name'), employee_id: identity('Employee ID'), email,
  subject: z.string().trim().max(80, 'Subject must be at most 80 characters').default(''),
  semester, password,
})
const studentRegister = z.object({
  name: trimmed(2, 80, 'Name'), usn: identity('Roll number').optional(), roll_number: identity('Roll number').optional(),
  email, class_section: z.string().trim().max(20).optional().default(''), semester, password,
}).refine(data => Boolean(data.usn || data.roll_number), { path: ['roll_number'], message: 'Roll number is required' })
  .transform(data => ({ ...data, usn: data.usn || data.roll_number }))
const hodSetup = z.object({
  name: trimmed(2, 80, 'Name'), employee_id: identity('Employee ID'), email,
  department: trimmed(2, 100, 'Department'), password,
  confirm_password: z.string().min(1, 'Confirm password is required').max(72),
}).refine(data => data.password === data.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match' })
const changePassword = z.object({ current_password: z.string().min(1).max(100), new_password: password })
const passwordLogin = z.object({ password: stringLogin })
const hodLogin = passwordLogin.extend({ employee_id: stringLogin })
const teacherLogin = hodLogin
const studentLogin = passwordLogin.extend({ usn: stringLogin })
const roomCreate = z.object({ subject: trimmed(1, 100, 'Subject'), semester })
const attendanceMark = z.object({ room_id: positiveId, student_id: positiveId.optional(), status: z.enum(['present', 'late']).default('present') })
const examCreate = z.object({
  room_id: positiveId, title: trimmed(1, 120, 'Title'),
  duration_mins: z.coerce.number().int().min(1).max(300).default(30),
  questions_json: z.union([z.array(z.unknown()), z.string().max(100 * 1024)]).default([]),
})
const jsonAnswers = z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]).default([]).refine(value => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return Buffer.byteLength(text, 'utf8') <= 200 * 1024
}, 'Answers must be 200 KB or smaller')
const examSubmit = z.object({
  exam_id: positiveId, score: z.coerce.number().finite().min(0), total: z.coerce.number().finite().positive(),
  answers_json: jsonAnswers, student_id: positiveId.optional(),
}).refine(data => data.score <= data.total, { path: ['score'], message: 'Score must not exceed total' })
const alertCreate = z.object({
  teacher_id: positiveId, message: trimmed(5, 300, 'Message'),
  type: z.enum(['reminder', 'warning', 'urgent']),
})
const emptyBody = z.object({})
const idParams = name => z.object({ [name]: positiveId })
const codeParams = name => z.object({ [name]: z.string().regex(/^[A-Z0-9]{6}$/, 'Room code must be 6 uppercase letters or numbers') })
const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})

module.exports = { teacherRegister, studentRegister, hodSetup, changePassword, hodLogin, teacherLogin, studentLogin, roomCreate, attendanceMark, examCreate, examSubmit, alertCreate, emptyBody, idParams, codeParams, auditQuery }
