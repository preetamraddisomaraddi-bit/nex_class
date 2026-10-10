const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');
const { verifyAdmin } = require('../middleware/auth');

// POST /api/semesters
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { department_id, university_id, number, academic_year } = req.body;
    if (!department_id || !university_id || !number) {
      return res.status(400).json({ error: 'department_id, university_id, and semester number are required' });
    }

    const result = await dbRun(
      'INSERT INTO semesters (department_id, university_id, number, academic_year) VALUES (?, ?, ?, ?)',
      [department_id, university_id, parseInt(number), academic_year || '']
    );

    const sem = await dbGet('SELECT * FROM semesters WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, semester: sem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semesters/department/:dept_id
// Open to all for student registration semester listings
router.get('/department/:dept_id', async (req, res) => {
  try {
    const sems = await dbAll(
      `SELECT sem.*, 
              (SELECT COUNT(*) FROM students WHERE semester_id = sem.id) as student_count
       FROM semesters sem WHERE sem.department_id = ? ORDER BY sem.number ASC`,
      [req.params.dept_id]
    );
    res.json({ semesters: sems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/semesters/:id/students
router.get('/:id/students', async (req, res) => {
  try {
    const students = await dbAll(
      `SELECT id, name, usn, email, roll_no, avatar_color 
       FROM students WHERE semester_id = ? ORDER BY name ASC`,
      [req.params.id]
    );
    res.json({ students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/semesters/:id/assign-teacher
router.post('/:id/assign-teacher', verifyAdmin, async (req, res) => {
  try {
    const semester_id = req.params.id;
    const { teacher_id } = req.body;
    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

    // Check duplicate assignment
    const existing = await dbGet('SELECT id FROM semester_teachers WHERE semester_id = ? AND teacher_id = ?', [semester_id, teacher_id]);
    if (existing) {
      return res.status(409).json({ error: 'Teacher is already assigned to this semester' });
    }

    await dbRun(
      'INSERT INTO semester_teachers (semester_id, teacher_id) VALUES (?, ?)',
      [semester_id, teacher_id]
    );

    res.status(201).json({ success: true, message: 'Teacher assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
