const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { dbGet, dbRun, jwtSecret } = require('../db/database')

const router = express.Router()
const clean = ({ password_hash, ...record }) => record
const makeToken = (user) => jwt.sign(user, jwtSecret, { expiresIn: '7d' })
const badCredentials = (res) => res.status(401).json({ error: 'Invalid ID or password' })

router.post('/hod/login', (req, res) => {
  const { employee_id, password } = req.body || {}
  if (!employee_id || !password) return res.status(400).json({ error: 'Employee ID and password required' })
  const hod = dbGet('SELECT * FROM hod WHERE employee_id = ?', [String(employee_id).trim()])
  if (!hod || !bcrypt.compareSync(String(password), hod.password_hash)) return badCredentials(res)
  const profile = clean(hod)
  res.json({ token: makeToken({ id: hod.id, role: 'hod', employee_id: hod.employee_id }), hod: profile })
})

router.post('/teacher/register', (req, res) => {
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

router.post('/teacher/login', (req, res) => {
  const { employee_id, password } = req.body || {}
  if (!employee_id || !password) return res.status(400).json({ error: 'Employee ID and password required' })
  const teacher = dbGet('SELECT * FROM teachers WHERE employee_id = ?', [String(employee_id).trim()])
  if (!teacher || !bcrypt.compareSync(String(password), teacher.password_hash)) return badCredentials(res)
  if (teacher.status !== 'approved') return res.status(403).json({ error: teacher.status === 'pending' ? 'Your account is pending HOD approval' : 'Your registration has been rejected' })
  res.json({ token: makeToken({ id: teacher.id, role: 'teacher', employee_id: teacher.employee_id }), teacher: clean(teacher) })
})

router.post('/student/register', (req, res) => {
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

router.post('/student/login', (req, res) => {
  const { usn, password } = req.body || {}
  if (!usn || !password) return res.status(400).json({ error: 'USN and password required' })
  const student = dbGet('SELECT * FROM students WHERE usn = ?', [String(usn).trim().toUpperCase()])
  if (!student || !bcrypt.compareSync(String(password), student.password_hash)) return badCredentials(res)
  res.json({ token: makeToken({ id: student.id, role: 'student', usn: student.usn }), student: clean(student) })
})

module.exports = router
