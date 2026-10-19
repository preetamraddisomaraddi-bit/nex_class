const express = require('express')
const { dbGet, dbAll, dbRun } = require('../db/database')
const { authenticate, allowRoles } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate)

router.post('/', allowRoles('student'), (req, res) => {
  const { room_id, status = 'present' } = req.body || {}
  const room = dbGet("SELECT * FROM rooms WHERE id=? AND status='active'", [Number(room_id)])
  if (!room) return res.status(404).json({ error: 'Room not found or session ended' })
  const student = dbGet('SELECT semester FROM students WHERE id=?', [req.user.id])
  if (!student || student.semester !== room.semester) return res.status(403).json({ error: 'Student is not in this room semester' })
  if (!['present', 'late'].includes(status)) return res.status(400).json({ error: 'Invalid attendance status' })
  dbRun(`INSERT INTO attendance (student_id,room_id,status) VALUES (?,?,?)
    ON CONFLICT(student_id,room_id) DO UPDATE SET status=excluded.status`, [req.user.id, room.id, status])
  res.json({ message: 'Attendance marked' })
})
router.get('/student/:id', (req, res) => {
  const id = Number(req.params.id)
  if (req.user.role !== 'hod' && !(req.user.role === 'student' && req.user.id === id)) return res.status(403).json({ error: 'Forbidden' })
  res.json(dbAll(`SELECT a.*,r.subject,r.code AS room_code,r.created_at AS session_date,t.name AS teacher_name
    FROM attendance a JOIN rooms r ON a.room_id=r.id LEFT JOIN teachers t ON r.teacher_id=t.id
    WHERE a.student_id=? ORDER BY r.created_at DESC`, [id]))
})
router.get('/summary', allowRoles('hod'), (_req, res) => {
  res.json(dbAll(`SELECT s.semester, COUNT(DISTINCT a.student_id) AS students,
    COUNT(DISTINCT a.room_id) AS sessions,
    SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
    COUNT(a.id) AS total_records FROM attendance a JOIN students s ON s.id=a.student_id
    GROUP BY s.semester ORDER BY s.semester`))
})
module.exports = router
