const express = require('express')
const { dbGet, dbRun } = require('../db/database')
const { authenticate } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate)

router.post('/', (req, res) => {
  const { room_id, title, duration_mins = 30, questions_json = [] } = req.body || {}
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Only teachers can create exams' })
  if (!room_id || !title) return res.status(400).json({ error: 'Room and exam title are required' })
  const room = dbGet("SELECT * FROM rooms WHERE id=? AND teacher_id=? AND status='active'", [Number(room_id), req.user.id])
  if (!room) return res.status(404).json({ error: 'Active room not found' })
  let questions
  try { questions = typeof questions_json === 'string' ? JSON.parse(questions_json) : questions_json } catch { return res.status(400).json({ error: 'questions_json must be valid JSON' }) }
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions_json must be an array' })
  const duration = Number(duration_mins)
  if (!Number.isInteger(duration) || duration < 1 || duration > 300) return res.status(400).json({ error: 'Exam duration must be between 1 and 300 minutes' })
  const result = dbRun('INSERT INTO exams (room_id,title,duration_mins,questions_json) VALUES (?,?,?,?)', [room.id, String(title).trim(), duration, JSON.stringify(questions)])
  res.status(201).json({ exam_id: result.lastInsertRowid, message: 'Exam created' })
})

router.get('/:id', (req, res) => {
  const exam = dbGet(`SELECT e.*,r.teacher_id,r.semester FROM exams e JOIN rooms r ON r.id=e.room_id WHERE e.id=?`, [Number(req.params.id)])
  if (!exam) return res.status(404).json({ error: 'Exam not found' })
  if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  if (req.user.role === 'student') {
    const student = dbGet('SELECT semester FROM students WHERE id=?', [req.user.id])
    if (!student || student.semester !== exam.semester) return res.status(403).json({ error: 'Forbidden' })
  }
  const { teacher_id, semester, ...safeExam } = exam
  try { safeExam.questions_json = JSON.parse(safeExam.questions_json || '[]') } catch { safeExam.questions_json = [] }
  if (req.user.role === 'student' && Array.isArray(safeExam.questions_json)) {
    safeExam.questions_json = safeExam.questions_json.map((question) => {
      if (!question || typeof question !== 'object') return question
      const { answer, correctAnswer, correct_answer, solution, ...studentQuestion } = question
      return studentQuestion
    })
  }
  res.json(safeExam)
})
module.exports = router
