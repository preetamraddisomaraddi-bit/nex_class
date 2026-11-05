const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { db, dbGet, writeAudit } = require('../db/database')
const { JWT_SECRET, JWT_EXPIRES } = require('../config')
const { validate } = require('../middleware/validate')
const { hodSetup } = require('../validation/schemas')

const router = express.Router()
const departmentCode = department => String(department).trim().split(/\s+/).filter(Boolean).map(word => word[0]).join('').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'DEPT'
const validPassword = password => password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)

router.get('/hod', (_req, res) => {
  res.json({ setupRequired: !dbGet('SELECT id FROM hod LIMIT 1') })
})

router.post('/hod', validate(hodSetup), (req, res) => {
  const { name, employee_id, email, department, password, confirm_password } = req.body || {}
  if (![name, employee_id, email, department, password, confirm_password].every(value => String(value || '').trim())) {
    return res.status(400).json({ error: 'All setup fields are required' })
  }
  const normalizedPassword = String(password)
  if (!validPassword(normalizedPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and a number' })
  }
  if (normalizedPassword !== String(confirm_password)) return res.status(400).json({ error: 'Passwords do not match' })
  if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) return res.status(400).json({ error: 'Enter a valid email address' })

  const normalized = {
    name: String(name).trim().slice(0, 120),
    employeeId: String(employee_id).trim().slice(0, 80),
    email: String(email).trim().toLowerCase().slice(0, 200),
    department: String(department).trim().slice(0, 160),
  }
  try {
    const createHod = db.transaction(() => {
      if (dbGet('SELECT id FROM hod LIMIT 1')) return false
      db.prepare(`INSERT INTO hod
        (id, name, employee_id, department, department_code, university, email, password_hash)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)`)
        .run(normalized.name, normalized.employeeId, normalized.department,
          departmentCode(normalized.department), process.env.NEXCLASS_UNIVERSITY || 'NexClass',
          normalized.email, bcrypt.hashSync(normalizedPassword, 12))
      return true
    }).immediate()

    if (!createHod) return res.status(409).json({ error: 'Department setup has already been completed' })
    const hod = dbGet('SELECT * FROM hod WHERE id=1')
    writeAudit({ role: 'hod', actorId: hod.id, action: 'hod_setup', target: `hod:${hod.id}`, ip: req.ip })
    const { password_hash, ...profile } = hod
    const token = jwt.sign({ id: hod.id, role: 'hod', employee_id: hod.employee_id, auth_version: hod.auth_version }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return res.status(201).json({ token, hod: profile })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Employee ID already exists' })
    throw error
  }
})

module.exports = router
