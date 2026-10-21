const express = require('express')
const { dbGet, dbAll } = require('../db/database')
const { authenticate, allowRoles } = require('../middleware/auth')
const router = express.Router()
const publicStudent = (row) => { if (!row) return row; const { password_hash, ...safe } = row; return safe }

router.use(authenticate)
router.get('/', allowRoles('hod'), (req, res) => {
  const params = []
  let where = ''
  if (req.query.semester) { where = 'WHERE s.semester=?'; params.push(Number(req.query.semester)) }
  const list = dbAll(`SELECT s.id, s.name, s.usn, s.email, s.semester, s.created_at,
    (SELECT COUNT(*) FROM attendance a WHERE a.student_id=s.id AND a.status='present') AS classes_attended,
    (SELECT AVG(100.0 * es.score / NULLIF(es.total,0)) FROM exam_scores es WHERE es.student_id=s.id) AS avg_score,
    (SELECT MAX(100.0 * es.score / NULLIF(es.total,0)) FROM exam_scores es WHERE es.student_id=s.id) AS best_exam_score,
    (SELECT COUNT(*) FROM code_submissions cs WHERE cs.student_id=s.id) AS code_submissions
    FROM students s ${where} ORDER BY s.name`, params)
  res.json(list)
})
router.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (req.user.role !== 'hod' && !(req.user.role === 'student' && req.user.id === id)) return res.status(403).json({ error: 'Forbidden' })
  const student = dbGet('SELECT * FROM students WHERE id=?', [id])
  if (!student) return res.status(404).json({ error: 'Student not found' })
  const attendance = dbAll(`SELECT a.*, r.subject, r.code AS room_code, r.created_at AS date, t.name AS teacher_name
    FROM attendance a JOIN rooms r ON a.room_id=r.id LEFT JOIN teachers t ON r.teacher_id=t.id
    WHERE a.student_id=? ORDER BY r.created_at DESC`, [id])
  const scores = dbAll(`SELECT es.*, e.title, r.subject, e.launched_at AS date
    FROM exam_scores es JOIN exams e ON es.exam_id=e.id JOIN rooms r ON e.room_id=r.id
    WHERE es.student_id=? ORDER BY es.submitted_at DESC`, [id])
  const codeCount = dbGet('SELECT COUNT(*) AS count FROM code_submissions WHERE student_id=?', [id])
  res.json({ ...publicStudent(student), attendance, scores, code_submissions: codeCount.count })
})
module.exports = router
