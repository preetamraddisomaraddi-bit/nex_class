const express = require('express')
const crypto = require('crypto')
const { dbGet, dbAll, dbRun } = require('../db/database')
const { authenticate } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate)

router.get('/', (req, res) => {
  const where = req.user.role === 'teacher' ? 'WHERE r.teacher_id=?' : ''
  const params = req.user.role === 'teacher' ? [req.user.id] : []
  if (req.user.role === 'student') {
    const student = dbGet('SELECT semester FROM students WHERE id=?', [req.user.id])
    if (!student) return res.status(401).json({ error: 'Student account not found' })
    return res.json(dbAll(`SELECT r.*, t.name AS teacher_name,
      (SELECT COUNT(*) FROM attendance a WHERE a.room_id=r.id AND a.status='present') AS students_present,
      (SELECT COUNT(*) FROM notes n WHERE n.room_id=r.id) AS notes_count,
      (SELECT COUNT(*) FROM exams e WHERE e.room_id=r.id) AS exams_count
      FROM rooms r LEFT JOIN teachers t ON t.id=r.teacher_id
      WHERE r.status='active' AND r.semester=? ORDER BY r.created_at DESC`, [student.semester]))
  }
  res.json(dbAll(`SELECT r.*, t.name AS teacher_name,
    (SELECT COUNT(*) FROM attendance a WHERE a.room_id=r.id AND a.status='present') AS students_present,
    (SELECT COUNT(*) FROM notes n WHERE n.room_id=r.id) AS notes_count,
    (SELECT COUNT(*) FROM exams e WHERE e.room_id=r.id) AS exams_count
    FROM rooms r LEFT JOIN teachers t ON t.id=r.teacher_id ${where} ORDER BY r.created_at DESC`, params))
})

router.get('/:code', (req, res) => {
  const room = dbGet(`SELECT r.*, t.name AS teacher_name FROM rooms r
    LEFT JOIN teachers t ON t.id=r.teacher_id WHERE r.code=?`, [String(req.params.code).toUpperCase()])
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (req.user.role === 'teacher' && room.teacher_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  let attendance
  if (req.user.role === 'student') {
    const student = dbGet('SELECT semester FROM students WHERE id=?', [req.user.id])
    if (!student || student.semester !== room.semester) return res.status(403).json({ error: 'Forbidden' })
    attendance = dbAll(`SELECT a.*, s.name, s.usn FROM attendance a
      JOIN students s ON s.id=a.student_id WHERE a.room_id=? AND a.student_id=?`, [room.id, req.user.id])
  } else {
    attendance = dbAll(`SELECT a.*, s.name, s.usn FROM attendance a JOIN students s ON s.id=a.student_id WHERE a.room_id=?`, [room.id])
  }
  const notes = dbAll('SELECT id, room_id, content, pushed_at FROM notes WHERE room_id=? ORDER BY pushed_at', [room.id])
  const exams = dbAll(`SELECT e.id,e.room_id,e.title,e.duration_mins,e.launched_at,
    AVG(100.0*es.score/NULLIF(es.total,0)) AS avg_score, COUNT(es.id) AS submissions
    FROM exams e LEFT JOIN exam_scores es ON es.exam_id=e.id WHERE e.room_id=? GROUP BY e.id`, [room.id])
  res.json({ ...room, attendance, notes, exams })
})

router.post('/', (req, res) => {
  const { subject, semester } = req.body || {}
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Only teachers can create rooms' })
  if (!subject || !Number.isInteger(Number(semester))) return res.status(400).json({ error: 'Subject and semester are required' })
  const teacher = dbGet('SELECT status, semester FROM teachers WHERE id=?', [req.user.id])
  if (!teacher || teacher.status !== 'approved') return res.status(403).json({ error: 'Approved teacher account required' })
  if (teacher.semester && teacher.semester !== Number(semester)) return res.status(403).json({ error: 'You can only create a room for your assigned semester' })
  let code
  do { code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase() } while (dbGet('SELECT id FROM rooms WHERE code=?', [code]))
  const result = dbRun('INSERT INTO rooms (code,subject,teacher_id,semester) VALUES (?,?,?,?)', [code, String(subject).trim(), req.user.id, Number(semester)])
  res.status(201).json(dbGet('SELECT * FROM rooms WHERE id=?', [result.lastInsertRowid]))
})

router.patch('/:code/end', (req, res) => {
  const room = dbGet('SELECT * FROM rooms WHERE code=?', [String(req.params.code).toUpperCase()])
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (req.user.role !== 'hod' && !(req.user.role === 'teacher' && room.teacher_id === req.user.id)) return res.status(403).json({ error: 'Forbidden' })
  dbRun("UPDATE rooms SET status='completed', ended_at=CURRENT_TIMESTAMP WHERE id=?", [room.id])
  res.json({ message: 'Session ended' })
})
module.exports = router
