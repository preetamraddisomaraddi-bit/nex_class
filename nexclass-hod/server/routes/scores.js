const express = require('express')
const { dbGet, dbAll, dbRun } = require('../db/database')
const { authenticate } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate)

router.post('/', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can submit scores' })
  const { exam_id, score, total = 100, answers_json = [] } = req.body || {}
  const exam = dbGet(`SELECT e.id,e.room_id,r.semester,r.status FROM exams e JOIN rooms r ON r.id=e.room_id WHERE e.id=?`, [Number(exam_id)])
  if (!exam) return res.status(404).json({ error: 'Exam not found' })
  if (exam.status !== 'active') return res.status(409).json({ error: 'This exam session has ended' })
  const student = dbGet('SELECT semester FROM students WHERE id=?', [req.user.id])
  if (!student || student.semester !== exam.semester) return res.status(403).json({ error: 'Student is not in this exam semester' })
  const numericScore = Number(score); const numericTotal = Number(total)
  if (!Number.isFinite(numericScore) || !Number.isFinite(numericTotal) || numericTotal <= 0 || numericScore < 0 || numericScore > numericTotal) return res.status(400).json({ error: 'Score must be between zero and the total' })
  const answers = typeof answers_json === 'string' ? answers_json : JSON.stringify(answers_json)
  dbRun(`INSERT INTO exam_scores (student_id,exam_id,score,total,answers_json) VALUES (?,?,?,?,?)
    ON CONFLICT(student_id,exam_id) DO UPDATE SET score=excluded.score,total=excluded.total,
    answers_json=excluded.answers_json,submitted_at=CURRENT_TIMESTAMP`, [req.user.id, exam.id, numericScore, numericTotal, answers])
  res.json({ message: 'Score submitted' })
})
router.get('/student/:id', (req, res) => {
  const id = Number(req.params.id)
  if (req.user.role !== 'hod' && !(req.user.role === 'student' && req.user.id === id)) return res.status(403).json({ error: 'Forbidden' })
  res.json(dbAll(`SELECT es.*,e.title,r.subject,r.code AS room_code,e.launched_at AS exam_date
    FROM exam_scores es JOIN exams e ON e.id=es.exam_id JOIN rooms r ON r.id=e.room_id
    WHERE es.student_id=? ORDER BY es.submitted_at DESC`, [id]))
})
router.get('/exam/:id', (req, res) => {
  if (!['hod', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' })
  const exam = dbGet('SELECT e.id,r.teacher_id FROM exams e JOIN rooms r ON r.id=e.room_id WHERE e.id=?', [Number(req.params.id)])
  if (!exam) return res.status(404).json({ error: 'Exam not found' })
  if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  res.json(dbAll(`SELECT es.id,es.student_id,es.exam_id,es.score,es.total,es.submitted_at,s.name,s.usn,s.semester
    FROM exam_scores es JOIN students s ON s.id=es.student_id WHERE es.exam_id=? ORDER BY es.score DESC`, [exam.id]))
})
module.exports = router
