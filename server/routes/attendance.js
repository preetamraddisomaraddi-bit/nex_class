const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../db/database');

router.post('/mark', async (req, res) => {
  try {
    const { student_id, room_id, status } = req.body;
    if (!student_id || !room_id) return res.status(400).json({ error: 'student_id and room_id required' });
    await dbRun('INSERT OR IGNORE INTO attendance (student_id, room_id, status) VALUES (?, ?, ?)', [student_id, room_id, status || 'present']);
    const record = await dbGet('SELECT * FROM attendance WHERE student_id = ? AND room_id = ?', [student_id, room_id]);
    res.json({ record });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/update', async (req, res) => {
  try {
    const { student_id, room_id, status } = req.body;
    await dbRun('UPDATE attendance SET status = ? WHERE student_id = ? AND room_id = ?', [status, student_id, room_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/room/:room_id', async (req, res) => {
  try {
    const records = await dbAll(
      `SELECT a.*, s.name, s.roll_no, s.class_section, s.avatar_color FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.room_id = ? ORDER BY s.roll_no ASC`,
      [req.params.room_id]
    );
    res.json({ records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/student/:student_id', async (req, res) => {
  try {
    const records = await dbAll(
      `SELECT a.*, r.subject, r.class_name, r.topic, r.started_at, t.name as teacher_name
       FROM attendance a JOIN rooms r ON a.room_id = r.id JOIN teachers t ON r.teacher_id = t.id
       WHERE a.student_id = ? ORDER BY a.joined_at DESC`,
      [req.params.student_id]
    );
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    res.json({ records, total, present, percentage: total ? Math.round((present / total) * 100) : 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
