const express = require('express')
const { dbGet, dbAll, dbRun } = require('../db/database')
const { requireAuth, requireRole } = require('../middleware/auth')
const { validate, validateIdParam } = require('../middleware/validate')
const { emptyBody } = require('../validation/schemas')
const { writeAudit } = require('../db/database')
const { requireWritable, requireSeat } = require('../middleware/license')
const router = express.Router()
const publicTeacher = (row) => { if (!row) return row; const { password_hash, ...safe } = row; return safe }

router.use(requireAuth)
router.param('id', validateIdParam('id'))
router.get('/', requireRole('hod'), (_req, res) => {
  const teachers = dbAll(`SELECT t.id, t.name, t.employee_id, t.email, t.subject,
    t.semester, t.status, t.created_at,
    COUNT(DISTINCT r.id) AS total_classes, MAX(r.created_at) AS last_active
    FROM teachers t LEFT JOIN rooms r ON r.teacher_id = t.id
    GROUP BY t.id ORDER BY t.created_at DESC`)
  res.json(teachers)
})

router.get('/:id', (req, res) => {
  if (req.user.role !== 'hod') return res.status(403).json({ error: 'Forbidden' })
  const id = Number(req.params.id)
  const teacher = dbGet('SELECT * FROM teachers WHERE id = ?', [id])
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' })
  const sessions = dbAll(`SELECT r.*, COUNT(DISTINCT a.student_id) AS students_present,
    COUNT(DISTINCT n.id) AS notes_count, COUNT(DISTINCT e.id) AS exams_count
    FROM rooms r LEFT JOIN attendance a ON a.room_id=r.id
    LEFT JOIN notes n ON n.room_id=r.id LEFT JOIN exams e ON e.room_id=r.id
    WHERE r.teacher_id=? GROUP BY r.id ORDER BY r.created_at DESC LIMIT 10`, [id])
  const exams = dbAll(`SELECT e.id, e.title, e.duration_mins, e.launched_at,
    AVG(100.0 * es.score / NULLIF(es.total, 0)) AS avg_score, COUNT(es.id) AS total_students
    FROM exams e JOIN rooms r ON e.room_id=r.id LEFT JOIN exam_scores es ON es.exam_id=e.id
    WHERE r.teacher_id=? GROUP BY e.id ORDER BY e.launched_at DESC`, [id])
  res.json({ ...publicTeacher(teacher), sessions, exams })
})

router.patch('/:id/approve', requireRole('hod'), requireWritable, requireSeat('teacher'), validate(emptyBody), (req, res) => {
  const result = dbRun("UPDATE teachers SET status='approved' WHERE id=?", [Number(req.params.id)])
  if (!result.changes) return res.status(404).json({ error: 'Teacher not found' })
  writeAudit({ role: 'hod', actorId: req.user.id, action: 'teacher_approve', target: `teacher:${req.params.id}`, ip: req.ip })
  res.json({ message: 'Teacher approved', teacher: publicTeacher(dbGet('SELECT * FROM teachers WHERE id=?', [Number(req.params.id)])) })
})
router.patch('/:id/reject', requireRole('hod'), validate(emptyBody), (req, res) => {
  const result = dbRun("UPDATE teachers SET status='rejected' WHERE id=?", [Number(req.params.id)])
  if (!result.changes) return res.status(404).json({ error: 'Teacher not found' })
  writeAudit({ role: 'hod', actorId: req.user.id, action: 'teacher_reject', target: `teacher:${req.params.id}`, ip: req.ip })
  res.json({ message: 'Teacher rejected' })
})
router.delete('/:id', requireRole('hod'), validate(emptyBody), (req, res) => {
  const result = dbRun('DELETE FROM teachers WHERE id=?', [Number(req.params.id)])
  if (!result.changes) return res.status(404).json({ error: 'Teacher not found' })
  writeAudit({ role: 'hod', actorId: req.user.id, action: 'teacher_delete', target: `teacher:${req.params.id}`, ip: req.ip })
  res.json({ message: 'Teacher removed' })
})
module.exports = router
