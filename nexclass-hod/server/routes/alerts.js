const express = require('express')
const { dbGet, dbAll, dbRun } = require('../db/database')
const { authenticate, allowRoles } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

router.post('/', allowRoles('hod'), (req, res) => {
  const teacherId = Number(req.body?.teacher_id)
  const message = String(req.body?.message || '').trim().slice(0, 2000)
  const type = ['reminder', 'warning', 'urgent'].includes(req.body?.type)
    ? req.body.type
    : 'reminder'

  if (!Number.isInteger(teacherId) || teacherId < 1 || !message) {
    return res.status(400).json({ error: 'A valid teacher_id and message are required' })
  }
  const teacher = dbGet('SELECT id FROM teachers WHERE id=?', [teacherId])
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' })

  const result = dbRun('INSERT INTO alerts (teacher_id, message, type) VALUES (?, ?, ?)', [teacherId, message, type])
  const alert = dbGet('SELECT id, teacher_id, message, type, sent_at FROM alerts WHERE id=?', [result.lastInsertRowid])
  return res.status(201).json(alert)
})

router.get('/teacher/:id', (req, res) => {
  const teacherId = Number(req.params.id)
  if (req.user.role !== 'hod' && !(req.user.role === 'teacher' && req.user.id === teacherId)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  return res.json(dbAll('SELECT id, teacher_id, message, type, sent_at FROM alerts WHERE teacher_id=? ORDER BY sent_at DESC', [teacherId]))
})

module.exports = router
