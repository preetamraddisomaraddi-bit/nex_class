const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { dbGet, dbAll, dbRun } = require('../db/database');

const JWT_SECRET = 'edusync_secret_key_2024';

router.post('/create', async (req, res) => {
  try {
    const { teacher_id, subject, class_name, topic, department_id, semester_id } = req.body;
    if (!teacher_id || !subject || !class_name)
      return res.status(400).json({ error: 'teacher_id, subject, class_name required' });
    
    // Fetch teacher university/dept for automatic inheritance
    const teacher = await dbGet('SELECT university_id, department_id FROM teachers WHERE id = ?', [teacher_id]);
    const university_id = teacher ? teacher.university_id : null;
    const final_dept_id = department_id || (teacher ? teacher.department_id : null);

    const code = uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
    const result = await dbRun(
      'INSERT INTO rooms (code, teacher_id, subject, class_name, topic, university_id, department_id, semester_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [code, teacher_id, subject, class_name, topic || '', university_id, final_dept_id, semester_id || null]
    );
    const room = await dbGet('SELECT * FROM rooms WHERE id = ?', [result.lastID]);
    res.json({ room });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/teacher/:teacher_id', async (req, res) => {
  try {
    const rooms = await dbAll('SELECT * FROM rooms WHERE teacher_id = ? ORDER BY started_at DESC', [req.params.teacher_id]);
    res.json({ rooms });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:code/students', async (req, res) => {
  try {
    const room = await dbGet('SELECT id FROM rooms WHERE code = ?', [req.params.code.toUpperCase()]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const students = await dbAll(
      `SELECT s.id, s.name, s.roll_no, s.class_section, s.avatar_color, a.status as attendance_status, a.joined_at
       FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.room_id = ? ORDER BY s.roll_no ASC`,
      [room.id]
    );
    res.json({ students });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:code', async (req, res) => {
  try {
    const roomCode = req.params.code.toUpperCase();
    const room = await dbGet(
      `SELECT r.*, t.name as teacher_name FROM rooms r JOIN teachers t ON r.teacher_id = t.id WHERE r.code = ? AND r.status = 'active'`,
      [roomCode]
    );
    if (!room) return res.status(404).json({ error: 'Room not found or already ended' });

    // Validate student department & semester if token exists
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.role === 'student') {
          const student = await dbGet(
            `SELECT s.id, s.department_id, s.semester_id, d.name as department_name, sem.number as semester_number
             FROM students s
             LEFT JOIN departments d ON s.department_id = d.id
             LEFT JOIN semesters sem ON s.semester_id = sem.id
             WHERE s.id = ?`,
            [decoded.id]
          );
          if (student) {
            if (room.department_id && student.department_id && room.department_id !== student.department_id) {
              const roomDept = await dbGet('SELECT name FROM departments WHERE id = ?', [room.department_id]);
              return res.status(403).json({
                error: `This session belongs to ${roomDept ? roomDept.name : 'another department'}. You are enrolled in ${student.department_name || 'a different department'}.`
              });
            }
            if (room.semester_id && student.semester_id && room.semester_id !== student.semester_id) {
              const semNumber = await dbGet('SELECT number FROM semesters WHERE id = ?', [room.semester_id]);
              return res.status(403).json({
                error: `This session is for Semester ${semNumber ? semNumber.number : room.semester_id}. You are in Semester ${student.semester_number || 'a different semester'}.`
              });
            }
          }
        }
      } catch (e) {
        // Continue if JWT fails or is legacy
      }
    }

    res.json({ room });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:code/end', async (req, res) => {
  try {
    await dbRun("UPDATE rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE code = ?", [req.params.code.toUpperCase()]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
