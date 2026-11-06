const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth')
const { dbGet, dbAll, dbRun } = require('../db/database')
const { SUPPORTED_LANGUAGES, runInSandbox } = require('../code-runner')
const { CODE_RUNNER_IMAGE } = require('../config')
const { logger } = require('../logging')

const router = express.Router()
const attempts = new Map()
const MAX_CODE_BYTES = 50 * 1024
const WINDOW_MS = 60 * 1000
const MAX_RUNS_PER_WINDOW = 6

function limitRuns(req, res, next) {
  const now = Date.now()
  const prior = (attempts.get(req.user.id) || []).filter(time => now - time < WINDOW_MS)
  if (prior.length >= MAX_RUNS_PER_WINDOW) {
    attempts.set(req.user.id, prior)
    return res.status(429).json({ error: 'Code execution limit reached. Try again in a minute.' })
  }
  prior.push(now)
  attempts.set(req.user.id, prior)
  if (attempts.size > 10000) {
    for (const [id, times] of attempts) if (!times.some(time => now - time < WINDOW_MS)) attempts.delete(id)
  }
  return next()
}

router.post('/execute', requireAuth, requireRole('student'), limitRuns, async (req, res) => {
  const code = req.body?.code
  const language = req.body?.language
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'Code is required' })
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) return res.status(413).json({ error: 'Code is too large (50 KB maximum)' })
  if (typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language)) {
    return res.status(400).json({ error: 'Choose one supported language: Python, JavaScript, Java, C or C++' })
  }

  const startedAt = Date.now()
  try {
    const result = await runInSandbox({ code, language, image: CODE_RUNNER_IMAGE })
    logger.info({ student_id: req.user.id, language, status: result.status, duration_ms: Date.now() - startedAt }, 'Student code execution completed')
    return res.status(result.status === 'runner_unavailable' ? 503 : 200).json({ ...result, duration_ms: Date.now() - startedAt })
  } catch (error) {
    logger.error({ student_id: req.user.id, language, message: error.message }, 'Student code execution failed')
    return res.status(500).json({ error: 'Code execution failed on the server' })
  }
})

router.post('/submit', requireAuth, requireRole('student'), (req, res) => {
  const { room_id, code, language } = req.body || {}
  if (!Number.isInteger(Number(room_id)) || Number(room_id) < 1 || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'room_id, code, and language are required' })
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) return res.status(413).json({ error: 'Code submission is too large' })
  if (typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language)) return res.status(400).json({ error: 'Unsupported language' })
  const room = dbGet("SELECT id,code,semester FROM rooms WHERE id=? AND status='active'", [Number(room_id)])
  const student = dbGet('SELECT id,name,usn,semester FROM students WHERE id=?', [req.user.id])
  if (!room || !student || Number(room.semester) !== Number(student.semester)) return res.status(404).json({ error: 'Active room not found for this student' })

  const output = typeof req.body.output === 'string' ? req.body.output.slice(0, MAX_CODE_BYTES) : ''
  const inserted = dbRun('INSERT INTO code_submissions(student_id,room_id,code,language,output) VALUES(?,?,?,?,?)', [req.user.id, room.id, code, language, output])
  const submission = dbGet(`SELECT cs.id,cs.student_id,cs.room_id,cs.code,cs.language,cs.output,
    cs.grade,cs.feedback,cs.status,cs.submitted_at,s.name,s.usn,r.code AS room_code
    FROM code_submissions cs JOIN students s ON s.id=cs.student_id JOIN rooms r ON r.id=cs.room_id WHERE cs.id=?`, [inserted.lastInsertRowid])
  req.app.get('io')?.to(`room:${room.code}`).emit('code:submission', submission)
  req.app.get('io')?.to('hod').emit('code:submitted', submission)
  return res.status(201).json({ id: inserted.lastInsertRowid, success: true })
})

router.get('/room/:room_id', requireAuth, requireRole('teacher'), (req, res) => {
  const roomId = Number(req.params.room_id)
  if (!Number.isInteger(roomId) || roomId < 1) return res.status(400).json({ error: 'Invalid room id' })
  const room = dbGet('SELECT id FROM rooms WHERE id=? AND teacher_id=?', [roomId, req.user.id])
  if (!room) return res.status(404).json({ error: 'Room not found for this teacher' })
  const submissions = dbAll(`SELECT cs.id,cs.student_id,cs.room_id,cs.code,cs.language,cs.output,cs.grade,cs.feedback,cs.status,cs.submitted_at,cs.graded_at,
    s.name,s.usn,r.code AS room_code FROM code_submissions cs
    JOIN students s ON s.id=cs.student_id JOIN rooms r ON r.id=cs.room_id
    WHERE cs.room_id=? ORDER BY cs.submitted_at DESC`, [room.id])
  return res.json({ submissions })
})

router.patch('/:submission_id/review', requireAuth, requireRole('teacher'), (req, res) => {
  const submissionId = Number(req.params.submission_id)
  if (!Number.isInteger(submissionId) || submissionId < 1) return res.status(400).json({ error: 'Invalid submission id' })
  const submission = dbGet(`SELECT cs.id FROM code_submissions cs JOIN rooms r ON r.id=cs.room_id
    WHERE cs.id=? AND r.teacher_id=?`, [submissionId, req.user.id])
  if (!submission) return res.status(404).json({ error: 'Code submission not found for this teacher' })
  const grade = req.body?.grade === '' || req.body?.grade == null ? null : Number(req.body.grade)
  if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 100)) return res.status(400).json({ error: 'Grade must be between 0 and 100' })
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim().slice(0, 4000) : ''
  const status = grade === null ? 'reviewed' : 'graded'
  dbRun('UPDATE code_submissions SET grade=?,feedback=?,status=?,graded_by=?,graded_at=CURRENT_TIMESTAMP WHERE id=?', [grade, feedback, status, req.user.id, submissionId])
  return res.json({ success: true, grade, feedback, status, graded_at: dbGet('SELECT graded_at FROM code_submissions WHERE id=?', [submissionId]).graded_at })
})

router.get('/student/:student_id', requireAuth, requireRole('student'), (req, res) => {
  const studentId = Number(req.params.student_id)
  if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ error: 'Invalid student id' })
  if (studentId !== req.user.id) return res.status(403).json({ error: 'Students can only view their own submissions' })
  const submissions = dbAll(`SELECT cs.id,cs.student_id,cs.room_id,cs.language,cs.grade,cs.feedback,cs.status,cs.submitted_at,cs.graded_at,r.subject,r.semester
    FROM code_submissions cs JOIN rooms r ON r.id=cs.room_id WHERE cs.student_id=? ORDER BY cs.submitted_at DESC`, [req.user.id])
  return res.json({ submissions })
})

module.exports = router
