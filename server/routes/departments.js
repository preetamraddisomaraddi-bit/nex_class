const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');
const { verifyAdmin } = require('../middleware/auth');

// POST /api/departments
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { university_id, name, code, hod_name } = req.body;
    if (!university_id || !name || !code) {
      return res.status(400).json({ error: 'university_id, name and code are required' });
    }

    const uppercaseCode = code.toUpperCase().trim();
    const result = await dbRun(
      'INSERT INTO departments (university_id, name, code, hod_name) VALUES (?, ?, ?, ?)',
      [university_id, name, uppercaseCode, hod_name || '']
    );

    const dept = await dbGet('SELECT * FROM departments WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/departments/university/:university_id
// Open to both admins, teachers and students for signup listings
router.get('/university/:university_id', async (req, res) => {
  try {
    const depts = await dbAll(
      `SELECT d.*, 
              (SELECT COUNT(*) FROM students WHERE department_id = d.id) as student_count,
              (SELECT COUNT(*) FROM teachers WHERE department_id = d.id) as teacher_count
       FROM departments d WHERE d.university_id = ? ORDER BY d.name ASC`,
      [req.params.university_id]
    );
    res.json({ departments: depts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/departments/:id
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { name, code, hod_name } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'name and code are required' });

    const uppercaseCode = code.toUpperCase().trim();
    await dbRun(
      'UPDATE departments SET name = ?, code = ?, hod_name = ? WHERE id = ?',
      [name, uppercaseCode, hod_name || '', req.params.id]
    );

    const updated = await dbGet('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    res.json({ success: true, department: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/departments/:id
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const deptId = req.params.id;

    // Check if students enrolled
    const studentCount = await dbGet('SELECT COUNT(*) as count FROM students WHERE department_id = ?', [deptId]);
    if (studentCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete department: students are enrolled in it' });
    }

    // Check if teachers assigned
    const teacherCount = await dbGet('SELECT COUNT(*) as count FROM teachers WHERE department_id = ?', [deptId]);
    if (teacherCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete department: teachers are assigned to it' });
    }

    await dbRun('DELETE FROM departments WHERE id = ?', [deptId]);
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
