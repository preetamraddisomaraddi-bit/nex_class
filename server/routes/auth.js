const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../db/database');
const { verifyAdmin } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'edusync_secret_key_2024';

// Teacher Register
router.post('/teacher/register', async (req, res) => {
  try {
    const { name, email, password, subject, university_code, department_id, employee_id } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

    const existing = await dbGet('SELECT id FROM teachers WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = bcrypt.hashSync(password, 10);

    let university_id = null;
    let status = 'approved'; // standalone teachers are auto-approved

    if (university_code) {
      const uni = await dbGet('SELECT id FROM universities WHERE code = ?', [university_code.toUpperCase().trim()]);
      if (!uni) return res.status(400).json({ error: 'University code not found' });
      university_id = uni.id;
      status = 'pending'; // needs admin approval
    }

    const result = await dbRun(
      'INSERT INTO teachers (name, email, password_hash, subject, university_id, department_id, employee_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, password_hash, subject || '', university_id, department_id || null, employee_id || null, status]
    );

    const token = jwt.sign({ id: result.lastID, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: result.lastID,
        name,
        email,
        subject,
        role: 'teacher',
        status,
        university_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher Login
router.post('/teacher/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const teacher = await dbGet('SELECT * FROM teachers WHERE email = ?', [email]);
    if (!teacher || !bcrypt.compareSync(password, teacher.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (teacher.university_id && teacher.status === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval by the University Administrator.' });
    }
    if (teacher.university_id && teacher.status === 'rejected') {
      return res.status(403).json({ error: 'Your account registration was rejected by the University Administrator.' });
    }

    const token = jwt.sign({ id: teacher.id, role: 'teacher' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject,
        role: 'teacher',
        university_id: teacher.university_id,
        department_id: teacher.department_id,
        status: teacher.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Register
router.post('/student/register', async (req, res) => {
  try {
    const { name, email, password, roll_no, class_section, university_code, department_id, semester_id, usn } = req.body;
    if (!name || !email || !password || !roll_no || !class_section) {
      return res.status(400).json({ error: 'Name, email, password, roll number, and class section are required' });
    }

    const existingEmail = await dbGet('SELECT id FROM students WHERE email = ?', [email]);
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

    let university_id = null;
    let upperUsn = null;

    if (university_code) {
      const uni = await dbGet('SELECT id FROM universities WHERE code = ?', [university_code.toUpperCase().trim()]);
      if (!uni) return res.status(400).json({ error: 'University code not found' });
      university_id = uni.id;

      if (usn) {
        upperUsn = usn.toUpperCase().trim();
        const existingUsn = await dbGet('SELECT id FROM students WHERE usn = ?', [upperUsn]);
        if (existingUsn) return res.status(409).json({ error: 'USN / University Number already registered' });
      }
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6'];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    const result = await dbRun(
      `INSERT INTO students (
        name, email, password_hash, roll_no, class_section, avatar_color, 
        university_id, department_id, semester_id, usn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, email, password_hash, roll_no, class_section, avatar_color,
        university_id, department_id || null, semester_id || null, upperUsn
      ]
    );

    const token = jwt.sign({ id: result.lastID, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: result.lastID,
        name,
        email,
        roll_no,
        class_section,
        avatar_color,
        role: 'student',
        university_id,
        department_id,
        semester_id,
        usn: upperUsn
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Login (Support both Email and USN login)
router.post('/student/login', async (req, res) => {
  try {
    const { email, usn, password } = req.body;
    if ((!email && !usn) || !password) {
      return res.status(400).json({ error: 'Email/USN and password required' });
    }

    let student;
    if (usn) {
      student = await dbGet('SELECT * FROM students WHERE usn = ?', [usn.toUpperCase().trim()]);
    } else {
      student = await dbGet('SELECT * FROM students WHERE email = ?', [email]);
    }

    if (!student || !bcrypt.compareSync(password, student.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: student.id, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        roll_no: student.roll_no,
        class_section: student.class_section,
        avatar_color: student.avatar_color,
        role: 'student',
        university_id: student.university_id,
        department_id: student.department_id,
        semester_id: student.semester_id,
        usn: student.usn
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher Approve / Reject endpoints (Admin only)
router.post('/teacher/approve/:id', verifyAdmin, async (req, res) => {
  try {
    await dbRun("UPDATE teachers SET status = 'approved' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Teacher approved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/reject/:id', verifyAdmin, async (req, res) => {
  try {
    await dbRun("UPDATE teachers SET status = 'rejected' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Teacher registration rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;