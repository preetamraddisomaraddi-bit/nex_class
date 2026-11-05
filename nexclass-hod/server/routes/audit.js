const express = require('express')
const { dbAll, dbGet } = require('../db/database')
const { requireAuth, requireRole } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { auditQuery } = require('../validation/schemas')

const router = express.Router()
router.use(requireAuth, requireRole('hod'))
router.get('/', validate(auditQuery, 'query'), (req, res) => {
  const { limit, offset } = req.query
  const total = dbGet('SELECT COUNT(*) AS count FROM audit_log').count
  const rows = dbAll(`SELECT id,actor_role,actor_id,action,target,ip,created_at
    FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset])
  res.json({ rows, total, limit, offset })
})

module.exports = router
