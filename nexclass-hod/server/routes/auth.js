const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { dbGet, dbRun, writeAudit } = require('../db/database')
const { JWT_SECRET, JWT_EXPIRES } = require('../config')
const { requireAuth, requireRole } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { hodLogin, teacherLogin, teacherRegister, studentRegister, studentLogin, changePassword } = require('../validation/schemas')
const { requireWritable, requireSeat } = require('../middleware/license')

const router = express.Router()
const clean = ({ password_hash, ...record }) => record
const makeToken = user => jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES })
const badCredentials = res => res.status(401).json({ error: 'Invalid credentials' })
const ip = req => req.ip || req.socket?.remoteAddress || ''
const lockout = res => res.status(429).json({ error: 'Too many attempts. Try again later.' })
function loginFailure(req, role, record, identifier) {
  writeAudit({ role, actorId: record?.id ?? null, action: 'login_failure', target: record ? `${role}:${record.id}` : `${role}:${identifier}`, ip: ip(req) })
}
function recordBadPassword(req, res, role, record, identifier) {
  loginFailure(req, role, record, identifier)
  if (!record) return badCredentials(res)
  const attempts = Number(record.failed_attempts || 0) + 1
  if (attempts >= 5) {
    dbRun("UPDATE " + roleTable(role) + " SET failed_attempts=0, locked_until=datetime('now','+15 minutes') WHERE id=?", [record.id])
    writeAudit({ role, actorId: record.id, action: 'account_lockout', target: `${role}:${record.id}`, ip: ip(req) })
    return lockout(res)
  }
  dbRun(`UPDATE ${roleTable(role)} SET failed_attempts=? WHERE id=?`, [attempts, record.id])
  return badCredentials(res)
}
function roleTable(role) { return ({ hod: 'hod', teacher: 'teachers', student: 'students' })[role] }
function isLocked(record) { return record?.locked_until && Date.parse(record.locked_until.replace(' ', 'T') + (record.locked_until.includes('Z') ? '' : 'Z')) > Date.now() }
function resetLoginFailures(role, record) { if (Number(record.failed_attempts || 0) || record.locked_until) dbRun(`UPDATE ${roleTable(role)} SET failed_attempts=0,locked_until=NULL WHERE id=?`, [record.id]) }

router.post('/hod/login', validate(hodLogin), (req, res) => {
  const { employee_id, password } = req.body || {}
  const hod = dbGet('SELECT * FROM hod WHERE employee_id = ?', [String(employee_id).trim()])
  if (isLocked(hod)) { loginFailure(req, 'hod', hod, employee_id); return lockout(res) }
  if (!hod || !bcrypt.compareSync(String(password), hod.password_hash)) return recordBadPassword(req, res, 'hod', hod, employee_id)
  resetLoginFailures('hod', hod)
  writeAudit({ role: 'hod', actorId: hod.id, action: 'login_success', target: `hod:${hod.id}`, ip: ip(req) })
  res.json({ token: makeToken({ id: hod.id, role: 'hod', employee_id: hod.employee_id, auth_version: hod.auth_version }), hod: clean(hod) })
})

router.post('/hod/change-password', requireAuth, requireRole('hod'), validate(changePassword), (req, res) => {
  const { current_password, new_password } = req.body || {}
  const hod = dbGet('SELECT * FROM hod WHERE id=?', [req.user.id])
  if (!hod || !bcrypt.compareSync(String(current_password || ''), hod.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }
  const password = new_password
  dbRun('UPDATE hod SET password_hash=?, auth_version=auth_version+1 WHERE id=?', [bcrypt.hashSync(password, 12), req.user.id])
  const updated = dbGet('SELECT * FROM hod WHERE id=?', [req.user.id])
  writeAudit({ role: 'hod', actorId: req.user.id, action: 'password_change', target: `hod:${req.user.id}`, ip: ip(req) })
  return res.json({
    message: 'Password changed successfully',
    token: makeToken({ id: updated.id, role: 'hod', employee_id: updated.employee_id, auth_version: updated.auth_version }),
  })
})

router.post('/teacher/register', requireWritable, validate(teacherRegister), (req, res) => {
  const { name, employee_id, email = '', password, subject = '', semester } = req.body || {}
  if (!name || !employee_id || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'Name, employee ID and a password of at least 8 characters are required' })
  }
  try {
    const result = dbRun(`INSERT INTO teachers
      (name, employee_id, email, password_hash, subject, semester)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [String(name).trim(), String(employee_id).trim(), String(email).trim(), bcrypt.hashSync(String(password), 12), String(subject), Number(semester) || null])
    res.status(201).json({ message: 'Registration successful. Awaiting HOD approval.', teacher_id: result.lastInsertRowid })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Teacher with this employee ID already exists' })
    throw error
  }
})

router.post('/teacher/login', validate(teacherLogin), (req, res) => {
  const { employee_id, password } = req.body || {}
  const teacher = dbGet('SELECT * FROM teachers WHERE employee_id = ?', [String(employee_id).trim()])
  if (isLocked(teacher)) { loginFailure(req, 'teacher', teacher, employee_id); return lockout(res) }
  if (!teacher || !bcrypt.compareSync(String(password), teacher.password_hash)) return recordBadPassword(req, res, 'teacher', teacher, employee_id)
  resetLoginFailures('teacher', teacher)
  if (teacher.status !== 'approved') {
    loginFailure(req, 'teacher', teacher, employee_id)
    return res.status(403).json({ error: teacher.status === 'pending' ? 'Your account is pending HOD approval' : 'Your registration has been rejected' })
  }
  writeAudit({ role: 'teacher', actorId: teacher.id, action: 'login_success', target: `teacher:${teacher.id}`, ip: ip(req) })
  res.json({ token: makeToken({ id: teacher.id, role: 'teacher', employee_id: teacher.employee_id }), teacher: clean(teacher) })
})

router.post('/student/register', requireWritable, requireSeat('student'), validate(studentRegister), (req, res) => {
  const { name, usn, email = '', password, semester } = req.body || {}
  if (!name || !usn || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'Name, USN and a password of at least 8 characters are required' })
  }
  try {
    const result = dbRun(`INSERT INTO students (name, usn, email, password_hash, semester)
      VALUES (?, ?, ?, ?, ?)`,
    [String(name).trim(), String(usn).trim().toUpperCase(), String(email).trim(), bcrypt.hashSync(String(password), 12), Number(semester) || null])
    res.status(201).json({ message: 'Registration successful', student_id: result.lastInsertRowid })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Student with this USN already exists' })
    throw error
  }
})

router.post('/student/login', validate(studentLogin), (req, res) => {
  const { usn, password } = req.body || {}
  const student = dbGet('SELECT * FROM students WHERE usn = ?', [String(usn).trim().toUpperCase()])
  if (isLocked(student)) { loginFailure(req, 'student', student, usn); return lockout(res) }
  if (!student || !bcrypt.compareSync(String(password), student.password_hash)) return recordBadPassword(req, res, 'student', student, usn)
  resetLoginFailures('student', student)
  writeAudit({ role: 'student', actorId: student.id, action: 'login_success', target: `student:${student.id}`, ip: ip(req) })
  res.json({ token: makeToken({ id: student.id, role: 'student', usn: student.usn }), student: clean(student) })
})

module.exports = router
